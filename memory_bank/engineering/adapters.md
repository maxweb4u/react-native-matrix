---
doc_kind: engineering
doc_function: canonical
purpose: The platform adapter contracts and how a host application wires them.
derived_from:
  - dependency-policy.md
status: active
canonical_for:
  - adapter_contract
  - adapter_absence_behaviour
  - adapter_wiring_recipes
---

# Adapters

## Contract

An adapter is an object the host passes to `MatrixProvider` implementing a capability the library refuses to depend on. Interfaces are declared in `src/types/adapters.ts`.

| Adapter | Capability | Needed for |
|-|-|-|
| `imagePicker` | Camera and photo library | Sending images |
| `documentPicker` | File browser | Sending files |
| `audioRecorder` | Microphone capture | Voice messages |
| `audioPlayer` | Playback with progress | Playing voice messages |
| `share` | System share sheet | Sharing a message |
| `clipboard` | Clipboard write | Copying a message |
| `fileSystem` | Base64 read and cache write | Adapters that cannot return a fetchable URI |
| `emojiSource` | Emoji catalogue | The reaction picker |
| `pushToken` | The device's FCM or APNs token | Registering a pusher — see [../domain/push.md](../domain/push.md) |

Every adapter is optional and independent. An application that only sends text passes none.

`pushToken` is the one adapter whose *absence of a value* is a normal state
rather than a missing capability: on first launch the user has not granted
notification permission, so `getToken()` resolves null. `registerPusher`
returns null and keeps watching, because the token arrives through
`onTokenRefresh` the moment permission is granted. An adapter that implements
`getToken` and omits `onTokenRefresh` therefore works, but registers nothing on
the launch where permission is first granted, and stops receiving notifications
the first time the messaging service rotates the token.

## Absence behaviour

Two rules, and the second is the one that matters:

1. Default components hide controls whose adapter is missing. No attach button appears without a picker.
2. Calling the feature programmatically throws `AdapterMissingError` naming the adapter and how to supply it.

A missing adapter is never a silent no-op. Silent failure is what makes a chat app feel broken rather than limited.

## Wiring recipes

These are examples, not endorsements: any library satisfying the interface works.

### Image picker with `react-native-image-picker`

```ts
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import type { ImagePickerAdapter, LocalFile } from 'react-native-matrix';

const toLocalFile = (asset: { uri?: string; fileName?: string; type?: string; fileSize?: number; width?: number; height?: number }): LocalFile | null =>
  asset?.uri
    ? {
        uri: asset.uri,
        name: asset.fileName ?? `image-${Date.now()}.jpg`,
        mimeType: asset.type ?? 'image/jpeg',
        size: asset.fileSize,
        width: asset.width,
        height: asset.height,
      }
    : null;

export const imagePicker: ImagePickerAdapter = {
  async pickFromLibrary(options) {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: options?.maxSize,
      maxHeight: options?.maxSize,
      quality: options?.quality ?? 0.8,
    });
    return result.assets?.[0] ? toLocalFile(result.assets[0]) : null;
  },
  async takePhoto(options) {
    const result = await launchCamera({ mediaType: 'photo', quality: options?.quality ?? 0.8 });
    return result.assets?.[0] ? toLocalFile(result.assets[0]) : null;
  },
};
```

### Clipboard with `@react-native-clipboard/clipboard`

```ts
import Clipboard from '@react-native-clipboard/clipboard';
import type { ClipboardAdapter } from 'react-native-matrix';

export const clipboard: ClipboardAdapter = { setString: (value) => Clipboard.setString(value) };
```

### Audio with `react-native-audio-recorder-player`

```ts
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import type { AudioPlayerAdapter, AudioRecorderAdapter } from 'react-native-matrix';

const engine = new AudioRecorderPlayer();

export const audioRecorder: AudioRecorderAdapter = {
  async start() { await engine.startRecorder(); },
  async stop() {
    const uri = await engine.stopRecorder();
    return uri ? { uri, name: `voice-${Date.now()}.m4a`, mimeType: 'audio/mp4' } : null;
  },
  async cancel() { await engine.stopRecorder(); },
};

export const audioPlayer: AudioPlayerAdapter = {
  async play(uri, onProgress) {
    await engine.startPlayer(uri);
    engine.addPlayBackListener((event) =>
      onProgress({ positionMs: event.currentPosition, durationMs: event.duration }),
    );
    return () => { engine.removePlayBackListener(); void engine.stopPlayer(); };
  },
  async stop() { await engine.stopPlayer(); },
};
```

## Implementing an adapter

- Resolve `null` on user cancellation; reject only on real failure.
- Return a URI the platform can fetch. Use `fileSystem` only when the underlying library cannot.
- Adapters are called from user gestures, so permission prompts belong inside them.
