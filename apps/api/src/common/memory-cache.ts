/**
 * A lightweight in-memory TTL cache.
 *
 * Designed specifically for cross-region deployments where every database
 * round-trip costs 200-300ms. Catalog data (categories, product listings)
 * changes rarely enough that a short TTL (30-60s) eliminates ~95% of DB
 * queries while keeping the storefront fresh within a minute of any admin edit.
 *
 * Not suitable for user-specific or request-specific data.
 */
export class MemoryCache {
  private readonly store = new Map<string, { data: unknown; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number = 30_000) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /**
   * Get-or-compute: returns the cached value if fresh, otherwise calls `compute`,
   * stores the result, and returns it. This is the primary interface — callers
   * never need to check-then-set manually.
   */
  async getOrSet<T>(key: string, compute: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const fresh = await compute();
    this.set(key, fresh, ttlMs);
    return fresh;
  }

  /** Evict a single key (used after admin mutations). */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Evict all keys matching a prefix (e.g. 'catalog:' after any product edit). */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Drop everything. */
  clear(): void {
    this.store.clear();
  }
}
