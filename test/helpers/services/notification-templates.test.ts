import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { formatEasternTime } from 'src/helpers/services/mechanical-email';
import { loadNotificationTemplates, NotificationTemplate, syncNotificationTemplate } from 'src/helpers/services/notification-templates';

const template = loadNotificationTemplates().find((t) => t.template_id === 'mechanical_case_summary') as NotificationTemplate;

describe('mechanical_case_summary template', () => {
  test('matches the GSDCOF-1744 fields and labels', () => {
    expect(template).toBeDefined();
    const placeholders = [...new Set(template.html.match(/\{\{\w+\}\}/g))].map((p) => p.slice(2, -2)).sort();
    expect(placeholders).toEqual([
      'arrival_time', 'case_number', 'dealer_name', 'description', 'driver_name', 'driver_phone',
      'event_address', 'fleet_name', 'po_number', 'repair_notes', 'service_type', 'survey_url',
      'unit_number', 'vehicle_rolling_time',
    ]);
    for (const label of ['Driver Name:', 'Contact Phone:', 'Service Provider:', 'Service Type:', 'Arrival Time:',
      'Vehicle Rolling Time:', 'ONCall Event #:', 'PO:', 'Location:', 'Unit #:', 'Description:', 'Repair Notes:']) {
      expect(template.html).toContain(label);
    }
    expect(template.html).not.toMatch(/Equipment Type|Tire Position|Tire Failure|<p><br><\/p>/);
  });
});

describe('formatEasternTime', () => {
  test('formats UTC timestamps in Eastern time like the tire feedback email', () => {
    expect(formatEasternTime('2026-10-05T12:00:00.000Z')).toBe('10/05/2026 08:00:00 EST');
    expect(formatEasternTime('2026-01-24T05:00:00.000Z')).toBe('01/24/2026 00:00:00 EST');
    expect(formatEasternTime(undefined)).toBe(' ');
    expect(formatEasternTime('not a date')).toBe(' ');
  });
});

describe('syncNotificationTemplate', () => {
  const fetchMock: any = jest.fn();
  const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  test('creates the template when it does not exist', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [] })).mockResolvedValueOnce({ ok: true, status: 201 });
    await expect(syncNotificationTemplate(template, 'https://n.example.test', 't')).resolves.toBe('created');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  test('leaves an identical remote template unchanged', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ ...template, id: 'remote-id', status: 'active', json: { ...template.json, extra: 'x' } }] }));
    await expect(syncNotificationTemplate(template, 'https://n.example.test', 't')).resolves.toBe('unchanged');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('updates a changed remote template and keeps its status', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ ...template, html: '<p>old</p>', id: 'remote-id', status: 'active' }] }))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(syncNotificationTemplate(template, 'https://n.example.test', 't')).resolves.toBe('updated');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('/v2/template/remote-id?');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).status).toBe('active');
  });
});
