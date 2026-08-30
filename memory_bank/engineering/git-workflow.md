---
doc_kind: engineering
doc_function: canonical
purpose: Branch, commit, and release-tag conventions.
derived_from:
  - ../dna/governance.md
status: active
canonical_for:
  - branch_naming
  - commit_format
  - release_tagging
---

# Git Workflow

## Branches

`master` is releasable. Work happens on `feat/…`, `fix/…`, `docs/…`, or `chore/…` branches and merges back through a pull request.

## Commits

Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. A breaking change carries `!` and a `BREAKING CHANGE:` footer naming the removed or changed export.

The subject says what changed and why in one line. A commit that fixes a defect names the symptom, not just the file.

## Releases

Releases are tagged `v<version>` and correspond to an entry in `CHANGELOG.md`. Publishing runs `npm run verify` and the integration suite first; `prepack` rebuilds `lib/` so the published artifact always matches the tag.
