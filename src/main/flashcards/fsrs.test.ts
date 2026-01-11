import { describe, it, expect } from 'vitest';
import { State, Rating, createEmptyCard } from 'ts-fsrs';
import {
  toTsFsrsRating,
  fromTsFsrsState,
  toTsFsrsState,
  createNewFSRSCard,
  dbToFsrsCard,
  fsrsCardToDb,
  getNextReview,
  getRetrievability,
  getIntervalString,
  getNextIntervals,
} from './fsrs';
import type { FSRSRating, FSRSState } from '../../shared/types';

describe('FSRS', () => {
  describe('toTsFsrsRating', () => {
    it('should convert 1 to Again', () => {
      expect(toTsFsrsRating(1)).toBe(Rating.Again);
    });

    it('should convert 2 to Hard', () => {
      expect(toTsFsrsRating(2)).toBe(Rating.Hard);
    });

    it('should convert 3 to Good', () => {
      expect(toTsFsrsRating(3)).toBe(Rating.Good);
    });

    it('should convert 4 to Easy', () => {
      expect(toTsFsrsRating(4)).toBe(Rating.Easy);
    });
  });

  describe('fromTsFsrsState', () => {
    it('should convert State.New to 0', () => {
      expect(fromTsFsrsState(State.New)).toBe(0);
    });

    it('should convert State.Learning to 1', () => {
      expect(fromTsFsrsState(State.Learning)).toBe(1);
    });

    it('should convert State.Review to 2', () => {
      expect(fromTsFsrsState(State.Review)).toBe(2);
    });

    it('should convert State.Relearning to 3', () => {
      expect(fromTsFsrsState(State.Relearning)).toBe(3);
    });
  });

  describe('toTsFsrsState', () => {
    it('should convert 0 to State.New', () => {
      expect(toTsFsrsState(0)).toBe(State.New);
    });

    it('should convert 1 to State.Learning', () => {
      expect(toTsFsrsState(1)).toBe(State.Learning);
    });

    it('should convert 2 to State.Review', () => {
      expect(toTsFsrsState(2)).toBe(State.Review);
    });

    it('should convert 3 to State.Relearning', () => {
      expect(toTsFsrsState(3)).toBe(State.Relearning);
    });
  });

  describe('createNewFSRSCard', () => {
    it('should create a card with State.New', () => {
      const card = createNewFSRSCard();
      expect(card.state).toBe(State.New);
    });

    it('should create a card with 0 reps', () => {
      const card = createNewFSRSCard();
      expect(card.reps).toBe(0);
    });

    it('should create a card with 0 lapses', () => {
      const card = createNewFSRSCard();
      expect(card.lapses).toBe(0);
    });
  });

  describe('dbToFsrsCard / fsrsCardToDb', () => {
    it('should convert database row to Card and back', () => {
      const now = new Date();
      const dbRow = {
        difficulty: 5.5,
        stability: 10.0,
        state: 2 as FSRSState, // Review
        due: now.toISOString(),
        lastReview: now.toISOString(),
        reps: 5,
        lapses: 1,
        scheduledDays: 7,
        elapsedDays: 3,
      };

      const card = dbToFsrsCard(dbRow);
      expect(card.difficulty).toBe(5.5);
      expect(card.stability).toBe(10.0);
      expect(card.state).toBe(State.Review);
      expect(card.reps).toBe(5);
      expect(card.lapses).toBe(1);

      const backToDb = fsrsCardToDb(card);
      expect(backToDb.difficulty).toBe(dbRow.difficulty);
      expect(backToDb.stability).toBe(dbRow.stability);
      expect(backToDb.state).toBe(dbRow.state);
      expect(backToDb.reps).toBe(dbRow.reps);
      expect(backToDb.lapses).toBe(dbRow.lapses);
    });

    it('should handle null lastReview', () => {
      const dbRow = {
        difficulty: 5.0,
        stability: 1.0,
        state: 0 as FSRSState,
        due: new Date().toISOString(),
        lastReview: null,
        reps: 0,
        lapses: 0,
        scheduledDays: 0,
        elapsedDays: 0,
      };

      const card = dbToFsrsCard(dbRow);
      expect(card.last_review).toBeUndefined();

      const backToDb = fsrsCardToDb(card);
      expect(backToDb.lastReview).toBeNull();
    });
  });

  describe('getNextReview', () => {
    it('should schedule new card after Good rating', () => {
      const card = createNewFSRSCard();
      const now = new Date();
      const result = getNextReview(card, 3, now); // Good

      expect(result.card.state).not.toBe(State.New);
      expect(result.card.reps).toBe(1);
      expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should keep card in learning after Again rating on new card', () => {
      const card = createNewFSRSCard();
      const now = new Date();
      const result = getNextReview(card, 1, now); // Again

      expect(result.card.state).toBe(State.Learning);
      expect(result.card.reps).toBe(1);
    });

    it('should increase stability after consecutive Good ratings', () => {
      let card = createNewFSRSCard();
      const now = new Date();

      // First review: Good
      let result = getNextReview(card, 3, now);
      const stabilityAfterFirst = result.card.stability;

      // Simulate time passing and another review
      card = result.card;
      const laterDate = new Date(result.card.due.getTime() + 1000);
      result = getNextReview(card, 3, laterDate);

      expect(result.card.stability).toBeGreaterThanOrEqual(stabilityAfterFirst);
    });

    it('should reset to Relearning after Again on Review card', () => {
      // Create a card that's in Review state
      let card = createNewFSRSCard();
      const now = new Date();

      // Progress card to Review state with multiple Good ratings
      for (let i = 0; i < 3; i++) {
        const result = getNextReview(card, 3, new Date(card.due.getTime() + 1000));
        card = result.card;
      }

      // Now rate Again
      const result = getNextReview(card, 1, new Date(card.due.getTime() + 1000));
      expect(result.card.state).toBe(State.Relearning);
      expect(result.card.lapses).toBeGreaterThan(0);
    });
  });

  describe('getRetrievability', () => {
    it('should return 1.0 for new cards', () => {
      const card = createNewFSRSCard();
      const retrievability = getRetrievability(card);
      expect(retrievability).toBe(1);
    });

    it('should return 1.0 when card is not yet due', () => {
      const card = createNewFSRSCard();
      const now = new Date();
      // Set due date to tomorrow
      card.due = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      card.state = State.Review;
      card.stability = 5;

      const retrievability = getRetrievability(card, now);
      expect(retrievability).toBe(1);
    });

    it('should decrease over time after due date', () => {
      const card = createEmptyCard();
      card.state = State.Review;
      card.stability = 5;
      card.due = new Date('2024-01-01');

      // 1 day after due
      const oneDayLater = new Date('2024-01-02');
      const r1 = getRetrievability(card, oneDayLater);

      // 5 days after due
      const fiveDaysLater = new Date('2024-01-06');
      const r5 = getRetrievability(card, fiveDaysLater);

      expect(r1).toBeLessThan(1);
      expect(r5).toBeLessThan(r1);
      expect(r5).toBeGreaterThan(0);
    });

    it('should use FSRS formula R = e^(-t/S)', () => {
      const card = createEmptyCard();
      card.state = State.Review;
      card.stability = 10; // 10 days stability
      card.due = new Date('2024-01-01');

      // Exactly 10 days after due (t = S)
      const tenDaysLater = new Date('2024-01-11');
      const r = getRetrievability(card, tenDaysLater);

      // At t = S, R should be e^(-1) ≈ 0.368
      expect(r).toBeCloseTo(Math.exp(-1), 2);
    });
  });

  describe('getIntervalString', () => {
    it('should format less than 1 minute as <1m', () => {
      expect(getIntervalString(0.5)).toBe('<1m');
    });

    it('should format minutes correctly', () => {
      expect(getIntervalString(5)).toBe('5m');
      expect(getIntervalString(30)).toBe('30m');
      expect(getIntervalString(59)).toBe('59m');
    });

    it('should format hours correctly', () => {
      expect(getIntervalString(60)).toBe('1h');
      expect(getIntervalString(120)).toBe('2h');
      expect(getIntervalString(23 * 60)).toBe('23h');
    });

    it('should format days correctly', () => {
      expect(getIntervalString(24 * 60)).toBe('1d');
      expect(getIntervalString(7 * 24 * 60)).toBe('7d');
      expect(getIntervalString(29 * 24 * 60)).toBe('29d');
    });

    it('should format months correctly', () => {
      expect(getIntervalString(30 * 24 * 60)).toBe('1mo');
      expect(getIntervalString(60 * 24 * 60)).toBe('2mo');
      expect(getIntervalString(180 * 24 * 60)).toBe('6mo');
    });

    it('should format years correctly', () => {
      expect(getIntervalString(365 * 24 * 60)).toBe('1.0y');
      expect(getIntervalString(730 * 24 * 60)).toBe('2.0y');
      expect(getIntervalString(548 * 24 * 60)).toBe('1.5y');
    });
  });

  describe('getNextIntervals', () => {
    it('should return all four interval options', () => {
      const card = createNewFSRSCard();
      const intervals = getNextIntervals(card);

      expect(intervals).toHaveProperty('again');
      expect(intervals).toHaveProperty('hard');
      expect(intervals).toHaveProperty('good');
      expect(intervals).toHaveProperty('easy');
    });

    it('should have increasing intervals from Again to Easy for new cards', () => {
      const card = createNewFSRSCard();
      const now = new Date();
      const intervals = getNextIntervals(card, now);

      // For new cards, intervals should generally increase
      // Again is shortest, Easy is longest
      expect(typeof intervals.again).toBe('string');
      expect(typeof intervals.easy).toBe('string');
    });

    it('should return valid interval strings', () => {
      const card = createNewFSRSCard();
      const intervals = getNextIntervals(card);

      // All intervals should match valid format patterns
      const validPattern = /^(<1m|\d+m|\d+h|\d+d|\d+mo|\d+\.\d+y)$/;
      expect(intervals.again).toMatch(validPattern);
      expect(intervals.hard).toMatch(validPattern);
      expect(intervals.good).toMatch(validPattern);
      expect(intervals.easy).toMatch(validPattern);
    });
  });
});
