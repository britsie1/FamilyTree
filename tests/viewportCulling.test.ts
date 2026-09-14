import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDoubleInLawPreset } from '../src/services/storage.ts';
import { computeLayoutAsync } from '../src/services/layoutClient.ts';
import type { LayoutNode } from '../src/types/tree.ts';

describe('Spatial Viewport Culling & Async Layout', () => {
  it('computes layout asynchronously via computeLayoutAsync', async () => {
    const tree = createDoubleInLawPreset();
    const layout = await computeLayoutAsync(tree, 'vertical', false, [], true);

    assert.ok(layout);
    assert.ok(Object.keys(layout.nodes).length > 0);
    assert.ok(layout.edges.length > 0);
    assert.ok(layout.bounds.width > 0);
  });

  it('correctly filters nodes inside and outside a visible viewport bounding box', () => {
    // Mock 4 nodes across coordinates
    const nodes: Record<string, LayoutNode> = {
      n1: {
        id: 'n1',
        type: 'person',
        data: { id: 'n1', unionIds: [] },
        x: 100,
        y: 100,
        width: 220,
        height: 104,
        generation: 0,
        order: 0,
      },
      n2: {
        id: 'n2',
        type: 'person',
        data: { id: 'n2', unionIds: [] },
        x: 800,
        y: 100,
        width: 220,
        height: 104,
        generation: 0,
        order: 1,
      },
      n3: {
        id: 'n3',
        type: 'person',
        data: { id: 'n3', unionIds: [] },
        x: 100,
        y: 900,
        width: 220,
        height: 104,
        generation: 1,
        order: 0,
      },
      n4: {
        id: 'n4',
        type: 'person',
        data: { id: 'n4', unionIds: [] },
        x: 2000,
        y: 2000,
        width: 220,
        height: 104,
        generation: 2,
        order: 0,
      },
    };

    // Viewport viewing around (0, 0) to (500, 400)
    const viewport = {
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 400,
    };

    const isVisible = (node: LayoutNode) => {
      const nodeRight = node.x + node.width;
      const nodeBottom = node.y + node.height;
      return (
        nodeRight >= viewport.minX &&
        node.x <= viewport.maxX &&
        nodeBottom >= viewport.minY &&
        node.y <= viewport.maxY
      );
    };

    // n1 (100, 100 to 320, 204) intersects [0, 0, 500, 400] -> visible
    assert.strictEqual(isVisible(nodes.n1), true);

    // n2 (800, 100 to 1020, 204) x > 500 -> culled
    assert.strictEqual(isVisible(nodes.n2), false);

    // n3 (100, 900 to 320, 1004) y > 400 -> culled
    assert.strictEqual(isVisible(nodes.n3), false);

    // n4 (2000, 2000) -> culled
    assert.strictEqual(isVisible(nodes.n4), false);
  });
});
