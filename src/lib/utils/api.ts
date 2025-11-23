import type { SessionResult, RaceSession, Driver } from '../types/f1';
import { API_ENDPOINTS, RATE_LIMIT, CACHE_CONFIG } from '../config/api';
import { getCachedData, setCachedData } from './cache';

/**
 * Sleep utility function
 */
export function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch session results with retry logic and caching
 */
export async function fetchSessionResults(
    sessionKey: number,
    attempt = 1,
    onRateLimit?: (delay: number) => void
): Promise<SessionResult[]> {
    // Always check cache first
    const cacheKey = `${CACHE_CONFIG.PREFIXES.SESSION_RESULT}${sessionKey}`;
    const cached = getCachedData<SessionResult[]>(cacheKey);
    if (cached) {
        console.log(`✓ Using cached session results for session ${sessionKey}`);
        return cached;
    }

    try {
        const response = await fetch(`${API_ENDPOINTS.sessionResult}${sessionKey}`);

        if (response.status === 429) {
            // Rate limited - implement exponential backoff
            const retryAfterHeader = response.headers.get('retry-after');
            let retryDelay: number;
            
            if (retryAfterHeader) {
                retryDelay = Number(retryAfterHeader) * 1000 + 500;
            } else {
                retryDelay = Math.min(
                    RATE_LIMIT.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
                    30000
                );
                retryDelay += Math.random() * 500; // Add jitter
            }

            if (attempt < RATE_LIMIT.MAX_RETRIES) {
                console.warn(
                    `⚠ 429 for session ${sessionKey} (attempt ${attempt}/${RATE_LIMIT.MAX_RETRIES}), ` +
                    `waiting ${Math.round(retryDelay)}ms before retry...`
                );
                
                if (onRateLimit) {
                    onRateLimit(retryDelay);
                }
                
                await sleep(retryDelay);
                return fetchSessionResults(sessionKey, attempt + 1, onRateLimit);
            } else {
                console.error(`✗ Max retries reached for session ${sessionKey}. Returning empty result.`);
                return [];
            }
        }

        if (!response.ok) {
            throw new Error(`Session result request failed (${response.status})`);
        }

        const result = await response.json();
        const data = Array.isArray(result) ? result : [];
        
        // Cache if we got actual data
        if (data.length > 0) {
            setCachedData(cacheKey, data);
        }
        
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.error(`✗ Network error for session ${sessionKey}:`, error.message);
        } else {
            console.error(`✗ Failed to fetch session results for ${sessionKey}:`, error);
        }
        return [];
    }
}

/**
 * Fetch all race sessions
 */
export async function fetchRaceSessions(): Promise<RaceSession[]> {
    const response = await fetch(API_ENDPOINTS.sessions);
    if (!response.ok) {
        throw new Error(`Sessions request failed (${response.status})`);
    }

    const sessions = await response.json();
    if (!Array.isArray(sessions)) {
        throw new Error('Unexpected sessions response format');
    }

    return sessions;
}

/**
 * Fetch drivers
 */
export async function fetchDrivers(): Promise<Driver[]> {
    const response = await fetch(API_ENDPOINTS.drivers);
    if (!response.ok) {
        throw new Error(`Drivers request failed (${response.status})`);
    }

    const drivers = await response.json();
    if (!Array.isArray(drivers)) {
        throw new Error('Unexpected drivers response format');
    }

    return drivers;
}

/**
 * Fetch all race sessions with their results
 */
export async function fetchRaceSessionsWithResults(
    onProgress?: (current: number, total: number) => void,
    onRateLimit?: (delay: number) => void
): Promise<RaceSession[]> {
    const sessions = await fetchRaceSessions();
    const sessionsWithResults: RaceSession[] = [];

    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        
        // Check cache first
        const cacheKey = `${CACHE_CONFIG.PREFIXES.SESSION_RESULT}${session.session_key}`;
        const cachedResult = getCachedData<SessionResult[]>(cacheKey);
        
        if (cachedResult) {
            sessionsWithResults.push({
                ...session,
                results: cachedResult
            });
            console.log(`✓ [${i + 1}/${sessions.length}] Session ${session.session_key} from cache`);
            if (i < sessions.length - 1) {
                await sleep(100); // Small delay even for cached entries
            }
        } else {
            // Wait before making request (except first one)
            if (i > 0) {
                await sleep(RATE_LIMIT.BETWEEN_REQUEST_DELAY_MS);
            }
            
            console.log(`→ [${i + 1}/${sessions.length}] Fetching session ${session.session_key}...`);
            const results = await fetchSessionResults(session.session_key, 1, onRateLimit);
            sessionsWithResults.push({
                ...session,
                results
            });
        }
        
        if (onProgress) {
            onProgress(i + 1, sessions.length);
        }
    }

    return sessionsWithResults;
}

