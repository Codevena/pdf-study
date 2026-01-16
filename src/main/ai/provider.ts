import OpenAI from 'openai';
import type { AIProvider, OpenAIModel } from '../../shared/types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// GPT-5 Model Pricing (USD per 1M tokens)
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5-nano': { input: 0.05, output: 0.40 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  'gpt-5.2': { input: 1.75, output: 14.00 },
  'default': { input: 0.25, output: 2.00 },
};

export interface AIProviderConfig {
  provider: AIProvider;
  // OpenAI settings
  openaiApiKey?: string | null;
  openaiModel?: OpenAIModel;
  // Ollama settings
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface UsageData {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

/**
 * Calculate cost for API usage (returns 0 for Ollama)
 */
export function calculateCost(
  config: AIProviderConfig,
  promptTokens: number,
  completionTokens: number
): number {
  if (config.provider === 'ollama') {
    return 0;
  }

  const model = config.openaiModel || 'gpt-5-mini';
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING['default'];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Get the model name being used
 */
export function getModelName(config: AIProviderConfig): string {
  if (config.provider === 'ollama') {
    return config.ollamaModel || 'llama3.1';
  }
  return config.openaiModel || 'gpt-5-mini';
}

/**
 * Create an OpenAI-compatible client for the configured provider
 */
export function createAIClient(config: AIProviderConfig): OpenAI {
  if (config.provider === 'ollama') {
    const baseUrl = config.ollamaBaseUrl || DEFAULT_OLLAMA_URL;
    return new OpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: 'ollama', // Ollama doesn't need a real API key
    });
  }

  if (!config.openaiApiKey) {
    throw new Error('OpenAI API-Schlussel fehlt');
  }

  return new OpenAI({
    apiKey: config.openaiApiKey,
  });
}

/**
 * Execute a chat completion with the configured AI provider
 */
export async function chat(
  config: AIProviderConfig,
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult> {
  const client = createAIClient(config);
  const model = getModelName(config);

  const response = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: options.maxTokens || 16000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Keine Antwort vom KI-Modell erhalten');
  }

  return {
    content,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Create usage data from chat result
 */
export function createUsageData(
  config: AIProviderConfig,
  promptTokens: number,
  completionTokens: number
): UsageData {
  return {
    model: getModelName(config),
    promptTokens,
    completionTokens,
    costUsd: calculateCost(config, promptTokens, completionTokens),
  };
}

/**
 * Validate the provider configuration
 */
export function validateConfig(config: AIProviderConfig): { valid: boolean; error?: string } {
  if (config.provider === 'openai') {
    if (!config.openaiApiKey) {
      return {
        valid: false,
        error: 'OpenAI API-Schlussel nicht konfiguriert. Bitte in den Einstellungen hinterlegen.',
      };
    }
  }
  // Ollama doesn't require any API key
  return { valid: true };
}
