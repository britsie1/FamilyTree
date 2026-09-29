import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRandomTree } from '../src/test-utils/treeGenerator';
import { exportGedcom, parseGedcom } from '../src/services/gedcomService';
import { processTreeIngress } from '../src/services/schema';
import { checkInvariants } from '../src/services/schema/invariants';
import { migrate } from '../src/services/schema/migrations';
import { syncMerge, mergeRecord, type SyncRecordMeta } from '../src/services/syncMerge';
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
import type { TreeData, Person } from '../src/types/tree';

describe('Phase 3: Comprehensive Invariant, Property, and Round-Trip Tests', () => {
  describe('Round-Trip Preservation Tests', () => {
    it('JSON export -> import produces identical structure and 0 invariant violations across 50 seeds', () => {
      for (let seed = 101; seed <= 150; seed++) {
        const count = 6 + (seed % 15);
        const original = generateRandomTree({ seed, personCount: count });
        const jsonString = JSON.stringify(original, null, 2);

        const parsed = JSON.parse(jsonString);
        const imported = processTreeIngress(parsed).tree;

        assert.equal(imported.id, original.id, `Seed ${seed}: id must match`);
        assert.equal(imported.name, original.name, `Seed ${seed}: name must match`);
        assert.equal(imported.rootPersonId, original.rootPersonId, `Seed ${seed}: rootPersonId must match`);
        assert.equal(
          Object.keys(imported.people).length,
          Object.keys(original.people).length,
          `Seed ${seed}: people count must match`
        );
        assert.equal(
          Object.keys(imported.unions).length,
          Object.keys(original.unions).length,
          `Seed ${seed}: unions count must match`
        );

        for (const [pId, originalPerson] of Object.entries(original.people)) {
          const importedPerson = imported.people[pId];
          assert.ok(importedPerson, `Seed ${seed}: person ${pId} must exist`);
          assert.equal(importedPerson.firstName, originalPerson.firstName);
          assert.equal(importedPerson.lastName, originalPerson.lastName);
          assert.equal(importedPerson.birthDate, originalPerson.birthDate);
          assert.deepEqual(
            [...(importedPerson.unionIds || [])].sort(),
            [...(originalPerson.unionIds || [])].sort()
          );
        }

        const violations = checkInvariants(imported);
        assert.deepEqual(violations, [], `Seed ${seed}: invariants must have 0 violations`);
      }
    });

    it('GEDCOM export -> import round-trip preserves family topology with 0 invariant violations across 30 seeds', () => {
      for (let seed = 201; seed <= 230; seed++) {
        const count = 6 + (seed % 10);
        const original = generateRandomTree({ seed, personCount: count });
        const gedcomText = exportGedcom(original);

        assert.ok(gedcomText.includes('0 HEAD'), `Seed ${seed}: must include HEAD`);
        assert.ok(gedcomText.includes('1 GEDC'), `Seed ${seed}: must include GEDC`);
        assert.ok(gedcomText.includes('0 TRLR'), `Seed ${seed}: must include TRLR`);

        const imported = parseGedcom(gedcomText);

        assert.equal(
          Object.keys(imported.people).length,
          Object.keys(original.people).length,
          `Person count must match for seed ${seed}`
        );

        assert.equal(
          Object.keys(imported.unions).length,
          Object.keys(original.unions).length,
          `Union count must match for seed ${seed}`
        );

        const violations = checkInvariants(imported);
        assert.deepEqual(violations, [], `Seed ${seed}: GEDCOM import must preserve all invariants`);
      }
    });
  });

  describe('Merge Mathematical Properties (syncMerge)', () => {
    it('Idempotence: syncMerge(A, A) returns identical tree across 100 seeds', () => {
      for (let seed = 1; seed <= 100; seed++) {
        const count = 6 + (seed % 8);
        const tree = generateRandomTree({ seed, personCount: count });
        const result = syncMerge(tree, tree);

        assert.deepEqual(
          result.tree.people,
          tree.people,
          `Seed ${seed}: people must be identical under self-merge`
        );
        assert.deepEqual(
          result.tree.unions,
          tree.unions,
          `Seed ${seed}: unions must be identical under self-merge`
        );
        assert.equal(result.repairsApplied, false, `Seed ${seed}: no repairs needed for valid tree`);
        assert.deepEqual(checkInvariants(result.tree), [], `Seed ${seed}: 0 violations`);
      }
    });

    it('Commutativity: syncMerge(A, B) and syncMerge(B, A) yield byte-for-byte identical records across 150 seeds', () => {
      for (let seed = 101; seed <= 250; seed++) {
        const count = 6 + (seed % 8);
        const base = generateRandomTree({ seed, personCount: count });
        const peopleIds = Object.keys(base.people);
        const p1Id = peopleIds[0];
        const p2Id = peopleIds[1] || p1Id;
        const p3Id = peopleIds[2] || p1Id;

        // Client A: edits p1, adds a child to root, and deletes p3 with tombstone
        const childA = createEmptyPerson({
          firstName: `ChildA_${seed}`,
          lastName: 'Test',
          updatedAt: '2026-01-01T10:05:00.000Z',
          rev: 1,
        });

        const treeA: TreeData = {
          ...base,
          version: (base.version || 1) + 1,
          updatedAt: '2026-01-01T10:05:00.000Z',
          people: {
            ...base.people,
            [p1Id]: {
              ...base.people[p1Id],
              firstName: `RenamedA_${seed}`,
              updatedAt: '2026-01-01T10:02:00.000Z',
              rev: (base.people[p1Id].rev || 1) + 1,
            },
            [childA.id]: childA,
            [p3Id]: {
              ...base.people[p3Id],
              deleted: true,
              deletedAt: '2026-01-01T10:04:00.000Z',
              updatedAt: '2026-01-01T10:04:00.000Z',
              rev: (base.people[p3Id].rev || 1) + 1,
            },
          },
        };

        // Client B: edits p1 with later timestamp, edits p2, and adds a partner
        const partnerB = createEmptyPerson({
          firstName: `PartnerB_${seed}`,
          lastName: 'Test',
          updatedAt: '2026-01-01T10:08:00.000Z',
          rev: 1,
        });

        const treeB: TreeData = {
          ...base,
          version: (base.version || 1) + 2,
          updatedAt: '2026-01-01T10:08:00.000Z',
          people: {
            ...base.people,
            [p1Id]: {
              ...base.people[p1Id],
              firstName: `RenamedB_${seed}`,
              updatedAt: '2026-01-01T10:07:00.000Z',
              rev: (base.people[p1Id].rev || 1) + 2,
            },
            [p2Id]: {
              ...base.people[p2Id],
              birthPlace: `City_${seed}`,
              updatedAt: '2026-01-01T10:06:00.000Z',
              rev: (base.people[p2Id].rev || 1) + 1,
            },
            [partnerB.id]: partnerB,
          },
        };

        const resAB = syncMerge(treeA, treeB);
        const resBA = syncMerge(treeB, treeA);

        // FULL record payload comparison (rev, updatedAt, deletedAt, all fields)
        assert.deepEqual(
          resAB.tree.people,
          resBA.tree.people,
          `Seed ${seed}: people record maps must be byte-for-byte identical regardless of merge argument order`
        );

        assert.deepEqual(
          resAB.tree.unions,
          resBA.tree.unions,
          `Seed ${seed}: unions record maps must be byte-for-byte identical regardless of merge argument order`
        );

        assert.deepEqual(
          resAB.tombstones,
          resBA.tombstones,
          `Seed ${seed}: tombstones must be byte-for-byte identical regardless of merge argument order`
        );

        assert.equal(
          resAB.tree.updatedAt,
          resBA.tree.updatedAt,
          `Seed ${seed}: tree.updatedAt must be deterministic and identical`
        );

        assert.equal(
          resAB.tree.version,
          resBA.tree.version,
          `Seed ${seed}: tree.version must be deterministic and identical`
        );

        assert.deepEqual(
          resAB.tree,
          resBA.tree,
          `Seed ${seed}: full TreeData object must be deeply identical`
        );

        assert.deepEqual(checkInvariants(resAB.tree), [], `Seed ${seed}: resAB invariants must pass`);
        assert.deepEqual(checkInvariants(resBA.tree), [], `Seed ${seed}: resBA invariants must pass`);
      }
    });

    it('Associativity: record-level and tree-level merge is associative across 100 seeds', () => {
      // 1. Record-level associativity across diverse record triples
      const baseRec: SyncRecordMeta = { id: 'rec_1', updatedAt: '2026-01-01T10:00:00.000Z', rev: 1 };
      for (let i = 0; i < 100; i++) {
        const timeA = `2026-01-01T10:${(i % 50).toString().padStart(2, '0')}:00.000Z`;
        const timeB = `2026-01-01T10:${((i + 15) % 50).toString().padStart(2, '0')}:00.000Z`;
        const timeC = `2026-01-01T10:${((i + 30) % 50).toString().padStart(2, '0')}:00.000Z`;

        const rA: SyncRecordMeta = { ...baseRec, updatedAt: timeA, rev: 1 + (i % 3), deleted: i % 4 === 0 };
        const rB: SyncRecordMeta = { ...baseRec, updatedAt: timeB, rev: 1 + ((i + 1) % 3), deleted: i % 3 === 0 };
        const rC: SyncRecordMeta = { ...baseRec, updatedAt: timeC, rev: 1 + ((i + 2) % 3), deleted: i % 5 === 0 };

        const left = mergeRecord(mergeRecord(rA, rB).merged, rC).merged;
        const right = mergeRecord(rA, mergeRecord(rB, rC).merged).merged;

        assert.equal(
          Boolean(left.deleted),
          Boolean(right.deleted),
          `Step ${i}: deleted state must match between left and right associative groupings`
        );
        assert.equal(
          left.updatedAt,
          right.updatedAt,
          `Step ${i}: winning updatedAt must be identical`
        );
      }

      // 2. Tree-level convergence with 3 clients
      for (let seed = 251; seed <= 300; seed++) {
        const base = generateRandomTree({ seed, personCount: 6 });

        const pA = createEmptyPerson({ firstName: `A_${seed}`, updatedAt: '2026-01-01T10:10:00.000Z' });
        const pB = createEmptyPerson({ firstName: `B_${seed}`, updatedAt: '2026-01-01T10:20:00.000Z' });
        const pC = createEmptyPerson({ firstName: `C_${seed}`, updatedAt: '2026-01-01T10:30:00.000Z' });

        const treeA: TreeData = { ...base, people: { ...base.people, [pA.id]: pA } };
        const treeB: TreeData = { ...base, people: { ...base.people, [pB.id]: pB } };
        const treeC: TreeData = { ...base, people: { ...base.people, [pC.id]: pC } };

        const leftMerge = syncMerge(treeA, treeB);
        const fullStateLeft: TreeData = {
          ...leftMerge.tree,
          people: { ...leftMerge.tree.people, ...leftMerge.tombstones.people },
          unions: { ...leftMerge.tree.unions, ...leftMerge.tombstones.unions },
        };
        const leftFinal = syncMerge(fullStateLeft, treeC).tree;

        const rightMerge = syncMerge(treeB, treeC);
        const fullStateRight: TreeData = {
          ...rightMerge.tree,
          people: { ...rightMerge.tree.people, ...rightMerge.tombstones.people },
          unions: { ...rightMerge.tree.unions, ...rightMerge.tombstones.unions },
        };
        const rightFinal = syncMerge(treeA, fullStateRight).tree;

        assert.deepEqual(
          Object.keys(leftFinal.people).sort(),
          Object.keys(rightFinal.people).sort(),
          `Seed ${seed}: people IDs must match in associative tree merge`
        );
        assert.deepEqual(checkInvariants(leftFinal), []);
        assert.deepEqual(checkInvariants(rightFinal), []);
      }
    });
  });

  describe('Operations Invariant Preservation', () => {
    it('every operation in treeOperations preserves checkInvariants == [] across multiple seeds', () => {
      for (const seed of [1212, 1313, 1414, 1515, 1616]) {
        let currentTree = generateRandomTree({ seed, personCount: 8 });

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
      }
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

  describe('Multi-Client Sync Simulation & Strong Eventual Consistency', () => {
    it('simulates 3 clients with concurrent mutations converging to identical state under all 6 network delivery permutations across 100 seeds', () => {
      function applyUpdate(
        serverState: TreeData,
        clientTree: TreeData
      ): { tree: TreeData; tombstones: { people: Record<string, Person>; unions: Record<string, any> } } {
        const res = syncMerge(serverState, clientTree);
        const cloudTree: TreeData = {
          ...res.tree,
          people: { ...res.tree.people, ...res.tombstones.people },
          unions: { ...res.tree.unions, ...res.tombstones.unions },
        };
        return { tree: cloudTree, tombstones: res.tombstones };
      }

      for (let seed = 301; seed <= 400; seed++) {
        const baseTree = generateRandomTree({ seed, personCount: 8 });
        const rootId = baseTree.rootPersonId!;
        const nonRootId = Object.keys(baseTree.people).find((id) => id !== rootId)!;

        // Client 1: updates root person name and adds a child
        let c1Tree: TreeData = {
          ...baseTree,
          updatedAt: '2026-01-01T10:05:00.000Z',
          people: {
            ...baseTree.people,
            [rootId]: {
              ...baseTree.people[rootId],
              firstName: `Root Renovated_${seed}`,
              updatedAt: '2026-01-01T10:00:00.000Z',
              rev: (baseTree.people[rootId].rev || 1) + 1,
            },
          },
        };
        const c1ChildRes = addChildToPerson(c1Tree, rootId);
        c1Tree = c1ChildRes.tree;

        // Client 2: modifies a partner and deletes nonRootId with tombstone at 10:15
        let c2Tree = deletePersonFromTree(
          { ...baseTree, updatedAt: '2026-01-01T10:15:00.000Z' },
          nonRootId
        );
        const unionTombstones: Record<string, any> = {};
        for (const uId of Object.keys(baseTree.unions)) {
          if (!c2Tree.unions[uId]) {
            unionTombstones[uId] = {
              ...baseTree.unions[uId],
              deleted: true,
              deletedAt: '2026-01-01T10:15:00.000Z',
              updatedAt: '2026-01-01T10:15:00.000Z',
              rev: (baseTree.unions[uId].rev || 1) + 1,
            };
          }
        }
        c2Tree = {
          ...c2Tree,
          updatedAt: '2026-01-01T10:15:00.000Z',
          people: {
            ...c2Tree.people,
            [nonRootId]: {
              ...baseTree.people[nonRootId],
              deleted: true,
              deletedAt: '2026-01-01T10:15:00.000Z',
              updatedAt: '2026-01-01T10:15:00.000Z',
              rev: (baseTree.people[nonRootId].rev || 1) + 1,
            },
          },
          unions: {
            ...c2Tree.unions,
            ...unionTombstones,
          },
        };

        // Client 3: went offline, modified root person's birthPlace at 10:20 (newer than c1's 10:00)
        const c3Tree: TreeData = {
          ...baseTree,
          updatedAt: '2026-01-01T10:20:00.000Z',
          people: {
            ...baseTree.people,
            [rootId]: {
              ...baseTree.people[rootId],
              birthPlace: `Denver, Colorado, USA_${seed}`,
              updatedAt: '2026-01-01T10:20:00.000Z',
              rev: (baseTree.people[rootId].rev || 1) + 2,
            },
          },
        };

        // All 6 possible network arrival delivery permutations
        const perms = [
          [c1Tree, c2Tree, c3Tree],
          [c1Tree, c3Tree, c2Tree],
          [c2Tree, c1Tree, c3Tree],
          [c2Tree, c3Tree, c1Tree],
          [c3Tree, c1Tree, c2Tree],
          [c3Tree, c2Tree, c1Tree],
        ];

        const results = perms.map((p) => {
          let s = baseTree;
          for (const client of p) {
            s = applyUpdate(s, client).tree;
          }
          return syncMerge(s, s);
        });

        const first = results[0];

        // Strong Eventual Consistency: Every permutation must converge to identical state
        for (let i = 1; i < results.length; i++) {
          assert.deepEqual(
            results[i].tree.people,
            first.tree.people,
            `Seed ${seed}: permutation ${i} must converge to identical people records as permutation 0`
          );
          assert.deepEqual(
            results[i].tree.unions,
            first.tree.unions,
            `Seed ${seed}: permutation ${i} must converge to identical unions records as permutation 0`
          );
          assert.deepEqual(
            results[i].tombstones,
            first.tombstones,
            `Seed ${seed}: permutation ${i} must converge to identical tombstones as permutation 0`
          );
        }

        // Structural and semantic verification
        const violations = checkInvariants(first.tree);
        assert.deepEqual(violations, [], `Seed ${seed}: converged tree must have 0 invariant violations`);

        // C1's child is preserved in active tree
        assert.ok(
          first.tree.people[c1ChildRes.newChildId],
          `Seed ${seed}: C1 child must be preserved in converged tree`
        );

        // C2's deletion is preserved (absent from active, present in tombstones)
        assert.equal(
          first.tree.people[nonRootId],
          undefined,
          `Seed ${seed}: C2 deleted person must not be in active people`
        );
        assert.ok(
          first.tombstones.people[nonRootId],
          `Seed ${seed}: C2 deleted person must be retained in tombstones`
        );

        // C3's newer edit to birthPlace is present (LWW)
        assert.equal(
          first.tree.people[rootId].birthPlace,
          `Denver, Colorado, USA_${seed}`,
          `Seed ${seed}: C3 newer edit must win LWW`
        );
      }
    });
  });
});
