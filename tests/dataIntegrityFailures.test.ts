import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { threeWayMergeTree } from '../src/services/treeMerge';
import { parseGedcom } from '../src/services/gedcomService';
import type { TreeData } from '../src/types/tree';

describe('Data Integrity Failure Scenarios (Phase 0 Reproductions)', () => {
  it('Failure Scenario 1: Three-way merge leaves dangling partner reference on concurrent delete vs union edit', {
    todo: 'Failing reproduction: threeWayMergeTree does not validate invariants or cascade deletes across unions. Resolved in Phase 1 & 2.',
  }, () => {
    const baseTree: TreeData = {
      id: 'tree1',
      name: 'Base Tree',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      version: 1,
      people: {
        p1: { id: 'p1', firstName: 'John', unionIds: ['u1'] },
        p2: { id: 'p2', firstName: 'Jane', unionIds: ['u1'] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: [], type: 'married' },
      },
    };

    // Client A deletes p1
    const clientATree: TreeData = {
      ...baseTree,
      version: 2,
      people: {
        p2: { id: 'p2', firstName: 'Jane', unionIds: ['u1'] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['p2'], childrenIds: [], type: 'married' },
      },
    };

    // Client B concurrently modifies union u1 (e.g. edits marriageDate)
    const clientBTree: TreeData = {
      ...baseTree,
      version: 2,
      unions: {
        u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: [], type: 'married', marriageDate: '2000-01-01' },
      },
    };

    const { merged } = threeWayMergeTree(baseTree, clientATree, clientBTree);

    // In the ideal/safe data layer:
    // Every partnerId in a union must exist in merged.people!
    // But currently, merged.people['p1'] is undefined while merged.unions['u1'].partnerIds contains 'p1'.
    for (const union of Object.values(merged.unions)) {
      for (const partnerId of union.partnerIds) {
        assert.ok(
          merged.people[partnerId],
          `Dangling partner reference detected: union ${union.id} references non-existent person ${partnerId}`
        );
      }
    }
  });

  it('Failure Scenario 2: Concurrent edit vs delete creates orphan union references', {
    todo: 'Failing reproduction: Hard delete in one client combined with child addition in another leaves dangling references. Resolved in Phase 1 & 2.',
  }, () => {
    const baseTree: TreeData = {
      id: 'tree1',
      name: 'Base Tree',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      version: 1,
      people: {
        p1: { id: 'p1', firstName: 'Father', unionIds: ['u1'] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['p1'], childrenIds: [] },
      },
    };

    // Client A deletes p1 and removes empty union u1
    const clientATree: TreeData = {
      ...baseTree,
      version: 2,
      people: {},
      unions: {},
    };

    // Client B concurrently adds child c1 to union u1
    const clientBTree: TreeData = {
      ...baseTree,
      version: 2,
      people: {
        p1: { id: 'p1', firstName: 'Father', unionIds: ['u1'] },
        c1: { id: 'c1', firstName: 'Child', parentUnionId: 'u1', unionIds: [] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['p1'], childrenIds: ['c1'] },
      },
    };

    const { merged } = threeWayMergeTree(baseTree, clientATree, clientBTree);

    // If u1 is kept because B edited it, but p1 is deleted because A deleted p1,
    // u1 has no partners and references dead p1.
    // In safe data layer, all children and union references must resolve cleanly.
    if (merged.people['c1'] && merged.people['c1'].parentUnionId) {
      assert.ok(
        merged.unions[merged.people['c1'].parentUnionId],
        'Child parentUnionId must resolve to an existing union'
      );
    }
    for (const union of Object.values(merged.unions)) {
      for (const partnerId of union.partnerIds) {
        assert.ok(merged.people[partnerId], `Union partner ${partnerId} must exist`);
      }
    }
  });

  it('Failure Scenario 3: GEDCOM import accepts parent-child cycle without detection or rejection', {
    todo: 'Failing reproduction: GEDCOM parser does not validate acyclicity invariants. Resolved in Phase 1.',
  }, () => {
    // Malformed GEDCOM: I1 is parent of I2, I2 is parent of I1
    const cyclicGedcom = `0 HEAD
1 SOUR FamilyTree
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Ancestor /One/
1 FAMS @F1@
1 FAMC @F2@
0 @I2@ INDI
1 NAME Ancestor /Two/
1 FAMS @F2@
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I2@
0 @F2@ FAM
1 HUSB @I2@
1 CHIL @I1@
0 TRLR`;

    const tree = parseGedcom(cyclicGedcom, 'Cyclic Tree');

    // A safe boundary must either reject this or repair the cycle.
    // Currently, tree is produced with I1 and I2 having mutual ancestry cycles.
    // We assert that the resulting tree has no cyclic ancestry:
    const hasCycle = (pId: string, visited = new Set<string>()): boolean => {
      if (visited.has(pId)) return true;
      visited.add(pId);
      const person = tree.people[pId];
      if (person?.parentUnionId && tree.unions[person.parentUnionId]) {
        for (const partnerId of tree.unions[person.parentUnionId].partnerIds) {
          if (hasCycle(partnerId, new Set(visited))) return true;
        }
      }
      return false;
    };

    assert.equal(hasCycle('I1') || hasCycle('I2'), false, 'Tree must not contain parent cycles');
  });

  it('Failure Scenario 4: JSON import accepts inverted dates (death before birth)', {
    todo: 'Failing reproduction: JSON import lacks date invariant validation. Resolved in Phase 1.',
  }, () => {
    const invalidJson = JSON.stringify({
      id: 'tree_invalid_dates',
      name: 'Invalid Dates Tree',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      people: {
        p1: {
          id: 'p1',
          firstName: 'Benjamin',
          lastName: 'Button',
          birthDate: '2020-05-01',
          deathDate: '1980-01-01', // Death 40 years before birth!
          isDeceased: true,
          unionIds: [],
        },
      },
      unions: {},
    });

    const imported = importTreeFromJsonString(invalidJson);

    // A safe boundary must validate or repair this anomaly.
    // Currently, it accepts it without warning or repair.
    const p = imported.people['p1'];
    assert.ok(
      !p.deathDate || !p.birthDate || p.birthDate <= p.deathDate,
      'Person birthDate must be prior to or equal to deathDate'
    );
  });
});
