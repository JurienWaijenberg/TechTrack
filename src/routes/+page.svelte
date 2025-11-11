<script lang="ts">
    import Header from './header.svelte';
    
    let raceSessions: any[] = $state([]);

    async function fetchData() {
      const url = 'https://api.openf1.org/v1/sessions?year=2025&session_name=Race';

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        console.log('2025 F1 Race Sessions:', result);
        console.log(`Total race sessions found: ${result.length}`);
        raceSessions = result;
      }
      catch(error: any) {
        console.error('Error fetching sessions:', error.message);
      }
    }

    $effect(() => {
        if (raceSessions.length === 0) {
            fetchData();
        }
    });
</script>
<Header />  

<section class="race-sessions">
    <h2>2025 F1 Race Sessions</h2>
    {#if raceSessions.length > 0}
        <p>Total race sessions found: {raceSessions.length}</p>
            {#each raceSessions as session}
                <section class="race-session">
                    <h3>{session.circuit_short_name || JSON.stringify(session)}</h3>
                    <p>{session.country_name || JSON.stringify(session)}</p>
                </section>
            {/each}
    {:else}
        <p>No race sessions found</p>
    {/if}
</section>