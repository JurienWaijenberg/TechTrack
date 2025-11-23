import type { SessionResult, RaceSession, Driver } from '../types/f1';
import { API_ENDPOINTS } from '../config/api';

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
 * Fetch all session results in one API call
 */
async function fetchAllSessionResults(): Promise<SessionResult[]> {
    try {
        const response = await fetch(API_ENDPOINTS.sessionResult);
        
        if (!response.ok) {
            throw new Error(`Session results request failed (${response.status})`);
        }
        
        const results = await response.json();
        return Array.isArray(results) ? results : [];
    } catch (error) {
        console.error('Error fetching all session results:', error);
        return [];
    }
}

/**
 * Fetch all race sessions with their results
 * Uses a single API call to get all results, then filters by session_key
 */
export async function fetchRaceSessionsWithResults(): Promise<RaceSession[]> {
    const sessions = await fetchRaceSessions();
    const sessionKeySet = new Set(sessions.map(s => s.session_key));
    
    // Fetch all session results in one call
    console.log('🚀 Fetching all session results...');
    const allResults = await fetchAllSessionResults();
    
    // Group results by session_key
    const resultsBySessionKey = new Map<number, SessionResult[]>();
    for (const result of allResults) {
        if (result.session_key !== undefined && sessionKeySet.has(result.session_key)) {
            if (!resultsBySessionKey.has(result.session_key)) {
                resultsBySessionKey.set(result.session_key, []);
            }
            resultsBySessionKey.get(result.session_key)!.push(result);
        }
    }
    
    // Match results to sessions
    const sessionsWithResults: RaceSession[] = sessions.map(session => ({
        ...session,
        results: resultsBySessionKey.get(session.session_key) || []
    }));
    
    console.log(`✓ Fetched ${sessionsWithResults.length} sessions with results`);
    
    return sessionsWithResults;
}
