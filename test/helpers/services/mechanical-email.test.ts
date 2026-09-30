import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
  buildMechanicalEmailNotificationRequest,
  ContactRecord,
  createMechanicalEmailDeliveryKey,
  extractCcEmails,
  getEligibleMechanicalRecipients,
  MechanicalEmailService,
  mergeMechanicalRecipients,
} from 'src/helpers/services/mechanical-email';
import type { Application } from 'src/declarations';
import { getMechanicalCaseStatus, MechanicalCaseStatus } from 'src/helpers/enums';

const subscribedContact: ContactRecord = {
  email_address: 'mailto:Test.Recipient@example.com',
  first_name: 'Test',
  last_name: 'Recipient',
  relationships: [{ customer_number: '1~1145733', is_deleted: false }],
  notification_subscription: [{
    event: 'mechanical_ers',
    type: 'case_summary',
    method: ['email'],
  }],
};

describe('Mechanical Kafka status mapping', () => {
  test('maps completion, repair start, and vendor ETA to the expected Mechanical statuses', () => {
    expect(getMechanicalCaseStatus({ WorkCompleteDate: '2026-08-29T20:13:21.000Z' }))
      .toBe(MechanicalCaseStatus.Rolling);
    expect(getMechanicalCaseStatus({ RepairStarted: '2026-08-29T18:16:00.000Z' }))
      .toBe(MechanicalCaseStatus.Arrived);
    expect(getMechanicalCaseStatus({ EstimatedVendorArrival: '2026-08-29T17:52:00.000Z' }))
      .toBe(MechanicalCaseStatus.EnRoute);
  });
});

describe('getEligibleMechanicalRecipients', () => {
  test('returns active contacts with an explicit mechanical email subscription', () => {
    expect(getEligibleMechanicalRecipients([subscribedContact], '1145733')).toEqual([{
      email: 'test.recipient@example.com',
      name: 'Test Recipient',
      ccEmails: [],
    }]);
  });

  test('excludes unsubscribed, inactive, and mismatched subscriptions', () => {
    const contacts: ContactRecord[] = [
      { ...subscribedContact, email_address: 'unsubscribed@example.com', notification_subscription: [] },
      { ...subscribedContact, email_address: 'inactive@example.com', relationships: [{ customer_number: '1~1145733', is_deleted: true }] },
      { ...subscribedContact, email_address: 'wrong-event@example.com', notification_subscription: [{ event: 'tire_ers', type: 'case_summary', method: ['email'] }] },
      { ...subscribedContact, email_address: 'wrong-method@example.com', notification_subscription: [{ event: 'mechanical_ers', type: 'case_summary', method: ['text'] }] },
    ];

    expect(getEligibleMechanicalRecipients(contacts, '1~1145733')).toEqual([]);
  });

  test('requires event, type, and method on the same subscription', () => {
    const contact: ContactRecord = {
      ...subscribedContact,
      notification_subscription: [
        { event: 'mechanical_ers', type: 'vehicle_rolling', method: ['email'] },
        { event: 'tire_ers', type: 'case_summary', method: ['email'] },
      ],
    };

    expect(getEligibleMechanicalRecipients([contact], '1145733')).toEqual([]);
  });

  test('normalizes CC addresses from strings and arrays', () => {
    expect(extractCcEmails({
      event: 'mechanical_ers',
      type: 'case_summary',
      method: 'email',
      cc_emails: 'mailto:First@example.com; [second@example.com], invalid',
    })).toEqual(['first@example.com', 'second@example.com']);
  });

  test('normalizes bracket-wrapped primary email addresses', () => {
    expect(getEligibleMechanicalRecipients([{
      ...subscribedContact,
      email_address: '[mailto:Test.Recipient@example.com]',
    }], '1145733')[0].email).toBe('test.recipient@example.com');
  });

  test('combines CC addresses from matching subscriptions on the same contact', () => {
    const contact: ContactRecord = {
      ...subscribedContact,
      notification_subscription: [
        { event: 'mechanical_ers', type: 'case_summary', method: ['email'], cc_emails: ['first@example.com'] },
        { event: 'mechanical_ers', type: 'case_summary', method: ['email'], cc_emails: 'second@example.com' },
      ],
    };

    expect(getEligibleMechanicalRecipients([contact], '1145733')[0].ccEmails).toEqual([
      'first@example.com',
      'second@example.com',
    ]);
  });

  test('merges Ship-To and Bill-To recipients without placing recipients in CC', () => {
    expect(mergeMechanicalRecipients([
      { email: 'ship-to@example.com', name: 'Ship To', ccEmails: ['bill-to@example.com', 'cc@example.com'] },
      { email: 'bill-to@example.com', name: 'Bill To', ccEmails: ['cc@example.com'] },
      { email: 'ship-to@example.com', name: 'Ship To', ccEmails: ['additional@example.com'] },
    ])).toEqual([
      { email: 'ship-to@example.com', name: 'Ship To', ccEmails: ['cc@example.com', 'additional@example.com'] },
      { email: 'bill-to@example.com', name: 'Bill To', ccEmails: ['cc@example.com'] },
    ]);
  });

  test('builds an English notification request with subscription CC addresses', () => {
    expect(buildMechanicalEmailNotificationRequest({
      email: 'recipient@example.com',
      name: 'Recipient',
      ccEmails: ['copy@example.com'],
    }, { case_number: 'M123' })).toMatchObject({
      notifiable_id: 'M123',
      email_to: ['recipient@example.com'],
      email_cc: ['copy@example.com'],
      language: 'en_US',
    });
  });
});

