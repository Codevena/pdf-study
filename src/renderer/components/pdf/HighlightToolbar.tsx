interface HighlightToolbarProps {
  position: { x: number; y: number };
  onHighlight: (color: string) => void;
  onExplain?: () => void;
  onClose: () => void;
}

const HIGHLIGHT_COLORS = [
  { color: '#FFFF00', name: 'Gelb' },
  { color: '#FF9800', name: 'Orange' },
  { color: '#4CAF50', name: 'Grün' },
  { color: '#2196F3', name: 'Blau' },
  { color: '#E91E63', name: 'Pink' },
];

export default function HighlightToolbar({ position, onHighlight, onExplain, onClose }: HighlightToolbarProps) {
  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex gap-1.5"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
      }}
    >
      {HIGHLIGHT_COLORS.map(({ color, name }) => (
        <button
          key={color}
          onClick={() => onHighlight(color)}
          className="w-7 h-7 rounded-full border-2 border-transparent hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          style={{ backgroundColor: color }}
          title={name}
        />
      ))}

      {/* Explain Button */}
      {onExplain && (
        <>
          <div className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />
          <button
            onClick={onExplain}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            title="Mit KI erklären"
          >
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </button>
        </>
      )}

      <div className="w-px bg-gray-200 dark:bg-gray-600 mx-1" />
      <button
        onClick={onClose}
        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Abbrechen"
      >
        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
