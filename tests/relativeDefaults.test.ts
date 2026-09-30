import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankTree } from '../src/services/storage';
import { addParentToPerson, addSiblingToPerson, addPartnerToPerson } from '../src/services/treeOperations';
import type { Gender } from '../src/types/tree';
import { getPersonHealthIssues } from '../src/services/personHealthIssues';

function makeTree(gender: Gender = 'female', maidenName = ' Miller ') {
  const tree = createBlankTree();
  const id = tree.rootPersonId!;
  tree.people[id] = { ...tree.people[id], firstName: 'Jane', lastName: 'Smith', gender, maidenName };
  return { tree, id };
}

describe('Relative creation defaults', () => {
  it('uses the maiden name for both parents, even if an existing parent has another surname', () => {
    const { tree, id } = makeTree();
    const first = addParentToPerson(tree, id);
    assert.equal(first.tree.people[first.newParentId].lastName, 'Miller');
    first.tree.people[first.newParentId].lastName = 'Jones';
    const second = addParentToPerson(first.tree, id);
    assert.equal(second.tree.people[second.newParentId].lastName, 'Miller');
    assert.equal(tree.people[id].lastName, 'Smith');
  });

  it('uses the maiden name for siblings and automatically created parents', () => {
    const { tree, id } = makeTree();
    const result = addSiblingToPerson(tree, id);
    assert.equal(result.tree.people[result.newSiblingId].lastName, 'Miller');
    const union = result.tree.unions[result.tree.people[id].parentUnionId!];
    assert.equal(result.tree.people[union.partnerIds[0]].lastName, 'Miller');
    const next = addSiblingToPerson(result.tree, id);
    assert.equal(next.tree.people[next.newSiblingId].lastName, 'Miller');
  });

  for (const [gender, maidenName] of [['female', ''], ['female', '   '], ['male', 'Miller'], ['unspecified', 'Miller']] as [Gender, string][]) {
    it(`falls back to the surname for ${gender} with birth name ${JSON.stringify(maidenName)}`, () => {
      const { tree, id } = makeTree(gender, maidenName);
      const parent = addParentToPerson(tree, id);
      const sibling = addSiblingToPerson(tree, id);
      assert.equal(parent.tree.people[parent.newParentId].lastName, 'Smith');
      assert.equal(sibling.tree.people[sibling.newSiblingId].lastName, 'Smith');
    });
  }

  for (const [gender, expected] of [['male', 'female'], ['female', 'male'], ['unspecified', 'unspecified'], ['other', 'unspecified']] as [Gender, Gender][]) {
    it(`defaults a partner of ${gender} to ${expected}, including reuse of an open union`, () => {
      const { tree, id } = makeTree(gender);
      const result = addPartnerToPerson(tree, id);
      assert.equal(result.tree.people[result.newPartnerId].gender, expected);
      delete result.tree.people[result.newPartnerId];
      result.tree.unions[result.newUnionId].partnerIds = [id];
      result.tree.people.child = { id: 'child', parentUnionId: result.newUnionId, unionIds: [] };
      result.tree.unions[result.newUnionId].childrenIds = ['child'];
      const reused = addPartnerToPerson(result.tree, id);
      assert.equal(reused.newUnionId, result.newUnionId);
      assert.equal(reused.tree.people[reused.newPartnerId].gender, expected);
    });
  }
});

describe('Person health issue index', () => {
  it('omits information-only research suggestions', () => {
    const { tree } = makeTree();
    assert.equal(getPersonHealthIssues(tree).size, 0);
  });

  it('shows relationship warnings on both affected people and removes resolved issues', () => {
    const { tree, id } = makeTree();
    tree.people[id].birthDate = '1990';
    tree.people[id].unionIds = ['u'];
    tree.people.child = { id: 'child', firstName: 'Child', birthDate: '1999', parentUnionId: 'u', unionIds: [] };
    tree.unions.u = { id: 'u', partnerIds: [id], childrenIds: ['child'] };
    const issues = getPersonHealthIssues(tree);
    assert.ok(issues.get(id)?.some((issue) => issue.code === 'parent_too_young'));
    assert.ok(issues.get('child')?.some((issue) => issue.code === 'parent_too_young'));
    tree.people[id].birthDate = '1970';
    assert.equal(getPersonHealthIssues(tree).size, 0);
  });
});