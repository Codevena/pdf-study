import type { OllamaStatus } from '../../shared/types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const TIMEOUT_MS = 2000;

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
  }>;
}

/**
 * Check if Ollama is running and get available models
 */
export async function checkOllamaStatus(baseUrl: string = DEFAULT_OLLAMA_URL): Promise<OllamaStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        models: [],
        baseUrl,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json() as OllamaTagsResponse;
    const models = data.models?.map((m) => m.name) ?? [];

    return {
      available: true,
      models,
      baseUrl,
    };
  } catch (error: any) {
    // AbortError means timeout
    if (error.name === 'AbortError') {
      return {
        available: false,
        models: [],
        baseUrl,
        error: 'Verbindung zu Ollama abgelaufen (Timeout)',
      };
    }

    // Connection refused means Ollama is not running
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      return {
        available: false,
        models: [],
        baseUrl,
        error: 'Ollama ist nicht gestartet',
      };
    }

    return {
      available: false,
      models: [],
      baseUrl,
      error: error.message || 'Unbekannter Fehler beim Verbinden mit Ollama',
    };
  }
}

/**
 * Get recommended Ollama model from available models
 */
export function getRecommendedModel(models: string[]): string {
  // Prefer these models in order of preference
  const preferredModels = [
    'llama3.1',
    'llama3',
    'llama2',
    'mistral',
    'mixtral',
    'gemma',
    'phi',
  ];

  for (const preferred of preferredModels) {
    const found = models.find((m) => m.toLowerCase().includes(preferred));
    if (found) return found;
  }

  // Return first available model or default
  return models[0] || 'llama3.1';
}
