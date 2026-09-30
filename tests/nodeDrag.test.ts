import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LayoutNode } from '../src/types/tree.ts';
import { createDragSession, getDragPositions, snapDrag } from '../src/components/Canvas/nodeDrag.ts';

const node = (id: string, x: number, y: number, width = 220, height = 104) =>
  ({ id, x, y, width, height } as LayoutNode);

describe('node dragging', () => {
  it('moves selected visible nodes together without changing relative spacing', () => {
    const nodes = { a: node('a', 13, 25), b: node('b', 300, 200), c: node('c', 900, 800) };
    const session = createDragSession(nodes, 'b', new Set(['a', 'b', 'hidden']));
    assert.equal(session.nodes.length, 2);
    assert.deepEqual(getDragPositions(session, { x: -50, y: 70 }), {
      a: { x: -37, y: 95 }, b: { x: 250, y: 270 },
    });
    assert.equal(nodes.a.x, 13);
    assert.deepEqual(session.targets.x, [900, 1010, 1120]);
  });

  it('drags only the grabbed node when it is outside the selection', () => {
    const session = createDragSession({ a: node('a', 0, 0), b: node('b', 300, 0) }, 'b', new Set(['a']));
    assert.deepEqual(session.nodes.map((n) => n.id), ['b']);
  });

  it('snaps to the closest stationary edge or centre ahead of the grid', () => {
    const session = createDragSession({ a: node('a', 0, 0), b: node('b', 301, 401) }, 'a', new Set());
    const result = snapDrag(session, { x: 78, y: 294 }, 1);
    assert.deepEqual(result, { offset: { x: 81, y: 297 }, guides: { x: 301, y: 401 } });
  });

  it('uses the existing 32-unit grid when no node alignment is nearby', () => {
    const session = createDragSession({ a: node('a', 10, 10) }, 'a', new Set());
    assert.deepEqual(snapDrag(session, { x: 23, y: 53 }, 1), {
      offset: { x: 22, y: 54 }, guides: { x: 32, y: 64 },
    });
  });

  it('uses a screen-pixel threshold at low and high zoom', () => {
    const session = createDragSession({ a: node('a', 0, 0), b: node('b', 301, 401) }, 'a', new Set());
    assert.equal(snapDrag(session, { x: 67, y: 270 }, 0.5).offset.x, 81);
    assert.equal(snapDrag(session, { x: 78, y: 270 }, 4).offset.x, 78);
  });

  it('bypasses snapping entirely with Alt and preserves fractional coordinates', () => {
    const session = createDragSession({ a: node('a', 0, 0) }, 'a', new Set());
    assert.deepEqual(snapDrag(session, { x: 31.25, y: -33.5 }, 1, true), {
      offset: { x: 31.25, y: -33.5 }, guides: {},
    });
  });
});