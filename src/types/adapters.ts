/**
 * Platform adapters.
 *
 * This library ships zero runtime dependencies. Anything that needs a native
 * module — camera, file picker, audio, share sheet, clipboard — is expressed
 * here as an interface that the host application implements with whichever
 * library it already uses.
 *
 * Every adapter is optional. Features that need a missing adapter are hidden
 * from the default UI and throw `AdapterMissingError` when called directly, so
 * a missing adapter is never a silent no-op.
 *
 * See memory_bank/engineering/dependency-policy.md for the rationale and
 * memory_bank/engineering/adapters.md for wiring recipes.
 */

/** A file selected or produced on the device, ready to be uploaded. */
export interface LocalFile {
  /** Platform file URI (`file://…`, `content://…`, `ph://…`). */
  uri: string;
  /** File name sent to the homeserver as the message body. */
  name: string;
  mimeType: string;
  /** Size in bytes when the picker reports one. */
  size?: number;
  width?: number;
  height?: number;
  /** Duration in milliseconds for audio and video. */
  durationMs?: number;
}

export interface ImagePickOptions {
  /** Longest edge in pixels the picker should downscale to, when supported. */
  maxSize?: number;
  /** JPEG quality between 0 and 1, when supported. */
  quality?: number;
}

export interface ImagePickerAdapter {
  /** Resolves null when the user cancels. */
  pickFromLibrary(options?: ImagePickOptions): Promise<LocalFile | null>;
  /** Resolves null when the user cancels. */
  takePhoto?(options?: ImagePickOptions): Promise<LocalFile | null>;
}

export interface DocumentPickerAdapter {
  /**
   * @param mimeTypes - Filter, e.g. `['application/pdf']`. Omit for any file.
   * Resolves null when the user cancels.
   */
  pick(mimeTypes?: string[]): Promise<LocalFile | null>;
}

export interface AudioRecorderAdapter {
  start(): Promise<void>;
  /** Resolves the recorded file, or null when nothing was captured. */
  stop(): Promise<LocalFile | null>;
  /** Aborts recording and discards the result. */
  cancel(): Promise<void>;
}

export interface PlaybackProgress {
  positionMs: number;
  durationMs: number;
}

export interface AudioPlayerAdapter {
  /**
   * Starts playback. Only one track plays at a time: implementations must stop
   * any previous track first.
   * @returns a function that stops playback and detaches the listener.
   */
  play(uri: string, onProgress: (progress: PlaybackProgress) => void): Promise<() => void>;
  stop(): Promise<void>;
}

export interface SharePayload {
  message?: string;
  /** Local file URI or data URI of an attachment. */
  url?: string;
  title?: string;
}

export interface ShareAdapter {
  share(payload: SharePayload): Promise<void>;
}

export interface ClipboardAdapter {
  setString(value: string): void | Promise<void>;
}

export interface FileSystemAdapter {
  /**
   * Reads a local file as a base64 string without the data-URI prefix.
   * Needed only by adapters that cannot hand back a fetchable URI.
   */
  readAsBase64(uri: string): Promise<string>;
  /**
   * Persists base64 data to a cache file and resolves its URI. Used when
   * saving a downloaded attachment for the share sheet.
   */
  writeBase64(fileName: string, base64: string, mimeType?: string): Promise<string>;
}

/** Supplies the emoji grid for the reaction picker. */
export interface EmojiSourceAdapter {
  /** Ordered categories rendered as sections in the picker. */
  categories(): Promise<EmojiCategory[]> | EmojiCategory[];
}

export interface EmojiCategory {
  key: string;
  title: string;
  emojis: string[];
}

export interface MatrixAdapters {
  imagePicker?: ImagePickerAdapter;
  documentPicker?: DocumentPickerAdapter;
  audioRecorder?: AudioRecorderAdapter;
  audioPlayer?: AudioPlayerAdapter;
  share?: ShareAdapter;
  clipboard?: ClipboardAdapter;
  fileSystem?: FileSystemAdapter;
  emojiSource?: EmojiSourceAdapter;
}

export type AdapterName = keyof MatrixAdapters;
