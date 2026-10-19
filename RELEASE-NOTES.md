# Venus 0.5.0

Venus now processes currently saved material and user edits without repeatedly comparing completed outputs against older conversations. Local fingerprints and coverage records skip unchanged completed segments, including zero-concept results. The cancelled semantic review entry point cannot launch model workers. Existing results and checkpoints are retained.

## New and fixed

- Independent source-layer processing, provider entry controls, and pause/resume for all four network animations.
- Truthful runtime activity across normal extraction, historical gaps and independent layers; deferred failures retain unresolved gaps. Inline retry, skip and continue controls retain traceability.
- Temporary-to-persistent identifier mapping, structured execution journals, and bounded recovery of failed work.
- Real provider/model token receipts with deduplication and cache semantics; the latest request's average output rate includes waiting and transport and is not live streaming throughput.
- Current-material input boundaries: user-edited content remains authoritative input, references provide traceability, and source instructions never grant execution permission.
- Consistent field, editor, dialog and floating-panel padding, line spacing, wrapping and scrolling. Long dialog bodies stay within the viewport while actions remain visible; late English captions now translate correctly.
- English architecture diagram, detailed update notes and a synthetic long-text spacing screenshot.

## Validation and package

45 related checks passed for extraction coverage, material boundaries, status and usage instrumentation; 3 locale checks passed for the final UI change. The synthetic 1280×720 dialog check verified scrolling, no horizontal overflow and visible actions. No live model call was made solely for validation.

The public package contains reviewed source, documentation, synthetic demos and licenses only. Private sources and generated content, histories, credentials, configuration, runtime logs, usage receipts, personal checkpoints and screenshots are excluded. Existing MIT/community documents and third-party notices are retained.

Install with `npm ci` and `npm run build`. For a local viewing session, set `VENUS_ANALYSIS=0` before starting. Select providers and budgets deliberately. Existing in-flight calls retain their original input until the runner reloads normally; no private data migration or forced analysis restart is required for packaging.

See [architecture](docs/ARCHITECTURE.md) and [detailed update notes](UPDATE-NOTES-2026-10-19.md).
