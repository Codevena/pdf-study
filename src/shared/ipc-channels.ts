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

  // Export
  EXPORT_PDF_DATA: 'export-pdf-data',

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

  // Events (Main -> Renderer)
  INDEXING_PROGRESS: 'indexing-progress',
  PDF_ADDED: 'pdf-added',
  PDF_REMOVED: 'pdf-removed',
  OCR_PROGRESS: 'ocr-progress',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
