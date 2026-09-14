import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDoubleInLawPreset, createDivorceBlendedPreset } from '../src/services/storage.ts';
import { findRelationship } from '../src/services/relationshipFinder.ts';
import type { TreeData } from '../src/types/tree.ts';

describe('Relationship Finder Engine', () => {
  const doubleInLawTree = createDoubleInLawPreset();

  test('Identity: finds Self relationship', () => {
    const rel = findRelationship(doubleInLawTree, 'me', 'me');
    assert.equal(rel.category, 'self');
    assert.equal(rel.relationshipName, 'Self');
    assert.equal(rel.inverseRelationshipName, 'Self');
    assert.equal(rel.generationDifference, 0);
    assert.equal(rel.isConsanguineous, true);
  });

  test('Direct Parent and Child relationship', () => {
    // me (male) -> dad (male)
    const toDad = findRelationship(doubleInLawTree, 'me', 'dad');
    assert.equal(toDad.category, 'direct');
    assert.equal(toDad.relationshipName, 'Father');
    assert.equal(toDad.inverseRelationshipName, 'Son');
    assert.equal(toDad.generationDifference, -1);
    assert.equal(toDad.isConsanguineous, true);

    // dad (male) -> me (male)
    const toSon = findRelationship(doubleInLawTree, 'dad', 'me');
    assert.equal(toSon.category, 'direct');
    assert.equal(toSon.relationshipName, 'Son');
    assert.equal(toSon.inverseRelationshipName, 'Father');
    assert.equal(toSon.generationDifference, 1);

    // me (male) -> mom (female)
    const toMom = findRelationship(doubleInLawTree, 'me', 'mom');
    assert.equal(toMom.relationshipName, 'Mother');
    assert.equal(toMom.inverseRelationshipName, 'Son');

    // mom (female) -> sibling_me (female)
    const toDaughter = findRelationship(doubleInLawTree, 'mom', 'sibling_me');
    assert.equal(toDaughter.relationshipName, 'Daughter');
    assert.equal(toDaughter.inverseRelationshipName, 'Mother');
  });

  test('Direct Grandparent and Grandchild relationship', () => {
    // me (male) -> gf_smith (male)
    const toGf = findRelationship(doubleInLawTree, 'me', 'gf_smith');
    assert.equal(toGf.category, 'direct');
    assert.equal(toGf.relationshipName, 'Grandfather');
    assert.equal(toGf.inverseRelationshipName, 'Grandson');
    assert.equal(toGf.generationDifference, -2);
    assert.equal(toGf.isConsanguineous, true);

    // gf_smith (male) -> me (male)
    const toGrandson = findRelationship(doubleInLawTree, 'gf_smith', 'me');
    assert.equal(toGrandson.relationshipName, 'Grandson');
    assert.equal(toGrandson.inverseRelationshipName, 'Grandfather');
    assert.equal(toGrandson.generationDifference, 2);

    // gf_smith -> sibling_me (female)
    const toGranddaughter = findRelationship(doubleInLawTree, 'gf_smith', 'sibling_me');
    assert.equal(toGranddaughter.relationshipName, 'Granddaughter');
    assert.equal(toGranddaughter.inverseRelationshipName, 'Grandfather');

    // me -> gm_miller (female)
    const toGm = findRelationship(doubleInLawTree, 'me', 'gm_miller');
    assert.equal(toGm.relationshipName, 'Grandmother');
    assert.equal(toGm.inverseRelationshipName, 'Grandson');
  });

  test('Great-grandparent and Great-grandchild relationship', () => {
    // Build a 4-generation mini tree
    const customTree: TreeData = {
      id: 'custom_great_tree',
      name: 'Great Tree',
      createdAt: '',
      updatedAt: '',
      people: {
        ggm: { id: 'ggm', firstName: 'Alice', gender: 'female', unionIds: ['u1'] },
        gm: { id: 'gm', firstName: 'Beth', gender: 'female', parentUnionId: 'u1', unionIds: ['u2'] },
        mother: { id: 'mother', firstName: 'Cathy', gender: 'female', parentUnionId: 'u2', unionIds: ['u3'] },
        daughter: { id: 'daughter', firstName: 'Daisy', gender: 'female', parentUnionId: 'u3', unionIds: [] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['ggm'], childrenIds: ['gm'] },
        u2: { id: 'u2', partnerIds: ['gm'], childrenIds: ['mother'] },
        u3: { id: 'u3', partnerIds: ['mother'], childrenIds: ['daughter'] },
      },
    };

    const toGgm = findRelationship(customTree, 'daughter', 'ggm');
    assert.equal(toGgm.category, 'direct');
    assert.equal(toGgm.relationshipName, 'Great-grandmother');
    assert.equal(toGgm.inverseRelationshipName, 'Great-granddaughter');
    assert.equal(toGgm.generationDifference, -3);

    const toGgd = findRelationship(customTree, 'ggm', 'daughter');
    assert.equal(toGgd.relationshipName, 'Great-granddaughter');
    assert.equal(toGgd.inverseRelationshipName, 'Great-grandmother');
    assert.equal(toGgd.generationDifference, 3);
  });

  test('Siblings: Brother and Sister', () => {
    // me (male) -> sibling_me (female)
    const toSister = findRelationship(doubleInLawTree, 'me', 'sibling_me');
    assert.equal(toSister.category, 'sibling');
    assert.equal(toSister.relationshipName, 'Sister');
    assert.equal(toSister.inverseRelationshipName, 'Brother');
    assert.equal(toSister.generationDifference, 0);
    assert.equal(toSister.isConsanguineous, true);

    // sibling_me (female) -> me (male)
    const toBrother = findRelationship(doubleInLawTree, 'sibling_me', 'me');
    assert.equal(toBrother.relationshipName, 'Brother');
    assert.equal(toBrother.inverseRelationshipName, 'Sister');

    // dad (male) -> uncle (male)
    const dadToUncle = findRelationship(doubleInLawTree, 'dad', 'uncle');
    assert.equal(dadToUncle.relationshipName, 'Brother');
    assert.equal(dadToUncle.inverseRelationshipName, 'Brother');
  });

  test('Aunts and Uncles, Nieces and Nephews', () => {
    // me (male) -> uncle (male)
    const toUncle = findRelationship(doubleInLawTree, 'me', 'uncle');
    assert.equal(toUncle.category, 'collateral');
    assert.equal(toUncle.relationshipName, 'Uncle');
    assert.equal(toUncle.inverseRelationshipName, 'Nephew');
    assert.equal(toUncle.generationDifference, -1);
    assert.equal(toUncle.isConsanguineous, true);

    // uncle (male) -> me (male)
    const fromUncleToMe = findRelationship(doubleInLawTree, 'uncle', 'me');
    assert.equal(fromUncleToMe.category, 'collateral');
    assert.equal(fromUncleToMe.relationshipName, 'Nephew');
    assert.equal(fromUncleToMe.inverseRelationshipName, 'Uncle');
    assert.equal(fromUncleToMe.generationDifference, 1);

    // uncle -> sibling_me (female)
    const uncleToNiece = findRelationship(doubleInLawTree, 'uncle', 'sibling_me');
    assert.equal(uncleToNiece.relationshipName, 'Niece');
    assert.equal(uncleToNiece.inverseRelationshipName, 'Uncle');

    // me -> aunt (female)
    const toAunt = findRelationship(doubleInLawTree, 'me', 'aunt');
    assert.equal(toAunt.relationshipName, 'Aunt');
    assert.equal(toAunt.inverseRelationshipName, 'Nephew');
  });

  test('Great-aunts and Great-uncles', () => {
    // In doubleInLawTree: gf_smith has a sibling if we add one with parents:
    const treeWithGreatAunt: TreeData = {
      ...doubleInLawTree,
      people: {
        ...doubleInLawTree.people,
        ggf_smith: {
          id: 'ggf_smith',
          firstName: 'William',
          lastName: 'Smith',
          gender: 'male',
          unionIds: ['u_great_grandparents'],
        },
        ggm_smith: {
          id: 'ggm_smith',
          firstName: 'Rose',
          lastName: 'Smith',
          gender: 'female',
          unionIds: ['u_great_grandparents'],
        },
        great_aunt_sarah: {
          id: 'great_aunt_sarah',
          firstName: 'Sarah',
          lastName: 'Smith',
          gender: 'female',
          parentUnionId: 'u_great_grandparents',
          unionIds: [],
        },
        gf_smith: {
          ...doubleInLawTree.people.gf_smith,
          parentUnionId: 'u_great_grandparents',
        },
      },
      unions: {
        ...doubleInLawTree.unions,
        u_great_grandparents: {
          id: 'u_great_grandparents',
          partnerIds: ['ggf_smith', 'ggm_smith'],
          childrenIds: ['gf_smith', 'great_aunt_sarah'],
        },
      },
    };

    const toGreatAunt = findRelationship(treeWithGreatAunt, 'me', 'great_aunt_sarah');
    assert.equal(toGreatAunt.category, 'collateral');
    assert.equal(toGreatAunt.relationshipName, 'Great-aunt');
    assert.equal(toGreatAunt.inverseRelationshipName, 'Great-nephew');
    assert.equal(toGreatAunt.generationDifference, -2);
  });

  test('Cousins: Double first cousins in Double In-Law preset', () => {
    // me <-> double_cousin_1 (sons of brothers David & Daniel, and sisters Mary & Margaret)
    const toCousin = findRelationship(doubleInLawTree, 'me', 'double_cousin_1');
    assert.equal(toCousin.category, 'cousin');
    assert.equal(toCousin.relationshipName, 'Double first cousin');
    assert.equal(toCousin.inverseRelationshipName, 'Double first cousin');
    assert.equal(toCousin.generationDifference, 0);
    assert.equal(toCousin.isConsanguineous, true);
  });

  test('Cousins: Standard first cousin and second cousin', () => {
    // Construct standard first cousin tree (only 1 couple shared)
    const cousinTree: TreeData = {
      id: 'cousin_tree',
      name: 'Cousin Tree',
      createdAt: '',
      updatedAt: '',
      people: {
        gp1: { id: 'gp1', firstName: 'Grandpa', gender: 'male', unionIds: ['u_gp'] },
        gp2: { id: 'gp2', firstName: 'Grandma', gender: 'female', unionIds: ['u_gp'] },
        p1: { id: 'p1', firstName: 'Parent 1', gender: 'male', parentUnionId: 'u_gp', unionIds: ['u_p1'] },
        p2: { id: 'p2', firstName: 'Parent 2', gender: 'female', parentUnionId: 'u_gp', unionIds: ['u_p2'] },
        c1: { id: 'c1', firstName: 'Cousin 1', gender: 'male', parentUnionId: 'u_p1', unionIds: ['u_c1'] },
        c2: { id: 'c2', firstName: 'Cousin 2', gender: 'female', parentUnionId: 'u_p2', unionIds: [] },
        second_gen_child: {
          id: 'second_gen_child',
          firstName: 'Second Gen',
          gender: 'male',
          parentUnionId: 'u_c1',
          unionIds: [],
        },
      },
      unions: {
        u_gp: { id: 'u_gp', partnerIds: ['gp1', 'gp2'], childrenIds: ['p1', 'p2'] },
        u_p1: { id: 'u_p1', partnerIds: ['p1'], childrenIds: ['c1'] },
        u_p2: { id: 'u_p2', partnerIds: ['p2'], childrenIds: ['c2'] },
        u_c1: { id: 'u_c1', partnerIds: ['c1'], childrenIds: ['second_gen_child'] },
      },
    };

    const firstCousin = findRelationship(cousinTree, 'c1', 'c2');
    assert.equal(firstCousin.category, 'cousin');
    assert.equal(firstCousin.relationshipName, 'First cousin');

    // c2 to second_gen_child (child of first cousin c1) => First cousin once removed
    const onceRemoved = findRelationship(cousinTree, 'c2', 'second_gen_child');
    assert.equal(onceRemoved.category, 'cousin');
    assert.equal(onceRemoved.relationshipName, 'First cousin once removed');
    assert.equal(onceRemoved.generationDifference, 1);
  });

  test('Direct Spouses and In-Laws', () => {
    // Spouses: dad & mom
    const dadToMom = findRelationship(doubleInLawTree, 'dad', 'mom');
    assert.equal(dadToMom.category, 'spouse');
    assert.equal(dadToMom.relationshipName, 'Wife');
    assert.equal(dadToMom.inverseRelationshipName, 'Husband');

    // In-laws: dad (male) -> gf_miller (mom's father)
    const toFatherInLaw = findRelationship(doubleInLawTree, 'dad', 'gf_miller');
    assert.equal(toFatherInLaw.category, 'in-law');
    assert.equal(toFatherInLaw.relationshipName, 'Father-in-law');
    assert.equal(toFatherInLaw.inverseRelationshipName, 'Son-in-law');

    // In-laws: dad -> aunt (mom's sister)
    const toSisterInLaw = findRelationship(doubleInLawTree, 'dad', 'aunt');
    assert.equal(toSisterInLaw.category, 'in-law');
    assert.equal(toSisterInLaw.relationshipName, 'Sister-in-law');
  });

  test('Divorced / Blended family step-relationships', () => {
    const blendedTree = createDivorceBlendedPreset();

    // p_dan and p_sarah are ex-spouses (divorced)
    const danToSarah = findRelationship(blendedTree, 'p_dan', 'p_sarah');
    assert.equal(danToSarah.category, 'spouse');
    assert.equal(danToSarah.relationshipName, 'Ex-wife');
    assert.equal(danToSarah.inverseRelationshipName, 'Ex-husband');

    // c_shared (Emma) -> p_lisa (Daniel's new wife): Stepmother
    const emmaToLisa = findRelationship(blendedTree, 'c_shared', 'p_lisa');
    assert.equal(emmaToLisa.category, 'step');
    assert.equal(emmaToLisa.relationshipName, 'Stepmother');
    assert.equal(emmaToLisa.inverseRelationshipName, 'Stepdaughter');

    // c_shared (Emma) -> c_dan (Oliver): Half-brother (share father Daniel)
    const emmaToOliver = findRelationship(blendedTree, 'c_shared', 'c_dan');
    assert.equal(emmaToOliver.category, 'sibling');
    assert.equal(emmaToOliver.relationshipName, 'Half-brother');
    assert.equal(emmaToOliver.inverseRelationshipName, 'Half-sister');
  });

  test('Unconnected individuals return No direct relationship', () => {
    const disconnectedTree: TreeData = {
      id: 'disconnected',
      name: 'Disconnected',
      createdAt: '',
      updatedAt: '',
      people: {
        pA: { id: 'pA', firstName: 'Alice', unionIds: [] },
        pB: { id: 'pB', firstName: 'Bob', unionIds: [] },
      },
      unions: {},
    };

    const rel = findRelationship(disconnectedTree, 'pA', 'pB');
    assert.equal(rel.category, 'none');
    assert.equal(rel.relationshipName, 'No direct relationship');
    assert.equal(rel.path.length, 0);
  });

  test('Regression: Married individuals with unconnected targets must never cause stack overflow', () => {
    // Couple 1: Husband1 + Wife1
    // Couple 2: Husband2 + Wife2
    // No connection between them
    const twoCouplesTree: TreeData = {
      id: 'two_couples',
      name: 'Two Couples',
      createdAt: '',
      updatedAt: '',
      people: {
        h1: { id: 'h1', firstName: 'Husband 1', gender: 'male', unionIds: ['u1'] },
        w1: { id: 'w1', firstName: 'Wife 1', gender: 'female', unionIds: ['u1'] },
        h2: { id: 'h2', firstName: 'Husband 2', gender: 'male', unionIds: ['u2'] },
        w2: { id: 'w2', firstName: 'Wife 2', gender: 'female', unionIds: ['u2'] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['h1', 'w1'], childrenIds: [] },
        u2: { id: 'u2', partnerIds: ['h2', 'w2'], childrenIds: [] },
      },
    };

    // Testing across unconnected married couples must terminate cleanly
    const rel1 = findRelationship(twoCouplesTree, 'h1', 'h2');
    assert.equal(rel1.category, 'none');
    assert.equal(rel1.relationshipName, 'No direct relationship');

    const rel2 = findRelationship(twoCouplesTree, 'w1', 'w2');
    assert.equal(rel2.category, 'none');

    const rel3 = findRelationship(twoCouplesTree, 'h1', 'w2');
    assert.equal(rel3.category, 'none');
  });
});
