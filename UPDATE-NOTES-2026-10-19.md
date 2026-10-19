# Current-material extraction and truthful runtime status

Venus organizes the material that is currently saved, including the user's edited version. It does not reopen older conversations to prove a claim, judge its truth, or restore an earlier version over the user's current wording.

## Material and reference boundaries

- The current source text is preserved byte for byte in the analysis input.
- Reference remains a trace-back aid. It does not create a review task or grant execution authority.
- Historical discussion evidence and generated continuation summaries are removed from new analysis payloads. Reference trails are removed from candidate evidence while the saved files retain their original references.
- A stored discussion locator can support local formatting and citation consistency only when its source ID and version hash match the current source. It is not a truth-verification step.
- Instructions, system-role text, commands and permissions quoted inside a document remain untrusted material. Importing them never authorizes execution.
- Existing manual-edit and expected-hash protections remain in place.

The implementation is in `src/current-material.mjs`, the CLI and HTTP runner adapters, and the current-version discussion filter in `src/concepts.mjs`.

## Incremental concept extraction

The former multi-pass semantic review executor is cancelled. Its legacy entry point reports cancellation and cannot start a model worker. Saved output files, source records, checkpoints and unresolved historical gaps are retained.

“Check concepts again” now checks local source fingerprints and extraction coverage. An unchanged covered range is skipped, including a valid result containing zero concepts. A rule-version change alone never schedules a semantic re-review.

Only new, changed or uncovered ranges enter the existing concept layer. Matching segment fingerprints can retain unchanged ranges after a source change. If a result file is missing and its originating range cannot be established safely, Venus reports the missing file instead of launching a whole-source review. Historical backfill retains its existing single slot; a source cannot acquire a duplicate concept task through the independent controls.

## Runtime status

Text fields, editor surfaces, dialogs and floating status panels now share consistent internal spacing and line height. Dialog bodies scroll independently while their title and action area remain accessible. Long text wraps within the available width; narrow layouts retain side gutters and stack paired fields without cropping the contents. Typography, colors and application behavior are preserved.

The status card aggregates actual activity across normal extraction, historical gap backfill, independent layers and the retained legacy review record. A paused or cancelled record cannot hide another active workflow. Deferred failures preserve their gaps and remain distinct from completion, manual pauses and permission or authentication blocks.

Saved progress comes from persisted offsets and actual save events. Reusing an existing response, withholding an invalid connection, or receiving no usage data does not count as a new save.

## Token receipts and rate reporting

The existing Codex JSON, compatible HTTP/local and Gemini Interactions adapters retain terminal usage receipts. This is instrumentation of existing requests, not a new inference or verification service. Unsupported native provider formats are not silently treated as compatible usage.

- Accumulation is keyed by request identity and terminal receipt. Repeated terminal events and cumulative stream snapshots are not added repeatedly.
- Cached input is a reported subset of input for the supported protocols and is not added to the total a second time. Gemini thought tokens remain separate; an unavailable total is not invented.
- Totals include only fields returned by the provider. Each field exposes its receipt coverage. Missing data is shown as unavailable, never inferred from characters or displayed as zero consumption.
- The displayed speed is the **latest request's average output tokens per second**, with its actual start/end window. The window is end to end and includes waiting, startup and transport. Per-request averages are not summed into concurrent throughput or presented as live streaming speed.
- Provider/model identity is visible. A configured model name is distinguished from a provider-reported identity.
- Collection starts when the instrumented runner begins recording. Earlier usage is not reconstructed. No billing estimate is calculated.

Receipt files contain counters and request metadata, not source text, model answers or credentials. Synthetic fixture tests cover cache subsets, protocol differences, deduplication, concurrent requests, missing receipts and the real adapter parsing path without invoking a live model.

## Validation and activation

Forty distinct targeted checks passed for local coverage, independent layers, usage receipts, provider adapters and truthful status reporting. Five additional current-material boundary checks passed, alongside the ten provider checks rerun for the input-filter change. No unresolved targeted test failure remains.

Active inference is not interrupted solely to confirm a UI or usage update. A current-material policy description can be applied to the active output-schema file without changing its structure. Newly loaded runners use the full input filter and prompt boundary; an already-running invocation retains its original input.

## Publication boundary

These changes are prepared locally. Publication remains a single final update after the English architecture diagram and release notes are assembled. Public release files must be selected explicitly: source, English documentation and synthetic demonstration assets only. Vault material, generated personal knowledge/skills/concepts, histories, credentials, model configuration, runtime logs, usage receipts and personal checkpoints are excluded.
