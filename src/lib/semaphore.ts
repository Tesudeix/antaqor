// ─── Async semaphore ───
// Caps concurrency for heavy operations (e.g. sharp image processing)
// so a traffic burst can't blow past the RSS ceiling and get PM2 to restart.

export class Semaphore {
  private current = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly max: number) {}

  /** Acquire a permit. Returns a release function — MUST be called in finally. */
  async acquire(timeoutMs?: number): Promise<() => void> {
    if (this.current < this.max) {
      this.current += 1;
      return () => this.release();
    }
    return new Promise<() => void>((resolve, reject) => {
      const timer = timeoutMs
        ? setTimeout(() => {
            const idx = this.waiters.indexOf(grant);
            if (idx !== -1) this.waiters.splice(idx, 1);
            reject(new Error("Semaphore timeout"));
          }, timeoutMs)
        : null;
      const grant = () => {
        if (timer) clearTimeout(timer);
        this.current += 1;
        resolve(() => this.release());
      };
      this.waiters.push(grant);
    });
  }

  private release() {
    this.current = Math.max(0, this.current - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  stats() {
    return { active: this.current, queued: this.waiters.length, max: this.max };
  }
}

// ─── Shared instances ───
// Sharp is the biggest memory hog — cap concurrent transforms.
// Droplets with 2GB RAM comfortably handle 3 concurrent resize-to-webp ops.
export const sharpSemaphore = new Semaphore(3);
