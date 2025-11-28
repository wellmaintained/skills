import { describe, it, expect, spyOn, beforeEach, afterEach, mock } from 'bun:test';
import { PollingService } from '../src/server/polling-service.js';

describe('PollingService', () => {
   let setTimeoutSpy: ReturnType<typeof spyOn>;
   let clearTimeoutSpy: ReturnType<typeof spyOn>;
   // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
   let timeoutCallback: Function | undefined;
   let timeoutDelay: number | undefined;

   beforeEach(() => {
     timeoutCallback = undefined;
     timeoutDelay = undefined;
     setTimeoutSpy = spyOn(global, 'setTimeout').mockImplementation(((cb: any, ms: number) => {
       timeoutCallback = cb;
       timeoutDelay = ms;
       return 123 as any;
     }) as typeof setTimeout);
    clearTimeoutSpy = spyOn(global, 'clearTimeout').mockImplementation(() => {});
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should call onUpdate and schedule next poll', async () => {
    const onUpdate = mock(async () => {});
    const service = new PollingService(onUpdate, 5);

    service.start();

    // Should schedule immediate poll
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutDelay).toBe(0);

    // Execute poll
    if (timeoutCallback) {
      await timeoutCallback();
    }

    expect(onUpdate).toHaveBeenCalledTimes(1);
    
    // Should schedule next poll
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(timeoutDelay).toBe(5000); // 5 seconds * 1000

    service.stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const onUpdate = mock(async () => {
      throw new Error('Update failed');
    });
    const onError = mock();

    const service = new PollingService(onUpdate, 5, onError);

    service.start();
    
    // Execute poll
    if (timeoutCallback) {
      await timeoutCallback();
    }

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    
    // Should still schedule next poll
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    service.stop();
  });
});
