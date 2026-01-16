import { ipcMain } from 'electron';
import * as queries from '../database/queries';
import * as flashcardQueries from '../flashcards/queries';
import { generateExplanation, generateFlashcardsFromHighlight, generateSummary } from '../flashcards/ai-generator';
import { extractTextFromPages } from '../pdf/extractor';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ExplanationStyle } from '../../shared/types';
import type { HandlerContext } from './types';
import { getAIConfig } from './utils';

export function registerAiHandlers({ db }: HandlerContext): void {
  // API Usage Stats
  ipcMain.handle(IPC_CHANNELS.API_GET_USAGE_STATS, () => {
    return queries.getApiUsageStats(db);
  });

  ipcMain.handle(IPC_CHANNELS.API_CLEAR_USAGE, () => {
    queries.clearApiUsage(db);
    return { success: true };
  });

  // AI Explanation Handlers
  ipcMain.handle(
    IPC_CHANNELS.EXPLAIN_TEXT,
    async (
      _,
      text: string,
      style: ExplanationStyle,
      pdfId: number,
      pageNum: number
    ) => {
      const config = getAIConfig(db);
      const language = (queries.getSetting(db, 'flashcardLanguage') as 'de' | 'en') || 'de';

      try {
        const result = await generateExplanation(config, {
          text,
          style,
          language,
        });

        // Save to database
        const id = queries.addExplanation(db, pdfId, pageNum, text, result.explanation, style);

        // Track API usage
        queries.addApiUsage(
          db,
          result.usage.model,
          'explanation',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.costUsd
        );

        return {
          success: true,
          explanation: result.explanation,
          id,
          cost: result.usage.costUsd,
        };
      } catch (error: any) {
        console.error('Explanation generation error:', error);
        return { success: false, error: error.message || 'Fehler bei der Erklaerungsgenerierung' };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_EXPLANATIONS, (_, pdfId: number, pageNum?: number) => {
    return queries.getExplanations(db, pdfId, pageNum);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_EXPLANATION, (_, id: number) => {
    queries.deleteExplanation(db, id);
    return { success: true };
  });

  // AI Quiz from Highlight
  ipcMain.handle(
    IPC_CHANNELS.GENERATE_QUIZ_FROM_HIGHLIGHT,
    async (
      _,
      highlightText: string,
      deckId: number,
      highlightId: number,
      pageNum: number
    ) => {
      const config = getAIConfig(db);
      const language = (queries.getSetting(db, 'flashcardLanguage') as 'de' | 'en') || 'de';

      try {
        const result = await generateFlashcardsFromHighlight(config, highlightText, language);

        // Add cards to deck
        let cardsCreated = 0;
        for (const card of result.cards) {
          flashcardQueries.addCard(db, deckId, card.front, card.back, 'basic', highlightId, pageNum);
          cardsCreated++;
        }

        // Track API usage
        queries.addApiUsage(
          db,
          result.usage.model,
          'quiz_from_highlight',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.costUsd
        );

        return {
          success: true,
          cardsCreated,
          deckId,
          cost: result.usage.costUsd,
        };
      } catch (error: any) {
        console.error('Quiz from highlight error:', error);
        return { success: false, error: error.message || 'Fehler bei der Quiz-Generierung' };
      }
    }
  );

  // AI Summary Handlers
  ipcMain.handle(
    IPC_CHANNELS.GENERATE_SUMMARY,
    async (
      _,
      pdfId: number,
      filePath: string,
      startPage: number,
      endPage: number
    ) => {
      const config = getAIConfig(db);
      const language = (queries.getSetting(db, 'flashcardLanguage') as 'de' | 'en') || 'de';

      try {
        // Extract text from pages
        const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
        const { text } = await extractTextFromPages(filePath, pageNumbers);

        if (!text || text.trim().length < 50) {
          return { success: false, error: 'Nicht genugend Text auf den ausgewaehlten Seiten gefunden.' };
        }

        const result = await generateSummary(config, {
          text,
          startPage,
          endPage,
          language,
        });

        // Save to database
        const id = queries.addSummary(db, pdfId, startPage, endPage, result.title, result.summary);

        // Track API usage
        queries.addApiUsage(
          db,
          result.usage.model,
          'summary',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.costUsd
        );

        return {
          success: true,
          summary: result.summary,
          title: result.title,
          id,
          cost: result.usage.costUsd,
        };
      } catch (error: any) {
        console.error('Summary generation error:', error);
        return { success: false, error: error.message || 'Fehler bei der Zusammenfassung' };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_SUMMARIES, (_, pdfId: number) => {
    return queries.getSummaries(db, pdfId);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_SUMMARY, (_, id: number) => {
    queries.deleteSummary(db, id);
    return { success: true };
  });
}
