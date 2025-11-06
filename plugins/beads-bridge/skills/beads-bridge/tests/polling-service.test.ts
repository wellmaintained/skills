import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingService } from '../src/server/polling-service.js';

describe('PollingService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call onUpdate when hash changes', async () => {
    let diagrams = ['diagram1', 'diagram1', 'diagram2'];
    let callCount = 0;

    const fetchDiagram = vi.fn(async () => diagrams[callCount++]);
    const onUpdate = vi.fn();

    const service = new PollingService(fetchDiagram, onUpdate, 5);

    service.start();
    await vi.runOnlyPendingTimersAsync(); // Initial poll

    expect(onUpdate).toHaveBeenCalledTimes(1); // First poll always triggers update
    expect(fetchDiagram).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000); // Second poll (same diagram)

    expect(onUpdate).toHaveBeenCalledTimes(1); // No change, no update
    expect(fetchDiagram).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000); // Third poll (changed diagram)

    expect(onUpdate).toHaveBeenCalledTimes(2); // Changed, trigger update
    expect(fetchDiagram).toHaveBeenCalledTimes(3);

    service.stop();
  });

  it('should handle errors gracefully', async () => {
    const fetchDiagram = vi.fn(async () => {
      throw new Error('bd command failed');
    });
    const onUpdate = vi.fn();
    const onError = vi.fn();

    const service = new PollingService(fetchDiagram, onUpdate, 5, onError);

    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onUpdate).not.toHaveBeenCalled();

    service.stop();
  });

  it('should stop polling when stop is called', async () => {
    const fetchDiagram = vi.fn(async () => 'diagram');
    const onUpdate = vi.fn();

    const service = new PollingService(fetchDiagram, onUpdate, 5);

    service.start();
    await vi.runOnlyPendingTimersAsync();

    service.stop();

    await vi.advanceTimersByTimeAsync(10000);

    expect(fetchDiagram).toHaveBeenCalledTimes(1); // Only initial call
  });
});
