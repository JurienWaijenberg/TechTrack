import { x as attr_class, y as ensure_array_like, z as stringify } from "../../chunks/index.js";
import "clsx";
import { e as escape_html } from "../../chunks/context.js";
function Header($$renderer) {
  $$renderer.push(`<header></header>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const sessionsUrl = "https://api.openf1.org/v1/sessions?year=2025&session_name=Race";
    const sessionResultUrl = "https://api.openf1.org/v1/session_result?session_key=";
    const MAX_RETRIES = 5;
    const BASE_RETRY_DELAY_MS = 3e3;
    const BETWEEN_REQUEST_DELAY_MS = 2e3;
    const MAX_BETWEEN_REQUEST_DELAY_MS = 1e4;
    const CACHE_TTL_MS = 60 * 60 * 1e3;
    const CACHE_PREFIX_SESSIONS = "f1_cache_sessions_2025";
    const CACHE_PREFIX_SESSION_RESULT = "f1_cache_session_result_";
    let raceSessions = [];
    let isLoading = false;
    let errorMessage = null;
    let cacheStatus = null;
    let consecutive429Errors = 0;
    let currentRequestDelay = BETWEEN_REQUEST_DELAY_MS;
    function getCachedData(key) {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        const now = Date.now();
        const age = now - parsed.timestamp;
        if (age > parsed.ttl) {
          localStorage.removeItem(key);
          return null;
        }
        return parsed.data;
      } catch (error) {
        console.error(`Error reading cache for ${key}:`, error);
        return null;
      }
    }
    function setCachedData(key, data) {
      try {
        const cached = { data, timestamp: Date.now(), ttl: CACHE_TTL_MS };
        localStorage.setItem(key, JSON.stringify(cached));
      } catch (error) {
        console.error(`Error writing cache for ${key}:`, error);
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          clearExpiredCache();
        }
      }
    }
    function clearExpiredCache() {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(CACHE_PREFIX_SESSIONS) && !key.startsWith(CACHE_PREFIX_SESSION_RESULT)) {
            continue;
          }
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsed = JSON.parse(cached);
              const now = Date.now();
              if (now - parsed.timestamp > parsed.ttl) {
                keysToRemove.push(key);
              }
            }
          } catch {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        if (keysToRemove.length > 0) {
          console.log(`Cleared ${keysToRemove.length} expired cache entries`);
        }
      } catch (error) {
        console.error("Error clearing expired cache:", error);
      }
    }
    async function primeCacheForSession(sessionKey) {
      const cacheKey = `${CACHE_PREFIX_SESSION_RESULT}${sessionKey}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        console.log(`Session ${sessionKey} already cached`);
        return;
      }
      console.log(`Manually fetching session ${sessionKey}...`);
      try {
        await sleep(2e3);
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
    if (typeof window !== "undefined") {
      window.clearF1Cache = () => {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(CACHE_PREFIX_SESSIONS) || key.startsWith(CACHE_PREFIX_SESSION_RESULT))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} cache entries`);
        raceSessions = [];
        fetchData();
      };
      window.primeF1Cache = (sessionKey) => {
        return primeCacheForSession(sessionKey);
      };
      window.primeF1CacheMultiple = async (sessionKeys) => {
        console.log(`Priming cache for ${sessionKeys.length} sessions...`);
        for (const key of sessionKeys) {
          await primeCacheForSession(key);
          await sleep(2e3);
        }
        console.log("✓ Cache priming complete. Reload the page to see results.");
      };
    }
    async function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async function fetchSessionResults(session_key, attempt = 1) {
      const cacheKey = `${CACHE_PREFIX_SESSION_RESULT}${session_key}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        console.log(`✓ Using cached session results for session ${session_key}`);
        return cached;
      }
      try {
        const response = await fetch(`${sessionResultUrl}${session_key}`);
        if (response.status === 429) {
          consecutive429Errors++;
          const retryAfterHeader = response.headers.get("retry-after");
          let retryDelay;
          if (retryAfterHeader) {
            retryDelay = Number(retryAfterHeader) * 1e3 + 500;
          } else {
            retryDelay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1), 3e4);
            retryDelay += Math.random() * 500;
          }
          if (attempt < MAX_RETRIES) {
            console.warn(`⚠ 429 for session ${session_key} (attempt ${attempt}/${MAX_RETRIES}), waiting ${Math.round(retryDelay)}ms before retry...`);
            currentRequestDelay = Math.min(currentRequestDelay * 1.5, MAX_BETWEEN_REQUEST_DELAY_MS);
            await sleep(retryDelay);
            return fetchSessionResults(session_key, attempt + 1);
          } else {
            console.error(`✗ Max retries reached for session ${session_key}. Returning empty result.`);
            return [];
          }
        }
        if (response.ok) {
          consecutive429Errors = 0;
          currentRequestDelay = BETWEEN_REQUEST_DELAY_MS;
        }
        if (!response.ok) {
          throw new Error(`Session result request failed (${response.status})`);
        }
        const result = await response.json();
        const data = Array.isArray(result) ? result : [];
        if (data.length > 0) {
          setCachedData(cacheKey, data);
        }
        return data;
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("fetch")) {
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
      const cachedSessions = getCachedData(CACHE_PREFIX_SESSIONS);
      if (cachedSessions) {
        console.log("Using cached race sessions");
        raceSessions = cachedSessions;
        cacheStatus = "cached";
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
          throw new Error("Unexpected sessions response format");
        }
        const sessionsWithResults = [];
        for (let i = 0; i < sessions.length; i++) {
          const session = sessions[i];
          const cacheKey = `${CACHE_PREFIX_SESSION_RESULT}${session.session_key}`;
          const cachedResult = getCachedData(cacheKey);
          if (cachedResult) {
            sessionsWithResults.push({ ...session, results: cachedResult });
            console.log(`✓ [${i + 1}/${sessions.length}] Session ${session.session_key} from cache`);
            if (i < sessions.length - 1) {
              await sleep(100);
            }
          } else {
            if (i > 0) {
              await sleep(currentRequestDelay);
            }
            console.log(`→ [${i + 1}/${sessions.length}] Fetching session ${session.session_key} (delay: ${currentRequestDelay}ms)...`);
            const results = await fetchSessionResults(session.session_key);
            sessionsWithResults.push({ ...session, results });
          }
        }
        setCachedData(CACHE_PREFIX_SESSIONS, sessionsWithResults);
        raceSessions = sessionsWithResults;
        cacheStatus = "fresh";
        consecutive429Errors = 0;
        currentRequestDelay = BETWEEN_REQUEST_DELAY_MS;
      } catch (error) {
        console.error("Error fetching race sessions:", error);
        errorMessage = error instanceof Error ? error.message : "Unknown error fetching sessions";
      } finally {
        isLoading = false;
      }
    }
    function formatDate(dateString) {
      if (!dateString) {
        return null;
      }
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return date.toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }
    Header($$renderer2);
    $$renderer2.push(`<!----> <div class="page-container svelte-1uha8ag"><section class="race-sessions svelte-1uha8ag"><h2>2025 F1 Race Sessions `);
    if (
      // Clear expired cache entries on load
      cacheStatus
    ) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span${attr_class(`cache-status ${stringify(cacheStatus)}`, "svelte-1uha8ag")}>${escape_html(cacheStatus === "fresh" ? "Fresh" : "Cached")}</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></h2> `);
    if (errorMessage) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="state-message error svelte-1uha8ag">${escape_html(errorMessage)}</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (isLoading && raceSessions.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p class="state-message svelte-1uha8ag">Loading race sessions…</p>`);
      } else {
        $$renderer2.push("<!--[!-->");
        if (raceSessions.length === 0) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<p class="state-message svelte-1uha8ag">No race sessions found.</p>`);
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push(`<p class="state-message svelte-1uha8ag">Total race sessions found: ${escape_html(raceSessions.length)} `);
          {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<br/> <small style="opacity: 0.6; font-size: 0.85rem;">Data cached for 60 minutes. <br/> Console commands: <code>clearF1Cache()</code></small>`);
          }
          $$renderer2.push(`<!--]--></p> <!--[-->`);
          const each_array = ensure_array_like(raceSessions);
          for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
            let session = each_array[$$index_1];
            $$renderer2.push(`<article class="race-session svelte-1uha8ag"><header class="svelte-1uha8ag"><h3 class="svelte-1uha8ag">${escape_html(session.meeting_name ?? session.circuit_short_name ?? `Session ${session.session_key}`)}</h3> `);
            if (formatDate(session.date_start)) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<p class="svelte-1uha8ag">${escape_html(formatDate(session.date_start))}</p>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]--></header> <div class="session-meta svelte-1uha8ag"><span>${escape_html(session.country_name ?? "Unknown location")}</span> <span>Session key: ${escape_html(session.session_key)}</span></div> `);
            if (session.results.length > 0) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<ul class="session-results svelte-1uha8ag"><!--[-->`);
              const each_array_1 = ensure_array_like(session.results);
              for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
                let result = each_array_1[$$index];
                $$renderer2.push(`<li class="session-result svelte-1uha8ag"><span class="position svelte-1uha8ag">P${escape_html(result.position ?? "—")}</span> <span class="driver svelte-1uha8ag">${escape_html(result.full_name ?? `Driver ${result.driver_number ?? "—"}`)}</span> <span class="team svelte-1uha8ag">${escape_html(result.team_name ?? "Team unavailable")}</span> <span class="meta svelte-1uha8ag">`);
                if (result.time) {
                  $$renderer2.push("<!--[-->");
                  $$renderer2.push(`Time: ${escape_html(result.time)}`);
                } else {
                  $$renderer2.push("<!--[!-->");
                  if (result.status) {
                    $$renderer2.push("<!--[-->");
                    $$renderer2.push(`Status: ${escape_html(result.status)}`);
                  } else {
                    $$renderer2.push("<!--[!-->");
                    $$renderer2.push(`Laps: ${escape_html(result.laps ?? "—")}`);
                  }
                  $$renderer2.push(`<!--]-->`);
                }
                $$renderer2.push(`<!--]--> `);
                if (typeof result.points === "number") {
                  $$renderer2.push("<!--[-->");
                  $$renderer2.push(`• ${escape_html(result.points)} pts`);
                } else {
                  $$renderer2.push("<!--[!-->");
                }
                $$renderer2.push(`<!--]--></span></li>`);
              }
              $$renderer2.push(`<!--]--></ul>`);
            } else {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push(`<p class="state-message svelte-1uha8ag">No classification available yet.</p>`);
            }
            $$renderer2.push(`<!--]--></article>`);
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></section></div>`);
  });
}
export {
  _page as default
};
