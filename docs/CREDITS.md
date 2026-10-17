# Credits and acknowledgments

## Code dependencies

The following packages are recorded in package-lock.json. Their original license notices are preserved separately; those licenses do not automatically license the Venus application.

| Package | Locked version | Role | License notice |
| --- | --- | --- | --- |
| Three.js | 0.180.0 | Three-dimensional network rendering | [MIT notice](../third-party-licenses/three-LICENSE.txt) |
| marked | 16.4.1 | Markdown rendering | [MIT notice](../third-party-licenses/marked-LICENSE.txt) |
| Prettier | 3.6.2 | Development formatting tool | [MIT notice](../third-party-licenses/prettier-LICENSE.txt) |

Thank you to the maintainers and contributors of these projects. Dependency names and roles do not imply their endorsement of Venus. The application itself has no selected open-source license; see [License status](LICENSE-STATUS.md).

## Runtime and optional integrations

Venus runs on Node.js. The Windows launcher uses PowerShell and a browser/application window. Optional import and backup utilities use Python. Codex and compatible HTTP, Gemini and local-model services are configurable integrations, not additional npm dependencies in this lockfile. Their names do not imply endorsement, partnership or independently verified live compatibility. See [Deployment](DEPLOYMENT.md) for the tested scope and credentials.

## Design inspiration

The compact workspace was informed by the user's requested Obsidian-style navigation and compact desktop-chat typography. These are visual references, separate from the dependency list; no affiliation, licensed product assets or exact reproduction of another application's internal design system is claimed.

## Actual app screenshots

Three user-approved actual app screenshots are included, unchanged, with English captions. They depict an earlier real run rather than certifying the latest layout or FPS.

- [Actual app screenshot — Vault network](images/01-vault-network.png)
- [Actual app screenshot — Knowledge network](images/02-knowledge-network.png)
- [Actual app screenshot — Skills network](images/03-skills-network.png)

The supplied PNG files were visually reviewed for readable private content and contain no text/EXIF metadata chunks. Their inclusion does not grant a general license for the application or imply provider endorsement.
