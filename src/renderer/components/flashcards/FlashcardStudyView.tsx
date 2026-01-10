import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { FSRSRating } from '../../../shared/types';

interface FlashcardStudyViewProps {
  onComplete: () => void;
  onBack: () => void;
}

export default function FlashcardStudyView({ onComplete, onBack }: FlashcardStudyViewProps) {
  const {
    dueFlashcards,
    setDueFlashcards,
    currentStudyCard,
    setCurrentStudyCard,
    studyCardIndex,
    setStudyCardIndex,
  } = useAppStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Initialize first card
  useEffect(() => {
    if (dueFlashcards.length > 0 && !currentStudyCard) {
      setCurrentStudyCard(dueFlashcards[0]);
      setStudyCardIndex(0);
    }
  }, [dueFlashcards, currentStudyCard]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;

      if (e.code === 'Space' && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
      } else if (isFlipped) {
        switch (e.key) {
          case '1':
            handleRating(1);
            break;
          case '2':
            handleRating(2);
            break;
          case '3':
            handleRating(3);
            break;
          case '4':
            handleRating(4);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isSubmitting, currentStudyCard]);

  const handleRating = async (rating: FSRSRating) => {
    if (!currentStudyCard || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await window.electronAPI.submitFlashcardReview(currentStudyCard.id, rating);
      setReviewedCount(prev => prev + 1);

      // Move to next card
      const nextIndex = studyCardIndex + 1;
      if (nextIndex < dueFlashcards.length) {
        setCurrentStudyCard(dueFlashcards[nextIndex]);
        setStudyCardIndex(nextIndex);
        setIsFlipped(false);
      } else {
        // Session complete
        setCurrentStudyCard(null);
        setStudyCardIndex(0);
        onComplete();
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse cloze text for display
  const renderCardContent = (text: string, showAnswer: boolean) => {
    if (!currentStudyCard || currentStudyCard.cardType !== 'cloze') {
      return text;
    }

    // Replace cloze deletions
    return text.replace(
      /\{\{c\d+::([^}:]+)(?:::([^}]+))?\}\}/g,
      (match, answer, hint) => {
        if (showAnswer) {
          return `**${answer}**`;
        }
        return hint ? `[${hint}]` : '[...]';
      }
    );
  };

  if (!currentStudyCard) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Session abgeschlossen!
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Du hast {reviewedCount} Karten gelernt.
        </p>
        <button
          onClick={onComplete}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          Zuruck zum Deck
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Beenden
        </button>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{studyCardIndex + 1}</span>
          <span className="mx-1">/</span>
          <span>{dueFlashcards.length}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${((studyCardIndex) / dueFlashcards.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div
          className={`w-full max-w-md perspective-1000 cursor-pointer ${isSubmitting ? 'pointer-events-none' : ''}`}
          onClick={() => !isFlipped && setIsFlipped(true)}
        >
          <div
            className={`relative w-full min-h-[300px] transition-transform duration-500 transform-style-preserve-3d ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="flex-1 flex items-center justify-center">
                <p className="text-lg text-gray-900 dark:text-gray-100 text-center whitespace-pre-wrap">
                  {renderCardContent(currentStudyCard.front, false)}
                </p>
              </div>
              <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
                Tippen oder Leertaste zum Aufdecken
              </div>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                  {currentStudyCard.cardType === 'cloze'
                    ? renderCardContent(currentStudyCard.front, true)
                    : currentStudyCard.front}
                </p>
                <div className="w-12 h-px bg-gray-300 dark:bg-gray-600 my-4" />
                <p className="text-lg text-gray-900 dark:text-gray-100 text-center font-medium whitespace-pre-wrap">
                  {currentStudyCard.back}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons */}
      {isFlipped && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-4 gap-2">
            <RatingButton
              rating={1}
              label="Nochmal"
              interval={currentStudyCard.nextIntervals.again}
              color="red"
              onClick={() => handleRating(1)}
              disabled={isSubmitting}
              shortcut="1"
            />
            <RatingButton
              rating={2}
              label="Schwer"
              interval={currentStudyCard.nextIntervals.hard}
              color="orange"
              onClick={() => handleRating(2)}
              disabled={isSubmitting}
              shortcut="2"
            />
            <RatingButton
              rating={3}
              label="Gut"
              interval={currentStudyCard.nextIntervals.good}
              color="green"
              onClick={() => handleRating(3)}
              disabled={isSubmitting}
              shortcut="3"
            />
            <RatingButton
              rating={4}
              label="Einfach"
              interval={currentStudyCard.nextIntervals.easy}
              color="blue"
              onClick={() => handleRating(4)}
              disabled={isSubmitting}
              shortcut="4"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface RatingButtonProps {
  rating: FSRSRating;
  label: string;
  interval: string;
  color: 'red' | 'orange' | 'green' | 'blue';
  onClick: () => void;
  disabled: boolean;
  shortcut: string;
}

function RatingButton({ label, interval, color, onClick, disabled, shortcut }: RatingButtonProps) {
  const colorClasses = {
    red: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
    orange: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
    green: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
    blue: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colorClasses[color]} text-white py-3 px-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs opacity-80">{interval}</div>
      <div className="text-[10px] opacity-60 mt-1">[{shortcut}]</div>
    </button>
  );
}
