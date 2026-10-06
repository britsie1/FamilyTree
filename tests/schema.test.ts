import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  validatePerson,
  validateUnion,
  validateTree,
  migrate,
  checkInvariants,
  repair,
  processTreeIngress,
  registerIngressRepairListener,
} from '../src/services/schema';
import type { TreeData, Person, Union } from '../src/types/tree';

describe('Phase 1: Versioned Schema & Boundary Validation', () => {
  describe('Schema Validators', () => {
    it('validates a valid Person record', () => {
      const validPerson: Person = {
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        birthDate: '1980-01-01',
        unionIds: ['u1'],
      };
      const res = validatePerson(validPerson);
      assert.equal(res.success, true);
      assert.deepEqual(res.errors, []);
      assert.equal(res.data?.id, 'p1');
    });

    it('rejects invalid Person records (missing id, invalid gender, non-array unionIds)', () => {
      assert.equal(validatePerson(null).success, false);
      assert.equal(validatePerson({ firstName: 'No ID' }).success, false);
      assert.equal(validatePerson({ id: '', firstName: 'Empty ID', unionIds: [] }).success, false);
      assert.equal(validatePerson({ id: 'p1', gender: 'alien' as any, unionIds: [] }).success, false);
      assert.equal(validatePerson({ id: 'p1', unionIds: 'not-an-array' as any }).success, false);
    });

    it('validates a valid Union record', () => {
      const validUnion: Union = {
        id: 'u1',
        partnerIds: ['p1', 'p2'],
        childrenIds: ['c1'],
        type: 'married',
        marriageDate: '2005-06-20',
      };
      const res = validateUnion(validUnion);
      assert.equal(res.success, true);
      assert.deepEqual(res.errors, []);
    });

    it('rejects invalid Union records (missing id, non-array partnerIds, invalid type)', () => {
      assert.equal(validateUnion(null).success, false);
      assert.equal(validateUnion({ id: 'u1', partnerIds: 'string' as any, childrenIds: [] }).success, false);
      assert.equal(validateUnion({ id: 'u1', partnerIds: [], childrenIds: [], type: 'soulmates' as any }).success, false);
    });

    it('validates a valid TreeData object', () => {
      const validTree: TreeData = {
        id: 'tree1',
        name: 'My Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        people: {
          p1: { id: 'p1', firstName: 'John', unionIds: [] },
        },
        unions: {},
      };
      const res = validateTree(validTree);
      assert.equal(res.success, true);
      assert.deepEqual(res.errors, []);
    });

    it('rejects TreeData with key mismatches or non-object people/unions', () => {
      const mismatchedTree: any = {
        id: 'tree1',
        name: 'Bad Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          key_is_not_id: { id: 'p1', unionIds: [] },
        },
        unions: {},
      };
      const res = validateTree(mismatchedTree);
      assert.equal(res.success, false);
      assert.ok(res.errors.some((e) => e.includes('does not match person.id')));
    });
  });

  describe('Stepwise Migration', () => {
    it('migrates legacy unversioned tree (v0) with visual coordinates on people', () => {
      const legacyTree: any = {
        id: 'tree_legacy',
        name: 'Legacy Format Tree',
        people: {
          p1: {
            id: 'p1',
            firstName: 'Old',
            lastName: 'Person',
            x: 150,
            y: 300,
            horizontalX: 400,
            horizontalY: 200,
            // unionIds missing in legacy raw payload
          },
        },
        unions: {
          u1: {
            id: 'u1',
            // partnerIds and childrenIds missing
          },
        },
      };

      const migrated = migrate(legacyTree);

      assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
      // Deprecated coordinates moved to layoutOverrides
      assert.deepEqual(migrated.layoutOverrides?.['p1'], { x: 150, y: 300 });
      assert.deepEqual(migrated.horizontalOverrides?.['p1'], { x: 400, y: 200 });
      // Person coordinates cleaned
      assert.equal((migrated.people['p1'] as any).x, undefined);
      assert.equal((migrated.people['p1'] as any).y, undefined);
      // Arrays normalized
      assert.deepEqual(migrated.people['p1'].unionIds, []);
      assert.deepEqual(migrated.unions['u1'].partnerIds, []);
      assert.deepEqual(migrated.unions['u1'].childrenIds, []);
    });

    it('is idempotent: migrating an already migrated tree is a no-op', () => {
      const sampleTree: TreeData = {
        id: 'tree_clean',
        name: 'Clean Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        people: {
          p1: { id: 'p1', firstName: 'Alice', unionIds: [] },
        },
        unions: {},
      };

      const first = migrate(sampleTree);
      const second = migrate(first);
      assert.deepEqual(first, second);
    });
  });

  describe('Invariant Checks (checkInvariants)', () => {
    it('detects duplicate person and union IDs', () => {
      const tree: TreeData = {
        id: 'tree_dup',
        name: 'Dup Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', unionIds: [] },
        },
        unions: {
          p1: { id: 'p1', partnerIds: [], childrenIds: [] }, // Collides with person p1!
        },
      };

      const violations = checkInvariants(tree);
      assert.ok(violations.some((v) => v.code === 'DUPLICATE_ID'));
    });

    it('detects dangling partner and child references', () => {
      const tree: TreeData = {
        id: 'tree_dangling',
        name: 'Dangling Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', parentUnionId: 'u_missing', unionIds: ['u_ghost'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p_ghost'], childrenIds: ['c_ghost'] },
        },
      };

      const violations = checkInvariants(tree);
      assert.ok(violations.some((v) => v.code === 'DANGLING_UNION_REF'));
      assert.ok(violations.some((v) => v.code === 'DANGLING_PARTNER_REF'));
      assert.ok(violations.some((v) => v.code === 'DANGLING_CHILD_REF'));
    });

    it('detects self-parenting (person is both partner and child of same union)', () => {
      const tree: TreeData = {
        id: 'tree_self_parent',
        name: 'Self Parent Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', parentUnionId: 'u1', unionIds: ['u1'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: ['p1'] },
        },
      };

      const violations = checkInvariants(tree);
      assert.ok(violations.some((v) => v.code === 'SELF_PARENTING'));
    });

    it('detects multi-node parent cycles (A is parent of B, B is parent of A)', () => {
      const tree: TreeData = {
        id: 'tree_cycle',
        name: 'Cycle Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', parentUnionId: 'u2', unionIds: ['u1'] },
          p2: { id: 'p2', parentUnionId: 'u1', unionIds: ['u2'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: ['p2'] },
          u2: { id: 'u2', partnerIds: ['p2'], childrenIds: ['p1'] },
        },
      };

      const violations = checkInvariants(tree);
      assert.ok(violations.some((v) => v.code === 'PARENT_CYCLE'));
    });

    it('detects invalid date range (birthDate after deathDate)', () => {
      const tree: TreeData = {
        id: 'tree_dates',
        name: 'Dates Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', birthDate: '2020-05-10', deathDate: '1980-01-01', unionIds: [] },
        },
        unions: {},
      };

      const violations = checkInvariants(tree);
      assert.ok(violations.some((v) => v.code === 'INVALID_DATE_RANGE'));
    });

    it('does NOT flag legal inter-generational marriages', () => {
      const tree: TreeData = {
        id: 'tree_intergen',
        name: 'Inter-generational Marriage Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p_older: { id: 'p_older', birthDate: '1940-01-01', generation: 1, unionIds: ['u_marriage'] },
          p_younger: { id: 'p_younger', birthDate: '1985-05-20', generation: 3, unionIds: ['u_marriage'] },
        },
        unions: {
          u_marriage: { id: 'u_marriage', partnerIds: ['p_older', 'p_younger'], childrenIds: [], type: 'married' },
        },
      };

      const violations = checkInvariants(tree);
      // Legal inter-generational marriage must NOT produce violations!
      assert.equal(violations.length, 0);
    });

    it('detects missing rootPersonId', () => {
      const tree: TreeData = {
        id: 'tree_root',
        name: 'Root Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        rootPersonId: 'ghost_root',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', unionIds: [] },
        },
        unions: {},
      };

      const violations = checkInvariants(tree);
      assert.ok(violations.some((v) => v.code === 'ROOT_PERSON_NOT_FOUND'));
    });
  });

  describe('Deterministic Repair (repair)', () => {
    it('prunes dangling references and repairs reciprocal links without deleting people', () => {
      const corruptedTree: TreeData = {
        id: 'tree_corrupt',
        name: 'Corrupt Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', parentUnionId: 'u_missing', unionIds: ['u1'] },
          p2: { id: 'p2', unionIds: [] }, // Partner in u1 but missing unionId
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2', 'ghost_partner'], childrenIds: ['ghost_child'] },
          u_dead: { id: 'u_dead', partnerIds: [], childrenIds: [] }, // Dead union
        },
      };

      const { tree: repaired, report } = repair(corruptedTree);

      assert.equal(report.repaired, true);
      assert.ok(report.changes.length > 0);

      // People must NEVER be deleted
      assert.ok(repaired.people['p1']);
      assert.ok(repaired.people['p2']);

      // Dangling parent union cleared
      assert.equal(repaired.people['p1'].parentUnionId, undefined);

      // Dangling partner and child removed from u1
      assert.deepEqual(repaired.unions['u1'].partnerIds, ['p1', 'p2']);
      assert.deepEqual(repaired.unions['u1'].childrenIds, []);

      // Reciprocal link repaired on p2
      assert.ok(repaired.people['p2'].unionIds.includes('u1'));

      // Dead union pruned
      assert.equal(repaired.unions['u_dead'], undefined);

      // Remaining invariant violations must be 0
      const remaining = checkInvariants(repaired);
      assert.equal(remaining.length, 0);
    });

    it('breaks pedigree cycles and corrects inverted dates', () => {
      const cyclicTree: TreeData = {
        id: 'tree_cycle',
        name: 'Cycle and Date Tree',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        people: {
          p1: { id: 'p1', birthDate: '2020-01-01', deathDate: '1980-01-01', parentUnionId: 'u2', unionIds: ['u1'] },
          p2: { id: 'p2', parentUnionId: 'u1', unionIds: ['u2'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: ['p2'] },
          u2: { id: 'u2', partnerIds: ['p2'], childrenIds: ['p1'] },
        },
      };

      const { tree: repaired, report } = repair(cyclicTree);
      assert.equal(report.repaired, true);

      // Cycle broken
      const violations = checkInvariants(repaired);
      assert.equal(violations.filter((v) => v.code === 'PARENT_CYCLE').length, 0);

      // Invalid death date cleared
      assert.equal(repaired.people['p1'].deathDate, undefined);
    });
  });

  describe('Boundary Pipeline (processTreeIngress)', () => {
    it('repairs intermediate snapshots silently but still reports explicit ingress repairs', () => {
      const dirty: TreeData = {
        id: 'tree_notices', name: 'Notices', schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
        people: { p1: { id: 'p1', unionIds: [] } },
        unions: { u1: { id: 'u1', partnerIds: ['p1', 'ghost'], childrenIds: [] } },
      };
      const original = structuredClone(dirty);
      let notices = 0;
      registerIngressRepairListener(() => { notices++; });
      try {
        const silent = processTreeIngress(dirty, { notifyRepairs: false });
        assert.equal(silent.repaired, true);
        assert.deepEqual(checkInvariants(silent.tree), []);
        assert.equal(notices, 0);
        processTreeIngress(dirty);
        assert.equal(notices, 1);
        processTreeIngress(silent.tree);
        assert.equal(notices, 1);
        assert.deepEqual(dirty, original);
      } finally {
        registerIngressRepairListener(null);
      }
    });

    it('migrates, validates, and repairs repairable trees in one pass', () => {
      const rawLegacy: any = {
        id: 'tree_raw',
        name: 'Raw Ingress Tree',
        people: {
          p1: { id: 'p1', x: 50, y: 100, unionIds: ['u1'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: ['ghost_c'] },
        },
      };

      const result = processTreeIngress(rawLegacy);

      assert.equal(result.repaired, true);
      assert.equal(result.tree.schemaVersion, CURRENT_SCHEMA_VERSION);
      assert.deepEqual(result.tree.layoutOverrides?.['p1'], { x: 50, y: 100 });
      assert.deepEqual(result.tree.unions['u1'].childrenIds, []);
      assert.equal(checkInvariants(result.tree).length, 0);
    });

    it('rejects completely invalid non-object or unrepairable payloads', () => {
      assert.throws(() => processTreeIngress(null), /valid non-null object/);
      assert.throws(() => processTreeIngress('string-payload'), /valid non-null object/);
    });
  });

  describe('Multiple Sets of Parents with Typed Relationships', () => {
    it('validates a person with multiple typed parent links', () => {
      const child: Person = {
        id: 'child1',
        firstName: 'Adopted',
        lastName: 'Child',
        unionIds: [],
        parentUnionId: 'u_bio',
        parentLinks: [
          { unionId: 'u_bio', type: 'biological', isPrimary: true },
          { unionId: 'u_adop', type: 'adoptive', isPrimary: false },
          { unionId: 'u_foster', type: 'foster' },
        ],
      };
      const res = validatePerson(child);
      assert.equal(res.success, true);
      assert.equal(res.data?.parentLinks?.length, 3);
    });

    it('rejects invalid parentLink type in validation', () => {
      const child: any = {
        id: 'child1',
        firstName: 'Invalid',
        unionIds: [],
        parentLinks: [
          { unionId: 'u_bio', type: 'extraterrestrial' },
        ],
      };
      const res = validatePerson(child);
      assert.equal(res.success, false);
      assert.ok(res.errors.some((e: string) => e.includes('ParentLink.type must be one of')));
    });

    it('checkInvariants accepts multiple parent unions without flagging inconsistent parent links', () => {
      const tree: TreeData = {
        id: 'multi-parent-tree',
        name: 'Multi Parent Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        people: {
          bio_dad: { id: 'bio_dad', unionIds: ['u_bio'] },
          bio_mom: { id: 'bio_mom', unionIds: ['u_bio'] },
          adop_dad: { id: 'adop_dad', unionIds: ['u_adop'] },
          adop_mom: { id: 'adop_mom', unionIds: ['u_adop'] },
          child: {
            id: 'child',
            unionIds: [],
            parentUnionId: 'u_bio',
            parentLinks: [
              { unionId: 'u_bio', type: 'biological', isPrimary: true },
              { unionId: 'u_adop', type: 'adoptive', isPrimary: false },
            ],
          },
        },
        unions: {
          u_bio: {
            id: 'u_bio',
            partnerIds: ['bio_dad', 'bio_mom'],
            childrenIds: ['child'],
          },
          u_adop: {
            id: 'u_adop',
            partnerIds: ['adop_dad', 'adop_mom'],
            childrenIds: ['child'],
          },
        },
      };

      const violations = checkInvariants(tree);
      assert.equal(violations.length, 0, `Expected 0 violations but got: ${JSON.stringify(violations)}`);
    });

    it('repair preserves both biological and adoptive parent unions for a child', () => {
      const tree: TreeData = {
        id: 'multi-parent-repair-tree',
        name: 'Repair Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        people: {
          bio_dad: { id: 'bio_dad', unionIds: ['u_bio'] },
          adop_dad: { id: 'adop_dad', unionIds: ['u_adop'] },
          child: {
            id: 'child',
            unionIds: [],
            parentUnionId: 'u_bio',
            parentLinks: [
              { unionId: 'u_bio', type: 'biological', isPrimary: true },
              { unionId: 'u_adop', type: 'adoptive', isPrimary: false },
            ],
          },
        },
        unions: {
          u_bio: {
            id: 'u_bio',
            partnerIds: ['bio_dad'],
            childrenIds: ['child'],
          },
          u_adop: {
            id: 'u_adop',
            partnerIds: ['adop_dad'],
            childrenIds: ['child'],
          },
        },
      };

      const { tree: repaired } = repair(tree);
      assert.ok(repaired.unions['u_bio'].childrenIds.includes('child'));
      assert.ok(repaired.unions['u_adop'].childrenIds.includes('child'));
      assert.equal(repaired.people['child'].parentLinks?.length, 2);
    });

    const driftTree = (): TreeData => ({
      id: 'drift',
      name: 'Drift',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      people: {
        a: { id: 'a', unionIds: ['u1'] },
        b: { id: 'b', unionIds: ['u2'] },
        kid: {
          id: 'kid',
          unionIds: [],
          parentUnionId: 'u_gone',
          parentLinks: [
            { unionId: 'u1', type: 'biological', isPrimary: true },
            { unionId: 'u2', type: 'step', isPrimary: false },
          ],
        },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['a'], childrenIds: ['kid'] },
        u2: { id: 'u2', partnerIds: ['b'], childrenIds: ['kid'] },
      },
    } as unknown as TreeData);

    it('flags parentUnionId that is not among parentLinks and repair resyncs it without mutating input', () => {
      const tree = driftTree();
      tree.people['kid'].parentUnionId = 'u2';
      tree.people['kid'].parentLinks = [{ unionId: 'u1', type: 'biological', isPrimary: true }];
      const before = JSON.stringify(tree);

      assert.ok(
        checkInvariants(tree).some((v) => v.code === 'INCONSISTENT_PARENT_LINK' && v.entityId === 'kid')
      );

      const { tree: repaired } = repair(tree);
      assert.equal(repaired.people['kid'].parentUnionId, 'u1');
      assert.equal(JSON.stringify(tree), before);
      assert.ok(!checkInvariants(repaired).some((v) => v.code === 'INCONSISTENT_PARENT_LINK'));
    });
  });
});
