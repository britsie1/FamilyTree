import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compactTombstones, DEFAULT_TOMBSTONE_RETENTION_MS } from '../src/services/tombstoneCompactor';
import type { TreeData, Person, Union } from '../src/types/tree';

describe('Tombstone Compactor Service', () => {
  const baseNow = new Date('2026-06-01T12:00:00.000Z').getTime();
  const thirtyFiveDaysAgo = new Date(baseNow - 35 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(baseNow - 10 * 24 * 60 * 60 * 1000).toISOString();

  it('purges tombstones older than 30 days and retains recent tombstones', () => {
    const activeTree: TreeData = {
      id: 'tree_1',
      name: 'Test Tree',
      people: {
        p_root: {
          id: 'p_root',
          firstName: 'Root',
          lastName: 'User',
          gender: 'female',
          unionIds: [],
        },
      },
      unions: {},
    };

    const tombstones = {
      people: {
        p_old: {
          id: 'p_old',
          firstName: 'Old',
          lastName: 'Tombstone',
          gender: 'male',
          unionIds: [],
          deleted: true,
          deletedAt: thirtyFiveDaysAgo,
        } as Person,
        p_recent: {
          id: 'p_recent',
          firstName: 'Recent',
          lastName: 'Tombstone',
          gender: 'female',
          unionIds: [],
          deleted: true,
          deletedAt: tenDaysAgo,
        } as Person,
      },
      unions: {
        u_old: {
          id: 'u_old',
          partnerIds: [],
          childrenIds: [],
          type: 'married',
          deleted: true,
          deletedAt: thirtyFiveDaysAgo,
        } as Union,
        u_recent: {
          id: 'u_recent',
          partnerIds: [],
          childrenIds: [],
          type: 'married',
          deleted: true,
          deletedAt: tenDaysAgo,
        } as Union,
      },
    };

    const result = compactTombstones(activeTree, tombstones, DEFAULT_TOMBSTONE_RETENTION_MS, baseNow);

    // Old tombstones must be purged
    assert.ok(result.purgedPeople.p_old);
    assert.ok(result.purgedUnions.u_old);
    assert.equal(result.purgedCount, 2);

    // Recent tombstones must be retained
    assert.ok(result.retainedPeople.p_recent);
    assert.ok(result.retainedUnions.u_recent);
    assert.equal(result.retainedCount, 2);
    assert.equal(result.safetyViolationsPrevented.length, 0);
  });

  it('preserves expired tombstones if active tree records still reference them (referential safety guarantee)', () => {
    const activeTree: TreeData = {
      id: 'tree_1',
      name: 'Test Tree',
      people: {
        p_child: {
          id: 'p_child',
          firstName: 'Child',
          lastName: 'User',
          gender: 'male',
          unionIds: [],
          parentUnionId: 'u_expired_ref',
        },
      },
      unions: {
        u_active: {
          id: 'u_active',
          partnerIds: ['p_expired_partner'],
          childrenIds: [],
          type: 'married',
        },
      },
    };

    const tombstones = {
      people: {
        p_expired_partner: {
          id: 'p_expired_partner',
          firstName: 'Partner',
          lastName: 'User',
          gender: 'female',
          unionIds: [],
          deleted: true,
          deletedAt: thirtyFiveDaysAgo,
        } as Person,
        p_safe_to_purge: {
          id: 'p_safe_to_purge',
          firstName: 'Unreferenced',
          lastName: 'User',
          gender: 'male',
          unionIds: [],
          deleted: true,
          deletedAt: thirtyFiveDaysAgo,
        } as Person,
      },
      unions: {
        u_expired_ref: {
          id: 'u_expired_ref',
          partnerIds: [],
          childrenIds: [],
          type: 'married',
          deleted: true,
          deletedAt: thirtyFiveDaysAgo,
        } as Union,
      },
    };

    const result = compactTombstones(activeTree, tombstones, DEFAULT_TOMBSTONE_RETENTION_MS, baseNow);

    // p_safe_to_purge is purged
    assert.ok(result.purgedPeople.p_safe_to_purge);
    assert.equal(result.purgedCount, 1);

    // p_expired_partner and u_expired_ref are RETAINED despite being > 30 days old!
    assert.ok(result.retainedPeople.p_expired_partner);
    assert.ok(result.retainedUnions.u_expired_ref);
    assert.equal(result.retainedCount, 2);

    // Safety violations report
    assert.equal(result.safetyViolationsPrevented.length, 2);
    assert.ok(result.safetyViolationsPrevented.some((s) => s.includes('p_expired_partner')));
    assert.ok(result.safetyViolationsPrevented.some((s) => s.includes('u_expired_ref')));
  });
});
