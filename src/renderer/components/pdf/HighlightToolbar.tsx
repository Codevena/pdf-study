interface HighlightToolbarProps {
  position: { x: number; y: number };
  onHighlight: (color: string) => void;
  onClose: () => void;
}

const HIGHLIGHT_COLORS = [
  { color: '#FFFF00', name: 'Gelb' },
  { color: '#FF9800', name: 'Orange' },
  { color: '#4CAF50', name: 'Grün' },
  { color: '#2196F3', name: 'Blau' },
  { color: '#E91E63', name: 'Pink' },
];

export default function HighlightToolbar({ position, onHighlight, onClose }: HighlightToolbarProps) {
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
