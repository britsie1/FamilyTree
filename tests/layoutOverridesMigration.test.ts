import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeTree, clearManualPositions } from '../src/services/treeOperations.ts';
import { importTreeFromJsonString, createDoubleInLawPreset } from '../src/services/storage.ts';
import { computeLayout } from '../src/services/layoutEngine.ts';
import type { TreeData } from '../src/types/tree.ts';

describe('Layout Overrides & Domain Entity Decoupling', () => {
  it('migrates legacy person.x and person.y into tree.layoutOverrides in sanitizeTree', () => {
    const rawTree: any = {
      id: 'legacy_tree_1',
      name: 'Legacy Tree',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      people: {
        p1: {
          id: 'p1',
          firstName: 'Alice',
          unionIds: [],
          x: 250,
          y: 400,
        },
        p2: {
          id: 'p2',
          firstName: 'Bob',
          unionIds: [],
          horizontalX: 120,
          horizontalY: 340,
        },
      },
      unions: {},
    };

    const sanitized = sanitizeTree(rawTree as TreeData);

    // Layout overrides should be populated
    assert.deepStrictEqual(sanitized.layoutOverrides, {
      p1: { x: 250, y: 400 },
    });
    assert.deepStrictEqual(sanitized.horizontalOverrides, {
      p2: { x: 120, y: 340 },
    });

    // Person domain entities must have legacy fields stripped
    assert.strictEqual((sanitized.people.p1 as any).x, undefined);
    assert.strictEqual((sanitized.people.p1 as any).y, undefined);
    assert.strictEqual((sanitized.people.p2 as any).horizontalX, undefined);
    assert.strictEqual((sanitized.people.p2 as any).horizontalY, undefined);
  });

  it('migrates legacy coordinates upon JSON string import', () => {
    const legacyJson = JSON.stringify({
      id: 'imported_legacy_tree',
      name: 'Imported Tree',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      people: {
        ancestor_1: {
          id: 'ancestor_1',
          firstName: 'Old',
          lastName: 'Ancestor',
          unionIds: [],
          x: 100,
          y: 200,
        },
      },
      unions: {},
    });

    const imported = importTreeFromJsonString(legacyJson);
    assert.deepStrictEqual(imported.layoutOverrides, {
      ancestor_1: { x: 100, y: 200 },
    });
    assert.strictEqual((imported.people.ancestor_1 as any).x, undefined);
    assert.strictEqual((imported.people.ancestor_1 as any).y, undefined);
  });

  it('clears layoutOverrides and horizontalOverrides in clearManualPositions', () => {
    const tree: TreeData = {
      ...createDoubleInLawPreset(),
      layoutOverrides: {
        gf_smith: { x: 500, y: 600 },
      },
      horizontalOverrides: {
        gf_smith: { x: 700, y: 800 },
      },
    };

    const cleared = clearManualPositions(tree);
    assert.strictEqual(cleared.layoutOverrides, undefined);
    assert.strictEqual(cleared.horizontalOverrides, undefined);
    assert.strictEqual((cleared.people.gf_smith as any).x, undefined);
  });

  it('computes layout using layoutOverrides argument or tree.layoutOverrides', () => {
    const tree = createDoubleInLawPreset();
    tree.layoutOverrides = {
      dad: { x: 1111, y: 2222 },
    };

    // Reads from tree.layoutOverrides
    const layout1 = computeLayout(tree, 'vertical');
    assert.strictEqual(layout1.nodes.dad.x, 1111);
    assert.strictEqual(layout1.nodes.dad.y, 2222);

    // Argument overrides tree.layoutOverrides
    const layout2 = computeLayout(tree, 'vertical', false, undefined, true, {
      dad: { x: 3333, y: 4444 },
    });
    assert.strictEqual(layout2.nodes.dad.x, 3333);
    assert.strictEqual(layout2.nodes.dad.y, 4444);
  });
});
