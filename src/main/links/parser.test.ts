import { describe, it, expect } from 'vitest';
import {
  parseWikiLinks,
  resolveLink,
  extractLinkedPdfNames,
  hasWikiLinks,
  formatWikiLink,
} from './parser';
import type { PDFDocument, ParsedWikiLink } from '../../shared/types';

describe('Link Parser', () => {
  describe('parseWikiLinks', () => {
    it('should parse [[Book.pdf]]', () => {
      const content = 'See [[Book.pdf]] for more info.';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].fullMatch).toBe('[[Book.pdf]]');
      expect(links[0].fileName).toBe('Book.pdf');
      expect(links[0].pageNum).toBeNull();
    });

    it('should parse [[Book.pdf#p50]]', () => {
      const content = 'Reference on [[Book.pdf#p50]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].fullMatch).toBe('[[Book.pdf#p50]]');
      expect(links[0].fileName).toBe('Book.pdf');
      expect(links[0].pageNum).toBe(50);
    });

    it('should parse [[Book.pdf#Page50]]', () => {
      const content = 'See [[Book.pdf#Page50]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].fileName).toBe('Book.pdf');
      expect(links[0].pageNum).toBe(50);
    });

    it('should parse [[Book]] without .pdf and add extension', () => {
      const content = 'Check [[Book]] for details.';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].fullMatch).toBe('[[Book]]');
      expect(links[0].fileName).toBe('Book.pdf');
      expect(links[0].pageNum).toBeNull();
    });

    it('should parse [[Book#p10]] without .pdf', () => {
      const content = 'Reference [[Book#p10]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].fileName).toBe('Book.pdf');
      expect(links[0].pageNum).toBe(10);
    });

    it('should handle multiple links in one text', () => {
      const content = 'See [[Book1.pdf#p10]] and [[Book2.pdf#p20]] for more.';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].fileName).toBe('Book1.pdf');
      expect(links[0].pageNum).toBe(10);
      expect(links[1].fileName).toBe('Book2.pdf');
      expect(links[1].pageNum).toBe(20);
    });

    it('should return empty array for no links', () => {
      const content = 'This is plain text without any links.';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(0);
    });

    it('should capture correct start and end indices', () => {
      const content = 'Start [[Book.pdf]] end';
      const links = parseWikiLinks(content);

      expect(links[0].startIndex).toBe(6);
      expect(links[0].endIndex).toBe(18);
      expect(content.substring(links[0].startIndex, links[0].endIndex)).toBe('[[Book.pdf]]');
    });

    it('should handle spaces in filename', () => {
      const content = 'See [[My Book.pdf#p5]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].fileName).toBe('My Book.pdf');
      expect(links[0].pageNum).toBe(5);
    });

    it('should be case-insensitive for page prefix', () => {
      const content1 = '[[Book#p10]]';
      const content2 = '[[Book#P10]]';
      const content3 = '[[Book#Page10]]';
      const content4 = '[[Book#PAGE10]]';

      expect(parseWikiLinks(content1)[0].pageNum).toBe(10);
      expect(parseWikiLinks(content2)[0].pageNum).toBe(10);
      expect(parseWikiLinks(content3)[0].pageNum).toBe(10);
      expect(parseWikiLinks(content4)[0].pageNum).toBe(10);
    });

    it('should handle consecutive calls (regex state reset)', () => {
      // This tests that the regex lastIndex is properly reset
      const links1 = parseWikiLinks('[[Book1.pdf]]');
      const links2 = parseWikiLinks('[[Book2.pdf]]');

      expect(links1).toHaveLength(1);
      expect(links2).toHaveLength(1);
      expect(links1[0].fileName).toBe('Book1.pdf');
      expect(links2[0].fileName).toBe('Book2.pdf');
    });
  });

  describe('resolveLink', () => {
    const mockPdfs: PDFDocument[] = [
      {
        id: 1,
        filePath: '/path/to/Book.pdf',
        fileName: 'Book.pdf',
        fileHash: 'abc123',
        pageCount: 100,
        indexedAt: '2024-01-01',
        ocrCompleted: false,
      },
      {
        id: 2,
        filePath: '/path/to/Another.pdf',
        fileName: 'Another.pdf',
        fileHash: 'def456',
        pageCount: 50,
        indexedAt: '2024-01-01',
        ocrCompleted: false,
      },
    ];

    it('should match case-insensitively', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[BOOK.PDF]]',
        fileName: 'BOOK.PDF',
        pageNum: null,
        startIndex: 0,
        endIndex: 12,
      };

      const result = resolveLink(link, mockPdfs);
      expect(result).not.toBeNull();
      expect(result!.pdfId).toBe(1);
    });

    it('should return null for non-existent PDF', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[NonExistent.pdf]]',
        fileName: 'NonExistent.pdf',
        pageNum: null,
        startIndex: 0,
        endIndex: 19,
      };

      const result = resolveLink(link, mockPdfs);
      expect(result).toBeNull();
    });

    it('should validate page number within range', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[Book.pdf#p50]]',
        fileName: 'Book.pdf',
        pageNum: 50,
        startIndex: 0,
        endIndex: 16,
      };

      const result = resolveLink(link, mockPdfs);
      expect(result).not.toBeNull();
      expect(result!.pageNum).toBe(50);
    });

    it('should return null pageNum for page beyond pageCount', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[Book.pdf#p150]]',
        fileName: 'Book.pdf',
        pageNum: 150, // Book only has 100 pages
        startIndex: 0,
        endIndex: 17,
      };

      const result = resolveLink(link, mockPdfs);
      expect(result).not.toBeNull();
      expect(result!.pdfId).toBe(1);
      expect(result!.pageNum).toBeNull(); // Page out of range
    });

    it('should return null pageNum for page 0', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[Book.pdf#p0]]',
        fileName: 'Book.pdf',
        pageNum: 0,
        startIndex: 0,
        endIndex: 15,
      };

      const result = resolveLink(link, mockPdfs);
      expect(result).not.toBeNull();
      expect(result!.pageNum).toBeNull();
    });

    it('should return null pageNum when no page specified', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[Book.pdf]]',
        fileName: 'Book.pdf',
        pageNum: null,
        startIndex: 0,
        endIndex: 12,
      };

      const result = resolveLink(link, mockPdfs);
      expect(result).not.toBeNull();
      expect(result!.pageNum).toBeNull();
    });

    it('should return empty result for empty PDF list', () => {
      const link: ParsedWikiLink = {
        fullMatch: '[[Book.pdf]]',
        fileName: 'Book.pdf',
        pageNum: null,
        startIndex: 0,
        endIndex: 12,
      };

      const result = resolveLink(link, []);
      expect(result).toBeNull();
    });
  });

  describe('extractLinkedPdfNames', () => {
    it('should extract unique PDF names in lowercase', () => {
      const content = '[[Book.pdf]] and [[book.pdf]] and [[Another.pdf]]';
      const names = extractLinkedPdfNames(content);

      expect(names).toHaveLength(2);
      expect(names).toContain('book.pdf');
      expect(names).toContain('another.pdf');
    });

    it('should return empty array for no links', () => {
      const content = 'No links here';
      const names = extractLinkedPdfNames(content);

      expect(names).toHaveLength(0);
    });

    it('should handle links without .pdf extension', () => {
      const content = '[[Book]] and [[Another]]';
      const names = extractLinkedPdfNames(content);

      expect(names).toHaveLength(2);
      expect(names).toContain('book.pdf');
      expect(names).toContain('another.pdf');
    });
  });

  describe('hasWikiLinks', () => {
    it('should return true when content has wiki-links', () => {
      expect(hasWikiLinks('See [[Book.pdf]] for info')).toBe(true);
      expect(hasWikiLinks('[[Test]]')).toBe(true);
      expect(hasWikiLinks('Before [[Book#p10]] after')).toBe(true);
    });

    it('should return false when content has no wiki-links', () => {
      expect(hasWikiLinks('Plain text')).toBe(false);
      expect(hasWikiLinks('')).toBe(false);
      expect(hasWikiLinks('Brackets [ ] but not wiki')).toBe(false);
      expect(hasWikiLinks('Single [[incomplete')).toBe(false);
    });

    it('should handle consecutive calls (regex state reset)', () => {
      // Test that regex lastIndex is reset between calls
      expect(hasWikiLinks('[[Book1]]')).toBe(true);
      expect(hasWikiLinks('no links')).toBe(false);
      expect(hasWikiLinks('[[Book2]]')).toBe(true);
    });
  });

  describe('formatWikiLink', () => {
    it('should format link without page number', () => {
      expect(formatWikiLink('Book.pdf')).toBe('[[Book]]');
      expect(formatWikiLink('My Document.pdf')).toBe('[[My Document]]');
    });

    it('should format link with page number', () => {
      expect(formatWikiLink('Book.pdf', 10)).toBe('[[Book#p10]]');
      expect(formatWikiLink('Document.pdf', 1)).toBe('[[Document#p1]]');
    });

    it('should handle filenames already without .pdf', () => {
      expect(formatWikiLink('Book')).toBe('[[Book]]');
      expect(formatWikiLink('Book', 5)).toBe('[[Book#p5]]');
    });

    it('should be case-insensitive for .pdf removal', () => {
      expect(formatWikiLink('Book.PDF')).toBe('[[Book]]');
      expect(formatWikiLink('Book.Pdf')).toBe('[[Book]]');
    });
  });
});
