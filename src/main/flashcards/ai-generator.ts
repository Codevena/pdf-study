import OpenAI from 'openai';
import type { OpenAIModel, GeneratedCard, FlashcardType, OutlineItem } from '../../shared/types';

interface GenerationOptions {
  model: OpenAIModel;
  cardType: 'basic' | 'cloze' | 'mixed';
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
  de: {
    basic: `Du bist ein Experte fur die Erstellung von Lernkarteikarten. Erstelle Karteikarten im Frage-Antwort-Format.

Regeln:
- Jede Karte hat eine klare, prazise Frage auf der Vorderseite
- Die Antwort auf der Ruckseite sollte kurz und einpragsam sein
- Fokussiere auf die wichtigsten Konzepte und Fakten
- Vermeide zu lange oder komplexe Antworten
- Formuliere die Fragen so, dass sie das Verstandnis prufen`,

    cloze: `Du bist ein Experte fur die Erstellung von Luckentext-Karteikarten (Cloze Deletion).

Regeln:
- Verwende das Format {{c1::Text}} fur Lucken
- Mehrere Lucken in einem Satz sind moglich: {{c1::erste Lucke}}, {{c2::zweite Lucke}}
- Wahle wichtige Begriffe, Definitionen oder Schlusselkonzepte als Lucken
- Der Satz sollte auch ohne die Lucken verstandlich sein
- Die Antwort enthalt die Losungen der Lucken`,

    mixed: `Du bist ein Experte fur die Erstellung von Lernkarteikarten. Erstelle eine Mischung aus:
1. Basic-Karten (Frage-Antwort)
2. Cloze-Karten mit Lucken im Format {{c1::Text}}

Wahle das Format, das am besten zum Inhalt passt:
- Definitionen und Fakten eignen sich gut fur Cloze
- Konzeptuelle Fragen fur Basic-Format`,
  },
  en: {
    basic: `You are an expert at creating flashcards. Create question-answer style flashcards.

Rules:
- Each card has a clear, precise question on the front
- The answer on the back should be brief and memorable
- Focus on the most important concepts and facts
- Avoid overly long or complex answers
- Phrase questions to test understanding`,

    cloze: `You are an expert at creating cloze deletion flashcards.

Rules:
- Use the format {{c1::text}} for deletions
- Multiple deletions in one sentence are allowed: {{c1::first deletion}}, {{c2::second deletion}}
- Choose important terms, definitions, or key concepts for deletions
- The sentence should make sense even with the deletions shown
- The answer contains the solutions`,

    mixed: `You are an expert at creating flashcards. Create a mix of:
1. Basic cards (question-answer)
2. Cloze cards with deletions in format {{c1::text}}

Choose the format that best fits the content:
- Definitions and facts work well for cloze
- Conceptual questions for basic format`,
  },
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

  const systemPrompt = SYSTEM_PROMPTS[options.language][options.cardType];
  const userPrompt = options.language === 'de'
    ? `Erstelle genau ${options.count} Karteikarten aus folgendem Text. Antworte NUR mit einem JSON-Array im Format:
[{"front": "Frage/Text mit Lucken", "back": "Antwort", "cardType": "basic oder cloze"}]

Text:
${text}`
    : `Create exactly ${options.count} flashcards from the following text. Respond ONLY with a JSON array in format:
[{"front": "Question/Text with cloze", "back": "Answer", "cardType": "basic or cloze"}]

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

    const rawCards = JSON.parse(jsonMatch[0]) as GeneratedCard[];

    // Validate and normalize cards
    const cards = rawCards.map((card) => ({
      front: card.front?.trim() || '',
      back: card.back?.trim() || '',
      cardType: (card.cardType === 'cloze' ? 'cloze' : 'basic') as FlashcardType,
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
    cardType: 'mixed',
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
