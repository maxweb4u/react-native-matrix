import { render, screen } from '@testing-library/react-native';

import { DaySeparator } from '../DaySeparator';
import { MatrixUiProvider } from '../MatrixUiProvider';

// Local midnight, not UTC: the separator compares calendar days in the
// device's zone, so a UTC-based fixture would flip depending on where the
// suite runs.
const NOW = new Date(2026, 7, 28, 14, 30).getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('DaySeparator', () => {
  beforeEach(() => {
    jest.setSystemTime(NOW);
  });

  it('labels the current day', async () => {
    await render(<DaySeparator ts={new Date(2026, 7, 28, 8, 0).getTime()} />);

    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('labels the previous day, across a month boundary', async () => {
    jest.setSystemTime(new Date(2026, 8, 1, 0, 30).getTime());

    await render(<DaySeparator ts={new Date(2026, 7, 31, 23, 45).getTime()} />);

    expect(screen.getByText('Yesterday')).toBeTruthy();
  });

  it('falls back to the formatted date for anything older', async () => {
    await render(<DaySeparator ts={NOW - 3 * DAY} />);

    expect(screen.getByText('Aug 25, 2026')).toBeTruthy();
  });

  it('does not call a late evening yesterday "Today"', async () => {
    // The 0.0.x bug this guards: a fixed millisecond span rather than a
    // calendar-day comparison. 20 hours back is still the previous day.
    await render(<DaySeparator ts={new Date(2026, 7, 27, 18, 30).getTime()} />);

    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.getByText('Yesterday')).toBeTruthy();
  });

  it('takes the relative labels from the provider', async () => {
    await render(
      <MatrixUiProvider labels={{ today: 'Heute', yesterday: 'Gestern' }} locale="de-DE">
        <DaySeparator ts={NOW} />
      </MatrixUiProvider>,
    );

    expect(screen.getByText('Heute')).toBeTruthy();
  });

  it('formats the absolute date in the provider locale', async () => {
    await render(
      <MatrixUiProvider locale="de-DE">
        <DaySeparator ts={NOW - 5 * DAY} />
      </MatrixUiProvider>,
    );

    expect(screen.getByText('23. Aug. 2026')).toBeTruthy();
  });
});
