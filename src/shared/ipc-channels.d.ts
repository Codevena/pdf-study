export declare const IPC_CHANNELS: {
    readonly SELECT_FOLDER: "select-folder";
    readonly GET_SETTINGS: "get-settings";
    readonly SAVE_SETTINGS: "save-settings";
    readonly GET_PDFS: "get-pdfs";
    readonly GET_PDF: "get-pdf";
    readonly INDEX_PDFS: "index-pdfs";
    readonly GET_INDEXING_STATUS: "get-indexing-status";
    readonly SEARCH: "search";
    readonly GET_BOOKMARKS: "get-bookmarks";
    readonly ADD_BOOKMARK: "add-bookmark";
    readonly REMOVE_BOOKMARK: "remove-bookmark";
    readonly GET_NOTES: "get-notes";
    readonly ADD_NOTE: "add-note";
    readonly UPDATE_NOTE: "update-note";
    readonly DELETE_NOTE: "delete-note";
    readonly GET_TAGS: "get-tags";
    readonly CREATE_TAG: "create-tag";
    readonly DELETE_TAG: "delete-tag";
    readonly ADD_TAG_TO_PDF: "add-tag-to-pdf";
    readonly REMOVE_TAG_FROM_PDF: "remove-tag-from-pdf";
    readonly GET_PDF_TAGS: "get-pdf-tags";
    readonly INDEXING_PROGRESS: "indexing-progress";
    readonly PDF_ADDED: "pdf-added";
    readonly PDF_REMOVED: "pdf-removed";
};
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
//# sourceMappingURL=ipc-channels.d.ts.map