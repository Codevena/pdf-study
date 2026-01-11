import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { FSRSRating } from '../../../shared/types';
import confetti from 'canvas-confetti';

// Feedback messages for each rating
const FEEDBACK_MESSAGES: Record<FSRSRating, string[]> = {
  1: ['Kein Problem!', 'Weiter so!', 'Du schaffst das!'],
  2: ['Gut gekampft!', 'Dranbleiben!', 'Fast!'],
  3: ['Super!', 'Gut gemacht!', 'Richtig!'],
  4: ['Perfekt!', 'Klasse!', 'Ausgezeichnet!', 'Genial!'],
};

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
  const [streak, setStreak] = useState(0);
  const [easyStreak, setEasyStreak] = useState(0);
  const [showCardAnimation, setShowCardAnimation] = useState(false);
  const [lastRating, setLastRating] = useState<FSRSRating | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previousDeckCardsRef = useRef<number[]>([]);

  // Initialize first card or reset on deck change
  useEffect(() => {
    // Get current card IDs to detect deck change
    const currentCardIds = dueFlashcards.map(c => c.id);
    const previousCardIds = previousDeckCardsRef.current;

    // Check if deck has changed (different cards)
    const deckChanged = currentCardIds.length > 0 &&
      (previousCardIds.length === 0 ||
       currentCardIds[0] !== previousCardIds[0] ||
       currentCardIds.length !== previousCardIds.length);

    if (deckChanged) {
      // Deck changed - reset everything and start fresh
      previousDeckCardsRef.current = currentCardIds;
      setIsSessionComplete(false);
      setReviewedCount(0);
      setStreak(0);
      setEasyStreak(0);
      setIsFlipped(false);
      setCurrentStudyCard(dueFlashcards[0]);
      setStudyCardIndex(0);
    } else if (dueFlashcards.length > 0 && !currentStudyCard && !isSessionComplete) {
      // Initial load - set first card only if session not complete
      previousDeckCardsRef.current = currentCardIds;
      setCurrentStudyCard(dueFlashcards[0]);
      setStudyCardIndex(0);
    }
  }, [dueFlashcards, currentStudyCard, isSessionComplete]);

  // Card entrance animation
  useEffect(() => {
    if (currentStudyCard) {
      setShowCardAnimation(true);
      const timer = setTimeout(() => setShowCardAnimation(false), 300);
      return () => clearTimeout(timer);
    }
  }, [currentStudyCard?.id]);

  // Trigger confetti on session complete
  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  }, []);

  // Trigger mini confetti for easy streak
  const triggerMiniConfetti = useCallback((streakCount: number) => {
    const particleCount = Math.min(30 + streakCount * 10, 100);
    confetti({
      particleCount,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#3b82f6', '#22c55e', '#eab308', '#a855f7'],
      zIndex: 9999,
    });
  }, []);

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
      setLastRating(rating);

      // Show feedback message
      const messages = FEEDBACK_MESSAGES[rating];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setFeedbackMessage(randomMessage);
      setTimeout(() => setFeedbackMessage(null), 1200);

      await window.electronAPI.submitFlashcardReview(currentStudyCard.id, rating);
      setReviewedCount(prev => prev + 1);

      // Update streak
      if (rating >= 3) {
        setStreak(prev => prev + 1);
      } else {
        setStreak(0);
      }

      // Track easy streak and trigger confetti
      if (rating === 4) {
        const newEasyStreak = easyStreak + 1;
        setEasyStreak(newEasyStreak);
        if (newEasyStreak >= 3) {
          triggerMiniConfetti(newEasyStreak);
        }
      } else {
        setEasyStreak(0);
      }

      // Move to next card
      const nextIndex = studyCardIndex + 1;
      if (nextIndex < dueFlashcards.length) {
        setCurrentStudyCard(dueFlashcards[nextIndex]);
        setStudyCardIndex(nextIndex);
        setIsFlipped(false);
        setLastRating(null);
      } else {
        // Session complete - trigger confetti and show completion screen
        triggerConfetti();
        setIsSessionComplete(true);
        setCurrentStudyCard(null);
        setStudyCardIndex(0);
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

  // Calculate progress percentage
  const progressPercent = Math.round((studyCardIndex / dueFlashcards.length) * 100);

  // Progress color based on completion
  const getProgressColor = () => {
    if (progressPercent < 33) return '#ef4444'; // red
    if (progressPercent < 66) return '#f59e0b'; // yellow
    return '#22c55e'; // green
  };

  if (isSessionComplete || !currentStudyCard) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-emerald-950/30 overflow-hidden relative">
        {/* Animated background circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-gradient-to-br from-emerald-200/40 to-teal-200/40 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-gradient-to-tl from-cyan-200/40 to-emerald-200/40 dark:from-cyan-900/20 dark:to-emerald-900/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Celebration badge */}
          <div className="relative mb-8">
            <div className="w-28 h-28 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30 animate-bounce">
              <svg className="w-14 h-14 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {/* Sparkles */}
            <div className="absolute -top-3 -right-3 text-3xl animate-bounce delay-75">✨</div>
            <div className="absolute -bottom-2 -left-4 text-2xl animate-bounce delay-150">🎉</div>
            <div className="absolute top-1/2 -right-8 text-xl animate-bounce delay-300">🌟</div>
            {/* Ring effect */}
            <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-emerald-400/30 animate-ping" />
          </div>

          <h3 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent mb-2">
            Fantastisch!
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Du hast deine Lern-Session abgeschlossen
          </p>

          {/* Stats cards */}
          <div className="flex gap-4 mb-8">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-emerald-100 dark:border-emerald-900/30 min-w-[120px]">
              <div className="text-4xl font-bold bg-gradient-to-br from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                {reviewedCount}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Karten gelernt</div>
            </div>
            {streak > 0 && (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-orange-100 dark:border-orange-900/30 min-w-[120px]">
                <div className="text-4xl font-bold text-transparent bg-gradient-to-br from-orange-500 to-red-500 bg-clip-text flex items-center justify-center gap-1">
                  {streak} <span className="text-2xl">🔥</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Beste Serie</div>
              </div>
            )}
          </div>

          <button
            onClick={onComplete}
            className="px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 shadow-xl shadow-emerald-500/25 transform hover:scale-105 hover:-translate-y-1 transition-all duration-300"
          >
            Zuruck zum Deck
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Beenden
        </button>

        {/* Streak Counter */}
        {streak > 0 && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${
            streak >= 5
              ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white'
              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
          } transition-all duration-300 ${streak >= 5 ? 'animate-pulse' : ''}`}>
            <span className="text-lg">{streak >= 5 ? '🔥' : '⚡'}</span>
            <span className="font-bold">{streak}</span>
          </div>
        )}

        {/* Progress Ring */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 transform -rotate-90">
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke={getProgressColor()}
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - progressPercent / 100)}`}
              className="transition-all duration-500 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-4 pb-4 flex items-center justify-center">
        <div
          ref={cardRef}
          className={`w-full max-w-2xl cursor-pointer transition-all duration-300 ${
            isSubmitting ? 'pointer-events-none scale-95 opacity-80' : ''
          } ${showCardAnimation ? 'animate-card-enter' : ''}`}
          onClick={() => !isFlipped && setIsFlipped(true)}
          style={{ perspective: '1200px' }}
        >
          <div
            className="relative w-full transition-transform duration-600 ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '450px',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Card background with gradient and pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900" />
              <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />

              {/* Decorative corner accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary-500/5 to-transparent rounded-tr-full" />

              {/* Card border effect */}
              <div className="absolute inset-0 rounded-3xl border border-gray-200/50 dark:border-gray-700/50" />
              <div className="absolute inset-[1px] rounded-3xl border border-white/50 dark:border-gray-700/30" />

              {/* Content */}
              <div className="relative flex-1 flex flex-col p-10">
                {/* Card number indicator */}
                <div className="absolute top-4 left-4 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100/80 dark:bg-gray-800/80 px-2 py-1 rounded-full">
                  {studyCardIndex + 1} / {dueFlashcards.length}
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <p className="text-2xl text-gray-800 dark:text-gray-100 text-center whitespace-pre-wrap leading-relaxed font-medium">
                    {renderCardContent(currentStudyCard.front, false)}
                  </p>
                </div>

                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full text-sm text-gray-600 dark:text-gray-300 shadow-inner">
                    <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Tippen oder Leertaste zum Aufdecken
                  </div>
                </div>
              </div>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {/* Card background with gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-800 dark:via-gray-850 dark:to-emerald-950/20" />
              <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310b981' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />

              {/* Decorative corner accent */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-br-full" />
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-teal-500/10 to-transparent rounded-tl-full" />

              {/* Card border effect */}
              <div className="absolute inset-0 rounded-3xl border border-emerald-200/30 dark:border-emerald-800/30" />
              <div className="absolute inset-[1px] rounded-3xl border border-white/60 dark:border-gray-700/30" />

              {/* Content */}
              <div className="relative flex-1 flex flex-col p-10">
                {/* Answer label */}
                <div className="absolute top-4 left-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40 px-3 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Antwort
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                  {/* Question recap */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md italic">
                    {currentStudyCard.cardType === 'cloze'
                      ? renderCardContent(currentStudyCard.front, true)
                      : currentStudyCard.front}
                  </p>

                  {/* Divider */}
                  <div className="w-24 h-px bg-gradient-to-r from-transparent via-emerald-300 dark:via-emerald-600 to-transparent mb-6" />

                  {/* Answer */}
                  <p className="text-2xl text-gray-800 dark:text-gray-100 text-center font-semibold whitespace-pre-wrap leading-relaxed">
                    {currentStudyCard.back}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons */}
      {isFlipped && (
        <div className="relative p-5 bg-gradient-to-t from-white via-white/95 to-white/80 dark:from-gray-800 dark:via-gray-800/95 dark:to-gray-800/80 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50">
          {/* Feedback Toast */}
          {feedbackMessage && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 animate-feedback-toast">
              <div className="px-6 py-2.5 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 text-lg font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                {feedbackMessage}
              </div>
            </div>
          )}
          <div className="max-w-2xl mx-auto">
            <div className="text-sm text-center text-gray-600 dark:text-gray-400 mb-4 font-medium">
              Wie gut wusstest du die Antwort?
            </div>
            <div className="grid grid-cols-4 gap-3">
              <RatingButton
                rating={1}
                label="Nochmal"
                interval={currentStudyCard.nextIntervals.again}
                color="red"
                onClick={() => handleRating(1)}
                disabled={isSubmitting}
                shortcut="1"
                isActive={lastRating === 1}
              />
              <RatingButton
                rating={2}
                label="Schwer"
                interval={currentStudyCard.nextIntervals.hard}
                color="orange"
                onClick={() => handleRating(2)}
                disabled={isSubmitting}
                shortcut="2"
                isActive={lastRating === 2}
              />
              <RatingButton
                rating={3}
                label="Gut"
                interval={currentStudyCard.nextIntervals.good}
                color="green"
                onClick={() => handleRating(3)}
                disabled={isSubmitting}
                shortcut="3"
                isActive={lastRating === 3}
              />
              <RatingButton
                rating={4}
                label="Einfach"
                interval={currentStudyCard.nextIntervals.easy}
                color="blue"
                onClick={() => handleRating(4)}
                disabled={isSubmitting}
                shortcut="4"
                isActive={lastRating === 4}
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes card-enter {
          from {
            opacity: 0;
            transform: translateX(50px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .animate-card-enter {
          animation: card-enter 0.3s ease-out;
        }
        @keyframes feedback-toast {
          0% {
            opacity: 0;
            transform: translate(-50%, 10px) scale(0.9);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -10px) scale(0.9);
          }
        }
        .animate-feedback-toast {
          animation: feedback-toast 1.2s ease-out forwards;
        }
        .duration-600 {
          transition-duration: 600ms;
        }
      `}</style>
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
  isActive: boolean;
}

function RatingButton({ label, interval, color, onClick, disabled, shortcut, isActive }: RatingButtonProps) {
  const colorClasses = {
    red: {
      base: 'bg-gradient-to-br from-rose-400 via-red-500 to-rose-600 hover:from-rose-500 hover:via-red-600 hover:to-rose-700',
      shadow: 'shadow-rose-500/40 hover:shadow-rose-500/50',
      ring: 'ring-rose-400',
      glow: 'hover:shadow-[0_0_30px_rgba(251,113,133,0.3)]',
    },
    orange: {
      base: 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 hover:from-amber-500 hover:via-orange-600 hover:to-amber-700',
      shadow: 'shadow-amber-500/40 hover:shadow-amber-500/50',
      ring: 'ring-amber-400',
      glow: 'hover:shadow-[0_0_30px_rgba(251,191,36,0.3)]',
    },
    green: {
      base: 'bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600 hover:from-emerald-500 hover:via-green-600 hover:to-emerald-700',
      shadow: 'shadow-emerald-500/40 hover:shadow-emerald-500/50',
      ring: 'ring-emerald-400',
      glow: 'hover:shadow-[0_0_30px_rgba(52,211,153,0.3)]',
    },
    blue: {
      base: 'bg-gradient-to-br from-sky-400 via-blue-500 to-sky-600 hover:from-sky-500 hover:via-blue-600 hover:to-sky-700',
      shadow: 'shadow-sky-500/40 hover:shadow-sky-500/50',
      ring: 'ring-sky-400',
      glow: 'hover:shadow-[0_0_30px_rgba(56,189,248,0.3)]',
    },
  };

  const styles = colorClasses[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden ${styles.base} ${styles.shadow} ${styles.glow} text-white py-4 px-3 rounded-2xl transition-all duration-300 shadow-lg transform hover:scale-[1.03] hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-lg ${
        isActive ? `ring-2 ${styles.ring} ring-offset-2 ring-offset-white dark:ring-offset-gray-800 scale-95` : ''
      }`}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        <div className="text-base font-bold tracking-wide">{label}</div>
        <div className="text-sm opacity-95 font-medium mt-0.5">{interval}</div>
        <div className="text-[11px] opacity-80 mt-2 font-mono bg-black/15 backdrop-blur-sm rounded-lg px-2 py-1 inline-block">
          {shortcut}
        </div>
      </div>
    </button>
  );
}
