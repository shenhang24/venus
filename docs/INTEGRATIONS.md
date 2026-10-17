# Integrations and scope

## Retrieval: no model call

Start Venus with analysis disabled for a retrieval-only session. The stdio entry is `node codex-plugin/readonly-mcp.mjs`. Six tools: `venus_search`, `venus_read_node`, `venus_neighbors`, `venus_sources`, `venus_source_fragment`, `venus_read_handoff`. The existing writable entry `mcp.mjs` is separate and must not be presented as read-only. `bridge.mjs` also includes writes; use `query.mjs` for compact retrieval.

The CLI uses one HTTP search and at most three parallel node reads. Local queries themselves require no paid model API. Background analysis is separate and can still consume subscription/API allowance when enabled. Queries use saved local knowledge and do not reanalyze documents. Search reranks only its first 25 candidates, and defaults to knowledge nodes. HTTP reads are loopback-only; no public deployment/authentication service is provided.

A desktop/local AI host may launch stdio MCP or call the CLI. A remote Gemini/cloud session cannot reach another computer's loopback address by itself. Do not assume a local response proves cloud access.

## Analysis providers

The model dialog saves non-secret provider options for the next backend start. Choices: Codex CLI; compatible HTTP chat completions; Gemini Interactions; local compatible HTTP. API adapters require the selected service's compatible schema and structured output. Secret values belong in the process environment, referenced by variable name. No credentials or personal provider config are included.

Provider configuration and response handling have mocked tests. These do not certify live Gemini authentication or compatibility with every local model. No paid endpoint is called during publication preparation. Local mode forbids non-loopback endpoints and does not silently fall back to a cloud provider.

## Languages and memory

Chinese and English UI strings are implemented; other system display languages fall back to English. Some source text, diagnostics and generated knowledge retain their original language. This is not a claim of complete localization.

The persistent library helps AI retrieve personal background, decisions and supporting evidence across conversations. Knowledge extraction can include irrelevant content, noise or mistaken associations; the UI supports editing and correction. The central value is personal knowledge distillation and continuity, not permanent learning in model weights or unlimited context. This project does not add a repeated external fact-checking workflow.
