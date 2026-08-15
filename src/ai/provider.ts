export interface AiProviderConfig {
  apiKey: string;
  apiUrl: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  fetchImpl?: typeof fetch;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProvider {
  complete(messages: AiMessage[], options?: Partial<AiProviderConfig>): Promise<string>;
}

export class OpenAICompatibleProvider implements AiProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private config: AiProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async complete(messages: AiMessage[], options: Partial<AiProviderConfig> = {}): Promise<string> {
    const apiUrl = options.apiUrl ?? this.config.apiUrl;
    if (!apiUrl) throw new Error('AiProvider requires an apiUrl');
    const response = await this.fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey ?? this.config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model ?? this.config.model ?? 'gpt-4o-mini',
        messages,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 1024,
        temperature: options.temperature ?? this.config.temperature ?? 0.2
      })
    });
    if (!response.ok) {
      throw new Error(`AI provider request failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined) throw new Error('AI provider returned no content');
    return content;
  }
}

export function createAiProvider(config: AiProviderConfig): AiProvider {
  return new OpenAICompatibleProvider(config);
}

export function isAiEnabled(env = process.env): boolean {
  return env.ENABLE_AI === 'true' && Boolean(env.AI_API_KEY);
}