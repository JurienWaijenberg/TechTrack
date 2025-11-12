<script lang="ts">
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

    let raceSessions: RaceSession[] = $state([]);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);

    async function fetchSessionResults(session_key: number): Promise<SessionResult[]> {
        try {
            const response = await fetch(`${sessionResultUrl}${session_key}`);
            if (!response.ok) {
                throw new Error(`Session result request failed (${response.status})`);
            }

            const result = await response.json();
            return Array.isArray(result) ? result : [];
        } catch (error) {
            console.error(`Failed to fetch session results for ${session_key}:`, error);
            return [];
        }
    }

    async function fetchData() {
        isLoading = true;
        errorMessage = null;

        try {
            const response = await fetch(sessionsUrl);
            if (!response.ok) {
                throw new Error(`Sessions request failed (${response.status})`);
            }

            const sessions = await response.json();
            if (!Array.isArray(sessions)) {
                throw new Error('Unexpected sessions response format');
            }

            const sessionsWithResults = await Promise.all(
                sessions.map(async (session: RaceSession) => ({
                    ...session,
                    results: await fetchSessionResults(session.session_key)
                }))
            );

            raceSessions = sessionsWithResults;
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

    $effect(() => {
        if (raceSessions.length === 0 && !isLoading) {
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
</style>
<Header />  

<div class="page-container">
    <section class="race-sessions">
        <h2>2025 F1 Race Sessions</h2>

        {#if errorMessage}
            <p class="state-message error">{errorMessage}</p>
        {:else if isLoading}
            <p class="state-message">Loading race sessions…</p>
        {:else if raceSessions.length === 0}
            <p class="state-message">No race sessions found.</p>
        {:else}
            <p class="state-message">Total race sessions found: {raceSessions.length}</p>

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