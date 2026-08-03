/**
 * Renders a component tree inside a provider backed by a fake session.
 *
 * Async because `@testing-library/react-native` 14 made `render` async to line
 * up with React 19's `act`. Every caller has to await it.
 *
 * Excluded from the published build by tsconfig.build.json.
 */

import { render, type RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { MatrixProvider } from '../MatrixProvider';
import type { FakeSession } from './fakeSession';

export function renderWithMatrix(fake: FakeSession, ui: ReactElement): Promise<RenderResult> {
  return render(
    <MatrixProvider
      session={fake.session}
      credentials={{
        baseUrl: 'http://localhost:8008',
        accessToken: 'fake-token',
        userId: fake.session.userId,
      }}
    >
      {ui}
    </MatrixProvider>,
  );
}
