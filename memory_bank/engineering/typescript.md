---
doc_kind: engineering
doc_function: canonical
purpose: TypeScript strictness settings, public type rules, and error conventions.
derived_from:
  - architecture.md
status: active
canonical_for:
  - typescript_strictness
  - public_type_rules
  - error_class_rules
---

# TypeScript Conventions

## Strictness

`strict` is on, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`. `@typescript-eslint/no-explicit-any` is an error, not a warning.

`noUncheckedIndexedAccess` is the one that costs typing effort and repays it: array and record access returns `T | undefined`, which is exactly the class of mistake that produced runtime crashes in 0.0.x.

## Public types

- Public types live in `src/types/` and are exported from the root barrel.
- View models are `readonly` throughout. A change produces a new object so React can compare by reference.
- Unions of string literals are declared as `const` objects plus a derived type, so consumers get both a value and a type under one name.
- Optional adapter methods are marked optional in the interface, never faked with a no-op that pretends to work.

## Errors

Every deliberate throw is a named subclass of `MatrixLibError` in `src/core/errors.ts`. An error message states what failed **and what the caller should do**, including the property or install step involved. Bare `throw new Error(...)` in library code is a defect.

## Interop with matrix-js-sdk

The SDK's types are used directly; they are not re-exported and not wrapped in parallel interfaces. Where a cast is unavoidable — the SDK types some content parameters more narrowly than the spec allows — the cast is local, commented, and never `any`.
