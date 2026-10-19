# Venus program architecture

![Venus program architecture](images/venus-architecture-en.png)

[Scalable SVG](images/venus-architecture-en.svg)

Local Markdown and imports enter Vault, where current text and user edits provide the effective analysis input. Configured AI providers support segmented extraction with checkpoints. AI knowledge, AI skills and the concept cloud persist with source references and appear in readable content directories, editing tools and four network views. Animation runs locally.

Incremental local change detection skips unchanged completed ranges, including valid empty results. Only new, changed or missing ranges need extraction. Schema and current-version reference checks protect writes; references do not create semantic re-review tasks. Venus does not consult older conversations to verify truth or override current user edits. Imported instructions do not grant authority to execute them.

Runtime feedback shows actual activity, saved progress, daily logs and recoverable exceptions. Usage counters come from real provider receipts. With terminal-only usage, speed is the latest request's end-to-end average output tokens per second, including startup, waiting and transport. Cache subsets are not added twice, and missing counters are not invented.

This is a program architecture illustration, not a file dependency graph or an external web fact-checking service. See [the detailed update notes](../UPDATE-NOTES-2026-10-19.md) for scope and validation.
