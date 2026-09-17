import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createThreeGenSampleTree, createDoubleInLawPreset } from '../src/services/storage.ts';
import { createTreeFromPeople } from '../src/services/treeOperations.ts';
import { computeLayout } from '../src/services/layoutEngine.ts';

describe('Create Tree from Selection', () => {
  it('correctly creates a new tree containing only selected parents and children with relationships preserved', () => {
    const originalTree = createThreeGenSampleTree();
    // p3 = Charles, p5 = Diana, p7 = William, p8 = Harry
    const selectedIds = ['p3', 'p5', 'p7', 'p8'];

    const newTree = createTreeFromPeople(originalTree, selectedIds, 'Charles & Diana Family');

    assert.strictEqual(newTree.name, 'Charles & Diana Family');
    assert.strictEqual(Object.keys(newTree.people).length, 4);
    assert.ok(newTree.people['p3']);
    assert.ok(newTree.people['p5']);
    assert.ok(newTree.people['p7']);
    assert.ok(newTree.people['p8']);

    // Non-selected members should not be present
    assert.ok(!newTree.people['p1']); // George
    assert.ok(!newTree.people['p2']); // Elizabeth

    // Charles & Diana union (u2) should exist
    assert.strictEqual(Object.keys(newTree.unions).length, 1);
    const union = Object.values(newTree.unions)[0];
    assert.ok(union.partnerIds.includes('p3'));
    assert.ok(union.partnerIds.includes('p5'));
    assert.ok(union.childrenIds.includes('p7'));
    assert.ok(union.childrenIds.includes('p8'));

    // Children point to union
    assert.strictEqual(newTree.people['p7'].parentUnionId, union.id);
    assert.strictEqual(newTree.people['p8'].parentUnionId, union.id);

    // Layout should compute smoothly without errors
    const layout = computeLayout(newTree);
    assert.strictEqual(Object.keys(layout.nodes).length, 4);
    assert.strictEqual(Object.keys(layout.unions).length, 1);
  });

  it('preserves single parent-child relationships when only one parent is selected', () => {
    const originalTree = createThreeGenSampleTree();
    // p3 = Charles, p7 = William (Diana p6 not selected)
    const selectedIds = ['p3', 'p7'];

    const newTree = createTreeFromPeople(originalTree, selectedIds);

    assert.strictEqual(Object.keys(newTree.people).length, 2);
    assert.ok(newTree.people['p3']);
    assert.ok(newTree.people['p7']);
    assert.ok(!newTree.people['p6']);

    // Union should exist with 1 partner (p3) and 1 child (p7)
    assert.strictEqual(Object.keys(newTree.unions).length, 1);
    const union = Object.values(newTree.unions)[0];
    assert.deepStrictEqual(union.partnerIds, ['p3']);
    assert.deepStrictEqual(union.childrenIds, ['p7']);
    assert.strictEqual(newTree.people['p7'].parentUnionId, union.id);
  });

  it('preserves sibling relationship group when only children are selected', () => {
    const originalTree = createThreeGenSampleTree();
    // p7 = William, p8 = Harry (neither Charles nor Diana selected)
    const selectedIds = ['p7', 'p8'];

    const newTree = createTreeFromPeople(originalTree, selectedIds);

    assert.strictEqual(Object.keys(newTree.people).length, 2);
    assert.ok(newTree.people['p7']);
    assert.ok(newTree.people['p8']);

    // An orphan union should connect William and Harry as siblings
    assert.strictEqual(Object.keys(newTree.unions).length, 1);
    const union = Object.values(newTree.unions)[0];
    assert.strictEqual(union.partnerIds.length, 0);
    assert.ok(union.childrenIds.includes('p7'));
    assert.ok(union.childrenIds.includes('p8'));
  });

  it('resets manual position coordinates in the newly created tree', () => {
    const originalTree = createThreeGenSampleTree();
    // Add layout overrides to original tree
    originalTree.layoutOverrides = {
      p3: { x: 850, y: 320 },
    };
    originalTree.horizontalOverrides = {
      p3: { x: 400, y: 200 },
    };

    const newTree = createTreeFromPeople(originalTree, ['p3', 'p7']);
    assert.strictEqual(newTree.layoutOverrides, undefined);
    assert.strictEqual(newTree.horizontalOverrides, undefined);
    assert.strictEqual((newTree.people['p3'] as any).x, undefined);
    assert.strictEqual((newTree.people['p3'] as any).y, undefined);
    assert.strictEqual((newTree.people['p3'] as any).horizontalX, undefined);
    assert.strictEqual((newTree.people['p3'] as any).horizontalY, undefined);
  });

  it('automatically derives family tree name from common surname', () => {
    const originalTree = createDoubleInLawPreset();
    // Select Arthur Smith (gf_smith) and David Smith (dad)
    const newTree = createTreeFromPeople(originalTree, ['gf_smith', 'dad']);
    assert.strictEqual(newTree.name, 'Smith Family Tree');
  });

  it('derives branch name when selected members have mixed surnames', () => {
    const originalTree = createDoubleInLawPreset();
    // Select Arthur Smith and Robert Miller
    const newTree = createTreeFromPeople(originalTree, ['gf_smith', 'gf_miller']);
    assert.strictEqual(newTree.name, `${originalTree.name} (Branch)`);
  });
});
