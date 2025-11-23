/**
 * Tests for section-updater utility
 *
 * This utility manages markdown sections marked with HTML comments.
 * It supports finding, updating, and appending sections.
 */

import { describe, it, expect } from 'vitest';
import { findSection, updateSection, appendSection } from '../../src/utils/section-updater.js';

describe('section-updater', () => {
  describe('findSection', () => {
    it('should find content between markers when section exists', () => {
      const markdown = `# Document

<!-- START_SECTION -->
existing content
<!-- END_SECTION -->

more content`;

      const result = findSection(markdown, '<!-- START_SECTION -->', '<!-- END_SECTION -->');

      expect(result).toBe('existing content\n');
    });

    it('should return null when start marker is missing', () => {
      const markdown = `# Document

some content
<!-- END_SECTION -->`;

      const result = findSection(markdown, '<!-- START_SECTION -->', '<!-- END_SECTION -->');

      expect(result).toBeNull();
    });

    it('should return null when end marker is missing', () => {
      const markdown = `# Document

<!-- START_SECTION -->
some content`;

      const result = findSection(markdown, '<!-- START_SECTION -->', '<!-- END_SECTION -->');

      expect(result).toBeNull();
    });

    it('should return empty string when section exists but is empty', () => {
      const markdown = `# Document

<!-- START_SECTION -->
<!-- END_SECTION -->

more content`;

      const result = findSection(markdown, '<!-- START_SECTION -->', '<!-- END_SECTION -->');

      expect(result).toBe('');
    });

    it('should handle multiline content in section', () => {
      const markdown = `# Document

<!-- START_SECTION -->
line 1
line 2
line 3
<!-- END_SECTION -->`;

      const result = findSection(markdown, '<!-- START_SECTION -->', '<!-- END_SECTION -->');

      expect(result).toBe('line 1\nline 2\nline 3\n');
    });
  });

  describe('updateSection', () => {
    it('should update existing section with new content', () => {
      const markdown = `# Document

<!-- START_SECTION -->
old content
<!-- END_SECTION -->

more content`;

      const result = updateSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'new content\n'
      );

      expect(result).toBe(`# Document

<!-- START_SECTION -->
new content
<!-- END_SECTION -->

more content`);
    });

    it('should throw error when section does not exist', () => {
      const markdown = `# Document

some content`;

      expect(() => {
        updateSection(
          markdown,
          '<!-- START_SECTION -->',
          '<!-- END_SECTION -->',
          'new content\n'
        );
      }).toThrow('Section not found');
    });

    it('should handle updating section with multiline content', () => {
      const markdown = `# Document

<!-- START_SECTION -->
old line 1
old line 2
<!-- END_SECTION -->

footer`;

      const result = updateSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'new line 1\nnew line 2\nnew line 3\n'
      );

      expect(result).toBe(`# Document

<!-- START_SECTION -->
new line 1
new line 2
new line 3
<!-- END_SECTION -->

footer`);
    });

    it('should preserve content before and after section', () => {
      const markdown = `header content

<!-- START_SECTION -->
old content
<!-- END_SECTION -->

footer content`;

      const result = updateSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'updated\n'
      );

      expect(result).toContain('header content');
      expect(result).toContain('footer content');
      expect(result).toContain('updated');
    });

    it('should handle empty new content', () => {
      const markdown = `# Document

<!-- START_SECTION -->
old content
<!-- END_SECTION -->

more`;

      const result = updateSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        ''
      );

      expect(result).toBe(`# Document

<!-- START_SECTION -->
<!-- END_SECTION -->

more`);
    });
  });

  describe('appendSection', () => {
    it('should append new section to end of document', () => {
      const markdown = `# Document

existing content`;

      const result = appendSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'new section content\n'
      );

      expect(result).toBe(`# Document

existing content

<!-- START_SECTION -->
new section content
<!-- END_SECTION -->
`);
    });

    it('should handle markdown without trailing newline', () => {
      const markdown = '# Document\n\ncontent';

      const result = appendSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'section content\n'
      );

      expect(result).toBe(`# Document

content

<!-- START_SECTION -->
section content
<!-- END_SECTION -->
`);
    });

    it('should append section with multiline content', () => {
      const markdown = `# Document`;

      const result = appendSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'line 1\nline 2\nline 3\n'
      );

      expect(result).toContain('line 1');
      expect(result).toContain('line 2');
      expect(result).toContain('line 3');
      expect(result).toMatch(/<!-- START_SECTION -->\nline 1\nline 2\nline 3\n<!-- END_SECTION -->/);
    });

    it('should append section to empty document', () => {
      const markdown = '';

      const result = appendSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'content\n'
      );

      expect(result).toBe(`<!-- START_SECTION -->
content
<!-- END_SECTION -->
`);
    });

    it('should append section with proper spacing', () => {
      const markdown = `existing line`;

      const result = appendSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        'new content\n'
      );

      // Should have blank line before new section
      expect(result).toContain('existing line\n\n<!-- START_SECTION -->');
    });

    it('should handle empty content in appended section', () => {
      const markdown = `# Document`;

      const result = appendSection(
        markdown,
        '<!-- START_SECTION -->',
        '<!-- END_SECTION -->',
        ''
      );

      expect(result).toBe(`# Document

<!-- START_SECTION -->
<!-- END_SECTION -->
`);
    });
  });

  describe('edge cases', () => {
    it('should handle markers with different comment styles', () => {
      const markdown = `# Document

<!-- CUSTOM_START -->
content here
<!-- CUSTOM_END -->`;

      const result = findSection(markdown, '<!-- CUSTOM_START -->', '<!-- CUSTOM_END -->');

      expect(result).toBe('content here\n');
    });

    it('should handle nested content that looks like markers', () => {
      const markdown = `# Document

<!-- START -->
this has <!-- FAKE --> marker
<!-- END -->`;

      const result = findSection(markdown, '<!-- START -->', '<!-- END -->');

      expect(result).toBe('this has <!-- FAKE --> marker\n');
    });

    it('should update section when markers are the only thing on their lines', () => {
      const markdown = `before
<!-- START -->
old
<!-- END -->
after`;

      const result = updateSection(
        markdown,
        '<!-- START -->',
        '<!-- END -->',
        'new\n'
      );

      expect(result).toBe(`before
<!-- START -->
new
<!-- END -->
after`);
    });
  });
});
