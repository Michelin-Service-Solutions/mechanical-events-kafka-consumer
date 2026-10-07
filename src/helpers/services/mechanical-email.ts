import type { Application } from '../../declarations';
import { getMechanicalCaseStatus, MechanicalCaseRecord, MechanicalCaseStatus } from '../enums';
import { redisClientPath } from '../../redis';
import { elasticSearchClientPath } from './elasticsearch';
import { mechanicalCaseDataPath } from './mechanical-case-data';

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
  email_cc?: string[];
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
  ServiceType?: string;
  RequestedServices?: string;
  ReportingCategory?: string;
  InitialTCDescription?: string;
  ArrivalTime?: string;
  EstimatedVendorArrival?: string;
  RepairStarted?: string;
  Complaint?: string;
  Correction?: string;
  ShipTo?: string;
  BillTo?: string;
  TirePosition?: string;
  FailureReason?: string;
  EquipmentType?: string;
}

const value = (input: unknown): string => input == null || input === '' ? ' ' : String(input);

const valueOr = (input: unknown, fallback: string): string => input == null || String(input).trim() === '' ? fallback : String(input);

export const DEFAULT_DRIVER_PHONE = 'N/A';
export const DEFAULT_SERVICE_PROVIDER = 'Contact Michelin ONCall for information';

export const MECHANICAL_EMAIL_TEMPLATE_ID = 'mechanical_case_summary';

export function formatEasternTime(input?: string | null): string {
  const date = input ? new Date(input) : undefined;
  if (!date || Number.isNaN(date.getTime())) return ' ';
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

const idempotencyExpirationInMinutes = 7 * 24 * 60;

export function createMechanicalEmailDeliveryKey(
  caseNumber: string,
  rollingTimestamp: string,
  recipientEmail: string,
): string {
  return `mechanical-email:${encodeURIComponent(caseNumber)}:${encodeURIComponent(rollingTimestamp)}:${recipientEmail}`;
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
  recipient: MechanicalEmailRecipient,
  content: Record<string, string>,
): MechanicalEmailNotificationRequest {
  return {
    notifiable_id: content.case_number,
    email_to: [recipient.email],
    ...(recipient.ccEmails.length ? { email_cc: recipient.ccEmails } : {}),
    notifiable_type: 'email',
    application: 'michelin-oncall',
    template_id: MECHANICAL_EMAIL_TEMPLATE_ID,
    language: 'en_US',
    subject: 'ONCall summary & feedback email',
    content,
  };
}

export class MechanicalEmailService {
  constructor(private readonly app: Application) {}

  async process(record: FnaCaseRecord): Promise<void> {
    if (record.status !== MechanicalCaseStatus.Rolling
      && getMechanicalCaseStatus(record) !== MechanicalCaseStatus.Rolling) return;

    const enriched = await this.app.get(mechanicalCaseDataPath).get(record);
    const contacts = await this.findContacts(enriched.ShipTo, enriched.BillTo);
    if (!contacts.length) return;

    const content = {
      fleet_name: value(enriched.CustomerName),
      driver_name: value(enriched.Driver),
      driver_phone: valueOr(enriched.DriverPhone ?? enriched.ContactPhone, DEFAULT_DRIVER_PHONE),
      dealer_name: valueOr(enriched.ServiceProvider, DEFAULT_SERVICE_PROVIDER),
      service_type: value(enriched.InitialTCDescription),
      arrival_time: formatEasternTime(enriched.RepairStarted),
      vehicle_rolling_time: formatEasternTime(enriched.WorkCompleteDate),
      case_number: value(enriched.EventNumber ?? enriched.case_number),
      po_number: value(enriched.CustomerPoNumber),
      event_address: [enriched.Event_Address, enriched.Event_City, enriched.Event_State, enriched.Event_Country].filter(Boolean).join(', '),
      unit_number: value(enriched.Unit),
      description: value(enriched.Complaint),
      repair_notes: value(enriched.Correction),
      survey_url: this.app.get('surveyUrl'),
    };

    if (this.app.get('dryRun')) {
      const requestBodies = contacts.map((contact) => buildMechanicalEmailNotificationRequest(contact, content));
      console.log(JSON.stringify({ dryRun: true, requestBodies }));
      return;
    }

    const redis = this.app.get(redisClientPath);
    const caseNumber = content.case_number;
    // Raw value keeps keys stable regardless of display formatting.
    const rollingTimestamp = value(enriched.WorkCompleteDate);
    for (const recipient of contacts) {
      const idempotencyKey = createMechanicalEmailDeliveryKey(caseNumber, rollingTimestamp, recipient.email);
      const acquiredLock = await redis.setIfAbsent(idempotencyKey, 'sent', idempotencyExpirationInMinutes);
      if (!acquiredLock) {
        console.log(JSON.stringify({ mechanicalEmail: 'skipped_duplicate', caseNumber, idempotencyKey }));
        continue;
      }

      const requestBody = buildMechanicalEmailNotificationRequest(recipient, content);
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
          emailCc: requestBody.email_cc ?? [],
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
