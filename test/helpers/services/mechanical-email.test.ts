import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
  buildMechanicalEmailNotificationRequest,
  ContactRecord,
  createMechanicalEmailDeliveryKey,
  extractCcEmails,
  formatVmrs,
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

  test('builds an English notification request for a single address', () => {
    const request = buildMechanicalEmailNotificationRequest('recipient@example.com', { case_number: 'M123' });
    expect(request).not.toHaveProperty('email_cc');
    expect(request).toMatchObject({
      notifiable_id: 'M123',
      email_to: ['recipient@example.com'],
      language: 'en_US',
      subject: 'ONCall Summary & Feedback for Event M123',
    });
  });
});

describe('MechanicalEmailService delivery', () => {
  const rollingCase = {
    EventNumber: 'M123',
    RepairStarted: '2026-09-28T14:15:00.000Z',
    WorkCompleteDate: '2026-04-10T12:00:00.000Z',
    InitialTCDescription: 'BRAKES-MAJOR / AIR SYSTEM',
    Complaint: 'SCR system error',
    Correction: 'Cleared the fault code',
    ShipTo: '1145733',
    BillTo: '1145733',
  };
  const setIfAbsent: any = jest.fn();
  const removeLock: any = jest.fn();
  const fetchMock: any = jest.fn();
  const elasticsearch = { search: jest.fn() as any };
  const app = {
    get: (key: string) => ({
      elasticSearchClient: elasticsearch,
      redisClient: { setIfAbsent, delete: removeLock },
      surveyUrl: 'https://survey.example.test',
      emailMaxDelayHours: 24,
      emailActivation: { getTime: async () => Date.parse('2026-04-10T11:30:00Z') },
      emailNotificationUrl: 'https://notifications.example.test',
      appToken: 'token',
    })[key],
  } as unknown as Application;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-10T13:00:00.000Z'));
    setIfAbsent.mockReset().mockResolvedValue(true);
    removeLock.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset();
    elasticsearch.search.mockReset().mockResolvedValue({ body: { hits: { hits: [{ _source: subscribedContact }] } } });
    global.fetch = fetchMock as typeof fetch;
  });

  test('sends only once per recipient for the same vehicle-rolling event', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    setIfAbsent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = new MechanicalEmailService(app);

    await service.process(rollingCase);
    await service.process(rollingCase);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const content = body.content;
    expect(body.template_id).toBe('mechanical_case_summary');
    expect(content.arrival_time).toBe('09/28/2026 10:15:00 EST');
    expect(content.vehicle_rolling_time).toBe('04/10/2026 08:00:00 EST');
    expect(content.service_type).toBe('BRAKES-MAJOR / AIR SYSTEM');
    expect(content.driver_phone).toBe('N/A');
    expect(content.dealer_name).toBe('Contact Michelin ONCall for information');
    expect(content.description).toBe('SCR system error');
    expect(content.repair_notes).toBe('Cleared the fault code');
    expect(content).not.toHaveProperty('notes');
    expect(content).not.toHaveProperty('type');
    expect(setIfAbsent).toHaveBeenCalledWith(
      createMechanicalEmailDeliveryKey('M123', 'test.recipient@example.com'),
      'sent',
      86400,
    );
  });

  test('sends a separate email to the primary and each CC address', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    elasticsearch.search.mockResolvedValue({ body: { hits: { hits: [{ _source: {
      ...subscribedContact,
      notification_subscription: [{ event: 'mechanical_ers', type: 'case_summary', method: ['email'], cc_emails: 'cc.one@example.com; cc.two@example.com' }],
    } }] } } });

    await new MechanicalEmailService(app).process(rollingCase);

    const recipients = fetchMock.mock.calls.map((call: any) => JSON.parse(call[1].body).email_to);
    expect(recipients).toEqual([['test.recipient@example.com'], ['cc.one@example.com'], ['cc.two@example.com']]);
    expect(setIfAbsent.mock.calls.map((call: any) => call[0])).toEqual([
      createMechanicalEmailDeliveryKey('M123', 'test.recipient@example.com'),
      createMechanicalEmailDeliveryKey('M123', 'cc.one@example.com'),
      createMechanicalEmailDeliveryKey('M123', 'cc.two@example.com'),
    ]);
  });

  test('shows N/A for empty, null, or whitespace-only fields', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    await new MechanicalEmailService(app).process({
      ...rollingCase,
      Driver: '  ',
      InitialTCDescription: undefined,
      CustomerPoNumber: '',
      Unit: null as unknown as string,
      Complaint: ' ',
      Correction: undefined,
      RepairStarted: undefined,
    });

    const content = JSON.parse(fetchMock.mock.calls[0][1].body).content;
    for (const field of ['driver_name', 'service_type', 'po_number', 'unit_number', 'description', 'repair_notes', 'arrival_time', 'event_address', 'vmrs']) {
      expect(content[field]).toBe('N/A');
    }
  });

  test('shows Description and Repair Notes exactly as received', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    const complaint = '(CALLER: BEN; PHONE: +15408013183)  (UNIT NUMBER: 179354) BRAKES DO NOT RELEASE';
    const correction = 'Correction: complete ;';
    await new MechanicalEmailService(app).process({ ...rollingCase, Complaint: complaint, Correction: correction });

    const content = JSON.parse(fetchMock.mock.calls[0][1].body).content;
    expect(content.description).toBe(complaint);
    expect(content.repair_notes).toBe(correction);
  });

  test('shows VMRS as code and description', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    await new MechanicalEmailService(app).process({ ...rollingCase, InitialTroubleCode: '113' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).content.vmrs).toBe('113 — BRAKES-MAJOR / AIR SYSTEM');
  });

  test('formatVmrs shows whichever parts are present', () => {
    expect(formatVmrs('145', 'POWER PLANT-MAJOR')).toBe('145 — POWER PLANT-MAJOR');
    expect(formatVmrs('113', undefined)).toBe('113');
    expect(formatVmrs(' ', 'COOLING SYSTEM')).toBe('COOLING SYSTEM');
    expect(formatVmrs(null, '')).toBe('N/A');
  });

  test('sends when the vehicle rolled exactly at the activation time', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    await new MechanicalEmailService(app).process({ ...rollingCase, WorkCompleteDate: '2026-04-10T11:30:00.000Z' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('sends for paid cases when the vehicle is rolling', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    const paidCase = { ...rollingCase, PaidInFull: 'Yes' };
    await new MechanicalEmailService(app).process(paidCase);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('sends when the vehicle rolled just under 24 hours ago', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-11T11:59:00.000Z'));
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => 'ok' });
    await new MechanicalEmailService(app).process(rollingCase);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not send when the vehicle rolled more than 24 hours ago', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-11T12:01:00.000Z'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await new MechanicalEmailService(app).process(rollingCase);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('"mechanicalEmail":"skipped_too_old"'));
    expect(elasticsearch.search).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test('does not send when the vehicle rolled before the activation time', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await new MechanicalEmailService(app).process({ ...rollingCase, WorkCompleteDate: '2026-04-10T11:00:00.000Z' });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('"mechanicalEmail":"skipped_before_activation"'));
    expect(elasticsearch.search).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test('does not send when WorkCompleteDate is the DMS placeholder date', async () => {
    await new MechanicalEmailService(app).process({ ...rollingCase, status: 'rolling', WorkCompleteDate: '1900-01-01T04:00:00.000Z' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setIfAbsent).not.toHaveBeenCalled();
  });

  test('uses the same delivery key when WorkCompleteDate is edited', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    const service = new MechanicalEmailService(app);

    await service.process(rollingCase);
    await service.process({ ...rollingCase, WorkCompleteDate: '2026-04-10T12:15:00.000Z' });

    expect(setIfAbsent.mock.calls[0][0]).toBe(setIfAbsent.mock.calls[1][0]);
  });

  test('uses driver phone and provider name when the case has them', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    await new MechanicalEmailService(app).process({ ...rollingCase, DriverPhone: '555-0100', ServiceProvider: 'Acme Truck Repair' });

    const content = JSON.parse(fetchMock.mock.calls[0][1].body).content;
    expect(content.driver_phone).toBe('555-0100');
    expect(content.dealer_name).toBe('Acme Truck Repair');
  });

  test('releases a recipient lock when notification delivery fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'service error' });
    const service = new MechanicalEmailService(app);

    await expect(service.process(rollingCase)).rejects.toThrow('Notification API failed');

    expect(removeLock).toHaveBeenCalledWith(
      createMechanicalEmailDeliveryKey('M123', 'test.recipient@example.com'),
    );
  });
});