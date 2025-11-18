<script lang="ts">
    import * as d3 from "d3";
    // import * as d3 from "d3"; // Uncomment when ready to use D3 charts

    import Timeline from "../completed/Timeline.svelte";





    import Header from './header.svelte';

    interface SessionResult {
        position?: number;
        driver_number?: number;
        full_name?: string;
        team_name?: string;
        time?: string;
        status?: string;
        points?: number;
        laps?: number;
    }

    interface RaceSession {
        session_key: number;
        session_name?: string;
        meeting_name?: string;
        country_name?: string;
        circuit_short_name?: string;
        date_start?: string;
        results: SessionResult[];
        [key: string]: unknown;
    }

    const sessionsUrl = 'https://api.openf1.org/v1/sessions?year=2025&session_name=Race';
    const sessionResultUrl = 'https://api.openf1.org/v1/session_result?session_key=';
    const MAX_RETRIES = 5;
    const BASE_RETRY_DELAY_MS = 3000; // 3 seconds - increased for better rate limit compliance
    const BETWEEN_REQUEST_DELAY_MS = 2000; // 2 seconds between requests - be very respectful of API
    const MAX_BETWEEN_REQUEST_DELAY_MS = 10000; // 10 seconds - maximum delay if we hit rate limits
    
    // Cache configuration - adjust TTL (time-to-live) as needed
    // CACHE_TTL_MS: How long cached data is valid (default: 1 hour)
    // Set to 0 to disable caching
    const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
    const CACHE_PREFIX_SESSIONS = 'f1_cache_sessions_2025';
    const CACHE_PREFIX_SESSION_RESULT = 'f1_cache_session_result_';

    interface CachedData<T> {
        data: T;
        timestamp: number;
        ttl: number;
    }

    let raceSessions: RaceSession[] = $state([]);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);
    let cacheStatus = $state<'fresh' | 'cached' | null>(null);
    
    // Track consecutive 429 errors to implement progressive backoff
    let consecutive429Errors = $state(0);
    let currentRequestDelay = $state(BETWEEN_REQUEST_DELAY_MS);

    // Cache utility functions
    function getCachedData<T>(key: string): T | null {
        if (CACHE_TTL_MS === 0) return null; // Caching disabled
        
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

    function setCachedData<T>(key: string, data: T): void {
        if (CACHE_TTL_MS === 0) return; // Caching disabled
        
        try {
            const cached: CachedData<T> = {
                data,
                timestamp: Date.now(),
                ttl: CACHE_TTL_MS
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

    function clearExpiredCache(): void {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || (!key.startsWith(CACHE_PREFIX_SESSIONS) && !key.startsWith(CACHE_PREFIX_SESSION_RESULT))) {
                    continue;
                }

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

    // Helper function to manually fetch and cache a specific session result
    async function primeCacheForSession(sessionKey: number): Promise<void> {
        const cacheKey = `${CACHE_PREFIX_SESSION_RESULT}${sessionKey}`;
        const cached = getCachedData<SessionResult[]>(cacheKey);
        if (cached) {
            console.log(`Session ${sessionKey} already cached`);
            return;
        }

        console.log(`Manually fetching session ${sessionKey}...`);
        try {
            // Use a longer delay for manual priming
            await sleep(2000);
            const results = await fetchSessionResults(sessionKey);
            if (results.length > 0) {
                console.log(`✓ Successfully cached session ${sessionKey} with ${results.length} results`);
            } else {
                console.warn(`⚠ Session ${sessionKey} returned empty results`);
            }
        } catch (error) {
            console.error(`✗ Failed to prime cache for session ${sessionKey}:`, error);
        }
    }

    // Expose helper functions globally for development (accessible via browser console)
    if (typeof window !== 'undefined') {
        (window as any).clearF1Cache = () => {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(CACHE_PREFIX_SESSIONS) || key.startsWith(CACHE_PREFIX_SESSION_RESULT))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log(`Cleared ${keysToRemove.length} cache entries`);
            // Reload data
            raceSessions = [];
            fetchData();
        };
        
        (window as any).primeF1Cache = (sessionKey: number) => {
            return primeCacheForSession(sessionKey);
        };
        
        (window as any).primeF1CacheMultiple = async (sessionKeys: number[]) => {
            console.log(`Priming cache for ${sessionKeys.length} sessions...`);
            for (const key of sessionKeys) {
                await primeCacheForSession(key);
                await sleep(2000); // Wait 2 seconds between each
            }
            console.log('✓ Cache priming complete. Reload the page to see results.');
        };
    }

    async function sleep(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    async function fetchSessionResults(session_key: number, attempt = 1): Promise<SessionResult[]> {
        // Always check cache first - even if we're retrying
        const cacheKey = `${CACHE_PREFIX_SESSION_RESULT}${session_key}`;
        const cached = getCachedData<SessionResult[]>(cacheKey);
        if (cached) {
            console.log(`✓ Using cached session results for session ${session_key}`);
            return cached;
        }

        try {
            const response = await fetch(`${sessionResultUrl}${session_key}`);

            if (response.status === 429) {
                consecutive429Errors++;
                
                // Exponential backoff with jitter
                const retryAfterHeader = response.headers.get('retry-after');
                let retryDelay: number;
                
                if (retryAfterHeader) {
                    // Use the API's suggested retry time, but add a buffer
                    retryDelay = Number(retryAfterHeader) * 1000 + 500;
                } else {
                    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                    retryDelay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1), 30000);
                    // Add jitter (random 0-500ms) to avoid thundering herd
                    retryDelay += Math.random() * 500;
                }

                if (attempt < MAX_RETRIES) {
                    console.warn(`⚠ 429 for session ${session_key} (attempt ${attempt}/${MAX_RETRIES}), waiting ${Math.round(retryDelay)}ms before retry...`);
                    
                    // Increase delay for subsequent requests
                    currentRequestDelay = Math.min(
                        currentRequestDelay * 1.5,
                        MAX_BETWEEN_REQUEST_DELAY_MS
                    );
                    
                    await sleep(retryDelay);
                    return fetchSessionResults(session_key, attempt + 1);
                } else {
                    console.error(`✗ Max retries reached for session ${session_key}. Returning empty result.`);
                    return [];
                }
            }

            // Reset error counter on success
            if (response.ok) {
                consecutive429Errors = 0;
                currentRequestDelay = BETWEEN_REQUEST_DELAY_MS;
            }

            if (!response.ok) {
                throw new Error(`Session result request failed (${response.status})`);
            }

            const result = await response.json();
            const data = Array.isArray(result) ? result : [];
            
            // Only cache if we got actual data
            if (data.length > 0) {
                setCachedData(cacheKey, data);
            }
            
            return data;
        } catch (error) {
            // Network errors - don't retry immediately, but return empty
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error(`✗ Network error for session ${session_key}:`, error.message);
            } else {
                console.error(`✗ Failed to fetch session results for ${session_key}:`, error);
            }
            return [];
        }
    }

    async function fetchData() {
        isLoading = true;
        errorMessage = null;
        cacheStatus = null;

        // Check cache first
        const cachedSessions = getCachedData<RaceSession[]>(CACHE_PREFIX_SESSIONS);
        if (cachedSessions) {
            console.log('Using cached race sessions');
            raceSessions = cachedSessions;
            cacheStatus = 'cached';
            isLoading = false;
            return;
        }

        try {
            const response = await fetch(sessionsUrl);
            if (!response.ok) {
                throw new Error(`Sessions request failed (${response.status})`);
            }

            const sessions = await response.json();
            if (!Array.isArray(sessions)) {
                throw new Error('Unexpected sessions response format');
            }

            const sessionsWithResults: RaceSession[] = [];

            for (let i = 0; i < sessions.length; i++) {
                const session = sessions[i];
                
                // Check if this session result is already cached
                const cacheKey = `${CACHE_PREFIX_SESSION_RESULT}${session.session_key}`;
                const cachedResult = getCachedData<SessionResult[]>(cacheKey);
                
                if (cachedResult) {
                    // Use cached result, no API call needed
                    sessionsWithResults.push({
                        ...session,
                        results: cachedResult
                    });
                    console.log(`✓ [${i + 1}/${sessions.length}] Session ${session.session_key} from cache`);
                    // Still add a small delay even for cached entries to be respectful
                    if (i < sessions.length - 1) {
                        await sleep(100);
                    }
                } else {
                    // Wait before making request (except first one)
                    if (i > 0) {
                        await sleep(currentRequestDelay);
                    }
                    
                    // Fetch from API
                    console.log(`→ [${i + 1}/${sessions.length}] Fetching session ${session.session_key} (delay: ${currentRequestDelay}ms)...`);
                    const results = await fetchSessionResults(session.session_key);
                    sessionsWithResults.push({
                        ...session,
                        results
                    });
                }
            }

            // Cache the complete sessions with results
            setCachedData(CACHE_PREFIX_SESSIONS, sessionsWithResults);
            
            raceSessions = sessionsWithResults;
            cacheStatus = 'fresh';
            
            // Reset error tracking on success
            consecutive429Errors = 0;
            currentRequestDelay = BETWEEN_REQUEST_DELAY_MS;
        } catch (error) {
            console.error('Error fetching race sessions:', error);
            errorMessage = error instanceof Error ? error.message : 'Unknown error fetching sessions';
        } finally {
            isLoading = false;
        }
    }

    function formatDate(dateString?: string): string | null {
        if (!dateString) {
            return null;
        }

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    // Transform race sessions into driver points data for the chart
    const driverChartData = $derived((() => {
        if (raceSessions.length === 0) return { driverData: [], raceLabels: [] };
        
        // Get all unique drivers
        const driverMap = new Map<string, { driverName: string; data: Array<{ raceIndex: number; points: number }> }>();
        const raceLabels: string[] = [];
        
        raceSessions.forEach((session, raceIndex) => {
            const raceName = session.meeting_name ?? session.circuit_short_name ?? `Race ${raceIndex + 1}`;
            raceLabels.push(raceName);
            
            if (session.results && session.results.length > 0) {
                session.results.forEach(result => {
                    const driverName = result.full_name ?? `Driver ${result.driver_number ?? 'Unknown'}`;
                    const points = typeof result.points === 'number' ? result.points : 0;
                    
                    if (!driverMap.has(driverName)) {
                        driverMap.set(driverName, {
                            driverName,
                            data: new Array(raceSessions.length).fill(null).map(() => ({ raceIndex: 0, points: 0 }))
                        });
                    }
                    
                    const driver = driverMap.get(driverName)!;
                    driver.data[raceIndex] = { raceIndex, points };
                });
            }
        });
        
        // Fill in missing races with 0 points for each driver
        driverMap.forEach(driver => {
            for (let i = 0; i < raceSessions.length; i++) {
                if (!driver.data[i] || driver.data[i].points === undefined) {
                    driver.data[i] = { raceIndex: i, points: 0 };
                }
            }
        });
        
        return {
            driverData: Array.from(driverMap.values()),
            raceLabels
        };
    })());

    $effect(() => {
        if (raceSessions.length === 0 && !isLoading) {
            // Clear expired cache entries on load
            clearExpiredCache();
            fetchData();
        }
    });

</script>

<style>
    :global(body) {
        background-color: #0B0A10;
        color: #FFFFFF;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
    }

    .page-container {
        padding: 2rem clamp(1rem, 4vw, 3rem);
        max-width: 1200px;
        margin: 0 auto;
    }

    .race-sessions {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .race-session {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.75rem;
        padding: 1.5rem;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(10px);
    }

    .race-session:nth-child(even) {
        background: rgba(255, 255, 255, 0.08);
    }

    .race-session header {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 1rem;
    }

    .race-session header h3 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 600;
    }

    .race-session header p {
        margin: 0;
        opacity: 0.7;
        font-size: 0.95rem;
    }

    .session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1rem;
        font-size: 0.9rem;
        opacity: 0.8;
    }

    .session-results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.75rem;
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .session-result {
        background: rgba(0, 0, 0, 0.25);
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.5rem 0.75rem;
        align-items: center;
    }

    .session-result .position {
        font-size: 1.1rem;
        font-weight: 700;
        color: #FFD166;
    }

    .session-result .driver {
        font-weight: 600;
    }

    .session-result .team {
        opacity: 0.7;
        font-size: 0.85rem;
        grid-column: span 2;
    }

    .session-result .meta {
        font-size: 0.8rem;
        opacity: 0.65;
        grid-column: span 2;
    }

    .state-message {
        margin: 2rem 0;
        text-align: center;
        opacity: 0.75;
    }

    .error {
        color: #FF6F91;
    }

    .cache-status {
        display: inline-block;
        margin-left: 0.5rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 500;
        background: rgba(255, 255, 255, 0.1);
        opacity: 0.7;
    }

    .cache-status.fresh {
        background: rgba(76, 175, 80, 0.2);
        color: #4CAF50;
    }

    .cache-status.cached {
        background: rgba(255, 193, 7, 0.2);
        color: #FFC107;
    }

    .Axis__tick {
        color: white;
    }
</style>
<Header />  

<div class="page-container">
    <section class="race-sessions">
        <h2>
            2025 F1 Race Sessions
            {#if cacheStatus}
                <span class="cache-status {cacheStatus}">
                    {cacheStatus === 'fresh' ? 'Fresh' : 'Cached'}
                </span>
            {/if}
        </h2>

        {#if raceSessions.length > 0 && driverChartData.driverData.length > 0}
            <div class="App">
                <h1>F1 Driver Points Championship</h1>
                <div class="App__charts">
                    <Timeline
                        driverData={driverChartData.driverData}
                        raceLabels={driverChartData.raceLabels}
                        label="Points" />
                </div>
            </div>
        {/if}

        {#if errorMessage}
            <p class="state-message error">{errorMessage}</p>
        {:else if isLoading && raceSessions.length === 0}
            <p class="state-message">Loading race sessions…</p>
        {:else if raceSessions.length === 0}
            <p class="state-message">No race sessions found.</p>
        {:else}
            <p class="state-message">
                Total race sessions found: {raceSessions.length}
                {#if CACHE_TTL_MS > 0}
                    <br>
                    <small style="opacity: 0.6; font-size: 0.85rem;">
                        Data cached for {Math.round(CACHE_TTL_MS / 1000 / 60)} minutes.
                        <br>
                        Console commands: <code>clearF1Cache()</code>
                    </small>
                {/if}
            </p>

            {#each raceSessions as session}
                <article class="race-session">
                    <header>
                        <h3>{session.meeting_name ?? session.circuit_short_name ?? `Session ${session.session_key}`}</h3>
                        {#if formatDate(session.date_start)}
                            <p>{formatDate(session.date_start)}</p>
                        {/if}
                    </header>

                    <div class="session-meta">
                        <span>{session.country_name ?? 'Unknown location'}</span>
                        <span>Session key: {session.session_key}</span>
                    </div>

                        {#if session.results.length > 0}
                            <ul class="session-results">
                                {#each session.results as result}
                                    <li class="session-result">
                                        <span class="position">P{result.position ?? '—'}</span>
                                        <span class="driver">{result.full_name ?? `Driver ${result.driver_number ?? '—'}`}</span>
                                        <span class="team">{result.team_name ?? 'Team unavailable'}</span>
                                        <span class="meta">
                                            {#if result.time}
                                                Time: {result.time}
                                            {:else if result.status}
                                                Status: {result.status}
                                            {:else}
                                                Laps: {result.laps ?? '—'}
                                            {/if}

                                            {#if typeof result.points === 'number'}
                                                • {result.points} pts
                                            {/if}
                                        </span>
                                    </li>
            {/each}
        </ul>
    {:else}
                            <p class="state-message">No classification available yet.</p>
                        {/if}
                </article>
            {/each}
    {/if}
</section>
</div>