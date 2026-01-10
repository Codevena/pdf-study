import OpenAI from 'openai';
import type { OpenAIModel, GeneratedCard, FlashcardType } from '../../shared/types';

interface GenerationOptions {
  model: OpenAIModel;
  cardType: 'basic' | 'cloze' | 'mixed';
  language: 'de' | 'en';
  count: number;
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

export async function generateFlashcards(
  apiKey: string,
  text: string,
  options: GenerationOptions
): Promise<GeneratedCard[]> {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Keine Antwort von OpenAI erhalten');
    }

    // Parse JSON from response
    // Try to extract JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Konnte keine Karteikarten aus der Antwort extrahieren');
    }

    const cards = JSON.parse(jsonMatch[0]) as GeneratedCard[];

    // Validate and normalize cards
    return cards.map((card) => ({
      front: card.front?.trim() || '',
      back: card.back?.trim() || '',
      cardType: (card.cardType === 'cloze' ? 'cloze' : 'basic') as FlashcardType,
    })).filter(card => card.front && card.back);
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
): Promise<GeneratedCard[]> {
  // For highlights, generate 1-3 cards depending on text length
  const count = Math.min(3, Math.max(1, Math.floor(highlightText.length / 100)));

  return generateFlashcards(apiKey, highlightText, {
    model,
    cardType: 'mixed',
    language,
    count,
  });
}
