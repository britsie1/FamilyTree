import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudCollectionSnapshots } from '../src/services/cloudTreeSnapshots';
import { createBlankTree } from '../src/services/storage';
import { addParentToPerson, addSiblingToPerson } from '../src/services/treeOperations';
import { computeLayout } from '../src/services/layoutEngine';
import type { Person, Union } from '../src/types/tree';

function documents<T extends Person | Union>(records: Record<string, T>) {
  return Object.entries(records).map(([id, record]) => ({ id, data: () => record }));
}

describe('Acknowledged realtime collection snapshots', () => {
  it('does not emit a partial tree while initial collections load in either order', () => {
    for (const peopleFirst of [true, false]) {
      const cache = new CloudCollectionSnapshots();
      assert.equal(cache.ready, false);
      if (peopleFirst) {
        assert.equal(cache.acceptPeople([], false), false);
        assert.equal(cache.acceptUnions([], false), true);
      } else {
        assert.equal(cache.acceptUnions([], false), false);
        assert.equal(cache.acceptPeople([], false), true);
      }
      assert.equal(cache.ready, true);
    }
  });

  for (const relation of ['parent', 'sibling'] as const) {
    it(`retains a new ${relation} after optimistic writes are skipped and the metadata-only ACK arrives`, () => {
      const base = createBlankTree();
      const result = relation === 'parent'
        ? addParentToPerson(base, base.rootPersonId!)
        : addSiblingToPerson(base, base.rootPersonId!);
      const local = result.tree;
      const cache = new CloudCollectionSnapshots();
      cache.acceptPeople(documents(base.people), false);
      cache.acceptUnions(documents(base.unions), false);
      assert.equal(cache.acceptPeople(documents(local.people), true), false);
      assert.equal(cache.acceptUnions(documents(local.unions), true), false);
      assert.deepEqual(Object.keys(cache.people), Object.keys(base.people));
      // Metadata-only ACKs may contain no docChanges, but docs still has the full set.
      assert.equal(cache.acceptPeople(documents(local.people), false), true);
      assert.equal(cache.acceptUnions(documents(local.unions), false), true);
      const combined = { ...base, people: cache.people, unions: cache.unions };
      assert.deepEqual(Object.keys(combined.people).sort(), Object.keys(local.people).sort());
      assert.deepEqual(combined.unions, local.unions);
      assert.deepEqual(Object.keys(computeLayout(combined).nodes).sort(), Object.keys(local.people).sort());
      // Subsequent root/collection snapshots must not revert the acknowledged records.
      cache.acceptUnions(documents(local.unions), false);
      assert.deepEqual(cache.people, local.people);
    });
  }

  it('removes hard-deleted documents instead of retaining them from earlier deltas', () => {
    const cache = new CloudCollectionSnapshots();
    cache.acceptPeople([{ id: 'p', data: () => ({ id: 'wrong', unionIds: [] }) }], false);
    cache.acceptUnions([{ id: 'u', data: () => ({ id: 'wrong', partnerIds: ['p'], childrenIds: [] }) }], false);
    assert.equal(cache.people.p.id, 'p');
    assert.equal(cache.unions.u.id, 'u');
    cache.acceptPeople([], false);
    cache.acceptUnions([], false);
    assert.deepEqual(cache.people, {});
    assert.deepEqual(cache.unions, {});
  });
});