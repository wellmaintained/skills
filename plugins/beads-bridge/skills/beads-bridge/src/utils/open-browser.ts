import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function open(url: string): Promise<void> {
  const command = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `start "${url}"`
    : `xdg-open "${url}"`;

  try {
    await execAsync(command);
  } catch (error) {
    console.warn('Failed to open browser automatically:', error);
  }
}
