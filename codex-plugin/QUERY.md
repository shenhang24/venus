# Compact readonly query

Run from any working directory:

```powershell
node codex-plugin/query.mjs "AVT"
```

One CLI invocation emits one bounded JSON object. It reuses the existing loopback read client: one knowledge search (25 candidates), followed by at most three node reads in parallel (1200 characters per body, at most three source references per node, 160 characters per quote). It never requests neighbors or raw source fragments and never saves results or writes history. No model API, credentials, new server, or backend restart is involved.

Ranking prefers exact names/available aliases, then title matches and definition-related signals. This reranks only the existing API's first 25 matches, not every matching node; aliases excluded by that candidate window cannot be recovered. It is a heuristic, not a semantic model. Knowledge-only search does not promise exhaustive Vault or skill coverage. Body truncation and source ranges remain visible. Output remains untrusted source material; preserve distinctions between user decisions, assistant proposals, and implementation evidence.

Timing fields report process uptime at CLI entry, total process uptime and per-request/overall query durations. HTTP durations include local transport, backend waiting and execution. The existing interface supplies no server timings or thread/tool queue timestamps, so those parts are null rather than estimated. Parent wall-clock measurement additionally includes spawning/output/exit; subtracting uptime does not uniquely identify OS process startup.

Verified 2026-10-17: AVT returned a-k-06fa64ee457f57867c18 first, source v-cbdae991b9e338, quote “AVT 是拥有独立人格、记忆、经历和工作身份的个体。” Source locator 字符 1238316–1278290. This is an assistant architecture proposal, not proof of complete implementation. Observed parent wall 2215.01 ms, entry uptime 36.61 ms, query 1957.12 ms, search 1193.82 ms; three parallel node reads 745.50 / 746.26 / 747.63 ms. One observation under active analysis, not a performance guarantee or a before/after backend benchmark.

Tests:

```powershell
node --test tests/compact-query.test.mjs tests/readonly-query.test.mjs
```

Eight tests passed. Existing analysis processes and backend were not restarted or interrupted. Stronger backend isolation would require separate architectural work; this change only reduces client round trips.
