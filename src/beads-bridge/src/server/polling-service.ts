export class PollingService {
  private timeoutId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    private onUpdate: () => Promise<void>,
    private intervalSeconds: number,
    private onError?: (error: Error) => void
  ) { }

  start(): void {
    this.isRunning = true;
    // Schedule first poll immediately
    this.schedulePoll(0);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private schedulePoll(delayMs: number): void {
    if (!this.isRunning) return;

    this.timeoutId = setTimeout(async () => {
      await this.poll();

      // Schedule next poll after current one completes
      if (this.isRunning) {
        this.schedulePoll(this.intervalSeconds * 1000);
      }
    }, delayMs);
  }

  private async poll(): Promise<void> {
    try {
      await this.onUpdate();
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
      // Don't crash, continue polling
    }
  }
}
