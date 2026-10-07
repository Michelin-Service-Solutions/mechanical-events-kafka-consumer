import fs from 'fs';
import path from 'path';
import type { Application } from '../../declarations';

export interface NotificationTemplate {
  template_id: string;
  name: string;
  application: string;
  language: string;
  subject: string;
  text: string;
  html: string;
  json: Record<string, string>;
}

const templatesDir = path.join(process.cwd(), 'templates');

export function loadNotificationTemplates(dir = templatesDir): NotificationTemplate[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((language) => {
    const languageDir = path.join(dir, language);
    if (!fs.statSync(languageDir).isDirectory()) return [];
    return fs.readdirSync(languageDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(fs.readFileSync(path.join(languageDir, file), 'utf8')) as NotificationTemplate);
  });
}

const differs = (local: NotificationTemplate, remote: NotificationTemplate): boolean => (
  ['name', 'subject', 'text', 'html'] as const).some((key) => local[key] !== remote[key])
  || Object.keys(local.json).some((key) => local.json[key] !== remote.json?.[key]);

export async function syncNotificationTemplate(template: NotificationTemplate, baseUrl: string, token: string): Promise<'created' | 'updated' | 'unchanged'> {
  const templatesUrl = `${baseUrl}/v2/template`;
  const headers = { 'Content-Type': 'application/json', Authorization: `x-auth ${token}` };
  const query = new URLSearchParams({ application: template.application, template_id: template.template_id, language: template.language });

  const found = await fetch(`${templatesUrl}?${query}`, { headers });
  if (!found.ok) throw new Error(`Template lookup failed for ${template.template_id}: ${found.status}`);
  const remote = ((await found.json()) as { data?: (NotificationTemplate & { id: string; status: string })[] }).data?.[0];

  if (!remote) {
    const created = await fetch(templatesUrl, { method: 'POST', headers, body: JSON.stringify(template) });
    if (!created.ok) throw new Error(`Template create failed for ${template.template_id}: ${created.status}`);
    return 'created';
  }
  if (!differs(template, remote)) return 'unchanged';

  const updateQuery = new URLSearchParams({ template_id: template.template_id, language: template.language });
  const updated = await fetch(`${templatesUrl}/${remote.id}?${updateQuery}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...template, status: remote.status }),
  });
  if (!updated.ok) throw new Error(`Template update failed for ${template.template_id}: ${updated.status}`);
  return 'updated';
}

export const notificationTemplates = (app: Application): void => {
  if (process.env.NODE_ENV === 'test') return;
  const baseUrl = app.get('emailNotificationUrl');
  const token = app.get('appToken');
  // Startup must not fail if the Notification API is briefly unavailable; sends would then use the last synced template.
  Promise.all(loadNotificationTemplates().map(async (template) => {
    try {
      const result = await syncNotificationTemplate(template, baseUrl, token);
      console.log(JSON.stringify({ notificationTemplate: template.template_id, language: template.language, result }));
    } catch (error) {
      console.error(JSON.stringify({ notificationTemplate: template.template_id, language: template.language, error: (error as Error).message }));
    }
  }));
};
