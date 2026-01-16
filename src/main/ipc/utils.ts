import type { DatabaseInstance } from '../database';
import type { AIProviderConfig } from '../ai/provider';
import type { AIProvider, OpenAIModel } from '../../shared/types';
import * as queries from '../database/queries';

/**
 * Safely parse JSON with a fallback value.
 * Prevents crashes from malformed JSON in database or external sources.
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('Failed to parse JSON, using fallback:', error);
    return fallback;
  }
}

/**
 * Get AI provider configuration from database settings
 */
export function getAIConfig(db: DatabaseInstance): AIProviderConfig {
  const provider = (queries.getSetting(db, 'aiProvider') as AIProvider) || 'openai';

  return {
    provider,
    // OpenAI settings
    openaiApiKey: queries.getSetting(db, 'openaiApiKey'),
    openaiModel: (queries.getSetting(db, 'openaiModel') as OpenAIModel) || 'gpt-5-mini',
    // Ollama settings
    ollamaModel: queries.getSetting(db, 'ollamaModel') || 'llama3.1',
    ollamaBaseUrl: queries.getSetting(db, 'ollamaBaseUrl') || 'http://localhost:11434',
  };
}
