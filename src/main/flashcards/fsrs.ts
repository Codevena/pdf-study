import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type RecordLogItem,
} from 'ts-fsrs';
import type { FSRSRating, FSRSState } from '../../shared/types';

// Initialize FSRS with default parameters and fuzzing enabled
const params = generatorParameters({ enable_fuzz: true });
const scheduler = fsrs(params);

// Type for our internal card representation (without learning_steps)
interface InternalCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;
}

// Convert our FSRSRating to ts-fsrs Rating
export function toTsFsrsRating(rating: FSRSRating): Rating {
  switch (rating) {
    case 1: return Rating.Again;
    case 2: return Rating.Hard;
    case 3: return Rating.Good;
    case 4: return Rating.Easy;
  }
}

// Convert ts-fsrs State to our FSRSState
export function fromTsFsrsState(state: State): FSRSState {
  switch (state) {
    case State.New: return 0;
    case State.Learning: return 1;
    case State.Review: return 2;
    case State.Relearning: return 3;
  }
}

// Convert our FSRSState to ts-fsrs State
export function toTsFsrsState(state: FSRSState): State {
  switch (state) {
    case 0: return State.New;
    case 1: return State.Learning;
    case 2: return State.Review;
    case 3: return State.Relearning;
  }
}

// Create a new empty card for FSRS
export function createNewFSRSCard(): Card {
  return createEmptyCard();
}

// Convert database row to ts-fsrs Card
export function dbToFsrsCard(row: {
  difficulty: number;
  stability: number;
  state: FSRSState;
  due: string;
  lastReview: string | null;
  reps: number;
  lapses: number;
  scheduledDays: number;
  elapsedDays: number;
}): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: toTsFsrsState(row.state),
    last_review: row.lastReview ? new Date(row.lastReview) : undefined,
    learning_steps: 0, // Current learning step index
  };
}

// Convert ts-fsrs Card to database format
export function fsrsCardToDb(card: Card): {
  difficulty: number;
  stability: number;
  state: FSRSState;
  due: string;
  lastReview: string | null;
  reps: number;
  lapses: number;
  scheduledDays: number;
  elapsedDays: number;
} {
  return {
    difficulty: card.difficulty,
    stability: card.stability,
    state: fromTsFsrsState(card.state),
    due: card.due.toISOString(),
    lastReview: card.last_review ? card.last_review.toISOString() : null,
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduled_days,
    elapsedDays: card.elapsed_days,
  };
}

// Get the next review scheduling for a card based on rating
export function getNextReview(
  card: Card,
  rating: FSRSRating,
  now: Date = new Date()
): { card: Card; log: RecordLogItem['log'] } {
  const scheduling = scheduler.repeat(card, now);
  const tsFsrsRating = toTsFsrsRating(rating);
  // IPreview is a RecordLog which is { [key in Grade]: RecordLogItem }
  // Grade is 1, 2, 3, 4 (Again, Hard, Good, Easy)
  const result = (scheduling as any)[tsFsrsRating] as RecordLogItem;
  return {
    card: result.card,
    log: result.log,
  };
}

// Calculate retrievability (probability of recall) for a card
export function getRetrievability(card: Card, now: Date = new Date()): number {
  if (card.state === State.New) {
    return 1;
  }

  const elapsedDays = (now.getTime() - card.due.getTime()) / (1000 * 60 * 60 * 24);
  if (elapsedDays <= 0) {
    return 1;
  }

  // FSRS retrievability formula: R = e^(-t/S)
  // where t is elapsed time and S is stability
  return Math.exp(-elapsedDays / card.stability);
}

// Get human-readable interval string from minutes
export function getIntervalString(minutes: number): string {
  if (minutes < 1) {
    return '<1m';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  if (minutes < 60 * 24) {
    return `${Math.round(minutes / 60)}h`;
  }
  const days = minutes / (60 * 24);
  if (days < 30) {
    return `${Math.round(days)}d`;
  }
  if (days < 365) {
    return `${Math.round(days / 30)}mo`;
  }
  return `${(days / 365).toFixed(1)}y`;
}

// Get all possible next intervals for preview
export function getNextIntervals(
  card: Card,
  now: Date = new Date()
): { again: string; hard: string; good: string; easy: string } {
  const scheduling = scheduler.repeat(card, now);

  // Calculate actual interval in minutes from now to the due date
  const getIntervalMinutes = (rating: Rating): number => {
    const result = (scheduling as any)[rating] as RecordLogItem;
    const dueTime = result.card.due.getTime();
    const nowTime = now.getTime();
    const diffMs = dueTime - nowTime;
    return Math.max(0, diffMs / (1000 * 60)); // Convert ms to minutes
  };

  return {
    again: getIntervalString(getIntervalMinutes(Rating.Again)),
    hard: getIntervalString(getIntervalMinutes(Rating.Hard)),
    good: getIntervalString(getIntervalMinutes(Rating.Good)),
    easy: getIntervalString(getIntervalMinutes(Rating.Easy)),
  };
}
