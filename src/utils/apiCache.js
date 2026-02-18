/**
 * Simple in-memory TTL cache for expensive external API responses.
 * Used for Xero API calls to avoid redundant round-trips and rate-limit pressure.
 */

class ApiCache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs - Time-to-live in milliseconds
   */
  set(key, value, ttlMs) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Retrieve a cached value, or null if missing/expired.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Invalidate all cache entries whose key starts with the given prefix.
   * @param {string} prefix
   */
  invalidate(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Express middleware factory. Caches successful JSON responses.
   * @param {function(req): string} keyFn - Derives the cache key from the request
   * @param {number} ttlMs - Cache TTL in milliseconds
   * @returns {function} Express middleware
   */
  middleware(keyFn, ttlMs) {
    return (req, res, next) => {
      const key = keyFn(req);
      const cached = this.get(key);
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Intercept res.json so we can cache the response body
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(key, data, ttlMs);
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    };
  }
}

// Singleton — shared across all requires
module.exports = new ApiCache();
