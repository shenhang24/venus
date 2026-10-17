# Page tour

Venus is a personal knowledge-base tool, not an Agent or an AI. It displays and edits saved material; model-based extraction requires a separately configured analyzer. Knowledge coverage depends on the material supplied, and extraction quality depends on the selected model and instructions.

| Page or control | What it is for | What it reads or returns |
| --- | --- | --- |
| Vault text view | Browse, search, open and edit original imported Markdown; add a named source | Local source titles and metadata for lists, and the selected source body when opened. Import accepts text/files the user supplies; it is not a full-account collector. Editing can retain older versions locally. |
| Knowledge text view | Read extracted concepts with supporting quotes, source locations and related knowledge; correct noisy conclusions | Saved knowledge nodes. The default list covers all knowledge, with an optional selected-source filter and paginated results. Opening an item reads its body and references. A derived claim is not automatically a verified fact. |
| Skills text view | Organize capability evidence across knowledge; distinguish mention, practice and verification | Saved skill bodies and their supporting knowledge/source references. A skill entry is not a certificate or a complete assessment of a person. |
| Vault network | Explore connections between source documents | The local Vault nodes, saved metadata, categories, heat and supported relationships. Visual labels are shortened; opening an item leads to its underlying content. |
| Knowledge network | Explore connected concepts and their evidence | Saved knowledge nodes, category cores and knowledge relationships, with source/reason details when inspected. A visual connection can be corrected; density or proximity is not independent proof of a claim. |
| Skills network | Explore relationships between capability evidence | Saved skill nodes, category cores and supported skill links. It does not discover a person's unprovided experience or independently certify proficiency. |
| Model and local AI settings | Select the analyzer, model, endpoint, reasoning and context/output budgets | Saved non-secret provider configuration and current provider description. The dialog saves options for the next backend start; saving does not test a model connection or switch active analysis. Secret values stay in the process environment, referenced by name. |
| MCP / CLI information | Connect a tool-capable AI host to existing library data | Public-copy panel describes local stdio MCP and CLI. CLI returns bounded search hits, bodies and sources. MCP can also retrieve requested neighbors, sources, original-source fragments and handoff records. Read-only describes mutation permissions, not confidentiality from the calling AI. |
| Automatic processing progress | See queued/completed sources, actual character/segment progress, active slots, failures and retries; pause/resume | Scheduler state, source titles, progress counters and recorded errors. Source analysis runs only with an available analyzer and enabled automatic processing. Queued is not completed. |

## Typical path

Save an original source in Vault, then choose whether to enable an analyzer. As configured analysis completes, review knowledge and skill evidence in their text views and explore supported connections in the three networks. Correct content or relationships when needed. Later, an authorized AI can retrieve saved context instead of requiring you to paste the whole history again.

The scheduler can send source chunks and selected contextual excerpts to the chosen analyzer. Merely opening a local text page or network is a different activity from enabling cloud analysis. See [Privacy and data flow](PRIVACY.md) for the distinction.

## Manual control and current deletion limits

You can edit the text of Vault sources, knowledge entries and skill entries yourself; AI is not required for those edits. The editor checks the saved version before accepting changes and retains the previous version. You can remove unwanted passages while keeping a nonempty document. Editing a source or a derived entry schedules affected material for review; manual derived text has protection in the current implementation, but this is not a promise that every future analysis will leave every related object unchanged.

You can manually correct classification summaries and category tags, including removing individual tag rows before saving. Relationship editing supports the endpoints, type, strength, short explanation, full reason, source quote and dimensions, subject to validation. Display filters hide records without deleting them.

The checked UI/API provides no dedicated whole-document or individual-relationship deletion operation. The relationship save method replaces or updates a relationship record; it is not a delete command. The store can detect Markdown files removed externally, but that does not establish cascading removal of citations, derived knowledge, old versions or analysis state. There is no verified permanent-suppression rule preventing an analyzer from deriving a similar concept or relationship again. Do not describe editing, hiding or external file removal as complete erasure.

## Reading scope and presentation limits

The application uses a metadata summary for navigation/graphs and requests selected node bodies separately. Some graph evidence and metadata can contain private text; a network screenshot is not automatically safe to publish. Changing a display filter does not delete underlying records or constrain every MCP query. Knowledge lists are paginated; the compact CLI reranks only a bounded candidate set and is not an exhaustive semantic search.

AI-generated summaries and classifications can be incomplete or incorrect. Venus makes them visible and editable; it does not make the underlying model infallible. Building a trustworthy knowledge base still requires your review and corrections. Models can misread sources, miss details and infer unsuitable categories or connections; use the manual controls above and allow time for maintenance. Storage, rendering and interface defects remain software issues and should not be blamed on model judgment. Graph layouts and summaries are not complete personality profiles or skill certifications.

This tour follows the existing implementation and a limited source check. It is not fresh visual acceptance of every page. The three user-supplied, approved actual app screenshots are included unchanged in docs/images with English captions. They show an earlier real run.
