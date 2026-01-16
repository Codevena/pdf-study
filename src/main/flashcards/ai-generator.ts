import OpenAI from 'openai';
import type { OpenAIModel, GeneratedCard, FlashcardType, OutlineItem, ExplanationStyle } from '../../shared/types';

interface GenerationOptions {
  model: OpenAIModel;
  language: 'de' | 'en';
  count: number;
}

// GPT-5 Model Pricing (USD per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5-nano': { input: 0.05, output: 0.40 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  'gpt-5.2': { input: 1.75, output: 14.00 },
  // Fallback for unknown models
  'default': { input: 0.25, output: 2.00 },
};

export interface UsageData {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

const SYSTEM_PROMPTS = {
  de: `Du bist ein Experte fur die Erstellung von Lernkarteikarten. Erstelle Karteikarten im Frage-Antwort-Format.

Regeln:
- Jede Karte hat eine klare, prazise Frage auf der Vorderseite
- Die Antwort auf der Ruckseite sollte kurz und einpragsam sein
- Fokussiere auf die wichtigsten Konzepte und Fakten
- Vermeide zu lange oder komplexe Antworten
- Formuliere die Fragen so, dass sie das Verstandnis prufen`,

  en: `You are an expert at creating flashcards. Create question-answer style flashcards.

Rules:
- Each card has a clear, precise question on the front
- The answer on the back should be brief and memorable
- Focus on the most important concepts and facts
- Avoid overly long or complex answers
- Phrase questions to test understanding`,
};

export interface GenerationResult {
  cards: GeneratedCard[];
  usage: UsageData;
}

export async function generateFlashcards(
  apiKey: string,
  text: string,
  options: GenerationOptions
): Promise<GenerationResult> {
  if (!apiKey) {
    throw new Error('OpenAI API-Schlussel fehlt');
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = SYSTEM_PROMPTS[options.language];
  const userPrompt = options.language === 'de'
    ? `Erstelle genau ${options.count} Karteikarten aus folgendem Text. Antworte NUR mit einem JSON-Array im Format:
[{"front": "Frage", "back": "Antwort"}]

Text:
${text}`
    : `Create exactly ${options.count} flashcards from the following text. Respond ONLY with a JSON array in format:
[{"front": "Question", "back": "Answer"}]

Text:
${text}`;

  try {
    const response = await openai.chat.completions.create({
      model: options.model,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
      ],
      max_completion_tokens: 32000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Keine Antwort von OpenAI erhalten');
    }

    // Calculate usage data
    const promptTokens = response.usage?.prompt_tokens ?? 0;
    const completionTokens = response.usage?.completion_tokens ?? 0;
    const costUsd = calculateCost(options.model, promptTokens, completionTokens);

    const usage: UsageData = {
      model: options.model,
      promptTokens,
      completionTokens,
      costUsd,
    };

    // Parse JSON from response
    // Try to extract JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Konnte keine Karteikarten aus der Antwort extrahieren');
    }

    const rawCards = JSON.parse(jsonMatch[0]) as Array<{ front: string; back: string }>;

    // Validate and normalize cards - always basic type
    const cards: GeneratedCard[] = rawCards.map((card) => ({
      front: card.front?.trim() || '',
      back: card.back?.trim() || '',
      cardType: 'basic' as FlashcardType,
    })).filter(card => card.front && card.back);

    return { cards, usage };
  } catch (error: any) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Ungueltiger OpenAI API-Schlussel');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI Kontingent erschopft');
    }
    throw error;
  }
}

export async function generateFlashcardsFromHighlight(
  apiKey: string,
  highlightText: string,
  model: OpenAIModel,
  language: 'de' | 'en'
): Promise<GenerationResult> {
  // For highlights, generate 1-3 cards depending on text length
  const count = Math.min(3, Math.max(1, Math.floor(highlightText.length / 100)));

  return generateFlashcards(apiKey, highlightText, {
    model,
    language,
    count,
  });
}

export interface OutlineResult {
  outline: OutlineItem[];
  usage: UsageData;
}

