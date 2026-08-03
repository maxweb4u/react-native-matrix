---
doc_kind: governance
doc_function: canonical
purpose: The lifecycle of a feature package and the gate at each stage.
derived_from:
  - ../dna/lifecycle.md
  - ../engineering/testing-policy.md
status: active
canonical_for:
  - feature_package_lifecycle
  - feature_gates
  - feature_package_shape
---

# Feature Flow

## When a feature package is required

A package is created when work changes the public API, spans more than a few files, or needs a decision recorded. Everything smaller lives in the commit and, when user-visible, in `CHANGELOG.md`.

Proportionality is the rule ([../dna/principles.md](../dna/principles.md), rule 10): a package that restates the diff is waste.

## Shape

```
features/FT-<id>-<slug>/
  feature.md              intent, scope, acceptance criteria, test cases
  implementation-plan.md   ordered steps and their verification (optional for small work)
```

## Stages

| Stage | `delivery_status` | Gate to leave it |
|-|-|-|
| Draft | `planned` | Scope and acceptance criteria are written and unambiguous |
| Implementation | `in_progress` | Every acceptance criterion has code and a test |
| Verification | `in_progress` | `npm run verify` passes; integration tests pass when the session, timeline, or crypto layers changed |
| Simplify review | `in_progress` | A separate pass confirming the implementation is no more complex than the constraints require |
| Done | `done` | Memory bank and `CHANGELOG.md` updated; the package records what actually shipped |

Verification, simplify review, and acceptance are separate passes. They may happen in one session, but each states its conclusion before the next begins.

## Test cases

Acceptance criteria are written as testable statements (`SC-1`, `SC-2`, …) in `feature.md`. Each maps to at least one automated test, or carries an explicit manual-only exception with its reason. The mapping is what makes the package auditable after the fact.
