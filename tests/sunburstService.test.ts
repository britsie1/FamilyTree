import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TreeData } from '../src/types/tree.ts';
import {
  getDirectParents,
  getAncestorRelationshipTitle,
  getLevelDescription,
  extractPedigreeSlots,
  createArcPath,
  buildSunburstLayout,
  getSlotColors,
} from '../src/services/sunburstService.ts';
import {
  formatLifespanWithAge,
  getPersonMaidenNameLabel,
} from '../src/services/displayUtils.ts';
import { createThreeGenSampleTree } from '../src/services/storage.ts';

describe('sunburstService', () => {
  describe('getLevelDescription', () => {
    it('returns accurate descriptions and counts for level 1 to 5', () => {
      const l1 = getLevelDescription(1);
      assert.strictEqual(l1.title, 'Parents');
      assert.strictEqual(l1.outerSlots, 2);
      assert.strictEqual(l1.maxAncestors, 2);

      const l2 = getLevelDescription(2);
      assert.strictEqual(l2.title, 'Grandparents');
      assert.strictEqual(l2.outerSlots, 4);
      assert.strictEqual(l2.maxAncestors, 6);

      const l3 = getLevelDescription(3);
      assert.strictEqual(l3.title, 'Great-grandparents');
      assert.strictEqual(l3.outerSlots, 8);
      assert.strictEqual(l3.maxAncestors, 14);

      const l4 = getLevelDescription(4);
      assert.strictEqual(l4.title, 'Great-great-grandparents');
      assert.strictEqual(l4.outerSlots, 16);
      assert.strictEqual(l4.maxAncestors, 30);

      const l5 = getLevelDescription(5);
      assert.strictEqual(l5.title, '3x Great-grandparents');
      assert.strictEqual(l5.outerSlots, 32);
      assert.strictEqual(l5.maxAncestors, 62);
    });
  });

  describe('getAncestorRelationshipTitle', () => {
    it('generates correct relationship titles based on lineage path and gender', () => {
      // Gen 0
      assert.strictEqual(getAncestorRelationshipTitle(0, []), 'Self (Root)');

      // Gen 1
      assert.strictEqual(getAncestorRelationshipTitle(1, ['father'], 'male'), 'Father');
      assert.strictEqual(getAncestorRelationshipTitle(1, ['mother'], 'female'), 'Mother');

      // Gen 2
      assert.strictEqual(getAncestorRelationshipTitle(2, ['father', 'father'], 'male'), 'Paternal Grandfather');
      assert.strictEqual(getAncestorRelationshipTitle(2, ['father', 'mother'], 'female'), 'Paternal Grandmother');
      assert.strictEqual(getAncestorRelationshipTitle(2, ['mother', 'father'], 'male'), 'Maternal Grandfather');
      assert.strictEqual(getAncestorRelationshipTitle(2, ['mother', 'mother'], 'female'), 'Maternal Grandmother');

      // Gen 3
      assert.strictEqual(getAncestorRelationshipTitle(3, ['father', 'father', 'father'], 'male'), 'Paternal Great-grandfather');
      assert.strictEqual(getAncestorRelationshipTitle(3, ['mother', 'father', 'mother'], 'female'), 'Maternal Great-grandmother');

      // Gen 4 (great-great)
      assert.strictEqual(getAncestorRelationshipTitle(4, ['father', 'father', 'father', 'father'], 'male'), 'Paternal Great-great-grandfather');
      assert.strictEqual(getAncestorRelationshipTitle(4, ['mother', 'mother', 'mother', 'mother'], 'female'), 'Maternal Great-great-grandmother');

      // Gen 5 (3x great)
      assert.strictEqual(getAncestorRelationshipTitle(5, ['father', 'father', 'father', 'father', 'father'], 'male'), 'Paternal 3rd Great-grandfather');
    });
  });

  describe('getDirectParents', () => {
    it('correctly resolves father and mother by gender from unions', () => {
      const tree: TreeData = {
        id: 'test_tree',
        name: 'Test Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child: { id: 'child', firstName: 'Child', gender: 'male', unionIds: [], parentUnionId: 'u1' },
          dad: { id: 'dad', firstName: 'Dad', gender: 'male', unionIds: ['u1'] },
          mom: { id: 'mom', firstName: 'Mom', gender: 'female', unionIds: ['u1'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['child'] },
        },
      };

      const parents = getDirectParents(tree, 'child');
      assert.strictEqual(parents.father?.id, 'dad');
      assert.strictEqual(parents.mother?.id, 'mom');
    });

    it('handles single parent appropriately', () => {
      const tree: TreeData = {
        id: 'test_tree',
        name: 'Test Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child: { id: 'child', firstName: 'Child', gender: 'male', unionIds: [], parentUnionId: 'u1' },
          singleMom: { id: 'singleMom', firstName: 'Mom', gender: 'female', unionIds: ['u1'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['singleMom'], childrenIds: ['child'] },
        },
      };

      const parents = getDirectParents(tree, 'child');
      assert.strictEqual(parents.father, null);
      assert.strictEqual(parents.mother?.id, 'singleMom');
    });

    it('returns null for person with no parents', () => {
      const tree: TreeData = {
        id: 'test_tree',
        name: 'Test Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          root: { id: 'root', firstName: 'Root', unionIds: [] },
        },
        unions: {},
      };

      const parents = getDirectParents(tree, 'root');
      assert.strictEqual(parents.father, null);
      assert.strictEqual(parents.mother, null);
    });
  });

  describe('extractPedigreeSlots', () => {
    it('constructs accurate Ahnentafel slots up to 4 levels', () => {
      // 4-generation tree:
      // g0: child (slot 1)
      // g1: dad (slot 2), mom (slot 3)
      // g2: paternal gf (slot 4), paternal gm (slot 5), maternal gf (slot 6), maternal gm (slot 7)
      // g3: great-grandparents (slots 8-15)
      // g4: great-great-grandparents (slots 16-31)
      const tree: TreeData = {
        id: 'pedigree_tree',
        name: 'Pedigree Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child: { id: 'child', firstName: 'Child', gender: 'female', unionIds: [], parentUnionId: 'u_parents' },
          dad: { id: 'dad', firstName: 'Father', gender: 'male', unionIds: ['u_parents'], parentUnionId: 'u_pg' },
          mom: { id: 'mom', firstName: 'Mother', gender: 'female', unionIds: ['u_parents'], parentUnionId: 'u_mg' },
          pgf: { id: 'pgf', firstName: 'Pat Grandfather', gender: 'male', unionIds: ['u_pg'], parentUnionId: 'u_pgg' },
          pgm: { id: 'pgm', firstName: 'Pat Grandmother', gender: 'female', unionIds: ['u_pg'] },
          mgf: { id: 'mgf', firstName: 'Mat Grandfather', gender: 'male', unionIds: ['u_mg'] },
          mgm: { id: 'mgm', firstName: 'Mat Grandmother', gender: 'female', unionIds: ['u_mg'] },
          pggf: { id: 'pggf', firstName: 'Pat Great-Grandfather', gender: 'male', unionIds: ['u_pgg'], parentUnionId: 'u_pggg' },
          pggm: { id: 'pggm', firstName: 'Pat Great-Grandmother', gender: 'female', unionIds: ['u_pgg'] },
          pgggf: { id: 'pgggf', firstName: 'Pat Great-Great-Grandfather', gender: 'male', unionIds: ['u_pggg'] },
          pgggm: { id: 'pgggm', firstName: 'Pat Great-Great-Grandmother', gender: 'female', unionIds: ['u_pggg'] },
        },
        unions: {
          u_parents: { id: 'u_parents', partnerIds: ['dad', 'mom'], childrenIds: ['child'] },
          u_pg: { id: 'u_pg', partnerIds: ['pgf', 'pgm'], childrenIds: ['dad'] },
          u_mg: { id: 'u_mg', partnerIds: ['mgf', 'mgm'], childrenIds: ['mom'] },
          u_pgg: { id: 'u_pgg', partnerIds: ['pggf', 'pggm'], childrenIds: ['pgf'] },
          u_pggg: { id: 'u_pggg', partnerIds: ['pgggf', 'pgggm'], childrenIds: ['pggf'] },
        },
      };

      const slots = extractPedigreeSlots(tree, 'child', 4);
      // Total slots for depth 4: 1 + 2 + 4 + 8 + 16 = 31 slots
      assert.strictEqual(slots.length, 31);

      // Root slot (1)
      assert.strictEqual(slots[0].slotIndex, 1);
      assert.strictEqual(slots[0].person?.id, 'child');
      assert.strictEqual(slots[0].generation, 0);

      // Level 1: Father (2), Mother (3)
      const slot2 = slots.find((s) => s.slotIndex === 2);
      const slot3 = slots.find((s) => s.slotIndex === 3);
      assert.strictEqual(slot2?.person?.id, 'dad');
      assert.strictEqual(slot3?.person?.id, 'mom');
      assert.strictEqual(slot2?.branch, 'paternal');
      assert.strictEqual(slot3?.branch, 'maternal');

      // Level 2: PGF (4), PGM (5), MGF (6), MGM (7)
      const slot4 = slots.find((s) => s.slotIndex === 4);
      const slot5 = slots.find((s) => s.slotIndex === 5);
      const slot6 = slots.find((s) => s.slotIndex === 6);
      const slot7 = slots.find((s) => s.slotIndex === 7);
      assert.strictEqual(slot4?.person?.id, 'pgf');
      assert.strictEqual(slot5?.person?.id, 'pgm');
      assert.strictEqual(slot6?.person?.id, 'mgf');
      assert.strictEqual(slot7?.person?.id, 'mgm');

      // Level 3: Pat Great-Grandfather (8 = 2 * 4), Pat Great-Grandmother (9 = 2 * 4 + 1)
      const slot8 = slots.find((s) => s.slotIndex === 8);
      const slot9 = slots.find((s) => s.slotIndex === 9);
      assert.strictEqual(slot8?.person?.id, 'pggf');
      assert.strictEqual(slot9?.person?.id, 'pggm');
      assert.strictEqual(slot8?.quadrant, 'paternal-father');

      // Level 4: Pat Great-Great-Grandparents (16 = 2 * 8, 17 = 2 * 8 + 1)
      const slot16 = slots.find((s) => s.slotIndex === 16);
      const slot17 = slots.find((s) => s.slotIndex === 17);
      assert.strictEqual(slot16?.person?.id, 'pgggf');
      assert.strictEqual(slot17?.person?.id, 'pgggm');
      assert.strictEqual(slot16?.relationshipTitle, 'Paternal Great-great-grandfather');

      // Unfilled slots should exist with person: null
      const slot18 = slots.find((s) => s.slotIndex === 18);
      assert.ok(slot18);
      assert.strictEqual(slot18.person, null);
      assert.strictEqual(slot18.generation, 4);
    });
  });

  describe('createArcPath', () => {
    it('produces valid SVG annular arc path string', () => {
      const path = createArcPath(100, 150, 0, Math.PI / 2);
      assert.ok(path.startsWith('M'));
      assert.ok(path.includes('L'));
      assert.ok(path.includes('A'));
      assert.ok(path.endsWith('Z'));
    });
  });

  describe('buildSunburstLayout', () => {
    it('builds complete layout for sample royal tree', () => {
      const tree = createThreeGenSampleTree();
      const rootId = 'p3'; // Charles Windsor

      const layout = buildSunburstLayout(tree, rootId, {
        maxLevel: 4,
        angleMode: '360',
        colorTheme: 'lineage',
      });

      assert.ok(layout);
      assert.strictEqual(layout.rootPerson.id, 'p3');
      assert.strictEqual(layout.maxLevel, 4);
      // Total ancestor slots for 4 generations = 30
      assert.strictEqual(layout.totalSlots, 30);
      assert.strictEqual(layout.nodes.length, 30); // gen 1..4 (excluding root)
      assert.ok(layout.filledSlots > 0);
      assert.ok(layout.completionPercentage > 0);
      assert.ok(layout.bounds.width > 0);
      assert.ok(layout.bounds.height > 0);
    });

    it('supports 180 degree fan mode', () => {
      const tree = createThreeGenSampleTree();
      const rootId = 'p3';

      const layout = buildSunburstLayout(tree, rootId, {
        maxLevel: 3,
        angleMode: '180',
      });

      assert.ok(layout);
      assert.strictEqual(layout.nodes.length, 14); // 2 + 4 + 8
      assert.ok(layout.bounds.height > 0);
      // Start angle for 180 fan spans from -PI to 0
      const firstGenNode = layout.nodes[0];
      assert.ok(firstGenNode.startAngle >= -Math.PI);
    });

    it('returns null for invalid root person', () => {
      const tree = createThreeGenSampleTree();
      const layout = buildSunburstLayout(tree, 'non_existent_id');
      assert.strictEqual(layout, null);
    });

    it('dynamically sizes each ring according to the longest name in that generation', () => {
      const tree: TreeData = {
        id: 'dynamic_tree',
        name: 'Dynamic Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child: { id: 'child', firstName: 'A', lastName: 'B', unionIds: [], parentUnionId: 'u1' },
          dad: { id: 'dad', firstName: 'Al', lastName: 'Li', gender: 'male', unionIds: ['u1'], parentUnionId: 'u2' },
          mom: { id: 'mom', firstName: 'Jo', lastName: 'Wu', gender: 'female', unionIds: ['u1'] },
          pgf: { id: 'pgf', firstName: 'Alexander', middleNames: 'Bartholomew', lastName: 'Montgomery', gender: 'male', unionIds: ['u2'] },
          pgm: { id: 'pgm', firstName: 'Mary', lastName: 'Jane', gender: 'female', unionIds: ['u2'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['child'] },
          u2: { id: 'u2', partnerIds: ['pgf', 'pgm'], childrenIds: ['dad'] },
        },
      };

      const layout = buildSunburstLayout(tree, 'child', {
        maxLevel: 2,
        dynamicRingSizes: true,
      });

      assert.ok(layout);
      assert.strictEqual(layout.ringRadii.length, 2);

      const gen1Ring = layout.ringRadii[0];
      const gen2Ring = layout.ringRadii[1];

      // Generation 2 has a 20-char name, so its thickness should be significantly larger than Generation 1 (5 chars)
      assert.ok(gen2Ring.thickness > gen1Ring.thickness);
      assert.strictEqual(gen2Ring.longestNameLength, 'Alexander Montgomery'.length);
      assert.strictEqual(gen2Ring.longestName, 'Alexander Montgomery');

      // Test fallback to uniform sizing when dynamicRingSizes is false
      const uniformLayout = buildSunburstLayout(tree, 'child', {
        maxLevel: 2,
        dynamicRingSizes: false,
      });

      assert.ok(uniformLayout);
      assert.strictEqual(uniformLayout.ringRadii[0].thickness, uniformLayout.ringRadii[1].thickness);
    });
  });

  describe('getSlotColors', () => {
    it('returns distinct colors for filled vs empty slots in lineage mode', () => {
      const emptySlot = {
        slotIndex: 4,
        generation: 2,
        person: null,
        relationshipTitle: 'Grandfather',
        lineagePath: ['father' as const, 'father' as const],
        branch: 'paternal' as const,
        quadrant: 'paternal-father' as const,
      };

      const emptyColors = getSlotColors(emptySlot, 'lineage', false);
      assert.ok(emptyColors.fill.includes('rgba'));

      const filledSlot = {
        ...emptySlot,
        person: { id: 'p1', firstName: 'John', unionIds: [] },
      };

      const filledColors = getSlotColors(filledSlot, 'lineage', false);
      assert.notStrictEqual(filledColors.fill, emptyColors.fill);
    });

    it('supports generation and gender themes', () => {
      const slot = {
        slotIndex: 2,
        generation: 1,
        person: { id: 'p1', firstName: 'John', gender: 'male' as const, unionIds: [] },
        relationshipTitle: 'Father',
        lineagePath: ['father' as const],
        branch: 'paternal' as const,
      };

      const genColors = getSlotColors(slot, 'generation', false);
      assert.ok(genColors.fill);

      const genderColors = getSlotColors(slot, 'gender', false);
      assert.ok(genderColors.fill);
    });

    it('supports antique parchment palette in light and dark modes', () => {
      const slot = {
        slotIndex: 4,
        generation: 2,
        person: { id: 'p1', firstName: 'John', unionIds: [] },
        relationshipTitle: 'Grandfather',
        lineagePath: ['father' as const, 'father' as const],
        branch: 'paternal' as const,
        quadrant: 'paternal-father' as const,
      };

      const lightParchment = getSlotColors(slot, 'parchment', false);
      assert.strictEqual(lightParchment.fill, '#ecdcc9');
      assert.strictEqual(lightParchment.text, '#3e2917');

      const darkParchment = getSlotColors(slot, 'parchment', true);
      assert.strictEqual(darkParchment.fill, '#382a20');

      const emptySlot = { ...slot, person: null };
      const emptyParchment = getSlotColors(emptySlot, 'parchment', false);
      assert.ok(emptyParchment.fill.includes('rgba'));
    });
  });

  describe('formatLifespanWithAge', () => {
    it('formats both birth and death year with age in brackets', () => {
      const person = {
        id: 'p1',
        firstName: 'George',
        lastName: 'Windsor',
        gender: 'male' as const,
        birthDate: '1895-12-14',
        deathDate: '1952-02-06',
        unionIds: [],
      };
      assert.strictEqual(formatLifespanWithAge(person), '1895 – 1952 (56)');
    });

    it('formats living person with b. and omits age', () => {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - 30;
      const person = {
        id: 'p2',
        firstName: 'Alice',
        gender: 'female' as const,
        birthDate: `${birthYear}-01-01`,
        unionIds: [],
      };
      const result = formatLifespanWithAge(person);
      assert.strictEqual(result, `b. ${birthYear}`);
    });

    it('formats deceased person with only birth date with dagger symbol', () => {
      const person = {
        id: 'p3',
        firstName: 'Arthur',
        birthDate: '1850',
        isDeceased: true,
        unionIds: [],
      };
      assert.strictEqual(formatLifespanWithAge(person), 'b. 1850 (†)');
    });

    it('formats person with only death date with d.', () => {
      const person = {
        id: 'p4',
        firstName: 'Mary',
        deathDate: '1945',
        unionIds: [],
      };
      assert.strictEqual(formatLifespanWithAge(person), 'd. 1945');
    });

    it('returns empty string for null or empty person', () => {
      assert.strictEqual(formatLifespanWithAge(null), '');
      assert.strictEqual(formatLifespanWithAge(undefined), '');
    });
  });

  describe('getPersonMaidenNameLabel', () => {
    it('returns née {maidenName} when maidenName is present', () => {
      const person = {
        id: 'p1',
        firstName: 'Elizabeth',
        lastName: 'Windsor',
        maidenName: 'Bowes-Lyon',
        gender: 'female' as const,
        unionIds: [],
      };
      assert.strictEqual(getPersonMaidenNameLabel(person), 'née Bowes-Lyon');
    });

    it('trims whitespace from maidenName', () => {
      const person = {
        id: 'p2',
        firstName: 'Mary',
        maidenName: '  Spencer  ',
        gender: 'female' as const,
        unionIds: [],
      };
      assert.strictEqual(getPersonMaidenNameLabel(person), 'née Spencer');
    });

    it('returns empty string when maidenName is missing or empty', () => {
      const person = {
        id: 'p3',
        firstName: 'Anne',
        maidenName: '',
        gender: 'female' as const,
        unionIds: [],
      };
      assert.strictEqual(getPersonMaidenNameLabel(person), '');
      assert.strictEqual(getPersonMaidenNameLabel(null), '');
    });
  });

  describe('maiden name dynamic ring sizing', () => {
    it('sizes rings to accommodate maiden names if longer than first/last name', () => {
      const tree: TreeData = {
        id: 'test_tree',
        name: 'Test Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child: { id: 'child', firstName: 'Child', gender: 'male', unionIds: [], parentUnionId: 'u1' },
          dad: { id: 'dad', firstName: 'Dad', lastName: 'Short', gender: 'male', unionIds: ['u1'] },
          mom: {
            id: 'mom',
            firstName: 'Ana',
            lastName: 'Short',
            maidenName: 'VeryLongAncestralMaidenFamilyName',
            gender: 'female',
            unionIds: ['u1'],
          },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['child'] },
        },
      };

      const layout = buildSunburstLayout(tree, 'child', {
        maxLevel: 1,
        dynamicRingSizes: true,
      });

      assert.ok(layout);
      const gen1Ring = layout.ringRadii[0];
      // The longest string in Gen 1 should be the maiden name 'née VeryLongAncestralMaidenFamilyName'
      assert.strictEqual(gen1Ring.longestName, 'née VeryLongAncestralMaidenFamilyName');
      assert.strictEqual(gen1Ring.longestNameLength, 'née VeryLongAncestralMaidenFamilyName'.length);
    });

    it('adjusts root radius dynamically if root person has long maiden name', () => {
      const tree: TreeData = {
        id: 'test_tree',
        name: 'Test Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          root: {
            id: 'root',
            firstName: 'Ana',
            lastName: 'Li',
            maidenName: 'VeryLongAncestralMaidenFamilyName',
            gender: 'female',
            unionIds: [],
          },
        },
        unions: {},
      };

      const layout = buildSunburstLayout(tree, 'root', {
        maxLevel: 1,
        dynamicRingSizes: true,
      });

      assert.ok(layout);
      // Root radius should be comfortably sized for the maiden name
      assert.ok(layout.rootNode.radius > 74);
    });
  });
});
