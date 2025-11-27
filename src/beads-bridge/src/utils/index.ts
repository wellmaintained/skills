/**
 * Utility exports
 */

export { BdCli, type BdCliOptions, type BdExecResult } from './bd-cli.js';
export {
  ExternalRefResolver,
  type ResolveParams,
  type ResolutionResult,
  type EpicLink
} from './external-ref-resolver.js';
export { checkLegacyMappingDir, LegacyMappingWarning } from './legacy-mapping-warning.js';