describe('MechanicalEmailService delivery', () => {
  const enrichedCase = {
    id: 'case-id',
    EventNumber: 'M123',
    RepairStarted: '2026-09-28T14:15:00.000Z',
    WorkCompleteDate: '2026-04-10T12:00:00.000Z',
    ReportingCategory: 'Maintenance',
    Complaint: 'SCR system error',
    Correction: 'Cleared the fault code',
    ShipTo: '1145733',
    BillTo: '1145733',
  };
  const rollingEvent = {
    id: 'case-id',
    case_number: 'M123',
    status: 'rolling',
  };
  const setIfAbsent: any = jest.fn();
  const removeLock: any = jest.fn();
  const fetchMock: any = jest.fn();
  const mechanicalCaseData = { get: jest.fn() as any };
  const elasticsearch = { search: jest.fn() as any };
  const app = {
    get: (key: string) => ({
      mechanicalCaseData,
      elasticSearchClient: elasticsearch,
      redisClient: { setIfAbsent, delete: removeLock },
      dryRun: false,
      surveyUrl: 'https://survey.example.test',
      emailNotificationUrl: 'https://notifications.example.test',
      appToken: 'token',
    })[key],
  } as unknown as Application;

  beforeEach(() => {
    setIfAbsent.mockReset().mockResolvedValue(true);
    removeLock.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset();
    mechanicalCaseData.get.mockReset().mockResolvedValue(enrichedCase);
    elasticsearch.search.mockReset().mockResolvedValue({ body: { hits: { hits: [{ _source: subscribedContact }] } } });
    global.fetch = fetchMock as typeof fetch;
  });

  test('sends only once per recipient for the same vehicle-rolling event', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    setIfAbsent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = new MechanicalEmailService(app);

    await service.process(rollingEvent);
    await service.process(rollingEvent);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const content = JSON.parse(fetchMock.mock.calls[0][1].body).content;
    expect(content.arrival_time).toBe('2026-09-28T14:15:00.000Z');
    expect(content.service_type).toBe('Maintenance');
    expect(content.description).toBe('SCR system error');
    expect(content.repair_notes).toBe('Cleared the fault code');
    expect(content.notes).toBe('Cleared the fault code');
    expect(setIfAbsent).toHaveBeenCalledWith(
      createMechanicalEmailDeliveryKey('M123', '2026-04-10T12:00:00.000Z', 'test.recipient@example.com'),
      'sent',
      10080,
    );
  });

  test('releases a recipient lock when notification delivery fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'service error' });
    const service = new MechanicalEmailService(app);

    await expect(service.process(rollingEvent)).rejects.toThrow('Notification API failed');

    expect(removeLock).toHaveBeenCalledWith(
      createMechanicalEmailDeliveryKey('M123', '2026-04-10T12:00:00.000Z', 'test.recipient@example.com'),
    );
  });
});