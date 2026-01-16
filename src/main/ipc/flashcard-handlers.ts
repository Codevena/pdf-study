import { ipcMain, dialog } from 'electron';
import fs from 'fs/promises';
import * as queries from '../database/queries';
import * as flashcardQueries from '../flashcards/queries';
import { dbToFsrsCard, fsrsCardToDb, getNextReview, getNextIntervals } from '../flashcards/fsrs';
import { generateFlashcards } from '../flashcards/ai-generator';
import { extractTextFromPages } from '../pdf/extractor';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { FSRSRating, OpenAIModel, GeneratedCard } from '../../shared/types';
import type { HandlerContext } from './types';

export function registerFlashcardHandlers({ db, mainWindow }: HandlerContext): void {
  // Deck Handlers
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_DECKS, (_, pdfId?: number) => {
    return flashcardQueries.getAllDecks(db, pdfId);
  });

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_DECK, (_, id: number) => {
    return flashcardQueries.getDeckById(db, id);
  });

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_CREATE_DECK,
    (_, name: string, pdfId?: number, description?: string) => {
      return flashcardQueries.createDeck(db, name, pdfId, description);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_UPDATE_DECK,
    (_, id: number, name: string, description?: string) => {
      flashcardQueries.updateDeck(db, id, name, description);
      return true;
    }
  );

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_DELETE_DECK, (_, id: number) => {
    flashcardQueries.deleteDeck(db, id);
    return true;
  });

  // Card Handlers
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_CARDS, (_, deckId: number) => {
    return flashcardQueries.getCardsByDeck(db, deckId);
  });

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_CARD, (_, id: number) => {
    return flashcardQueries.getCardById(db, id);
  });

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_ADD_CARD,
    (
      _,
      deckId: number,
      front: string,
      back: string,
      cardType?: 'basic' | 'cloze',
      highlightId?: number,
      sourcePage?: number,
      clozeData?: string
    ) => {
      return flashcardQueries.addCard(
        db,
        deckId,
        front,
        back,
        cardType || 'basic',
        highlightId,
        sourcePage,
        clozeData
      );
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_UPDATE_CARD,
    (_, id: number, front: string, back: string, cardType?: 'basic' | 'cloze', clozeData?: string) => {
      flashcardQueries.updateCard(db, id, front, back, cardType, clozeData);
      return true;
    }
  );

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_DELETE_CARD, (_, id: number) => {
    flashcardQueries.deleteCard(db, id);
    return true;
  });

  // FSRS / Study Handlers
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_DUE, (_, deckId?: number, limit?: number) => {
    const cards = flashcardQueries.getDueCards(db, deckId, limit);
    // Add next intervals preview for each card
    return cards.map(card => ({
      ...card,
      nextIntervals: getNextIntervals(dbToFsrsCard(card.fsrs)),
    }));
  });

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_SUBMIT_REVIEW,
    (_, flashcardId: number, rating: FSRSRating) => {
      const card = flashcardQueries.getCardById(db, flashcardId);
      if (!card) {
        throw new Error('Karte nicht gefunden');
      }

      // Get current FSRS card state
      const fsrsCard = dbToFsrsCard(card.fsrs);

      // Calculate next review
      const { card: nextCard } = getNextReview(fsrsCard, rating);

      // Convert back to DB format
      const nextFsrsData = fsrsCardToDb(nextCard);

      // Update FSRS data in database
      flashcardQueries.updateFSRS(db, flashcardId, nextFsrsData);

      // Record the review
      flashcardQueries.addReview(
        db,
        flashcardId,
        rating,
        nextFsrsData.scheduledDays,
        nextFsrsData.elapsedDays,
        nextFsrsData.state
      );

      // Return updated card with next intervals
      const updatedCard = flashcardQueries.getCardById(db, flashcardId);
      return {
        ...updatedCard,
        nextIntervals: updatedCard ? getNextIntervals(dbToFsrsCard(updatedCard.fsrs)) : null,
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_STATS, (_, deckId?: number) => {
    return flashcardQueries.getStats(db, deckId);
  });

  // Heatmap Handler
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GET_HEATMAP,
    (_, timeframe: 'week' | 'month' | 'year', deckId?: number) => {
      return flashcardQueries.getHeatmapData(db, timeframe, deckId);
    }
  );

  // LearnBuddy Export Handler
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_EXPORT_LEARNBUDDY, async (_, deckId: number) => {
    const cards = flashcardQueries.getCardsByDeck(db, deckId);
    const deck = flashcardQueries.getDeckById(db, deckId);

    if (!deck) {
      return { success: false, error: 'Deck nicht gefunden' };
    }

    // Generate LearnBuddy CSV format
    const csvLines = cards.map(card => {
      // Escape fields with quotes if they contain commas or quotes
      const escapeField = (field: string) => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      return `${escapeField(card.front)},${escapeField(card.back)}`;
    });

    const csvContent = csvLines.join('\n');

    // Show save dialog
    const defaultFileName = `${deck.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_\s]/g, '')}.csv`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'LearnBuddy Export speichern',
      defaultPath: defaultFileName,
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      await fs.writeFile(result.filePath, csvContent, 'utf-8');
      return { success: true, filePath: result.filePath, cardCount: cards.length };
    } catch (error) {
      console.error('Export error:', error);
      return { success: false, error: 'Fehler beim Speichern' };
    }
  });

  // AI Generation Handler
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GENERATE_AI,
    async (
      _,
      text: string,
      options: {
        model: OpenAIModel;
        language: 'de' | 'en';
        count: number;
      }
    ): Promise<{ success: boolean; cards?: GeneratedCard[]; error?: string }> => {
      const apiKey = queries.getSetting(db, 'openaiApiKey');

      if (!apiKey) {
        return { success: false, error: 'OpenAI API-Schlussel nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' };
      }

      try {
        const { cards, usage } = await generateFlashcards(apiKey, text, options);

        // Track API usage
        queries.addApiUsage(
          db,
          usage.model,
          'flashcard_generation',
          usage.promptTokens,
          usage.completionTokens,
          usage.costUsd
        );

        return { success: true, cards };
      } catch (error: any) {
        console.error('AI generation error:', error);
        return { success: false, error: error.message || 'Fehler bei der KI-Generierung' };
      }
    }
  );

  // Get PDF page text for AI generation
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GET_PDF_PAGE_TEXT,
    async (
      _,
      filePath: string,
      pageNumbers: number[]
    ): Promise<{ success: boolean; text?: string; pageCount?: number; error?: string }> => {
      try {
        const result = await extractTextFromPages(filePath, pageNumbers);
        return { success: true, text: result.text, pageCount: result.pageCount };
      } catch (error: any) {
        console.error('PDF text extraction error:', error);
        return { success: false, error: error.message || 'Fehler beim Extrahieren des PDF-Textes' };
      }
    }
  );

  // Generate flashcards from PDF pages
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GENERATE_FROM_PDF,
    async (
      _,
      filePath: string,
      pageNumbers: number[],
      options: {
        model: OpenAIModel;
        language: 'de' | 'en';
        count: number;
      }
    ): Promise<{ success: boolean; cards?: GeneratedCard[]; error?: string }> => {
      const apiKey = queries.getSetting(db, 'openaiApiKey');

      if (!apiKey) {
        return { success: false, error: 'OpenAI API-Schlussel nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' };
      }

      try {
        // Extract text from the specified pages
        const { text } = await extractTextFromPages(filePath, pageNumbers);

        if (!text.trim()) {
          return { success: false, error: 'Kein Text auf den ausgewahlten Seiten gefunden.' };
        }

        // Generate flashcards from the extracted text
        const { cards, usage } = await generateFlashcards(apiKey, text, options);

        // Track API usage
        queries.addApiUsage(
          db,
          usage.model,
          'flashcard_generation_pdf',
          usage.promptTokens,
          usage.completionTokens,
          usage.costUsd
        );

        return { success: true, cards };
      } catch (error: any) {
        console.error('PDF AI generation error:', error);
        return { success: false, error: error.message || 'Fehler bei der KI-Generierung' };
      }
    }
  );
}
