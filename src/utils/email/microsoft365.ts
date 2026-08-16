import { EmailProvider, EmailMessage, EmailAttachment, ListMessagesOptions } from './provider.js';

export interface Microsoft365Options {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userPrincipalName: string;
  graphBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class Microsoft365Provider implements EmailProvider {
  readonly name = 'microsoft365';
  private accessToken: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(private options: Microsoft365Options) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async listMessages(options: ListMessagesOptions = {}): Promise<EmailMessage[]> {
    const token = await this.getAccessToken();
    const { folder = 'inbox', maxResults = 10 } = options;
    const query = options.query ? `&$search="${encodeURIComponent(options.query)}"` : '';
    const url =
      `${this.graphBaseUrl()}/users/${this.options.userPrincipalName}/mailFolders/${folder}/messages` +
      `?$top=${maxResults}&$orderby=receivedDateTime%20desc${query}`;

    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`Microsoft Graph list messages failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { value: unknown[] };
    return data.value.map((message) => this.mapMessage(message as Record<string, unknown>));
  }

  async getMessage(id: string): Promise<EmailMessage | undefined> {
    const token = await this.getAccessToken();
    const url = `${this.graphBaseUrl()}/users/${this.options.userPrincipalName}/messages/${id}`;
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as Record<string, unknown>;
    return this.mapMessage(data);
  }

  async downloadAttachment(messageId: string, filename: string): Promise<EmailAttachment | undefined> {
    const token = await this.getAccessToken();
    const url =
      `${this.graphBaseUrl()}/users/${this.options.userPrincipalName}/messages/${messageId}` +
      `/attachments?$filter=name eq '${encodeURIComponent(filename)}'`;
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { value?: Record<string, unknown>[] };
    const match = data.value?.find((a) => a.name === filename);
    if (!match) return undefined;
    return {
      filename: String(match.name),
      contentType: String(match.contentType ?? 'application/octet-stream'),
      content: Buffer.from(String(match.contentBytes ?? ''), 'base64')
    };
  }

  async waitForMessage(subjectPattern: RegExp, timeoutMs = 30000): Promise<EmailMessage> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const messages = await this.listMessages({ maxResults: 20 });
      const match = messages.find((m) => subjectPattern.test(m.subject));
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error(`No message matching ${subjectPattern} within ${timeoutMs}ms`);
  }

  async close(): Promise<void> {
    this.accessToken = undefined;
  }

  private graphBaseUrl(): string {
    return this.options.graphBaseUrl ?? 'https://graph.microsoft.com/v1.0';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const url = `https://login.microsoftonline.com/${this.options.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!response.ok) {
      throw new Error(`Microsoft Graph token acquisition failed: ${response.status}`);
    }
    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private mapMessage(message: Record<string, unknown>): EmailMessage {
    const from = message.from as { emailAddress?: { name?: string; address?: string } } | undefined;
    const toRecipients = (message.toRecipients as { emailAddress?: { address?: string } }[]) ?? [];
    const attachments = (message.attachments as Record<string, unknown>[]) ?? [];
    const body = message.body as { content?: string } | undefined;
    return {
      id: String(message.id),
      subject: String(message.subject ?? ''),
      from: from?.emailAddress?.address ?? '',
      to: toRecipients.map((r) => r.emailAddress?.address ?? ''),
      sentAt: String(message.receivedDateTime ?? ''),
      text: body?.content,
      attachments: attachments.map((a) => ({
        filename: String(a.name ?? ''),
        contentType: String(a.contentType ?? 'application/octet-stream'),
        content: Buffer.from(String(a.contentBytes ?? ''), 'base64')
      }))
    };
  }
}

export function createMicrosoft365Provider(options: Microsoft365Options): EmailProvider {
  return new Microsoft365Provider(options);
}