// API endpoints
export const API_ENDPOINTS = {
    sessions: 'https://api.openf1.org/v1/sessions?year=2025&session_name=Race',
    sessionResult: 'https://api.openf1.org/v1/session_result', // All session results (filter by session_key)
    sessionResultByKey: 'https://api.openf1.org/v1/session_result?session_key=', // Single session (fallback)
    drivers: 'https://api.openf1.org/v1/drivers?session_key=9869'
} as const;
