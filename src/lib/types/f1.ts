export interface Driver {
    driver_number?: number;
    full_name?: string;
    last_name?: string;
    team_name?: string;
    team_colour?: string;
    nationality?: string;
    headshot_url?: string;
}

export interface SessionResult {
    session_key?: number; // Links result to a session
    position?: number;
    driver_number?: number;
    full_name?: string;
    team_name?: string;
    time?: string;
    status?: string;
    points?: number;
    laps?: number;
}

export interface RaceSession {
    session_key: number;
    session_name?: string;
    meeting_name?: string;
    country_name?: string;
    circuit_short_name?: string;
    date_start?: string;
    results: SessionResult[];
    [key: string]: unknown;
}

export interface CachedData<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

