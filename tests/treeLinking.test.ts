import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createThreeGenSampleTree,
  createDoubleInLawPreset,
  importTreeFromJsonString,
} from '../src/services/storage.ts';
import {
  splitBranchToNewTree,
  addTreeLink,
  removeTreeLink,
  linkPeopleAcrossTrees,
} from '../src/services/treeOperations.ts';
import type { TreeLink } from '../src/types/tree.ts';

describe('Tree Linking & Branch Moving (Ancestry-style)', () => {
  it('moves a branch to a new tree and establishes mutual tree link on bridge person', () => {
    const originalTree = createThreeGenSampleTree();
    // In three-gen tree:
    // p1 = George VI, p2 = Elizabeth Bowes-Lyon
    // p3 = Charles, p4 = Anne, p5 = Andrew, p6 = Edward
    // u2 = Charles & Diana (p7 = Diana), children: p8 = William, p9 = Harry
    // Let's select Charles branch: ['p3', 'p7', 'p8', 'p9']
    const selectedIds = ['p3', 'p7', 'p8', 'p9'];

    const { newTree, updatedSourceTree, bridgePersonId } = splitBranchToNewTree(
      originalTree,
      selectedIds,
      'Charles & Diana Family Tree',
      {
        bridgePersonId: 'p3', // Charles is the bridge person
        removeMovedFromSource: true,
        linkTrees: true,
      }
    );

    assert.strictEqual(bridgePersonId, 'p3');

    // 1. Check new tree
    assert.strictEqual(newTree.name, 'Charles & Diana Family Tree');
    assert.strictEqual(Object.keys(newTree.people).length, 4);
    assert.ok(newTree.people['p3']);
    assert.ok(newTree.people['p7']);
    assert.ok(newTree.people['p8']);
    assert.ok(newTree.people['p9']);

    // Check bridge link in new tree pointing to original tree
    const charlesInNewTree = newTree.people['p3'];
    assert.ok(charlesInNewTree.linkedTrees && charlesInNewTree.linkedTrees.length > 0);
    const linkInNew = charlesInNewTree.linkedTrees[0];
    assert.strictEqual(linkInNew.treeId, originalTree.id);
    assert.strictEqual(linkInNew.treeName, originalTree.name);
    assert.strictEqual(linkInNew.personId, 'p3');

    // 2. Check updated source tree
    // Charles (bridge person) should REMAIN in source tree
    assert.ok(updatedSourceTree.people['p3']);
    // Non-bridge moved members should be REMOVED from source tree
    assert.strictEqual(updatedSourceTree.people['p7'], undefined); // Diana moved
    assert.strictEqual(updatedSourceTree.people['p8'], undefined); // William moved
    assert.strictEqual(updatedSourceTree.people['p9'], undefined); // Harry moved
    // Other non-selected family members should still be intact
    assert.ok(updatedSourceTree.people['p1']); // George VI
    assert.ok(updatedSourceTree.people['p2']); // Elizabeth
    assert.ok(updatedSourceTree.people['p4']); // Anne

    // Check bridge link in source tree pointing to new tree
    const charlesInSource = updatedSourceTree.people['p3'];
    assert.ok(charlesInSource.linkedTrees && charlesInSource.linkedTrees.length > 0);
    const linkInSource = charlesInSource.linkedTrees[0];
    assert.strictEqual(linkInSource.treeId, newTree.id);
    assert.strictEqual(linkInSource.treeName, 'Charles & Diana Family Tree');
    assert.strictEqual(linkInSource.personId, 'p3');
  });

  it('supports copy mode where all members remain in the initial tree and bridge person is linked', () => {
    const originalTree = createDoubleInLawPreset();
    // Grandparents: gf_smith, gm_smith
    // Dad: dad, uncle
    const selectedIds = ['gf_smith', 'gm_smith', 'uncle'];

    const { newTree, updatedSourceTree, bridgePersonId } = splitBranchToNewTree(
      originalTree,
      selectedIds,
      'Smith Ancestry',
      {
        bridgePersonId: 'gf_smith',
        removeMovedFromSource: false, // COPY mode
        linkTrees: true,
      }
    );

    assert.strictEqual(bridgePersonId, 'gf_smith');

    // All original members are retained in updated source tree
    assert.strictEqual(
      Object.keys(updatedSourceTree.people).length,
      Object.keys(originalTree.people).length
    );
    assert.ok(updatedSourceTree.people['gf_smith']);
    assert.ok(updatedSourceTree.people['gm_smith']);
    assert.ok(updatedSourceTree.people['uncle']);

    // Bridge person has link to new tree
    assert.strictEqual(updatedSourceTree.people['gf_smith'].linkedTrees?.length, 1);
    assert.strictEqual(
      updatedSourceTree.people['gf_smith'].linkedTrees?.[0].treeId,
      newTree.id
    );

    // In new tree, bridge person has link to original tree
    assert.strictEqual(newTree.people['gf_smith'].linkedTrees?.length, 1);
    assert.strictEqual(
      newTree.people['gf_smith'].linkedTrees?.[0].treeId,
      originalTree.id
    );
  });

  it('manually links two existing trees between matching people', () => {
    const treeA = createDoubleInLawPreset();
    treeA.id = 'tree_smith_main';
    treeA.name = 'Smith Main Tree';

    const treeB = createThreeGenSampleTree();
    treeB.id = 'tree_royal_lineage';
    treeB.name = 'Royal Lineage';

    const { updatedTreeA, updatedTreeB } = linkPeopleAcrossTrees(
      treeA,
      'dad',
      treeB,
      'p3'
    );

    // Tree A person links to Tree B person
    const dadLinks = updatedTreeA.people['dad'].linkedTrees;
    assert.ok(dadLinks && dadLinks.length === 1);
    assert.strictEqual(dadLinks[0].treeId, 'tree_royal_lineage');
    assert.strictEqual(dadLinks[0].personId, 'p3');

    // Tree B person links back to Tree A person
    const p3Links = updatedTreeB.people['p3'].linkedTrees;
    assert.ok(p3Links && p3Links.length === 1);
    assert.strictEqual(p3Links[0].treeId, 'tree_smith_main');
    assert.strictEqual(p3Links[0].personId, 'dad');
  });

  it('unlinks a tree link cleanly', () => {
    let tree = createDoubleInLawPreset();
    const link: TreeLink = {
      treeId: 'tree_target_branch',
      treeName: 'Target Branch Tree',
      personId: 'target_p1',
    };

    tree = addTreeLink(tree, 'dad', link);
    assert.strictEqual(tree.people['dad'].linkedTrees?.length, 1);

    // Now remove the link
    tree = removeTreeLink(tree, 'dad', 'tree_target_branch');
    assert.strictEqual(tree.people['dad'].linkedTrees, undefined);
  });

  it('persists linkedTrees through JSON export and import serialization', () => {
    let tree = createDoubleInLawPreset();
    const link: TreeLink = {
      treeId: 'tree_ext_123',
      treeName: 'External In-Laws',
      personId: 'partner_anchor',
      relationshipNote: 'Maternal side',
    };

    tree = addTreeLink(tree, 'mom', link);

    const jsonString = JSON.stringify(tree);
    const restored = importTreeFromJsonString(jsonString);

    assert.ok(restored.people['mom'].linkedTrees);
    assert.strictEqual(restored.people['mom'].linkedTrees.length, 1);
    assert.strictEqual(restored.people['mom'].linkedTrees[0].treeId, 'tree_ext_123');
    assert.strictEqual(restored.people['mom'].linkedTrees[0].treeName, 'External In-Laws');
    assert.strictEqual(restored.people['mom'].linkedTrees[0].relationshipNote, 'Maternal side');
  });

  it('sets isCloud: true on mutual links when splitting a cloud tree branch', () => {
    const cloudTree = createThreeGenSampleTree();
    (cloudTree as any).ownerId = 'user_google_123';
    cloudTree.id = 'tree_cloud_lineage';

    const { newTree, updatedSourceTree, bridgePersonId } = splitBranchToNewTree(
      cloudTree,
      ['p3', 'p7', 'p8'],
      'Charles Branch Cloud',
      {
        bridgePersonId: 'p3',
        isCloud: true,
      }
    );

    assert.strictEqual(bridgePersonId, 'p3');

    // Link in source tree points to new cloud tree
    const linkInSource = updatedSourceTree.people['p3'].linkedTrees?.[0];
    assert.ok(linkInSource);
    assert.strictEqual(linkInSource.treeId, newTree.id);
    assert.strictEqual(linkInSource.isCloud, true);

    // Link in new tree points back to original cloud tree
    const linkInNew = newTree.people['p3'].linkedTrees?.[0];
    assert.ok(linkInNew);
    assert.strictEqual(linkInNew.treeId, cloudTree.id);
    assert.strictEqual(linkInNew.isCloud, true);
  });

  it('preserves isCloud flags when manually linking two trees', () => {
    const treeA = createDoubleInLawPreset();
    treeA.id = 'tree_local_a';

    const treeB = createThreeGenSampleTree();
    treeB.id = 'tree_cloud_b';
    (treeB as any).ownerId = 'cloud_owner_999';

    // Link tree A (local) with tree B (cloud)
    const { updatedTreeA, updatedTreeB } = linkPeopleAcrossTrees(
      treeA,
      'dad',
      treeB,
      'p3',
      {
        isCloudA: false,
        isCloudB: true,
      }
    );

    // Link on dad points to Tree B which is a cloud tree
    const dadLink = updatedTreeA.people['dad'].linkedTrees?.[0];
    assert.ok(dadLink);
    assert.strictEqual(dadLink.treeId, 'tree_cloud_b');
    assert.strictEqual(dadLink.isCloud, true);

    // Link on p3 points to Tree A which is local
    const p3Link = updatedTreeB.people['p3'].linkedTrees?.[0];
    assert.ok(p3Link);
    assert.strictEqual(p3Link.treeId, 'tree_local_a');
    assert.strictEqual(p3Link.isCloud, false);
  });
});
