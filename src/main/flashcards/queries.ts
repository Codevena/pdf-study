import type { DatabaseInstance } from '../database';
import type {
  FlashcardDeck,
  Flashcard,
  FlashcardFSRS,
  FlashcardWithFSRS,
  FlashcardReview,
  FlashcardStats,
  FSRSRating,
  FSRSState,
} from '../../shared/types';
import { createNewFSRSCard, fsrsCardToDb } from './fsrs';

// ============ DECK QUERIES ============

export function getAllDecks(db: DatabaseInstance, pdfId?: number): FlashcardDeck[] {
  let query = `
    SELECT
      d.id, d.pdf_id as pdfId, d.name, d.description,
      d.created_at as createdAt, d.updated_at as updatedAt,
      COUNT(DISTINCT f.id) as cardCount,
      COUNT(DISTINCT CASE WHEN fs.due <= datetime('now') THEN f.id END) as dueCount
    FROM flashcard_decks d
    LEFT JOIN flashcards f ON f.deck_id = d.id
    LEFT JOIN flashcard_fsrs fs ON fs.flashcard_id = f.id
  `;

  if (pdfId !== undefined) {
    query += ` WHERE d.pdf_id = ? OR d.pdf_id IS NULL`;
  }

  query += ` GROUP BY d.id ORDER BY d.updated_at DESC`;

  if (pdfId !== undefined) {
    return db.prepare(query).all(pdfId) as FlashcardDeck[];
  }
  return db.prepare(query).all() as FlashcardDeck[];
}

export function getDeckById(db: DatabaseInstance, id: number): FlashcardDeck | undefined {
  return db.prepare(`
    SELECT
      d.id, d.pdf_id as pdfId, d.name, d.description,
      d.created_at as createdAt, d.updated_at as updatedAt,
      COUNT(DISTINCT f.id) as cardCount,
      COUNT(DISTINCT CASE WHEN fs.due <= datetime('now') THEN f.id END) as dueCount
    FROM flashcard_decks d
    LEFT JOIN flashcards f ON f.deck_id = d.id
    LEFT JOIN flashcard_fsrs fs ON fs.flashcard_id = f.id
    WHERE d.id = ?
    GROUP BY d.id
  `).get(id) as FlashcardDeck | undefined;
}

export function createDeck(
  db: DatabaseInstance,
  name: string,
  pdfId?: number,
  description?: string
): number {
  const result = db.prepare(`
    INSERT INTO flashcard_decks (pdf_id, name, description)
    VALUES (?, ?, ?)
  `).run(pdfId ?? null, name, description ?? null);
  return result.lastInsertRowid as number;
}

