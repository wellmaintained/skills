/**
 * Utility exports
 */

export { BdCli, type BdCliOptions, type BdExecResult } from './bd-cli.js';
export {
  parseExternalRef,
  detectBackendFromRef,
  isValidExternalRefFormat,
  type ParsedExternalRef,
} from './external-ref-parser.js';
export { detectRepository, extractPrefixFromIssues } from './repo-detector.js';
export type { DetectedRepository } from './repo-detector.js';
