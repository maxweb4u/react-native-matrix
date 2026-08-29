import {Share} from 'react-native';
import type {
  ImagePickerAdapter,
  MatrixAdapters,
  ShareAdapter,
} from 'react-native-matrix';

/**
 * Platform adapters for the example app.
 *
 * This is the whole integration surface of the library's native features. Two
 * adapters are wired and the rest are not, on purpose: the composer renders
 * the photo control and hides the document and voice controls, which is what
 * "a missing adapter is never a silent no-op" looks like on screen.
 *
 * See memory_bank/engineering/adapters.md for real wiring recipes.
 */

/** Uses React Native's own share sheet — no dependency needed. */
const share: ShareAdapter = {
  async share(payload) {
    await Share.share({
      message: payload.message ?? '',
      ...(payload.url ? {url: payload.url} : {}),
      ...(payload.title ? {title: payload.title} : {}),
    });
  },
};

/**
 * A stand-in picker that returns a generated image instead of opening the
 * camera roll.
 *
 * It exists so the upload path can be exercised without adding a native
 * dependency to this example. In a real application this is where
 * `react-native-image-picker` goes:
 *
 * ```ts
 * import {launchImageLibrary} from 'react-native-image-picker';
 *
 * const imagePicker: ImagePickerAdapter = {
 *   async pickFromLibrary(options) {
 *     const result = await launchImageLibrary({
 *       mediaType: 'photo',
 *       maxWidth: options?.maxSize,
 *       maxHeight: options?.maxSize,
 *       quality: options?.quality,
 *     });
 *     const asset = result.assets?.[0];
 *     if (!asset?.uri) return null;
 *     return {
 *       uri: asset.uri,
 *       name: asset.fileName ?? 'photo.jpg',
 *       mimeType: asset.type ?? 'image/jpeg',
 *       size: asset.fileSize,
 *       width: asset.width,
 *       height: asset.height,
 *     };
 *   },
 * };
 * ```
 */
const imagePicker: ImagePickerAdapter = {
  async pickFromLibrary() {
    return {
      // `sendFile` reads this with `fetch`, which handles data URIs as well as
      // the `file://` and `content://` URIs a real picker returns.
      uri: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
      name: 'sample.png',
      mimeType: 'image/png',
      width: 8,
      height: 8,
    };
  },
};

/** An 8×8 blue square. Small enough to inline, real enough to render. */
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2NkYPjPQApgYhhVMKpg' +
  'VMGoglEFVFAAAI0AAv7wJ0YAAAAASUVORK5CYII=';

export const adapters: MatrixAdapters = {imagePicker, share};
