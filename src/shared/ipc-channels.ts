// IPC Channel Names for type-safe communication between main and renderer

export const IPC_CHANNELS = {
  // Folder Management
  SELECT_FOLDER: 'select-folder',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',

  // PDF Operations
  GET_PDFS: 'get-pdfs',
  GET_PDF: 'get-pdf',
  GET_PDF_OUTLINE: 'get-pdf-outline',
  GENERATE_AI_OUTLINE: 'generate-ai-outline',
  GET_AI_OUTLINE: 'get-ai-outline',
  SAVE_AI_OUTLINE: 'save-ai-outline',
  INDEX_PDFS: 'index-pdfs',
  GET_INDEXING_STATUS: 'get-indexing-status',

  // Search
  SEARCH: 'search',

  // Bookmarks
  GET_BOOKMARKS: 'get-bookmarks',
  ADD_BOOKMARK: 'add-bookmark',
  REMOVE_BOOKMARK: 'remove-bookmark',

  // Notes
  GET_NOTES: 'get-notes',
  ADD_NOTE: 'add-note',
  UPDATE_NOTE: 'update-note',
  UPDATE_NOTE_TAGS: 'update-note-tags',
  GET_ALL_NOTE_TAGS: 'get-all-note-tags',
  DELETE_NOTE: 'delete-note',

  // Recent Views
  GET_RECENT_VIEWS: 'get-recent-views',
  ADD_RECENT_VIEW: 'add-recent-view',
  UPDATE_RECENT_VIEW_PAGE: 'update-recent-view-page',

  // Search History
  GET_SEARCH_HISTORY: 'get-search-history',
  ADD_SEARCH_HISTORY: 'add-search-history',
  DELETE_SEARCH_HISTORY_ITEM: 'delete-search-history-item',
  CLEAR_SEARCH_HISTORY: 'clear-search-history',

  // Tags
  GET_TAGS: 'get-tags',
  CREATE_TAG: 'create-tag',
  DELETE_TAG: 'delete-tag',
  ADD_TAG_TO_PDF: 'add-tag-to-pdf',
  REMOVE_TAG_FROM_PDF: 'remove-tag-from-pdf',
  GET_PDF_TAGS: 'get-pdf-tags',
  GET_ALL_PDF_TAGS: 'get-all-pdf-tags',

  // Export
  EXPORT_PDF_DATA: 'export-pdf-data',
  EXPORT_PDF_DATA_ENHANCED: 'export-pdf-data-enhanced',
  EXPORT_ALL_PDFS: 'export-all-pdfs',

  // Smart Links
  GET_LINK_SUGGESTIONS: 'get-link-suggestions',
  GET_BACKLINKS: 'get-backlinks',
  RESOLVE_LINK: 'resolve-link',
  GET_LINK_GRAPH: 'get-link-graph',

  // Highlights
  GET_HIGHLIGHTS: 'get-highlights',
  ADD_HIGHLIGHT: 'add-highlight',
  UPDATE_HIGHLIGHT_COLOR: 'update-highlight-color',
  DELETE_HIGHLIGHT: 'delete-highlight',

  // OCR
  START_OCR: 'start-ocr',
  START_OCR_FOR_PDF: 'start-ocr-for-pdf',
  FORCE_OCR: 'force-ocr',
  GET_OCR_STATUS: 'get-ocr-status',
  CANCEL_OCR: 'cancel-ocr',

  // Flashcard Decks
  FLASHCARD_GET_DECKS: 'flashcard-get-decks',
  FLASHCARD_GET_DECK: 'flashcard-get-deck',
  FLASHCARD_CREATE_DECK: 'flashcard-create-deck',
  FLASHCARD_UPDATE_DECK: 'flashcard-update-deck',
  FLASHCARD_DELETE_DECK: 'flashcard-delete-deck',

  // Flashcards
  FLASHCARD_GET_CARDS: 'flashcard-get-cards',
  FLASHCARD_GET_CARD: 'flashcard-get-card',
  FLASHCARD_ADD_CARD: 'flashcard-add-card',
  FLASHCARD_UPDATE_CARD: 'flashcard-update-card',
  FLASHCARD_DELETE_CARD: 'flashcard-delete-card',

  // FSRS / Study
  FLASHCARD_GET_DUE: 'flashcard-get-due',
  FLASHCARD_SUBMIT_REVIEW: 'flashcard-submit-review',
  FLASHCARD_GET_STATS: 'flashcard-get-stats',

  // AI Generation
  FLASHCARD_GENERATE_AI: 'flashcard-generate-ai',
  FLASHCARD_GENERATE_FROM_PDF: 'flashcard-generate-from-pdf',
  FLASHCARD_GET_PDF_PAGE_TEXT: 'flashcard-get-pdf-page-text',

  // Export
  FLASHCARD_EXPORT_LEARNBUDDY: 'flashcard-export-learnbuddy',

  // Heatmap
  FLASHCARD_GET_HEATMAP: 'flashcard-get-heatmap',

  // API Usage / Cost Tracking
  API_GET_USAGE_STATS: 'api-get-usage-stats',
  API_CLEAR_USAGE: 'api-clear-usage',

  // Events (Main -> Renderer)
  INDEXING_PROGRESS: 'indexing-progress',
  PDF_ADDED: 'pdf-added',
  PDF_REMOVED: 'pdf-removed',
  OCR_PROGRESS: 'ocr-progress',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
