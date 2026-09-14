import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeLayout,
  getDescendantPersonIds,
  getBranchPersonIds,
} from '../src/services/layoutEngine.ts';
import { createThreeGenSampleTree } from '../src/services/storage.ts';

describe('Branch Collapsing and Focus Mode', () => {
  it('correctly collects all descendants of an ancestor', () => {
    const tree = createThreeGenSampleTree();
    // p1 = George Windsor, p2 = Elizabeth, p3 = Charles, p4 = Anne, p7 = William, p8 = Harry, p10 = George, p11 = Charlotte
    const descendantsOfCharles = getDescendantPersonIds(tree, 'p3');

    assert.ok(descendantsOfCharles.has('p7')); // William
    assert.ok(descendantsOfCharles.has('p8')); // Harry
    assert.ok(descendantsOfCharles.has('p10')); // George
    assert.ok(descendantsOfCharles.has('p11')); // Charlotte
    assert.ok(!descendantsOfCharles.has('p4')); // Anne (sibling, not descendant)
    assert.ok(!descendantsOfCharles.has('p1')); // Parent, not descendant
  });

  it('filters collapsed branches and computes a more compact layout', () => {
    const tree = createThreeGenSampleTree();

    const fullLayout = computeLayout(tree);
    const collapsedLayout = computeLayout(tree, 'vertical', false, ['p3']);

    // Full tree has all nodes
    assert.strictEqual(Object.keys(fullLayout.nodes).length, Object.keys(tree.people).length);

    // Collapsed layout has hidden Charles's descendants (William, Harry, George, Charlotte)
    assert.ok(collapsedLayout.nodes['p3']);
    assert.strictEqual(collapsedLayout.nodes['p3'].isCollapsed, true);
    assert.strictEqual(collapsedLayout.nodes['p3'].hiddenCount, 4);

    assert.ok(!collapsedLayout.nodes['p7']); // William is hidden
    assert.ok(!collapsedLayout.nodes['p8']); // Harry is hidden
    assert.ok(!collapsedLayout.nodes['p10']); // George is hidden
    assert.ok(!collapsedLayout.nodes['p11']); // Charlotte is hidden

    // Height of collapsed tree is smaller than full tree
    assert.ok(collapsedLayout.bounds.height <= fullLayout.bounds.height);
  });

  it('collects complete lineage branch for focus mode', () => {
    const tree = createThreeGenSampleTree();
    // Focus on William (p7)
    const branchIds = getBranchPersonIds(tree, 'p7');

    assert.ok(branchIds.has('p7')); // William
    assert.ok(branchIds.has('p3')); // Charles (father)
    assert.ok(branchIds.has('p5')); // Diana (mother)
    assert.ok(branchIds.has('p8')); // Harry (brother)
    assert.ok(branchIds.has('p10')); // George (child)
    assert.ok(branchIds.has('p11')); // Charlotte (child)
    assert.ok(branchIds.has('p9')); // Catherine (wife)
    assert.ok(branchIds.has('p1')); // Grandparent
    assert.ok(branchIds.has('p2')); // Grandparent
  });
});
