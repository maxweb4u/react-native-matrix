/**
 * Rich reply (quote) fallback handling, on the reading side only.
 *
 * Matrix carries replies as `m.in_reply_to` plus a plain-text fallback where
 * each quoted line is prefixed with `> `. Clients must strip that fallback
 * before rendering, otherwise the quote appears twice.
 *
 * This library strips incoming fallbacks and deliberately sends none: the
 * fallback is deprecated in the spec, and duplicating the quoted text into
 * every reply body makes it turn up in the recipient's search results and
 * notifications. See memory_bank/domain/timeline.md#replies.
 *
 * 0.0.x detected quotes with `line.indexOf('> ') !== -1`, which matched any
 * line merely containing `> ` — a message like `2 > 1 means…` was rendered as
 * a quote — and it dropped newlines while rejoining the remainder.
 *
 * See https://spec.matrix.org/latest/client-server-api/#rich-replies
 */

export interface SplitReplyBody {
  /** The quoted text with the `> ` prefixes removed, or null when absent. */
  quoted: string | null;
  /** The actual message the user typed. */
  body: string;
}

/** Splits a reply fallback into the quoted part and the reply itself. */
export function splitReplyFallback(body: string): SplitReplyBody {
  if (typeof body !== 'string' || !body.startsWith('> ')) {
    return { quoted: null, body: body ?? '' };
  }

  const lines = body.split('\n');
  const quotedLines: string[] = [];
  let index = 0;

  // The fallback is a contiguous run of `> ` lines at the very start.
  for (; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (line.startsWith('> ')) {
      quotedLines.push(line.slice(2));
    } else if (line === '>') {
      quotedLines.push('');
    } else {
      break;
    }
  }

  // A single blank line separates the fallback from the reply body.
  if (lines[index] === '') {
    index += 1;
  }

  const remainder = lines.slice(index).join('\n');
  return {
    quoted: quotedLines.length > 0 ? quotedLines.join('\n') : null,
    body: remainder,
  };
}
