import type { Application } from '../../declarations';
import { getMechanicalCaseStatus, MechanicalCaseRecord, MechanicalCaseStatus } from '../enums';
import { redisClientPath } from '../../redis';
import { elasticSearchClientPath } from './elasticsearch';

export interface ContactRelationship {
  customer_number: string;
  is_deleted: boolean;
}

export interface NotificationSubscription {
  event: string;
  type: string;
  method: string[] | string;
  cc_emails?: string[] | string;
}

export interface ContactRecord {
  email_address?: string;
  first_name?: string;
  last_name?: string;
  relationships?: ContactRelationship[];
  notification_subscription?: NotificationSubscription[] | NotificationSubscription;
}

export interface MechanicalEmailRecipient {
  email: string;
  name: string;
  ccEmails: string[];
}

export interface MechanicalEmailNotificationRequest {
  notifiable_id: string;
  email_to: string[];
  notifiable_type: string;
  application: string;
  template_id: string;
  language: string;
  subject: string;
  content: Record<string, string>;
}

export interface FnaCaseRecord extends MechanicalCaseRecord {
  id?: string;
  case_number?: string;
  status?: string;
  EventNumber?: string;
  CustomerName?: string;
  CustomerPoNumber?: string;
  Event_Address?: string;
  Event_City?: string;
  Event_State?: string;
  Event_Country?: string;
  Unit?: string;
  Driver?: string;
  DriverPhone?: string;
  ContactPhone?: string;
  ServiceProvider?: string;
  InitialTCDescription?: string;
  Complaint?: string;
  Correction?: string;
  ShipTo?: string;
  BillTo?: string;
}

const value = (input: unknown): string => input == null || input === '' ? ' ' : String(input);

const valueOr = (input: unknown, fallback: string): string => input == null || String(input).trim() === '' ? fallback : String(input);

export const NOT_AVAILABLE = 'N/A';
export const DEFAULT_DRIVER_PHONE = NOT_AVAILABLE;
export const DEFAULT_SERVICE_PROVIDER = 'Contact Michelin ONCall for information';

const display = (input: unknown): string => valueOr(input, NOT_AVAILABLE);

export const MECHANICAL_EMAIL_TEMPLATE_ID = 'mechanical_case_summary';

