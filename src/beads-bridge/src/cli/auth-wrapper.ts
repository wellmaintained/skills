import { BackendType } from '../types/config.js';
import { CredentialStore } from '../auth/credential-store.js';

/**
 * Wraps a CLI operation that requires authentication.
 * Checks for valid credentials before executing the operation.
 *
 * @param backendType - The backend type to check authentication for
 * @param operation - The async operation to execute if authenticated
 */
export async function withAuth(
  backendType: BackendType,
  operation: () => Promise<void>
): Promise<void> {
  const credStore = new CredentialStore();

  try {
    const hasAuth = await credStore.hasCredentials(backendType);

    if (!hasAuth) {
      console.error(`\n❌ Not authenticated with ${backendType}`);
      console.error(`\nTo authenticate, run:`);
      console.error(`  beads-bridge auth ${backendType}\n`);
      process.exit(1);
    }

    await operation();
  } catch (error) {
    if (error instanceof Error && error.message.includes('credentials')) {
      console.error(`\n❌ Authentication error: ${error.message}`);
      console.error(`\nTo re-authenticate, run:`);
      console.error(`  beads-bridge auth ${backendType}\n`);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Gets the backend type from the loaded config.
 * Used by commands that need to determine which backend to authenticate against.
 *
 * @param configPath - Optional path to config file
 * @returns The backend type from the config
 */
export async function getBackendFromConfig(configPath?: string): Promise<BackendType> {
  const { ConfigManager } = await import('../config/config-manager.js');
  const manager = await ConfigManager.load(configPath);
  return manager.getBackend();
}
