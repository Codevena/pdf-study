export interface PDFDocument {
    id: number;
    filePath: string;
    fileName: string;
    fileHash: string;
    pageCount: number;
    indexedAt: string | null;
    ocrCompleted: boolean;
}
export interface PDFPage {
    pdfId: number;
    pageNum: number;
    content: string;
}
export interface SearchResult {
    id: number;
    fileName: string;
    filePath: string;
    pageNum: number;
    snippet: string;
    rank: number;
}
export interface Tag {
    id: number;
    name: string;
    color: string;
}
export interface Bookmark {
    id: number;
    pdfId: number;
    pageNum: number;
    title: string | null;
    createdAt: string;
}
export interface Note {
    id: number;
    pdfId: number;
    pageNum: number;
    content: string;
    positionX: number | null;
    positionY: number | null;
    createdAt: string;
    updatedAt: string;
}
export interface AppSettings {
    pdfFolder: string | null;
    theme: 'light' | 'dark';
    ocrEnabled: boolean;
    ocrLanguages: string[];
}
export interface IndexingStatus {
    isIndexing: boolean;
    totalFiles: number;
    processedFiles: number;
    currentFile: string | null;
}
//# sourceMappingURL=types.d.ts.map