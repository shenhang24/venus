# Contributing to Venus

Venus is an early-stage, personally maintained project. Small, focused reports and pull requests are welcome. Maintenance is best-effort; a response, review, or merge is not guaranteed.

## Before starting

Read the [README](README.md), [support guidance](SUPPORT.md), and [code of conduct](CODE_OF_CONDUCT.md). Search existing issues before opening a new one. Discuss substantial changes in an issue first so the scope can be agreed before implementation.

## Report a bug or propose a feature

Use the repository's [issue templates](https://github.com/shenhang24/venus/issues/new/choose). Describe the version, environment, expected behavior, and actual result. Give minimal steps and synthetic sample Markdown when useful. For security concerns, follow [SECURITY.md](SECURITY.md).

Never upload a private Vault, conversation export, knowledge or skill collection, concept records, credentials, tokens, account details, or unredacted logs. Replace personal content with invented examples and inspect screenshots before sharing. Paid API access is not required to report an issue or contribute a fix.

## Local development

Follow the [deployment instructions](docs/DEPLOYMENT.md). Use Node.js 20 or later and a disposable directory containing only synthetic data. From the repository root:

```sh
npm ci
npm run build
npm test
```

Run checks appropriate to your change. Documentation-only changes need a spelling, link, and consistency review rather than a full application test run. For code changes, include relevant test results or explain what could not be tested. Do not run live extraction or incur model charges merely to verify an unrelated change.

## Pull requests

Keep one problem per pull request. Explain the user-visible behavior, motivation, and validation. Preserve source references, user edits, and existing data; avoid unrelated refactors, generated output changes, or new dependencies without a clear need. Keep private runtime configuration and data out of commits. Include generated assets only when required by the change and describe how they were produced.

Your contributions are provided under the project's [MIT License](LICENSE). Submit only material you have the right to contribute, retain attribution, and preserve third-party license notices.
