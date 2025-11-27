import { access } from 'fs/promises';
import { join } from 'path';

export async function checkLegacyMappingDir(
  configDir: string,
  warn: (message: string) => void = console.warn
): Promise<boolean> {
  const mappingsPath = join(configDir, 'mappings');

  try {
    await access(mappingsPath);
    warn(`⚠️ Legacy ${mappingsPath} detected. Configure beads issues with external_ref (e.g., github:owner/repo#123).`);
    return true;
  } catch {
    return false;
  }
}

export class LegacyMappingWarning {
  private warned = false;

  constructor(
    private readonly configDir: string,
    private readonly warnFn: (message: string) => void = console.warn
  ) {}

  async maybeWarn(): Promise<void> {
    if (this.warned) {
      return;
    }

    const exists = await checkLegacyMappingDir(this.configDir, this.warnFn);
    if (exists) {
      this.warned = true;
    }
  }
}
