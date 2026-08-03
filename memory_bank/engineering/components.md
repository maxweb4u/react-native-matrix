---
doc_kind: engineering
doc_function: canonical
purpose: What the default components are for, how they are themed and translated, and where the line between them and the hooks falls.
derived_from:
  - architecture.md
  - ../product/vision.md
status: active
canonical_for:
  - component_scope
  - theming_contract
  - label_contract
---

# Components

`src/components/` is the default UI. It is optional: the hooks below it are the real product, and an application that wants its own design system should render from `useTimeline` and `useRooms` directly. The components exist so that a team can see a working chat on day one and decide later.

## Constraints

- **React Native primitives only.** `View`, `Text`, `Image`, `Pressable`, `TextInput`, `FlatList`, `ActivityIndicator`, `KeyboardAvoidingView`. No gesture library, no icon font, no SVG package, no bundled binary assets — the avatar fallback is initials, and controls are labelled text. This follows from the zero-dependency rule in [dependency-policy.md](dependency-policy.md); a component library that pulled in an icon set would reintroduce exactly the dependency rot that made 0.0.x uninstallable.
- **No SDK imports.** A component reads view models and calls hooks. `matrix-js-sdk` types never appear in a component signature.
- **Every state renders as something.** A redaction, a decryption failure, and an unrendered msgtype each become an explicit placeholder. A row that silently draws nothing cannot be told apart from a bug.

## Composition

| Component | Use it when |
|-|-|
| `ChatScreen` | You want a whole conversation screen, including keyboard handling |
| `MessageList` + `Composer` | You want your own screen chrome around the two hard parts |
| `MessageRow`, `RoomListItem`, `Avatar`, `ReactionBar`, `DaySeparator` | You are building your own list and want the rows |

## Theming and labels

`MatrixUiProvider` supplies three things: a `theme` of design tokens, a `labels` object, and a `locale`. All three are optional, and the components fall back to the defaults when no provider is present, so nothing has to be configured to see the chat work.

Overrides are shallow-merged per group, so replacing one colour does not require restating the palette.

Interpolated labels are **functions**, not templates with placeholders:

```ts
typingOne: (displayName) => `${displayName} печатает…`
```

This is a direct response to a 0.0.x defect. The Android action sheet looked up a translation key that did not exist and rendered the interpolation object, so users saw `[object Object]`. A function argument cannot go missing without the compiler saying so, and there is no key to fail to resolve.

## Keyboard behaviour

`ChatScreen` uses `KeyboardAvoidingView` with `behavior="padding"` on iOS and no behaviour on Android, where `android:windowSoftInputMode="adjustResize"` in the host manifest does the work. 0.0.x subscribed only to `keyboardWillShow`, which never fires on Android, so the composer sat under the keyboard there for the life of the package — with the `keyboardDidShow` handlers commented out one line below.

This is verified manually (SC-12); see the feature's [manual-only verification](../features/FT-001-typescript-rewrite/feature.md).
