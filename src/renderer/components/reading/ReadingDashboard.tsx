import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';

type HeatmapTimeframe = 'week' | 'month' | 'year';

interface ReadingStats {
  todayPages: number;
  weekPages: number;
  totalPages: number;
  streak: number;
  dailyGoal: number;
  goalProgress: number;
}

interface ReadingHeatmapData {
  data: { date: string; count: number }[];
  maxCount: number;
  totalPages: number;
  streak: number;
  startDate: string;
  endDate: string;
}

interface PdfWithProgress {
  id: number;
  fileName: string;
  filePath: string;
  pageCount: number;
  currentPage: number;
  progress: number;
  lastViewed: string | null;
}

interface CalendarDay {
  date: string;
  count: number;
  isPlaceholder: boolean;
}

export default function ReadingDashboard() {
  const { setCurrentPdf, pdfs } = useAppStore();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [heatmapData, setHeatmapData] = useState<ReadingHeatmapData | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PdfWithProgress[]>([]);
  const [timeframe, setTimeframe] = useState<HeatmapTimeframe>('month');
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(20);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, heatmap, pdfsWithProgress] = await Promise.all([
        window.electronAPI.getReadingStats(),
        window.electronAPI.getReadingHeatmap(timeframe),
        window.electronAPI.getAllPdfsWithProgress(),
      ]);
      setStats(statsData);
      setHeatmapData(heatmap);
      setPdfProgress(pdfsWithProgress);
      setNewGoal(statsData.dailyGoal);
    } catch (error) {
      console.error('Error loading reading data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSetGoal = async () => {
    try {
      await window.electronAPI.setReadingGoal(newGoal);
      setShowGoalModal(false);
      loadData();
    } catch (error) {
      console.error('Error setting goal:', error);
    }
  };

  const handlePdfClick = (pdfId: number) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      setCurrentPdf(pdf);
    }
  };

  // Generate calendar grid data
  const calendarData = useMemo(() => {
    if (!heatmapData) return [];
    return generateCalendarGrid(heatmapData, timeframe);
  }, [heatmapData, timeframe]);

  if (loading && !stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Daily Goal Card */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Tagliches Leseziel</h3>
          <button
            onClick={() => setShowGoalModal(true)}
            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
          >
            Bearbeiten
          </button>
        </div>
        <div className="flex items-end gap-3">
          <div className="text-3xl font-bold">
            {stats?.todayPages || 0}
            <span className="text-lg font-normal opacity-80">/{stats?.dailyGoal || 20}</span>
          </div>
          <span className="text-sm opacity-80 mb-1">Seiten</span>
        </div>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, stats?.goalProgress || 0)}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-right opacity-80">
          {stats?.goalProgress || 0}%
        </div>
      </div>

      {/* Streak Display */}
      {stats && stats.streak > 0 && (
        <div className="bg-gradient-to-r from-orange-400 to-red-500 rounded-xl p-4 text-white flex items-center gap-3">
          <div className="text-3xl">
            <FireIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.streak} Tage</div>
            <div className="text-sm opacity-90">Lese-Streak!</div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Heute"
          value={stats?.todayPages || 0}
          unit="Seiten"
          color="blue"
        />
        <StatCard
          label="Diese Woche"
          value={stats?.weekPages || 0}
          unit="Seiten"
          color="green"
        />
        <StatCard
          label="Gesamt"
          value={stats?.totalPages || 0}
          unit="Seiten"
          color="purple"
        />
      </div>

      {/* Heatmap */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Leseaktivitat
          </span>
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

        <HeatmapGrid data={calendarData} maxCount={heatmapData?.maxCount || 1} timeframe={timeframe} />

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

      {/* PDF Progress List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          PDF-Fortschritt
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {pdfProgress.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              Noch keine PDFs gelesen
            </p>
          ) : (
            pdfProgress
              .filter(pdf => pdf.progress > 0)
              .sort((a, b) => b.progress - a.progress)
              .map((pdf) => (
                <div
                  key={pdf.id}
                  onClick={() => handlePdfClick(pdf.id)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {pdf.fileName.replace('.pdf', '')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pdf.progress >= 100 ? 'bg-green-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${Math.min(100, pdf.progress)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {pdf.progress}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {pdf.currentPage}/{pdf.pageCount}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Tagliches Leseziel
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                Seiten pro Tag
              </label>
              <input
                type="number"
                value={newGoal}
                onChange={(e) => setNewGoal(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min={1}
                max={500}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSetGoal}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, unit, color }: {
  label: string;
  value: number;
  unit: string;
  color: 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-3 text-white`}>
      <div className="text-2xl font-bold">{value.toLocaleString('de-DE')}</div>
      <div className="text-xs opacity-80">{unit}</div>
      <div className="text-[10px] opacity-60 mt-1">{label}</div>
    </div>
  );
}

// Fire Icon
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

  const cols = timeframe === 'week' ? 7 : 10;

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

  const formattedDate = day.date ? formatDate(day.date) : '';
  const tooltip = day.date ? `${formattedDate}: ${day.count} Seiten` : '';

  return (
    <div
      className={`${sizeClass} rounded-sm ${getColorClass(level)} ${
        day.isPlaceholder ? 'opacity-0' : ''
      }`}
      title={tooltip}
    />
  );
}

// Blue color scale for reading (different from green flashcard heatmap)
function getColorClass(level: number): string {
  const colors = [
    'bg-gray-100 dark:bg-gray-700',
    'bg-blue-200 dark:bg-blue-900',
    'bg-blue-300 dark:bg-blue-700',
    'bg-blue-400 dark:bg-blue-600',
    'bg-blue-500 dark:bg-blue-500',
  ];
  return colors[Math.min(level, colors.length - 1)];
}

function generateCalendarGrid(data: ReadingHeatmapData, timeframe: HeatmapTimeframe): CalendarDay[] {
  const dataMap = new Map(data.data.map(d => [d.date, d.count]));
  const days: CalendarDay[] = [];

  const endDate = new Date(data.endDate + 'T12:00:00');
  const startDate = new Date(data.startDate + 'T12:00:00');

  if (timeframe === 'year') {
    const adjustedStart = new Date(startDate);
    const dayOfWeek = adjustedStart.getDay();
    adjustedStart.setDate(adjustedStart.getDate() - dayOfWeek);

    for (let i = 0; i < dayOfWeek; i++) {
      days.push({ date: '', count: 0, isPlaceholder: true });
    }

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
