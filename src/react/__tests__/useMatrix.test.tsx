import { act, renderHook } from '@testing-library/react-native';

import { createFakeSession } from '../testing/fakeSession';
import { renderMatrixHook } from '../testing/renderWithMatrix';
import { useMatrix } from '../useMatrix';

describe('useMatrix', () => {
  it('exposes the session, its status and the user ID', async () => {
    const fake = createFakeSession({ userId: '@alice:localhost' });

    const { result } = await renderMatrixHook(fake, () => useMatrix());

    expect(result.current.session).toBe(fake.session);
    expect(result.current.userId).toBe('@alice:localhost');
    expect(result.current.status.syncState).toBe('syncing');
    expect(result.current.status.isReady).toBe(true);
  });

  it('re-renders when the status changes', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useMatrix());
    await act(async () => {
      fake.setStatus({ syncState: 'error', isReady: false, totalUnread: 3 });
    });

    expect(result.current.status.syncState).toBe('error');
    expect(result.current.status.isReady).toBe(false);
    expect(result.current.status.totalUnread).toBe(3);
  });

  it('re-renders on a status change and on nothing else', async () => {
    // What protects this hook is snapshot identity, not the narrow
    // subscription: `useSyncExternalStore` compares with Object.is, so a
    // getSnapshot that copied the status defensively would re-render every
    // consumer of `useMatrix` on every sync tick. That copy is the mutation
    // this test exists to catch.
    const fake = createFakeSession();
    let renders = 0;

    await renderMatrixHook(fake, () => {
      renders += 1;
      return useMatrix();
    });
    const afterMount = renders;

    await act(async () => {
      fake.emitRoomSummary();
      fake.emitReceipt();
    });
    expect(renders).toBe(afterMount);

    await act(async () => {
      fake.setStatus({ totalUnread: 1 });
    });
    expect(renders).toBeGreaterThan(afterMount);
  });

  it('stops listening once unmounted', async () => {
    const fake = createFakeSession();

    const { unmount } = await renderMatrixHook(fake, () => useMatrix());
    await unmount();

    expect(fake.emitter.listenerCount('status')).toBe(0);
  });

  it('names itself in the error when used outside a provider', async () => {
    // Rendered bare: the message has to say which hook was misplaced, because
    // the stack a consumer sees is minified.
    await expect(renderHook(() => useMatrix())).rejects.toThrow('useMatrix');
  });
});
