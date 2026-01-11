import { useState, useEffect, useMemo } from 'react';
import type { HeatmapData, HeatmapTimeframe } from '../../../shared/types';

interface LearningHeatmapProps {
  deckId?: number;
}

interface CalendarDay {
  date: string;
  count: number;
  isPlaceholder: boolean;
}

export default function LearningHeatmap({ deckId }: LearningHeatmapProps) {
  const [timeframe, setTimeframe] = useState<HeatmapTimeframe>('month');
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHeatmapData();
  }, [timeframe, deckId]);

  const loadHeatmapData = async () => {
    try {
      setLoading(true);
      const heatmapData = await window.electronAPI.getFlashcardHeatmap(timeframe, deckId);
      setData(heatmapData);
    } catch (error) {
      console.error('Error loading heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate calendar grid data
  const calendarData = useMemo(() => {
    if (!data) return [];
    return generateCalendarGrid(data, timeframe);
  }, [data, timeframe]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Lernaktivitat
          </span>
          {data && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {data.totalReviews} Reviews
            </span>
          )}
        </div>

        {/* Timeframe Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {(['week', 'month', 'year'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                timeframe === tf
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {tf === 'week' ? '7T' : tf === 'month' ? '30T' : '1J'}
            </button>
          ))}
        </div>
      </div>

      {/* Streak Display */}
      {data && data.streak > 0 && (
        <div className="flex items-center gap-1.5 mb-3 text-orange-600 dark:text-orange-400">
          <FireIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{data.streak} Tage Streak!</span>
        </div>
      )}

      {/* Heatmap Grid */}
      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <HeatmapGrid data={calendarData} maxCount={data?.maxCount || 1} timeframe={timeframe} />
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span>Weniger</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`w-2.5 h-2.5 rounded-sm ${getColorClass(level)}`}
          />
        ))}
        <span>Mehr</span>
      </div>
    </div>
  );
}

// Fire icon component
function FireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.04-6.77 5.24-8.27.4-.19.88-.05 1.1.32.22.38.12.86-.24 1.1C6.34 9.22 5 11.48 5 14c0 3.87 3.13 7 7 7s7-3.13 7-7c0-2.52-1.34-4.78-4.1-6.85-.36-.24-.46-.72-.24-1.1.22-.37.7-.51 1.1-.32C19.96 7.23 22 10.47 22 14c0 4.97-4.03 9-9 9h-1zm.16-15.19c-.33-.21-.76-.12-.98.2-.22.33-.13.76.19.99 2.08 1.47 3.13 3.45 3.13 5.89 0 2.76-2.24 5-5 5s-5-2.24-5-5c0-2.44 1.05-4.42 3.13-5.89.32-.23.41-.66.19-.99-.22-.32-.65-.41-.98-.2C4.16 9.77 2.5 12.3 2.5 15c0 3.58 2.92 6.5 6.5 6.5s6.5-2.92 6.5-6.5c0-2.7-1.66-5.23-4.34-7.19zM12 2c.28 0 .5.22.5.5v6c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-6c0-.28.22-.5.5-.5z"/>
    </svg>
  );
}

// Heatmap Grid Component
function HeatmapGrid({ data, maxCount, timeframe }: {
  data: CalendarDay[];
  maxCount: number;
  timeframe: HeatmapTimeframe;
}) {
  if (timeframe === 'year') {
    // GitHub-style: 7 rows (days of week) x N columns (weeks)
    const weeks: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];

    for (const day of data) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return (
      <div className="flex gap-[2px] overflow-x-auto pb-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[2px]">
            {week.map((day, dayIdx) => (
              <HeatmapCell
                key={day.date || `${weekIdx}-${dayIdx}`}
                day={day}
                maxCount={maxCount}
                size="small"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Week/Month view: simple grid
  const cols = timeframe === 'week' ? 7 : 10; // 7 for week, 10x3 for month

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {data.map((day, idx) => (
        <HeatmapCell
          key={day.date || idx}
          day={day}
          maxCount={maxCount}
          size="large"
        />
      ))}
    </div>
  );
}

function HeatmapCell({ day, maxCount, size }: {
  day: CalendarDay;
  maxCount: number;
  size: 'small' | 'large';
}) {
  const level = day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / maxCount) * 4));
  const sizeClass = size === 'small' ? 'w-2.5 h-2.5' : 'w-5 h-5';

  // Format date for tooltip
  const formattedDate = day.date ? formatDate(day.date) : '';
  const tooltip = day.date ? `${formattedDate}: ${day.count} Reviews` : '';

  return (
    <div
      className={`${sizeClass} rounded-sm ${getColorClass(level)} ${
        day.isPlaceholder ? 'opacity-0' : ''
      }`}
      title={tooltip}
    />
  );
}

// Color scale (GitHub-style green gradient)
function getColorClass(level: number): string {
  const colors = [
    'bg-gray-100 dark:bg-gray-700',           // 0 - no activity
    'bg-green-200 dark:bg-green-900',         // 1 - low
    'bg-green-300 dark:bg-green-700',         // 2 - medium-low
    'bg-green-400 dark:bg-green-600',         // 3 - medium-high
    'bg-green-500 dark:bg-green-500',         // 4 - high
  ];
  return colors[Math.min(level, colors.length - 1)];
}

// Generate calendar grid with placeholders
function generateCalendarGrid(data: HeatmapData, timeframe: HeatmapTimeframe): CalendarDay[] {
  const dataMap = new Map(data.data.map(d => [d.date, d.count]));
  const days: CalendarDay[] = [];

  const endDate = new Date(data.endDate + 'T12:00:00');
  const startDate = new Date(data.startDate + 'T12:00:00');

  if (timeframe === 'year') {
    // GitHub style: start from first Sunday, align weeks properly
    // Go back to the previous Sunday
    const adjustedStart = new Date(startDate);
    const dayOfWeek = adjustedStart.getDay();
    adjustedStart.setDate(adjustedStart.getDate() - dayOfWeek);

    // Add placeholder days before the actual start
    for (let i = 0; i < dayOfWeek; i++) {
      days.push({ date: '', count: 0, isPlaceholder: true });
    }

    // Fill in actual days
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        count: dataMap.get(dateStr) || 0,
        isPlaceholder: false,
      });
      current.setDate(current.getDate() + 1);
    }
  } else {
    // Week/Month: simpler grid
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        count: dataMap.get(dateStr) || 0,
        isPlaceholder: false,
      });
      current.setDate(current.getDate() + 1);
    }
  }

  return days;
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
