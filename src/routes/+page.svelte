<script lang="ts">
    import Timeline from "../completed/Timeline.svelte";
    import Header from './header.svelte';
    
    // Types
    import type { Driver, RaceSession } from '$lib/types/f1';
    
    // Utils
    import { fetchRaceSessionsWithResults, fetchDrivers } from '$lib/utils/api';
    import { transformToChartData } from '$lib/utils/chart';
    import { formatDate } from '$lib/utils/format';

    // State
    let raceDrivers: Driver[] = $state([]);
    let raceSessions: RaceSession[] = $state([]);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);
    let driversFetchInitiated = false;

    // Fetch drivers
    async function loadDrivers() {
        if (driversFetchInitiated) return;
        driversFetchInitiated = true;

        try {
            raceDrivers = await fetchDrivers();
            console.log(`✓ Fetched ${raceDrivers.length} drivers`);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            driversFetchInitiated = false;
        }
    }

    // Fetch race data
    async function loadRaceData() {
        isLoading = true;
        errorMessage = null;

        try {
            raceSessions = await fetchRaceSessionsWithResults();
        } catch (error) {
            console.error('Error fetching race sessions:', error);
            errorMessage = error instanceof Error ? error.message : 'Unknown error fetching sessions';
        } finally {
            isLoading = false;
        }
    }

    // Transform data for chart
    const driverChartData = $derived(transformToChartData(raceSessions));

    // Load data on mount
    $effect(() => {
        if (raceSessions.length === 0 && !isLoading) {
            loadRaceData();
        }
    });

    $effect(() => {
        if (!driversFetchInitiated) {
            loadDrivers();
        }
    });
</script>

<Header />  

<div class="page-container">
    <section class="race-sessions">

        <section>
            <h2>2025 F1 Drivers</h2>
            <div class="race-drivers">
                {#each raceDrivers as driver}
                    <div class="race-driver">
                        <img src={driver.headshot_url} alt={driver.full_name ?? `Driver ${driver.driver_number ?? 'Unknown'}`} />
                        <section>
                            <p>{driver.full_name ?? `Driver ${driver.driver_number ?? 'Unknown'}`}</p>
                            <p>{driver.team_name ?? 'Team unavailable'}</p>
                        </section>
                    </div>
                {/each}
            </div>
        </section>

        <h2>2025 F1 Race Sessions</h2>

        {#if errorMessage}
            <p class="state-message error">{errorMessage}</p>
        {:else if isLoading && raceSessions.length === 0}
            <p class="state-message">Loading race sessions…</p>
        {:else if raceSessions.length === 0}
            <p class="state-message">No race sessions found.</p>
        {:else}
            <p class="state-message">
                Total race sessions found: {raceSessions.length}
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

    </section>
</div>
