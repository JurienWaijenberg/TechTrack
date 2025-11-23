// API endpoints
export const API_ENDPOINTS = {
    sessions: 'https://api.openf1.org/v1/sessions?year=2025&session_name=Race',
    sessionResult: 'https://api.openf1.org/v1/session_result?session_key=',
    drivers: 'https://api.openf1.org/v1/drivers?session_key=9869'
} as const;

// Rate limiting configuration
export const RATE_LIMIT = {
    MAX_RETRIES: 5,
    BASE_RETRY_DELAY_MS: 3000,
    BETWEEN_REQUEST_DELAY_MS: 1000,
    MAX_BETWEEN_REQUEST_DELAY_MS: 10000
} as const;

// Cache configuration
export const CACHE_CONFIG = {
    TTL_MS: 60 * 60 * 1000, // 1 hour
    PREFIXES: {
        SESSIONS: 'f1_cache_sessions_2025',
        SESSION_RESULT: 'f1_cache_session_result_'
    }
} as const;

