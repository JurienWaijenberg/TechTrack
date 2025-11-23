import type { CachedData } from '../types/f1';
import { CACHE_CONFIG } from '../config/api';

/**
 * Get cached data from localStorage
 */
export function getCachedData<T>(key: string): T | null {
    if (CACHE_CONFIG.TTL_MS === 0) return null; // Caching disabled
    
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const parsed: CachedData<T> = JSON.parse(cached);
        const now = Date.now();
        const age = now - parsed.timestamp;

        if (age > parsed.ttl) {
            // Cache expired, remove it
            localStorage.removeItem(key);
            return null;
        }

        return parsed.data;
    } catch (error) {
        console.error(`Error reading cache for ${key}:`, error);
        return null;
    }
}

/**
 * Set cached data in localStorage
 */
export function setCachedData<T>(key: string, data: T): void {
    if (CACHE_CONFIG.TTL_MS === 0) return; // Caching disabled
    
    try {
        const cached: CachedData<T> = {
            data,
            timestamp: Date.now(),
            ttl: CACHE_CONFIG.TTL_MS
        };
        localStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
        console.error(`Error writing cache for ${key}:`, error);
        // If storage is full, try to clear old cache entries
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            clearExpiredCache();
        }
    }
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
    try {
        const keysToRemove: string[] = [];
        const prefixes = Object.values(CACHE_CONFIG.PREFIXES);
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            // Check if key matches any cache prefix
            const matchesPrefix = prefixes.some(prefix => key.startsWith(prefix));
            if (!matchesPrefix) continue;

            try {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const parsed: CachedData<unknown> = JSON.parse(cached);
                    const now = Date.now();
                    if (now - parsed.timestamp > parsed.ttl) {
                        keysToRemove.push(key);
                    }
                }
            } catch {
                keysToRemove.push(key); // Remove invalid cache entries
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        if (keysToRemove.length > 0) {
            console.log(`Cleared ${keysToRemove.length} expired cache entries`);
        }
    } catch (error) {
        console.error('Error clearing expired cache:', error);
    }
}

/**
 * Clear all F1 cache entries
 */
export function clearAllCache(): number {
    const keysToRemove: string[] = [];
    const prefixes = Object.values(CACHE_CONFIG.PREFIXES);
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && prefixes.some(prefix => key.startsWith(prefix))) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
}