export function updateDeck(
  db: DatabaseInstance,
  id: number,
  name: string,
  description?: string
): void {
  db.prepare(`
    UPDATE flashcard_decks
    SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, description ?? null, id);
}

export function deleteDeck(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM flashcard_decks WHERE id = ?').run(id);
}

// ============ FLASHCARD QUERIES ============

export function getCardsByDeck(db: DatabaseInstance, deckId: number): FlashcardWithFSRS[] {
  const cards = db.prepare(`
    SELECT
      f.id, f.deck_id as deckId, f.highlight_id as highlightId,
      f.front, f.back, f.card_type as cardType, f.cloze_data as clozeData,
      f.source_page as sourcePage, f.created_at as createdAt, f.updated_at as updatedAt,
      fs.id as fsrsId, fs.difficulty, fs.stability, fs.retrievability,
      fs.state, fs.due, fs.last_review as lastReview, fs.reps, fs.lapses,
      fs.scheduled_days as scheduledDays, fs.elapsed_days as elapsedDays
    FROM flashcards f
    LEFT JOIN flashcard_fsrs fs ON fs.flashcard_id = f.id
    WHERE f.deck_id = ?
    ORDER BY f.created_at DESC
  `).all(deckId) as any[];

  return cards.map(row => ({
    id: row.id,
    deckId: row.deckId,
    highlightId: row.highlightId,
    front: row.front,
    back: row.back,
    cardType: row.cardType,
    clozeData: row.clozeData,
    sourcePage: row.sourcePage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fsrs: {
      id: row.fsrsId,
      flashcardId: row.id,
      difficulty: row.difficulty ?? 0,
      stability: row.stability ?? 0,
      retrievability: row.retrievability ?? 1,
      state: row.state ?? 0,
      due: row.due ?? new Date().toISOString(),
      lastReview: row.lastReview,
      reps: row.reps ?? 0,
      lapses: row.lapses ?? 0,
      scheduledDays: row.scheduledDays ?? 0,
      elapsedDays: row.elapsedDays ?? 0,
    },
  }));
}

export function getCardById(db: DatabaseInstance, id: number): FlashcardWithFSRS | undefined {
  const row = db.prepare(`
    SELECT
      f.id, f.deck_id as deckId, f.highlight_id as highlightId,
      f.front, f.back, f.card_type as cardType, f.cloze_data as clozeData,
      f.source_page as sourcePage, f.created_at as createdAt, f.updated_at as updatedAt,
      fs.id as fsrsId, fs.difficulty, fs.stability, fs.retrievability,
      fs.state, fs.due, fs.last_review as lastReview, fs.reps, fs.lapses,
      fs.scheduled_days as scheduledDays, fs.elapsed_days as elapsedDays
    FROM flashcards f
    LEFT JOIN flashcard_fsrs fs ON fs.flashcard_id = f.id
    WHERE f.id = ?
  `).get(id) as any;

  if (!row) return undefined;

  return {
    id: row.id,
    deckId: row.deckId,
    highlightId: row.highlightId,
    front: row.front,
    back: row.back,
    cardType: row.cardType,
    clozeData: row.clozeData,
    sourcePage: row.sourcePage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fsrs: {
      id: row.fsrsId,
      flashcardId: row.id,
      difficulty: row.difficulty ?? 0,
      stability: row.stability ?? 0,
      retrievability: row.retrievability ?? 1,
      state: row.state ?? 0,
      due: row.due ?? new Date().toISOString(),
      lastReview: row.lastReview,
      reps: row.reps ?? 0,
      lapses: row.lapses ?? 0,
      scheduledDays: row.scheduledDays ?? 0,
      elapsedDays: row.elapsedDays ?? 0,
    },
  };
}

export function addCard(
  db: DatabaseInstance,
  deckId: number,
  front: string,
  back: string,
  cardType: 'basic' | 'cloze' = 'basic',
  highlightId?: number,
  sourcePage?: number,
  clozeData?: string
): number {
  // Insert flashcard
  const cardResult = db.prepare(`
    INSERT INTO flashcards (deck_id, highlight_id, front, back, card_type, cloze_data, source_page)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(deckId, highlightId ?? null, front, back, cardType, clozeData ?? null, sourcePage ?? null);

  const cardId = cardResult.lastInsertRowid as number;

  // Create FSRS entry for the card
  const newCard = createNewFSRSCard();
  const fsrsData = fsrsCardToDb(newCard);

  db.prepare(`
    INSERT INTO flashcard_fsrs (flashcard_id, difficulty, stability, retrievability, state, due, last_review, reps, lapses, scheduled_days, elapsed_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cardId,
    fsrsData.difficulty,
    fsrsData.stability,
    1, // Initial retrievability
    fsrsData.state,
    fsrsData.due,
    fsrsData.lastReview,
    fsrsData.reps,
    fsrsData.lapses,
    fsrsData.scheduledDays,
    fsrsData.elapsedDays
  );

  // Update deck's updated_at
  db.prepare('UPDATE flashcard_decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(deckId);

  return cardId;
}

export function updateCard(
  db: DatabaseInstance,
  id: number,
  front: string,
  back: string,
  cardType?: 'basic' | 'cloze',
  clozeData?: string
): void {
  db.prepare(`
    UPDATE flashcards
    SET front = ?, back = ?, card_type = COALESCE(?, card_type), cloze_data = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(front, back, cardType ?? null, clozeData ?? null, id);
}

export function deleteCard(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM flashcards WHERE id = ?').run(id);
}

// ============ FSRS / STUDY QUERIES ============

export function getDueCards(
  db: DatabaseInstance,
  deckId?: number,
  limit: number = 50
): FlashcardWithFSRS[] {
  let query = `
    SELECT
      f.id, f.deck_id as deckId, f.highlight_id as highlightId,
      f.front, f.back, f.card_type as cardType, f.cloze_data as clozeData,
      f.source_page as sourcePage, f.created_at as createdAt, f.updated_at as updatedAt,
      fs.id as fsrsId, fs.difficulty, fs.stability, fs.retrievability,
      fs.state, fs.due, fs.last_review as lastReview, fs.reps, fs.lapses,
      fs.scheduled_days as scheduledDays, fs.elapsed_days as elapsedDays
    FROM flashcards f
    JOIN flashcard_fsrs fs ON fs.flashcard_id = f.id
    WHERE fs.due <= datetime('now')
  `;

  if (deckId !== undefined) {
    query += ` AND f.deck_id = ?`;
  }

  // Order: New cards first, then by due date
  query += ` ORDER BY fs.state ASC, fs.due ASC LIMIT ?`;

  const params = deckId !== undefined ? [deckId, limit] : [limit];
  const cards = db.prepare(query).all(...params) as any[];

  return cards.map(row => ({
    id: row.id,
    deckId: row.deckId,
    highlightId: row.highlightId,
    front: row.front,
    back: row.back,
    cardType: row.cardType,
    clozeData: row.clozeData,
    sourcePage: row.sourcePage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fsrs: {
      id: row.fsrsId,
      flashcardId: row.id,
      difficulty: row.difficulty,
      stability: row.stability,
      retrievability: row.retrievability,
      state: row.state,
      due: row.due,
      lastReview: row.lastReview,
      reps: row.reps,
      lapses: row.lapses,
      scheduledDays: row.scheduledDays,
      elapsedDays: row.elapsedDays,
    },
  }));
}

export function updateFSRS(
  db: DatabaseInstance,
  flashcardId: number,
  fsrsData: {
    difficulty: number;
    stability: number;
    state: FSRSState;
    due: string;
    lastReview: string | null;
    reps: number;
    lapses: number;
    scheduledDays: number;
    elapsedDays: number;
  }
): void {
  db.prepare(`
    UPDATE flashcard_fsrs
    SET difficulty = ?, stability = ?, state = ?, due = ?, last_review = ?,
        reps = ?, lapses = ?, scheduled_days = ?, elapsed_days = ?
    WHERE flashcard_id = ?
  `).run(
    fsrsData.difficulty,
    fsrsData.stability,
    fsrsData.state,
    fsrsData.due,
    fsrsData.lastReview,
    fsrsData.reps,
    fsrsData.lapses,
    fsrsData.scheduledDays,
    fsrsData.elapsedDays,
    flashcardId
  );
}

export function addReview(
  db: DatabaseInstance,
  flashcardId: number,
  rating: FSRSRating,
  scheduledDays: number,
  elapsedDays: number,
  state: FSRSState
): void {
  db.prepare(`
    INSERT INTO flashcard_reviews (flashcard_id, rating, scheduled_days, elapsed_days, state)
    VALUES (?, ?, ?, ?, ?)
  `).run(flashcardId, rating, scheduledDays, elapsedDays, state);
}

export function getStats(db: DatabaseInstance, deckId?: number): FlashcardStats {
  const whereClause = deckId !== undefined ? 'WHERE f.deck_id = ?' : '';
  const params = deckId !== undefined ? [deckId] : [];

  const stats = db.prepare(`
    SELECT
      COUNT(f.id) as totalCards,
      SUM(CASE WHEN fs.state = 0 THEN 1 ELSE 0 END) as newCards,
      SUM(CASE WHEN fs.state = 1 THEN 1 ELSE 0 END) as learningCards,
      SUM(CASE WHEN fs.state = 2 THEN 1 ELSE 0 END) as reviewCards,
      SUM(CASE WHEN fs.due <= datetime('now') THEN 1 ELSE 0 END) as dueToday
    FROM flashcards f
    LEFT JOIN flashcard_fsrs fs ON fs.flashcard_id = f.id
    ${whereClause}
  `).get(...params) as any;

  // Count reviews today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const reviewedTodayQuery = deckId !== undefined
    ? `SELECT COUNT(*) as count FROM flashcard_reviews r JOIN flashcards f ON f.id = r.flashcard_id WHERE r.reviewed_at >= ? AND f.deck_id = ?`
    : `SELECT COUNT(*) as count FROM flashcard_reviews WHERE reviewed_at >= ?`;

  const reviewedTodayParams = deckId !== undefined
    ? [todayStart.toISOString(), deckId]
    : [todayStart.toISOString()];

  const reviewedToday = db.prepare(reviewedTodayQuery).get(...reviewedTodayParams) as { count: number };

  return {
    totalCards: stats?.totalCards ?? 0,
    newCards: stats?.newCards ?? 0,
    learningCards: stats?.learningCards ?? 0,
    reviewCards: stats?.reviewCards ?? 0,
    dueToday: stats?.dueToday ?? 0,
    reviewedToday: reviewedToday?.count ?? 0,
    streak: 0, // TODO: Calculate streak
  };
}
