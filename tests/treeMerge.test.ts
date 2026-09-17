import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  threeWayMergePerson,
  threeWayMergeUnion,
  threeWayMergeTree,
} from '../src/services/treeMerge';
import type { TreeData, Person, Union } from '../src/types/tree';

describe('3-Way Concurrency Merge Engine', () => {
  const basePerson: Person = {
    id: 'p1',
    firstName: 'John',
    lastName: 'Doe',
    notes: 'Base notes',
    birthDate: '1950-01-01',
    unionIds: ['u1'],
  };

  it('merges non-conflicting field edits on the same person (e.g. User A edits notes, User B edits birthDate)', () => {
    const localPerson: Person = {
      ...basePerson,
      notes: 'User A edited notes',
    };

    const remotePerson: Person = {
      ...basePerson,
      birthDate: '1950-05-15',
    };

    const result = threeWayMergePerson(basePerson, localPerson, remotePerson, 'p1');

    assert.equal(result.hasConflict, false);
    assert.equal(result.conflicts.length, 0);
    assert.equal(result.mergedPerson.firstName, 'John');
    assert.equal(result.mergedPerson.lastName, 'Doe');
    // Both non-conflicting edits preserved!
    assert.equal(result.mergedPerson.notes, 'User A edited notes');
    assert.equal(result.mergedPerson.birthDate, '1950-05-15');
  });

  it('detects direct key collision on the same field and records conflict while preserving local edit', () => {
    const localPerson: Person = {
      ...basePerson,
      firstName: 'Jonathan',
    };

    const remotePerson: Person = {
      ...basePerson,
      firstName: 'Johnny',
    };

    const result = threeWayMergePerson(basePerson, localPerson, remotePerson, 'p1');

    assert.equal(result.hasConflict, true);
    assert.equal(result.conflicts.length, 1);
    assert.deepEqual(result.conflicts[0].path, ['people', 'p1', 'firstName']);
    assert.equal(result.conflicts[0].baseValue, 'John');
    assert.equal(result.conflicts[0].localValue, 'Jonathan');
    assert.equal(result.conflicts[0].remoteValue, 'Johnny');
    assert.equal(result.mergedPerson.firstName, 'Jonathan');
  });

  it('merges non-conflicting unionIds and document arrays without losing elements', () => {
    const localPerson: Person = {
      ...basePerson,
      unionIds: ['u1', 'u2'],
    };

    const remotePerson: Person = {
      ...basePerson,
      unionIds: ['u1', 'u3'],
    };

    const result = threeWayMergePerson(basePerson, localPerson, remotePerson, 'p1');
    assert.equal(result.hasConflict, false);
    assert.ok(result.mergedPerson.unionIds.includes('u1'));
    assert.ok(result.mergedPerson.unionIds.includes('u2'));
    assert.ok(result.mergedPerson.unionIds.includes('u3'));
  });

  it('merges non-conflicting union edits (e.g. User A edits type, User B edits marriageDate)', () => {
    const baseUnion: Union = {
      id: 'u1',
      partnerIds: ['p1', 'p2'],
      childrenIds: ['c1'],
      type: 'married',
      marriageDate: '1975-06-01',
    };

    const localUnion: Union = {
      ...baseUnion,
      type: 'divorced',
      divorceDate: '1990-01-01',
    };

    const remoteUnion: Union = {
      ...baseUnion,
      childrenIds: ['c1', 'c2'],
    };

    const result = threeWayMergeUnion(baseUnion, localUnion, remoteUnion, 'u1');
    assert.equal(result.hasConflict, false);
    assert.equal(result.mergedUnion.type, 'divorced');
    assert.equal(result.mergedUnion.divorceDate, '1990-01-01');
    assert.deepEqual(result.mergedUnion.childrenIds, ['c1', 'c2']);
  });

  it('merges concurrent edits across different people in a full tree without data loss', () => {
    const baseTree: TreeData = {
      id: 'tree1',
      name: 'Family Tree',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      version: 1,
      people: {
        p1: { id: 'p1', firstName: 'Alice', unionIds: [] },
        p2: { id: 'p2', firstName: 'Bob', unionIds: [] },
      },
      unions: {},
    };

    // User A edits Alice
    const localTree: TreeData = {
      ...baseTree,
      version: 1,
      people: {
        ...baseTree.people,
        p1: { ...baseTree.people.p1, notes: 'Alice notes from User A' },
      },
    };

    // User B edits Bob and adds Charlie
    const remoteTree: TreeData = {
      ...baseTree,
      version: 2,
      people: {
        ...baseTree.people,
        p2: { ...baseTree.people.p2, birthDate: '1982-11-20' },
        p3: { id: 'p3', firstName: 'Charlie', unionIds: [] },
      },
    };

    const result = threeWayMergeTree(baseTree, localTree, remoteTree);

    assert.equal(result.hasConflict, false);
    assert.equal(result.conflicts.length, 0);
    // Alice has User A's edit
    assert.equal(result.merged.people.p1.notes, 'Alice notes from User A');
    // Bob has User B's edit
    assert.equal(result.merged.people.p2.birthDate, '1982-11-20');
    // Charlie was added
    assert.ok(result.merged.people.p3);
    assert.equal(result.merged.people.p3.firstName, 'Charlie');
    // Version incremented
    assert.equal(result.merged.version, 3);
  });
});