/**
 * Generate a table of contents from PDF text using AI
 * Analyzes the first pages to detect chapter/section structure
 */
export async function generateOutlineFromText(
  apiKey: string,
  text: string,
  model: OpenAIModel,
  totalPages: number
): Promise<OutlineResult> {
  if (!apiKey) {
    throw new Error('OpenAI API-Schlussel fehlt');
  }

  const openai = new OpenAI({ apiKey });

  const userPrompt = `Extrahiere das VOLLSTANDIGE Inhaltsverzeichnis aus diesem PDF-Text. Das Dokument hat ${totalPages} Seiten.

Antworte NUR mit JSON (keine Erklarung):
[{"title":"Kapitel","pageIndex":0,"children":[{"title":"Unterkapitel","pageIndex":1,"children":[]}]}]

pageIndex ist 0-basiert (Seite 1 = Index 0).

WICHTIG: Extrahiere ALLE Teile, Kapitel und Unterkapitel vollstandig!

Text:
${text.slice(0, 25000)}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 16000,
    });

    console.log('OpenAI Response:', JSON.stringify(response, null, 2));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('No content in response. Full response:', response);
      throw new Error('Keine Antwort von OpenAI erhalten');
    }

    // Calculate usage data
    const promptTokens = response.usage?.prompt_tokens ?? 0;
    const completionTokens = response.usage?.completion_tokens ?? 0;
    const costUsd = calculateCost(model, promptTokens, completionTokens);

    const usage: UsageData = {
      model,
      promptTokens,
      completionTokens,
      costUsd,
    };

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Konnte kein Inhaltsverzeichnis aus der Antwort extrahieren');
    }

    const rawOutline = JSON.parse(jsonMatch[0]) as OutlineItem[];

    // Validate and normalize outline items
    function validateOutlineItem(item: any): OutlineItem {
      return {
        title: String(item.title || '').trim(),
        pageIndex: Math.max(0, Math.min(totalPages - 1, parseInt(item.pageIndex) || 0)),
        children: Array.isArray(item.children)
          ? item.children.map(validateOutlineItem)
          : [],
      };
    }

    const outline = rawOutline.map(validateOutlineItem).filter(item => item.title);
    return { outline, usage };
  } catch (error: any) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Ungueltiger OpenAI API-Schlussel');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI Kontingent erschopft');
    }
    throw error;
  }
}

// =============================================================================
// AI Text Explanation
// =============================================================================

export interface ExplanationResult {
  explanation: string;
  usage: UsageData;
}

interface ExplanationOptions {
  text: string;
  style: ExplanationStyle;
  language: 'de' | 'en';
  context?: string; // Optional: document name for context
}

const EXPLANATION_PROMPTS = {
  short: {
    de: `Du bist ein hilfreicher Erklärer. Erkläre den folgenden Text in 1-2 einfachen Sätzen, als würdest du es einem Anfänger erklären. Sei präzise und vermeide Fachjargon.`,
    en: `You are a helpful explainer. Explain the following text in 1-2 simple sentences, as if explaining to a beginner. Be precise and avoid jargon.`,
  },
  detailed: {
    de: `Du bist ein hilfreicher Erklärer. Erkläre den folgenden Text ausführlich und strukturiert:
1. Was bedeutet der Text?
2. Warum ist das wichtig?
3. Gib ein einfaches Beispiel oder eine Analogie.

Formatiere deine Antwort klar und übersichtlich.`,
    en: `You are a helpful explainer. Explain the following text in detail and structured:
1. What does the text mean?
2. Why is this important?
3. Give a simple example or analogy.

Format your answer clearly and organized.`,
  },
};

export async function generateExplanation(
  apiKey: string,
  model: OpenAIModel,
  options: ExplanationOptions
): Promise<ExplanationResult> {
  if (!apiKey) {
    throw new Error('OpenAI API-Schlüssel fehlt');
  }

  // Truncate very long text to avoid excessive tokens
  const maxTextLength = 2000;
  const text = options.text.length > maxTextLength
    ? options.text.slice(0, maxTextLength) + '...'
    : options.text;

  const openai = new OpenAI({ apiKey });

  const systemPrompt = EXPLANATION_PROMPTS[options.style][options.language];
  const userPrompt = options.language === 'de'
    ? `Text:\n"${text}"`
    : `Text:\n"${text}"`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: options.style === 'detailed' ? 1000 : 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Keine Antwort von OpenAI erhalten');
    }

    // Calculate usage data
    const promptTokens = response.usage?.prompt_tokens ?? 0;
    const completionTokens = response.usage?.completion_tokens ?? 0;
    const costUsd = calculateCost(model, promptTokens, completionTokens);

    const usage: UsageData = {
      model,
      promptTokens,
      completionTokens,
      costUsd,
    };

    return {
      explanation: content.trim(),
      usage,
    };
  } catch (error: any) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Ungültiger OpenAI API-Schlüssel');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI Kontingent erschöpft');
    }
    throw error;
  }
}

// =============================================================================
// AI Summary Generation
// =============================================================================

export interface SummaryGenResult {
  title: string;
  summary: string;
  usage: UsageData;
}

interface SummaryOptions {
  text: string;
  startPage: number;
  endPage: number;
  language: 'de' | 'en';
  documentName?: string;
}

const SUMMARY_PROMPTS = {
  de: `Du bist ein Experte für das Zusammenfassen von Texten. Erstelle eine strukturierte Zusammenfassung des folgenden Textabschnitts.

Antworte im folgenden JSON-Format:
{"title": "Kurzer, prägnanter Titel", "summary": "Detaillierte Zusammenfassung mit den wichtigsten Punkten"}

Die Zusammenfassung sollte:
- Die Kernaussagen erfassen
- Wichtige Konzepte erklären
- In klarer, verständlicher Sprache sein
- Bei längeren Texten mit Bullet-Points strukturiert sein`,
  en: `You are an expert at summarizing texts. Create a structured summary of the following text section.

Respond in the following JSON format:
{"title": "Short, concise title", "summary": "Detailed summary with key points"}

The summary should:
- Capture the core messages
- Explain important concepts
- Be in clear, understandable language
- Use bullet points for longer texts`,
};

export async function generateSummary(
  apiKey: string,
  model: OpenAIModel,
  options: SummaryOptions
): Promise<SummaryGenResult> {
  if (!apiKey) {
    throw new Error('OpenAI API-Schlüssel fehlt');
  }

  // Truncate very long text to avoid excessive tokens
  const maxTextLength = 12000;
  const text = options.text.length > maxTextLength
    ? options.text.slice(0, maxTextLength) + '...'
    : options.text;

  const openai = new OpenAI({ apiKey });

  const systemPrompt = SUMMARY_PROMPTS[options.language];
  const pageRange = options.startPage === options.endPage
    ? `Seite ${options.startPage}`
    : `Seiten ${options.startPage}-${options.endPage}`;

  const userPrompt = options.language === 'de'
    ? `Textabschnitt (${pageRange}):\n\n${text}`
    : `Text section (pages ${options.startPage}-${options.endPage}):\n\n${text}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Keine Antwort von OpenAI erhalten');
    }

    // Calculate usage data
    const promptTokens = response.usage?.prompt_tokens ?? 0;
    const completionTokens = response.usage?.completion_tokens ?? 0;
    const costUsd = calculateCost(model, promptTokens, completionTokens);

    const usage: UsageData = {
      model,
      promptTokens,
      completionTokens,
      costUsd,
    };

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: use content as summary directly
      return {
        title: pageRange,
        summary: content.trim(),
        usage,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { title: string; summary: string };

    return {
      title: parsed.title || pageRange,
      summary: parsed.summary || content.trim(),
      usage,
    };
  } catch (error: any) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Ungültiger OpenAI API-Schlüssel');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI Kontingent erschöpft');
    }
    throw error;
  }
}
