import { EmailProvider, EmailMessage, EmailAttachment, ListMessagesOptions } from './provider.js';

export interface GoogleWorkspaceOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userId?: string;
  gmailBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class GoogleWorkspaceProvider implements EmailProvider {
  readonly name = 'googleWorkspace';
  private accessToken: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(private options: GoogleWorkspaceOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async listMessages(options: ListMessagesOptions = {}): Promise<EmailMessage[]> {
    const token = await this.getAccessToken();
    const { maxResults = 10 } = options;
    const query = options.query ? `&q=${encodeURIComponent(options.query)}` : '';
    const url = `${this.gmailBaseUrl()}/gmail/v1/users/${this.userId()}/messages?maxResults=${maxResults}${query}`;

    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`Gmail list messages failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { messages?: { id: string }[] };
    const messages: EmailMessage[] = [];
    for (const item of data.messages ?? []) {
      const message = await this.getMessage(item.id);
      if (message) messages.push(message);
    }
    return messages;
  }

  async getMessage(id: string): Promise<EmailMessage | undefined> {
    const token = await this.getAccessToken();
    const url =
      `${this.gmailBaseUrl()}/gmail/v1/users/${this.userId()}/messages/${id}` +
      `?format=full&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`;
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as Record<string, unknown>;
    return this.mapMessage(data);
  }

  async downloadAttachment(messageId: string, attachmentId: string): Promise<EmailAttachment | undefined> {
    const token = await this.getAccessToken();
    const url =
      `${this.gmailBaseUrl()}/gmail/v1/users/${this.userId()}/messages/${messageId}/attachments/${attachmentId}`;
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { size?: number; data?: string };
    return {
      filename: attachmentId,
      contentType: 'application/octet-stream',
      content: Buffer.from(data.data ?? '', 'base64')
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

  private userId(): string {
    return this.options.userId ?? 'me';
  }

  private gmailBaseUrl(): string {
    return this.options.gmailBaseUrl ?? 'https://gmail.googleapis.com';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const url = 'https://oauth2.googleapis.com/token';
    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      refresh_token: this.options.refreshToken,
      grant_type: 'refresh_token'
    });
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!response.ok) {
      throw new Error(`Gmail token refresh failed: ${response.status}`);
    }
    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private mapMessage(message: Record<string, unknown>): EmailMessage {
    const payload = (message.payload as Record<string, unknown> | undefined) ?? {};
    const headers = (payload.headers as { name?: string; value?: string }[]) ?? [];
    const getHeader = (name: string): string =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

    let bodyText: string | undefined;
    let bodyHtml: string | undefined;
    const extractBody = (part: Record<string, unknown> | undefined): void => {
      if (!part) return;
      if (part.mimeType === 'text/plain') bodyText = decodeBase64Url(String((part.body as { data?: string } | undefined)?.data ?? ''));
      if (part.mimeType === 'text/html') bodyHtml = decodeBase64Url(String((part.body as { data?: string } | undefined)?.data ?? ''));
      const parts = (part.parts as Record<string, unknown>[]) ?? [];
      for (const child of parts) extractBody(child);
    };
    extractBody(payload);

    return {
      id: String(message.id),
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To').split(',').map((s) => s.trim()).filter(Boolean),
      sentAt: String(message.internalDate ?? new Date().toISOString()),
      text: bodyText,
      html: bodyHtml,
      attachments: []
    };
  }
}

function decodeBase64Url(value: string): string {
  if (!value) return '';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function createGoogleWorkspaceProvider(options: GoogleWorkspaceOptions): EmailProvider {
  return new GoogleWorkspaceProvider(options);
}