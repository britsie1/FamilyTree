import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRandomTree } from '../src/test-utils/treeGenerator';
import { exportGedcom, parseGedcom } from '../src/services/gedcomService';
import { processTreeIngress } from '../src/services/schema';
import { checkInvariants } from '../src/services/schema/invariants';
import { migrate } from '../src/services/schema/migrations';
import { syncMerge } from '../src/services/syncMerge';
import {
  createEmptyPerson,
  addChildToPerson,
  addSiblingToPerson,
  addPartnerToPerson,
  addParentToPerson,
  linkExistingChild,
  linkExistingSibling,
  linkExistingPartner,
  linkExistingParent,
  unlinkPartner,
  unlinkChild,
  unlinkParentFromChild,
  deletePersonFromTree,
} from '../src/services/treeOperations';
import type { TreeData } from '../src/types/tree';

describe('Phase 3: Invariant, Property, and Round-Trip Tests', () => {
  describe('Round-Trip Preservation Tests', () => {
    it('JSON export -> import produces identical structure and 0 invariant violations', () => {
      for (const seed of [101, 202, 303, 404]) {
        const original = generateRandomTree({ seed, personCount: 12 });
        const jsonString = JSON.stringify(original, null, 2);

        const parsed = JSON.parse(jsonString);
        const imported = processTreeIngress(parsed).tree;

        assert.equal(imported.id, original.id);
        assert.equal(imported.name, original.name);
        assert.equal(imported.rootPersonId, original.rootPersonId);
        assert.equal(Object.keys(imported.people).length, Object.keys(original.people).length);
        assert.equal(Object.keys(imported.unions).length, Object.keys(original.unions).length);

        for (const [pId, originalPerson] of Object.entries(original.people)) {
          const importedPerson = imported.people[pId];
          assert.ok(importedPerson, `Person ${pId} must exist in imported tree`);
          assert.equal(importedPerson.firstName, originalPerson.firstName);
          assert.equal(importedPerson.lastName, originalPerson.lastName);
          assert.equal(importedPerson.birthDate, originalPerson.birthDate);
          assert.deepEqual(importedPerson.unionIds.sort(), originalPerson.unionIds.sort());
        }

        const violations = checkInvariants(imported);
        assert.deepEqual(violations, []);
      }
    });

    it('GEDCOM export -> import round-trip preserves family topology with 0 invariant violations', () => {
      for (const seed of [505, 606, 707]) {
        const original = generateRandomTree({ seed, personCount: 10 });
        const gedcomText = exportGedcom(original);

        assert.ok(gedcomText.includes('0 HEAD'));
        assert.ok(gedcomText.includes('1 GEDC'));
        assert.ok(gedcomText.includes('0 TRLR'));

        const imported = parseGedcom(gedcomText);

        // Individual counts must match
        assert.equal(
          Object.keys(imported.people).length,
          Object.keys(original.people).length,
          `Person count must match for seed ${seed}`
        );

        // Union counts must match
        assert.equal(
          Object.keys(imported.unions).length,
          Object.keys(original.unions).length,
          `Union count must match for seed ${seed}`
        );

        // Invariants must be completely valid on the imported tree
        const violations = checkInvariants(imported);
        assert.deepEqual(violations, []);
      }
    });
  });

  describe('Merge Mathematical Properties (syncMerge)', () => {
    it('Idempotence: syncMerge(A, A) returns identical tree', () => {
      const tree = generateRandomTree({ seed: 808, personCount: 8 });
      const result = syncMerge(tree, tree);

      assert.equal(Object.keys(result.tree.people).length, Object.keys(tree.people).length);
      assert.equal(Object.keys(result.tree.unions).length, Object.keys(tree.unions).length);
      assert.deepEqual(Object.keys(result.tree.people).sort(), Object.keys(tree.people).sort());
      assert.deepEqual(checkInvariants(result.tree), []);
    });

    it('Commutativity: syncMerge(A, B) and syncMerge(B, A) yield equivalent graphs', () => {
      const base = generateRandomTree({ seed: 909, personCount: 6 });

      // Client A adds Child A
      const childA = createEmptyPerson({ firstName: 'ChildA', lastName: 'Common' });
      const treeA: TreeData = {
        ...base,
        updatedAt: '2026-01-01T10:00:00Z',
        people: {
          ...base.people,
          [childA.id]: childA,
        },
      };

      // Client B adds Child B
      const childB = createEmptyPerson({ firstName: 'ChildB', lastName: 'Common' });
      const treeB: TreeData = {
        ...base,
        updatedAt: '2026-01-01T10:30:00Z',
        people: {
          ...base.people,
          [childB.id]: childB,
        },
      };

      const mergeAB = syncMerge(treeA, treeB).tree;
      const mergeBA = syncMerge(treeB, treeA).tree;

      assert.deepEqual(Object.keys(mergeAB.people).sort(), Object.keys(mergeBA.people).sort());
      assert.deepEqual(Object.keys(mergeAB.unions).sort(), Object.keys(mergeBA.unions).sort());
      assert.deepEqual(checkInvariants(mergeAB), []);
      assert.deepEqual(checkInvariants(mergeBA), []);
    });

    it('Associativity: syncMerge(syncMerge(A, B), C) == syncMerge(A, syncMerge(B, C))', () => {
      const base = generateRandomTree({ seed: 1010, personCount: 6 });

      const pA = createEmptyPerson({ firstName: 'A', updatedAt: '2026-01-01T10:00:00Z' });
      const pB = createEmptyPerson({ firstName: 'B', updatedAt: '2026-01-01T11:00:00Z' });
      const pC = createEmptyPerson({ firstName: 'C', updatedAt: '2026-01-01T12:00:00Z' });

      const treeA: TreeData = { ...base, people: { ...base.people, [pA.id]: pA } };
      const treeB: TreeData = { ...base, people: { ...base.people, [pB.id]: pB } };
      const treeC: TreeData = { ...base, people: { ...base.people, [pC.id]: pC } };

      const left = syncMerge(syncMerge(treeA, treeB).tree, treeC).tree;
      const right = syncMerge(treeA, syncMerge(treeB, treeC).tree).tree;

      assert.deepEqual(Object.keys(left.people).sort(), Object.keys(right.people).sort());
      assert.deepEqual(checkInvariants(left), []);
      assert.deepEqual(checkInvariants(right), []);
    });
  });

  describe('Operations Invariant Preservation', () => {
    it('every operation in treeOperations preserves checkInvariants == []', () => {
      let currentTree = generateRandomTree({ seed: 1212, personCount: 8 });

      // 1. addChildToPerson
      const pRoot = currentTree.rootPersonId!;
      const childRes = addChildToPerson(currentTree, pRoot);
      currentTree = childRes.tree;
      assert.deepEqual(checkInvariants(currentTree), []);

      // 2. addSiblingToPerson
      const sibRes = addSiblingToPerson(currentTree, childRes.newChildId);
      currentTree = sibRes.tree;
      assert.deepEqual(checkInvariants(currentTree), []);

      // 3. addPartnerToPerson
      const partnerRes = addPartnerToPerson(currentTree, sibRes.newSiblingId);
      currentTree = partnerRes.tree;
      assert.deepEqual(checkInvariants(currentTree), []);

      // 4. addParentToPerson
      const parentRes = addParentToPerson(currentTree, partnerRes.newPartnerId);
      currentTree = parentRes.tree;
      assert.deepEqual(checkInvariants(currentTree), []);

      // 5. linkExistingChild
      const orphanPerson = createEmptyPerson({ firstName: 'Orphan' });
      currentTree = {
        ...currentTree,
        people: { ...currentTree.people, [orphanPerson.id]: orphanPerson },
      };
      currentTree = linkExistingChild(currentTree, pRoot, orphanPerson.id);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 6. unlinkChild
      currentTree = unlinkChild(currentTree, orphanPerson.id);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 7. linkExistingPartner
      const partnerCandidate = createEmptyPerson({ firstName: 'Candidate' });
      currentTree = {
        ...currentTree,
        people: { ...currentTree.people, [partnerCandidate.id]: partnerCandidate },
      };
      currentTree = linkExistingPartner(currentTree, orphanPerson.id, partnerCandidate.id);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 8. unlinkPartner
      const candidateUnionId = currentTree.people[partnerCandidate.id].unionIds[0];
      currentTree = unlinkPartner(currentTree, partnerCandidate.id, candidateUnionId);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 9. linkExistingSibling
      const otherPerson = createEmptyPerson({ firstName: 'Other' });
      currentTree = {
        ...currentTree,
        people: { ...currentTree.people, [otherPerson.id]: otherPerson },
      };
      currentTree = linkExistingSibling(currentTree, childRes.newChildId, otherPerson.id);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 10. linkExistingParent
      const elderPerson = createEmptyPerson({ firstName: 'Elder' });
      currentTree = {
        ...currentTree,
        people: { ...currentTree.people, [elderPerson.id]: elderPerson },
      };
      currentTree = linkExistingParent(currentTree, otherPerson.id, elderPerson.id);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 11. unlinkParentFromChild
      currentTree = unlinkParentFromChild(currentTree, otherPerson.id, elderPerson.id);
      assert.deepEqual(checkInvariants(currentTree), []);

      // 12. deletePersonFromTree
      currentTree = deletePersonFromTree(currentTree, childRes.newChildId);
      assert.deepEqual(checkInvariants(currentTree), []);

      currentTree = deletePersonFromTree(currentTree, elderPerson.id);
      assert.deepEqual(checkInvariants(currentTree), []);
    });
  });

  describe('Migration Idempotence', () => {
    it('migrating an already-migrated tree is an idempotent identity operation', () => {
      const rawTree = {
        id: 'legacy_v0',
        name: 'Legacy Tree',
        people: {
          p1: { id: 'p1', firstName: 'Old', unionIds: [] },
        },
        unions: {},
      };

      const once = migrate(rawTree);
      assert.equal(once.schemaVersion, 1);

      const twice = migrate(once);
      assert.deepEqual(twice, once);

      const thrice = migrate(twice);
      assert.deepEqual(thrice, once);
    });
  });

  describe('Multi-Client Sync Simulation', () => {
    it('simulates 3 clients making concurrent edits and offline updates, converging to 0 violations', () => {
      const baseTree = generateRandomTree({ seed: 4242, personCount: 8 });

      // Client 1: updates root person name and adds a child
      let c1Tree: TreeData = {
        ...baseTree,
        people: {
          ...baseTree.people,
          [baseTree.rootPersonId!]: {
            ...baseTree.people[baseTree.rootPersonId!],
            firstName: 'Root Renovated',
            updatedAt: '2026-01-01T10:00:00Z',
          },
        },
        updatedAt: '2026-01-01T10:00:00Z',
      };
      const c1ChildRes = addChildToPerson(c1Tree, baseTree.rootPersonId!);
      c1Tree = { ...c1ChildRes.tree, updatedAt: '2026-01-01T10:05:00Z' };

      // Client 2: modifies a partner and deletes another non-root person with tombstone at 10:15
      const nonRootId = Object.keys(baseTree.people).find((id) => id !== baseTree.rootPersonId)!;
      let c2Tree = deletePersonFromTree(baseTree, nonRootId);
      c2Tree = {
        ...c2Tree,
        updatedAt: '2026-01-01T10:15:00Z',
        people: {
          ...c2Tree.people,
          [nonRootId]: {
            ...baseTree.people[nonRootId],
            deleted: true,
            deletedAt: '2026-01-01T10:15:00Z',
            updatedAt: '2026-01-01T10:15:00Z',
          },
        },
      };

      // Client 3: went offline, modified root person's birthPlace at 10:20 (newer than c1's 10:00)
      const c3Tree: TreeData = {
        ...baseTree,
        people: {
          ...baseTree.people,
          [baseTree.rootPersonId!]: {
            ...baseTree.people[baseTree.rootPersonId!],
            birthPlace: 'Denver, Colorado, USA',
            updatedAt: '2026-01-01T10:20:00Z',
          },
        },
        updatedAt: '2026-01-01T10:20:00Z',
      };

      // Sync step 1: C1 and C2 exchange with cloud
      const sync12Result = syncMerge(c1Tree, c2Tree);
      // In cloud storage, tombstones are stored alongside active records in the subcollection
      const cloudTreeAfter12: TreeData = {
        ...sync12Result.tree,
        people: { ...sync12Result.tree.people, ...sync12Result.tombstones.people },
        unions: { ...sync12Result.tree.unions, ...sync12Result.tombstones.unions },
      };

      // Sync step 2: C3 connects and syncs with cloud state
      const syncAll = syncMerge(cloudTreeAfter12, c3Tree).tree;

      // Invariants check
      const violations = checkInvariants(syncAll);
      assert.deepEqual(violations, []);

      // Verify convergence:
      // - C1's child is preserved
      assert.ok(syncAll.people[c1ChildRes.newChildId]);
      // - C2's deletion of nonRootId is preserved
      assert.equal(syncAll.people[nonRootId], undefined);
      // - C3's newer edit to birthPlace is present
      assert.equal(syncAll.people[baseTree.rootPersonId!].birthPlace, 'Denver, Colorado, USA');
    });
  });
});
