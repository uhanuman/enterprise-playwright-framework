export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  sentAt: string;
  text?: string;
  html?: string;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface ListMessagesOptions {
  folder?: string;
  query?: string;
  maxResults?: number;
}

export interface EmailProvider {
  name: string;
  listMessages(options?: ListMessagesOptions): Promise<EmailMessage[]>;
  getMessage(id: string): Promise<EmailMessage | undefined>;
  downloadAttachment(messageId: string, filename: string): Promise<EmailAttachment | undefined>;
  waitForMessage(subjectPattern: RegExp, timeoutMs?: number): Promise<EmailMessage>;
  close(): Promise<void>;
}

export async function parseHtmlText(html: string, cheerioImport?: unknown): Promise<string> {
  if (cheerioImport) {
    const cheerio = cheerioImport as { load(html: string): { text(): string } };
    return cheerio.load(html).text();
  }
  try {
    const { load } = await import('cheerio');
    return load(html).text();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export function messageMatchesSubject(message: EmailMessage, pattern: RegExp): boolean {
  return pattern.test(message.subject);
}