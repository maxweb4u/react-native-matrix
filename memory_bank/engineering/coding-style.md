---
doc_kind: engineering
doc_function: canonical
purpose: Naming, comments, file layout, and lint conventions.
derived_from:
  - typescript.md
status: active
canonical_for:
  - naming_conventions
  - comment_policy
  - file_layout
---

# Coding Style

## Files

One primary export per file, named after the file. Tests live in a sibling `__tests__/` directory named after the module under test. Barrels (`index.ts`) re-export and contain no logic.

## Naming

| Kind | Convention |
|-|-|
| Types, classes, components | `PascalCase` |
| Functions, variables, hooks | `camelCase`, hooks prefixed `use` |
| Constants that are value objects | `PascalCase` (`MessageKind`) |
| Files | Match the primary export |
| Booleans | `is` / `has` / `was` prefix |

## Comments

Comments explain **why**, never what the line already says. Two cases justify one:

1. Non-obvious rationale, especially a spec requirement or a defect being prevented. Reference the original defect when the code exists because of it — this is how the rewrite keeps its history legible.
2. A pointer to the canonical document, per [../dna/cross-references.md](../dna/cross-references.md).

Commented-out code is deleted. Git remembers it. 0.0.x carried blocks of dead commented code in almost every file, including a disabled `shouldComponentUpdate` body that hid why the component always re-rendered.

## Lint

ESLint flat config, `npm run lint`. `no-console` is an error: a library must not write to a consumer's console. Diagnostics go through the `onError` callback on session options.
