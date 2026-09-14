import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getPersonDisplayName,
  getPersonFullName,
  createEmptyPerson,
} from '../src/services/treeOperations.ts';
import type { Person } from '../src/types/tree.ts';

describe('Person Identity & Display Name', () => {
  describe('getPersonDisplayName', () => {
    it('uses knownAs with lastName when knownAs is present', () => {
      const person: Person = {
        id: 'p1',
        firstName: 'Robert',
        middleNames: 'Francis',
        lastName: 'Miller',
        knownAs: 'Bob',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Bob Miller');
    });

    it('falls back to firstName with lastName when knownAs is undefined', () => {
      const person: Person = {
        id: 'p2',
        firstName: 'Robert',
        middleNames: 'Francis',
        lastName: 'Miller',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Robert Miller');
    });

    it('falls back to firstName with lastName when knownAs is empty or whitespace', () => {
      const person1: Person = {
        id: 'p3',
        firstName: 'Robert',
        lastName: 'Miller',
        knownAs: '',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person1), 'Robert Miller');

      const person2: Person = {
        id: 'p4',
        firstName: 'Robert',
        lastName: 'Miller',
        knownAs: '   ',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person2), 'Robert Miller');
    });

    it('trims whitespace from knownAs, firstName, and lastName', () => {
      const person: Person = {
        id: 'p5',
        firstName: '  Robert  ',
        lastName: '  Miller  ',
        knownAs: '  Bob  ',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Bob Miller');
    });

    it('returns only knownAs when lastName is absent', () => {
      const person: Person = {
        id: 'p6',
        firstName: 'Robert',
        knownAs: 'Bob',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Bob');
    });

    it('returns only firstName when lastName and knownAs are absent', () => {
      const person: Person = {
        id: 'p7',
        firstName: 'Robert',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Robert');
    });

    it('returns only lastName when firstName and knownAs are absent', () => {
      const person: Person = {
        id: 'p8',
        lastName: 'Miller',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Miller');
    });

    it('returns "Unnamed Person" when all name fields are empty or missing', () => {
      const person: Person = {
        id: 'p9',
        unionIds: [],
      };
      assert.strictEqual(getPersonDisplayName(person), 'Unnamed Person');
      assert.strictEqual(getPersonDisplayName(null), 'Unnamed Person');
      assert.strictEqual(getPersonDisplayName(undefined), 'Unnamed Person');
    });
  });

  describe('getPersonFullName', () => {
    it('returns firstName, middleNames, and lastName', () => {
      const person: Person = {
        id: 'p1',
        firstName: 'Henry',
        middleNames: 'Charles Albert David',
        lastName: 'Windsor',
        knownAs: 'Harry',
        unionIds: [],
      };
      assert.strictEqual(getPersonFullName(person), 'Henry Charles Albert David Windsor');
    });

    it('handles missing middleNames', () => {
      const person: Person = {
        id: 'p2',
        firstName: 'George',
        lastName: 'Windsor',
        unionIds: [],
      };
      assert.strictEqual(getPersonFullName(person), 'George Windsor');
    });

    it('handles missing lastName or firstName', () => {
      const person1: Person = {
        id: 'p3',
        firstName: 'Madonna',
        unionIds: [],
      };
      assert.strictEqual(getPersonFullName(person1), 'Madonna');

      const person2: Person = {
        id: 'p4',
        middleNames: 'Marie',
        lastName: 'Smith',
        unionIds: [],
      };
      assert.strictEqual(getPersonFullName(person2), 'Marie Smith');
    });

    it('returns "Unnamed Person" when all parts are empty', () => {
      const person: Person = {
        id: 'p5',
        unionIds: [],
      };
      assert.strictEqual(getPersonFullName(person), 'Unnamed Person');
      assert.strictEqual(getPersonFullName(null), 'Unnamed Person');
    });
  });

  describe('createEmptyPerson', () => {
    it('initializes default empty strings for middleNames and knownAs', () => {
      const person = createEmptyPerson();
      assert.strictEqual(person.middleNames, '');
      assert.strictEqual(person.knownAs, '');
      assert.strictEqual(person.firstName, '');
      assert.strictEqual(person.lastName, '');
    });

    it('preserves overrides for middleNames and knownAs', () => {
      const person = createEmptyPerson({
        firstName: 'Henry',
        middleNames: 'Charles',
        knownAs: 'Harry',
        lastName: 'Windsor',
      });
      assert.strictEqual(person.firstName, 'Henry');
      assert.strictEqual(person.middleNames, 'Charles');
      assert.strictEqual(person.knownAs, 'Harry');
      assert.strictEqual(person.lastName, 'Windsor');
      assert.strictEqual(getPersonDisplayName(person), 'Harry Windsor');
    });
  });

  describe('Search matching for Known As and Middle Names', () => {
    it('finds person by knownAs or middleNames', () => {
      const p: Person = {
        id: 'p_test',
        firstName: 'Henry',
        middleNames: 'Charles Albert David',
        knownAs: 'Harry',
        lastName: 'Windsor',
        unionIds: [],
      };

      const matchQuery = (query: string) => {
        const q = query.toLowerCase();
        const nameString = `${p.firstName || ''} ${p.middleNames || ''} ${p.knownAs || ''} ${p.lastName || ''} ${p.maidenName || ''}`.toLowerCase();
        return nameString.includes(q) || (p.notes && p.notes.toLowerCase().includes(query)) || p.id.toLowerCase().includes(q);
      };

      assert.strictEqual(matchQuery('harry'), true);
      assert.strictEqual(matchQuery('charles'), true);
      assert.strictEqual(matchQuery('henry'), true);
      assert.strictEqual(matchQuery('windsor'), true);
      assert.strictEqual(matchQuery('nonexistent'), false);
    });
  });

  describe('Card Initials logic', () => {
    it('uses knownAs initial when knownAs is provided', () => {
      const person: Person = {
        id: 'p1',
        firstName: 'Henry',
        knownAs: 'Harry',
        lastName: 'Windsor',
        unionIds: [],
      };
      const namePart = (person.knownAs && person.knownAs.trim()) ? person.knownAs.trim() : (person.firstName?.trim() || '');
      const initials = (
        (namePart ? namePart[0] : '') +
        (person.lastName?.trim() ? person.lastName.trim()[0] : '')
      ).toUpperCase() || '?';

      assert.strictEqual(initials, 'HW');
    });

    it('uses firstName initial when knownAs is not provided', () => {
      const person: Person = {
        id: 'p2',
        firstName: 'William',
        lastName: 'Windsor',
        unionIds: [],
      };
      const namePart = (person.knownAs && person.knownAs.trim()) ? person.knownAs.trim() : (person.firstName?.trim() || '');
      const initials = (
        (namePart ? namePart[0] : '') +
        (person.lastName?.trim() ? person.lastName.trim()[0] : '')
      ).toUpperCase() || '?';

      assert.strictEqual(initials, 'WW');
    });
  });
});
