import {
  formatDayLabel,
  formatDuration,
  formatListTimestamp,
  formatMessageTime,
  isDifferentDay,
  isToday,
  isYesterday,
} from '../datetime';

const at = (iso: string): number => new Date(iso).getTime();

describe('isDifferentDay', () => {
  it('separates messages that cross midnight only hours apart', () => {
    // The regression that motivated this helper: 0.0.x compared elapsed time,
    // so these two were treated as the same day and no separator was drawn.
    const before = at('2026-01-12T23:30:00');
    const after = at('2026-01-13T01:00:00');
    expect(isDifferentDay(before, after)).toBe(true);
  });

  it('keeps messages on the same calendar day together', () => {
    expect(isDifferentDay(at('2026-01-12T00:01:00'), at('2026-01-12T23:59:00'))).toBe(false);
  });

  it('detects a change of month and year', () => {
    expect(isDifferentDay(at('2025-12-31T23:00:00'), at('2026-01-01T00:30:00'))).toBe(true);
  });

  it('is symmetric', () => {
    const a = at('2026-03-01T10:00:00');
    const b = at('2026-03-02T10:00:00');
    expect(isDifferentDay(a, b)).toBe(isDifferentDay(b, a));
  });
});

describe('isToday / isYesterday', () => {
  const now = at('2026-01-12T12:00:00');

  it('recognises the current day', () => {
    expect(isToday(at('2026-01-12T07:00:00'), now)).toBe(true);
    expect(isToday(at('2026-01-11T23:59:00'), now)).toBe(false);
  });

  it('recognises the previous day across a month boundary', () => {
    const firstOfMonth = at('2026-02-01T09:00:00');
    expect(isYesterday(at('2026-01-31T22:00:00'), firstOfMonth)).toBe(true);
  });
});

describe('formatting', () => {
  it('formats a message time as hours and minutes', () => {
    expect(formatMessageTime(at('2026-01-12T14:05:00'), 'en-GB')).toBe('14:05');
  });

  it('formats a day label with day, month and year', () => {
    const label = formatDayLabel(at('2026-01-12T14:05:00'), 'en-GB');
    expect(label).toContain('12');
    expect(label).toContain('2026');
  });

  it('shows a clock time for today and a weekday within the last week', () => {
    const now = at('2026-01-12T18:00:00');
    expect(formatListTimestamp(at('2026-01-12T09:30:00'), 'en-GB', now)).toBe('09:30');

    const threeDaysAgo = formatListTimestamp(at('2026-01-09T09:30:00'), 'en-GB', now);
    expect(threeDaysAgo).toMatch(/^[A-Za-z]{3}$/);

    const longAgo = formatListTimestamp(at('2025-11-02T09:30:00'), 'en-GB', now);
    expect(longAgo).toContain('2');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [1_000, '0:01'],
    [61_000, '1:01'],
    [599_000, '9:59'],
    [3_600_000, '1:00:00'],
    [3_661_000, '1:01:01'],
  ])('formats %ims as %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it('treats invalid input as zero rather than rendering NaN', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});
