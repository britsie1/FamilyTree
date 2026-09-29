import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TreeData, Person, Union } from '../src/types/tree';
import {
  mergeRecord,
  mergeRecordDictionary,
  syncMerge,
} from '../src/services/syncMerge';
import { CloudSyncBridge } from '../src/services/cloudSyncBridge';
import { checkInvariants } from '../src/services/schema/invariants';

describe('Phase 2: Per-Record Cloud Sync with Tombstones', () => {
  describe('mergeRecord (LWW and Tombstones)', () => {
    it('prefers newer updatedAt for active records (LWW)', () => {
      const local: Person = {
        id: 'p1',
        firstName: 'John',
        unionIds: [],
        updatedAt: '2026-01-01T10:00:00.000Z',
        rev: 1,
      };
      const remote: Person = {
        id: 'p1',
        firstName: 'Jonathan',
        unionIds: [],
        updatedAt: '2026-01-01T11:00:00.000Z',
        rev: 2,
      };

      const result = mergeRecord(local, remote, 'person');
      assert.equal(result.winner, 'remote');
      assert.equal(result.merged.firstName, 'Jonathan');
      assert.equal(result.isDeleted, false);
      assert.equal(result.wasRestored, false);
    });

    it('prefers higher rev when timestamps are identical', () => {
      const local: Person = {
        id: 'p1',
        firstName: 'John',
        unionIds: [],
        updatedAt: '2026-01-01T10:00:00.000Z',
        rev: 5,
      };
      const remote: Person = {
        id: 'p1',
        firstName: 'Johnny',
        unionIds: [],
        updatedAt: '2026-01-01T10:00:00.000Z',
        rev: 3,
      };

      const result = mergeRecord(local, remote, 'person');
      assert.equal(result.winner, 'local');
      assert.equal(result.merged.firstName, 'John');
    });

    it('delete wins when tombstone is newer than or equal to edit timestamp', () => {
      const localTombstone: Person = {
        id: 'p1',
        firstName: 'John',
        unionIds: [],
        deleted: true,
        deletedAt: '2026-01-01T12:00:00.000Z',
        updatedAt: '2026-01-01T12:00:00.000Z',
        rev: 3,
      };
      const remoteEdit: Person = {
        id: 'p1',
        firstName: 'John Updated',
        unionIds: [],
        deleted: false,
        updatedAt: '2026-01-01T11:00:00.000Z',
        rev: 2,
      };

      const result = mergeRecord(localTombstone, remoteEdit, 'person');
      assert.equal(result.isDeleted, true);
      assert.equal(result.wasRestored, false);
      assert.equal(result.winner, 'local');
      assert.equal(result.merged.deleted, true);
      assert.equal(result.merged.deletedAt, '2026-01-01T12:00:00.000Z');
    });

    it('edit wins and resurrects record when edit is strictly newer than tombstone', () => {
      const localTombstone: Person = {
        id: 'p1',
        firstName: 'John',
        unionIds: [],
        deleted: true,
        deletedAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        rev: 2,
      };
      const remoteEdit: Person = {
        id: 'p1',
        firstName: 'John Resurrected',
        unionIds: [],
        deleted: false,
        updatedAt: '2026-01-01T12:00:00.000Z',
        rev: 3,
      };

      const result = mergeRecord(localTombstone, remoteEdit, 'person');
      assert.equal(result.isDeleted, false);
      assert.equal(result.wasRestored, true);
      assert.equal(result.winner, 'remote');
      assert.equal(result.merged.deleted, false);
      assert.equal(result.merged.deletedAt, undefined);
      assert.equal(result.merged.firstName, 'John Resurrected');
      assert.ok(result.notice?.includes('Restored'));
    });

    it('resolves between two tombstones by keeping latest deletion time', () => {
      const localTombstone: Union = {
        id: 'u1',
        partnerIds: ['p1'],
        childrenIds: [],
        deleted: true,
        deletedAt: '2026-01-01T10:00:00.000Z',
        rev: 2,
      };
      const remoteTombstone: Union = {
        id: 'u1',
        partnerIds: ['p1'],
        childrenIds: [],
        deleted: true,
        deletedAt: '2026-01-01T14:00:00.000Z',
        rev: 3,
      };

      const result = mergeRecord(localTombstone, remoteTombstone, 'union');
      assert.equal(result.isDeleted, true);
      assert.equal(result.winner, 'remote');
      assert.equal(result.merged.deletedAt, '2026-01-01T14:00:00.000Z');
    });
  });

  describe('mergeRecordDictionary', () => {
    it('segregates active records from tombstones and reports notices', () => {
      const localMap: Record<string, Person> = {
        p1: { id: 'p1', firstName: 'Alice', unionIds: [], updatedAt: '2026-01-01T10:00:00Z' },
        p2: { id: 'p2', firstName: 'Bob', unionIds: [], deleted: true, deletedAt: '2026-01-01T12:00:00Z' },
      };
      const remoteMap: Record<string, Person> = {
        p1: { id: 'p1', firstName: 'Alice Updated', unionIds: [], updatedAt: '2026-01-01T11:00:00Z' },
        p2: { id: 'p2', firstName: 'Bob Restored', unionIds: [], updatedAt: '2026-01-01T13:00:00Z' },
        p3: { id: 'p3', firstName: 'Charlie', unionIds: [], updatedAt: '2026-01-01T10:00:00Z' },
      };

      const res = mergeRecordDictionary(localMap, remoteMap, 'person');
      assert.equal(Object.keys(res.active).length, 3);
      assert.equal(res.active.p1.firstName, 'Alice Updated');
      assert.equal(res.active.p2.firstName, 'Bob Restored');
      assert.equal(res.active.p3.firstName, 'Charlie');
      assert.ok(res.restoredIds.includes('p2'));
      assert.equal(res.notices.length, 1);
    });
  });

  describe('syncMerge (Tree Level)', () => {
    it('merges two divergent client trees without whole-tree clobber and fixes invariants', () => {
      const baseTree: TreeData = {
        id: 'tree_1',
        name: 'Family',
        people: {
          p1: { id: 'p1', firstName: 'Parent 1', unionIds: ['u1'], updatedAt: '2026-01-01T08:00:00Z' },
          p2: { id: 'p2', firstName: 'Parent 2', unionIds: ['u1'], updatedAt: '2026-01-01T08:00:00Z' },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: [], updatedAt: '2026-01-01T08:00:00Z' },
        },
        updatedAt: '2026-01-01T08:00:00Z',
      };

      // Client A adds Child A
      const clientATree: TreeData = {
        ...baseTree,
        people: {
          ...baseTree.people,
          p_childA: { id: 'p_childA', firstName: 'Child A', parentUnionId: 'u1', unionIds: [], updatedAt: '2026-01-01T09:00:00Z' },
        },
        unions: {
          u1: { ...baseTree.unions.u1, childrenIds: ['p_childA'], updatedAt: '2026-01-01T09:00:00Z' },
        },
        updatedAt: '2026-01-01T09:00:00Z',
      };

      // Client B concurrently adds Child B
      const clientBTree: TreeData = {
        ...baseTree,
        people: {
          ...baseTree.people,
          p_childB: { id: 'p_childB', firstName: 'Child B', parentUnionId: 'u1', unionIds: [], updatedAt: '2026-01-01T09:30:00Z' },
        },
        unions: {
          u1: { ...baseTree.unions.u1, childrenIds: ['p_childB'], updatedAt: '2026-01-01T09:30:00Z' },
        },
        updatedAt: '2026-01-01T09:30:00Z',
      };

      const mergeResult = syncMerge(clientATree, clientBTree);
      const mergedTree = mergeResult.tree;

      // Both children exist in merged tree
      assert.ok(mergedTree.people.p_childA);
      assert.ok(mergedTree.people.p_childB);
      assert.equal(mergedTree.people.p_childA.firstName, 'Child A');
      assert.equal(mergedTree.people.p_childB.firstName, 'Child B');

      // Invariants are 100% clean
      const violations = checkInvariants(mergedTree);
      assert.deepEqual(violations, []);
    });

    it('handles concurrent delete vs edit with tombstone resolution and reference cleanup', () => {
      // Client A deletes Parent 2
      const clientATree: TreeData = {
        id: 'tree_1',
        name: 'Family',
        people: {
          p1: { id: 'p1', firstName: 'Parent 1', unionIds: ['u1'], updatedAt: '2026-01-01T08:00:00Z' },
          p2: { id: 'p2', firstName: 'Parent 2', unionIds: [], deleted: true, deletedAt: '2026-01-01T11:00:00Z', updatedAt: '2026-01-01T11:00:00Z' },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: [], updatedAt: '2026-01-01T11:00:00Z' },
        },
        updatedAt: '2026-01-01T11:00:00Z',
      };

      // Client B modified Parent 2 earlier (at 10:00)
      const clientBTree: TreeData = {
        id: 'tree_1',
        name: 'Family',
        people: {
          p1: { id: 'p1', firstName: 'Parent 1', unionIds: ['u1'], updatedAt: '2026-01-01T08:00:00Z' },
          p2: { id: 'p2', firstName: 'Parent 2 Renamed', unionIds: ['u1'], updatedAt: '2026-01-01T10:00:00Z' },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: [], updatedAt: '2026-01-01T10:00:00Z' },
        },
        updatedAt: '2026-01-01T10:00:00Z',
      };

      const mergeResult = syncMerge(clientATree, clientBTree);
      const mergedTree = mergeResult.tree;

      // Parent 2 delete at 11:00 beats edit at 10:00
      assert.equal(mergedTree.people.p2, undefined);
      assert.ok(mergeResult.tombstones.people.p2);

      // Union partnerIds should not contain deleted p2
      assert.ok(!mergedTree.unions.u1.partnerIds.includes('p2'));

      // Invariants are clean
      const violations = checkInvariants(mergedTree);
      assert.deepEqual(violations, []);
    });
  });

  describe('CloudSyncBridge queueBatchDiff', () => {
    it('detects added, modified, and deleted records and queues them accurately', () => {
      const bridge = new CloudSyncBridge();

      const base: TreeData = {
        id: 'tree_diff',
        name: 'Diff Tree',
        people: {
          p1: { id: 'p1', firstName: 'Alice', unionIds: [] },
          p2: { id: 'p2', firstName: 'Bob', unionIds: [] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: [] },
        },
      };

      const current: TreeData = {
        id: 'tree_diff',
        name: 'Diff Tree',
        people: {
          p1: { id: 'p1', firstName: 'Alice Modified', unionIds: [] },
          // p2 deleted
          p3: { id: 'p3', firstName: 'Charlie Added', unionIds: [] },
        },
        unions: {
          // u1 modified
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: [] },
        },
      };

      bridge.queueBatchDiff('tree_diff', base, current, { isSubcollection: true });
      // 1 modified person (p1), 1 deleted person (p2), 1 added person (p3), 1 modified union (u1)
      assert.equal(bridge.getPendingCount(), 4);

      bridge.clear();
      assert.equal(bridge.getPendingCount(), 0);
    });
  });
});
