import { describe, expect, test } from "bun:test";
import { MissingExternalRefError } from "../../src/types/errors.js";

describe('MissingExternalRefError', () => {
  test('should format help text correctly with bead ID', () => {
    const error = new MissingExternalRefError('pensive-123');
    
    expect(error.message).toBe("Bead 'pensive-123' has no external_ref set");
    expect(error.beadId).toBe('pensive-123');
    expect(error.helpText).toContain('bd update pensive-123 --external-ref "github:owner/repo#123"');
    expect(error.helpText).toContain('bd update pensive-123 --external-ref "shortcut:12345"');
    expect(error.helpText).toContain('Supported formats:');
  });
});
