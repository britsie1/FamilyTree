import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPersonCardNameLines } from '../src/services/displayUtils';
import type { Person } from '../src/types/tree';

describe('person card name lines', () => {
  const person: Person = { id: 'person', firstName: 'Mary Anne', lastName: 'van der Merwe', unionIds: [] };

  it('keeps multi-word names and surnames on separate rows', () => {
    assert.deepEqual(getPersonCardNameLines(person), ['Mary Anne', 'van der Merwe']);
  });

  it('prefers knownAs and trims both rows', () => {
    assert.deepEqual(getPersonCardNameLines({ ...person, knownAs: ' Annie ', lastName: ' Smith ' }), ['Annie', 'Smith']);
  });

  it('does not add empty rows when only one name is known', () => {
    assert.deepEqual(getPersonCardNameLines({ ...person, firstName: '' }), ['van der Merwe']);
    assert.deepEqual(getPersonCardNameLines({ ...person, lastName: '' }), ['Mary Anne']);
  });

  it('handles unnamed people', () => {
    assert.deepEqual(getPersonCardNameLines(null), ['Unnamed Person']);
    assert.deepEqual(getPersonCardNameLines({ id: 'empty', unionIds: [] }), ['Unnamed Person']);
  });
});