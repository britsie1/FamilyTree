import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advancePanMomentum } from '../src/components/Canvas/panMomentum';
import { useCanvasStore } from '../src/stores/useCanvasStore';

describe('Canvas navigation', () => {
  it('switches modes without changing node positions or selection', () => {
    const previous = useCanvasStore.getState();
    previous.setNavigationMode(true);
    const next = useCanvasStore.getState();
    assert.equal(next.navigationMode, true);
    assert.equal(next.layoutOverrides, previous.layoutOverrides);
    assert.equal(next.selectedPersonIds, previous.selectedPersonIds);
    next.setNavigationMode(false);
    assert.equal(useCanvasStore.getState().navigationMode, false);
  });

  it('keeps the release direction while gradually slowing to a stop', () => {
    let velocity = { x: 1, y: -0.5 };
    for (let i = 0; i < 100; i++) {
      const next = advancePanMomentum(velocity, 16);
      assert.ok(next.offset.x > 0);
      assert.ok(next.offset.y < 0);
      assert.ok(next.velocity.x < velocity.x);
      velocity = next.velocity;
    }
    assert.ok(Math.hypot(velocity.x, velocity.y) < 0.02);
  });

  it('gives the same result at different frame rates', () => {
    const initial = { x: 1, y: 0.5 };
    const full = advancePanMomentum(initial, 32);
    const first = advancePanMomentum(initial, 16);
    const second = advancePanMomentum(first.velocity, 16);
    assert.ok(Math.abs(full.offset.x - first.offset.x - second.offset.x) < 1e-10);
    assert.ok(Math.abs(full.velocity.y - second.velocity.y) < 1e-10);
  });

  it('bounds long frames and ignores negative elapsed time', () => {
    assert.deepEqual(advancePanMomentum({ x: 1, y: 1 }, 1000), advancePanMomentum({ x: 1, y: 1 }, 64));
    assert.deepEqual(advancePanMomentum({ x: 1, y: 1 }, -10).offset, { x: 0, y: 0 });
  });
});