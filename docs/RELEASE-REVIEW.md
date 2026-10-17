# Publication preparation review

Local source-only preparation; a fresh local Git repository contains only the selected staged files. No commit, remote creation, push or old history has been copied.

GitHub connector account: shenhang24. The owned repositories visible to that connection were shenhang24 and stable-diffusion-webui; neither conflicts with the suggested target shenhang24/venus. Visibility is bounded by connector permissions. Local gh was unavailable, so local CLI authentication could not be confirmed. Recheck target availability immediately before any authorized creation. The proposed target is not a created repository.

Included: application source, generated browser code, launch files, tests with synthetic fixtures, conversion/backup utilities, local CLI/MCP code, English README, integration and license documentation, synthetic Markdown example and dependency notices. PUBLIC-FILES.json records the candidate file paths, byte sizes and hashes; PUBLIC-DOCUMENTS.json selects the English documentation. After the user manually removed temporary dependencies/caches, a separate read-only candidate-file pattern check found no matched secrets, private paths or project identifiers apart from an explicit placeholder. This is not a complete security audit.

Excluded: actual data and all Vault/knowledge/skill documents, history, source exports, evidence, logs, credentials, personal configuration, all remote-connection controller/profile code and old Git history. Public-copy changes remove private project heat defaults and connection UI, make launcher/script paths relative, default analysis to explicit opt-in and update related synthetic tests. Original application and running analysis are untouched.

Screenshots: three approved PNG files were supplied locally, visually checked, renamed and included unchanged in docs/images. No readable private source text, project names, paths or credentials were observed.

The prepared tree built successfully; 159 Node tests and 10 Python tests passed before the English-documentation update. The latest deep-orbit fix is synchronized. The prepared copy built and passed 164 Node tests before the user manually removed the temporary dependencies and caches. The directories are now absent; no deletion was retried by the agent. These checks do not certify a fresh native desktop installation or live cloud/local-model adapters. No paid model invocation is part of validation.

The canonical public README is README.md. README.en.md is a compatibility pointer excluded from the public documentation selection. docs/README.zh.private-draft.md is retained locally only and must be excluded from any future public manifest and Git tracking. A fresh local Git repository was initialized and its staged file list was checked against the allowlist; it has no commits or prior refs.