export function formatEasternTime(input?: string | null): string {
  const date = input ? new Date(input) : undefined;
  if (!date || Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  const formatted = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return `${formatted.replace(',', '')} EST`;
}

const normalizeCustomerNumber = (customerNumber: string): string => customerNumber.replace(/^1~/, '');

const normalizeEmail = (email?: string): string => email?.replace(/[\[\]]/g, '').replace(/^mailto:/i, '').trim().toLowerCase() ?? '';

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Cases can stay open in billing for weeks after rolling; later updates must not resend.
const idempotencyExpirationInMinutes = 60 * 24 * 60;

export function createMechanicalEmailDeliveryKey(caseNumber: string, recipientEmail: string): string {
  return `mechanical-email:${encodeURIComponent(caseNumber)}:${recipientEmail.toLowerCase()}`;
}

export function extractCcEmails(subscription: NotificationSubscription): string[] {
  const rawCcEmails = subscription.cc_emails;
  const ccEmails = Array.isArray(rawCcEmails)
    ? rawCcEmails
    : rawCcEmails ? String(rawCcEmails).split(/[,;]/) : [];

  return [...new Set(ccEmails.map(normalizeEmail).filter(isValidEmail))];
}

export function getEligibleMechanicalRecipients(
  contacts: ContactRecord[],
  customerNumber: string,
): MechanicalEmailRecipient[] {
  const normalizedCustomerNumber = normalizeCustomerNumber(customerNumber);

  return contacts.flatMap((contact) => {
    const email = normalizeEmail(contact.email_address);
    if (!isValidEmail(email)) return [];

    const hasActiveRelationship = contact.relationships?.some((relationship) => (
      normalizeCustomerNumber(relationship.customer_number) === normalizedCustomerNumber
      && relationship.is_deleted === false
    ));
    if (!hasActiveRelationship) return [];

    const subscriptions = Array.isArray(contact.notification_subscription)
      ? contact.notification_subscription
      : contact.notification_subscription ? [contact.notification_subscription] : [];
    const matchingSubscriptions = subscriptions.filter((candidate) => {
      const methods = Array.isArray(candidate.method) ? candidate.method : [candidate.method];
      return candidate.event === 'mechanical_ers'
        && candidate.type === 'case_summary'
        && methods.some((method) => method.toLowerCase() === 'email');
    });
    if (!matchingSubscriptions.length) return [];

    return [{
      email,
      name: `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim(),
      ccEmails: [...new Set(matchingSubscriptions.flatMap(extractCcEmails))],
    }];
  });
}

export function mergeMechanicalRecipients(recipients: MechanicalEmailRecipient[]): MechanicalEmailRecipient[] {
  const mergedByEmail = new Map<string, MechanicalEmailRecipient>();

  for (const recipient of recipients) {
    const existingRecipient = mergedByEmail.get(recipient.email);
    if (existingRecipient) {
      existingRecipient.ccEmails = [...new Set([...existingRecipient.ccEmails, ...recipient.ccEmails])];
    } else {
      mergedByEmail.set(recipient.email, { ...recipient, ccEmails: [...recipient.ccEmails] });
    }
  }

  const recipientEmails = new Set(mergedByEmail.keys());
  return [...mergedByEmail.values()].map((recipient) => ({
    ...recipient,
    ccEmails: recipient.ccEmails.filter((email) => email !== recipient.email && !recipientEmails.has(email)),
  }));
}

export function buildMechanicalEmailNotificationRequest(
  email: string,
  content: Record<string, string>,
): MechanicalEmailNotificationRequest {
  return {
    notifiable_id: content.case_number,
    email_to: [email],
    notifiable_type: 'email',
    application: 'michelin-oncall',
    template_id: MECHANICAL_EMAIL_TEMPLATE_ID,
    language: 'en_US',
    subject: `ONCall Summary & Feedback for Event ${content.case_number}`,
    content,
  };
}

export class MechanicalEmailService {
  constructor(private readonly app: Application) {}

  async process(record: FnaCaseRecord): Promise<void> {
    if (getMechanicalCaseStatus(record) !== MechanicalCaseStatus.Rolling) return;

    const rolledAt = Date.parse(record.WorkCompleteDate as string);
    const activationTime = await this.app.get('emailActivation').getTime();
    const skipped = rolledAt < activationTime ? 'skipped_before_activation'
      : Date.now() - rolledAt > this.app.get('emailMaxDelayHours') * 60 * 60 * 1000 ? 'skipped_too_old'
        : undefined;
    if (skipped) {
      console.log(JSON.stringify({ mechanicalEmail: skipped, caseNumber: record.EventNumber, workCompleteDate: record.WorkCompleteDate }));
      return;
    }

    const contacts = await this.findContacts(record.ShipTo, record.BillTo);
    if (!contacts.length) return;

    const content = {
      fleet_name: value(record.CustomerName),
      driver_name: display(record.Driver),
      driver_phone: valueOr(record.DriverPhone ?? record.ContactPhone, DEFAULT_DRIVER_PHONE),
      dealer_name: valueOr(record.ServiceProvider, DEFAULT_SERVICE_PROVIDER),
      service_type: display(record.InitialTCDescription),
      arrival_time: formatEasternTime(record.RepairStarted),
      vehicle_rolling_time: formatEasternTime(record.WorkCompleteDate),
      case_number: value(record.EventNumber ?? record.case_number),
      po_number: display(record.CustomerPoNumber),
      event_address: display([record.Event_Address, record.Event_City, record.Event_State, record.Event_Country]
        .map((part) => part?.trim()).filter(Boolean).join(', ')),
      unit_number: display(record.Unit),
      description: display(record.Complaint),
      repair_notes: display(record.Correction),
      survey_url: this.app.get('surveyUrl'),
    };

    // One email per address: Notification API drops email_cc, and SES rejects a whole message if any recipient is refused.
    const addresses = [...new Set(contacts.flatMap((contact) => [contact.email, ...contact.ccEmails]))];

    const redis = this.app.get(redisClientPath);
    const caseNumber = content.case_number;
    for (const email of addresses) {
      const idempotencyKey = createMechanicalEmailDeliveryKey(caseNumber, email);
      const acquiredLock = await redis.setIfAbsent(idempotencyKey, 'sent', idempotencyExpirationInMinutes);
      if (!acquiredLock) {
        console.log(JSON.stringify({ mechanicalEmail: 'skipped_duplicate', caseNumber, idempotencyKey }));
        continue;
      }

      const requestBody = buildMechanicalEmailNotificationRequest(email, content);
      try {
        const response = await fetch(`${this.app.get('emailNotificationUrl')}/from-template`, {
        method: 'POST',
        headers: {
          Authorization: `x-auth ${this.app.get('appToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        });
        const responseText = await response.text();
        if (!response.ok || responseText.includes('error')) {
          throw new Error(`Notification API failed for ${requestBody.email_to[0]}: ${response.status} ${responseText}`);
        }
        console.log(JSON.stringify({
          mechanicalEmail: 'sent',
          caseNumber,
          emailTo: requestBody.email_to,
          templateId: requestBody.template_id,
          status: response.status,
          idempotencyKey,
        }));
      } catch (error) {
        await redis.delete(idempotencyKey);
        throw error;
      }
    }
  }

  private async findContacts(shipTo?: string, billTo?: string): Promise<MechanicalEmailRecipient[]> {
    const customers = [...new Set([shipTo, billTo].filter(Boolean) as string[])];
    const client = this.app.get(elasticSearchClientPath);
    const recipients: MechanicalEmailRecipient[] = [];
    for (const customer of customers) {
      const normalizedCustomer = normalizeCustomerNumber(customer);
      const customerRelationship = `1~${normalizedCustomer}`;
      const result = await client.search<any>({
        index: 'contact_repository',
        body: {
          size: 100,
          _source: ['email_address', 'first_name', 'last_name', 'notification_subscription', 'relationships'],
          query: { bool: { must: [
            { term: { 'range_key.keyword': 'v0_contact' } },
            { nested: { path: 'relationships', query: { bool: { must: [
              { term: { 'relationships.customer_number.keyword': customerRelationship } },
              { term: { 'relationships.is_deleted': false } },
            ] } } } },
            { term: { 'notification_subscription.event.keyword': 'mechanical_ers' } },
            { term: { 'notification_subscription.type.keyword': 'case_summary' } },
            { term: { 'notification_subscription.method.keyword': 'email' } },
          ] } },
        },
      });
      const contacts = getEligibleMechanicalRecipients(
        result.body.hits.hits.map((hit: any) => hit._source as ContactRecord),
        normalizedCustomer,
      );
      recipients.push(...contacts);
    }
    return mergeMechanicalRecipients(recipients);
  }
}

export const mechanicalEmailService = (app: Application): void => {
  app.set('mechanicalEmailService', new MechanicalEmailService(app));
};
