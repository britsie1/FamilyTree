import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeLayout,
  CARD_WIDTH,
  HORIZONTAL_SPACING,
} from '../src/services/layoutEngine.ts';
import {
  createDivorceBlendedPreset,
} from '../src/services/storage.ts';
import { clearManualPositions } from '../src/services/treeOperations.ts';
import { userExportedTree } from './layoutEngine.test.ts';
import type { TreeData } from '../src/types/tree.ts';

// Canonical Test Trees
export function createSingleFamilyTree(): TreeData {
  return {
    id: 'single_family_3kids',
    name: 'Single Family (3 kids)',
    createdAt: '',
    updatedAt: '',
    people: {
      dad: { id: 'dad', firstName: 'Dad', unionIds: ['u1'] },
      mom: { id: 'mom', firstName: 'Mom', unionIds: ['u1'] },
      c1: { id: 'c1', firstName: 'Child 1', parentUnionId: 'u1', unionIds: [] },
      c2: { id: 'c2', firstName: 'Child 2', parentUnionId: 'u1', unionIds: [] },
      c3: { id: 'c3', firstName: 'Child 3', parentUnionId: 'u1', unionIds: [] },
    },
    unions: {
      u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['c1', 'c2', 'c3'] },
    },
    rootPersonId: 'dad',
  };
}

export function createSingleChildFamilyTree(): TreeData {
  return {
    id: 'single_family_1kid',
    name: 'Single Family (1 kid)',
    createdAt: '',
    updatedAt: '',
    people: {
      dad: { id: 'dad', firstName: 'Dad', unionIds: ['u1'] },
      mom: { id: 'mom', firstName: 'Mom', unionIds: ['u1'] },
      c1: { id: 'c1', firstName: 'Child 1', parentUnionId: 'u1', unionIds: [] },
    },
    unions: {
      u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['c1'] },
    },
    rootPersonId: 'dad',
  };
}

export function createTwoFamiliesUnevenTree(): TreeData {
  return {
    id: 'two_families_uneven',
    name: 'Two Families Uneven',
    createdAt: '',
    updatedAt: '',
    people: {
      dad1: { id: 'dad1', firstName: 'Dad 1', unionIds: ['u1'] },
      mom1: { id: 'mom1', firstName: 'Mom 1', unionIds: ['u1'] },
      c1: { id: 'c1', firstName: 'Child 1', parentUnionId: 'u1', unionIds: [] },

      dad2: { id: 'dad2', firstName: 'Dad 2', unionIds: ['u2'] },
      mom2: { id: 'mom2', firstName: 'Mom 2', unionIds: ['u2'] },
      c2: { id: 'c2', firstName: 'Child 2', parentUnionId: 'u2', unionIds: [] },
      c3: { id: 'c3', firstName: 'Child 3', parentUnionId: 'u2', unionIds: [] },
      c4: { id: 'c4', firstName: 'Child 4', parentUnionId: 'u2', unionIds: [] },
    },
    unions: {
      u1: { id: 'u1', partnerIds: ['dad1', 'mom1'], childrenIds: ['c1'] },
      u2: { id: 'u2', partnerIds: ['dad2', 'mom2'], childrenIds: ['c2', 'c3', 'c4'] },
    },
    rootPersonId: 'dad1',
  };
}

export function createThreeGenBranchingTree(): TreeData {
  return {
    id: 'three_gen_branching',
    name: 'Three Gen Branching',
    createdAt: '',
    updatedAt: '',
    people: {
      gf: { id: 'gf', firstName: 'Grandfather', unionIds: ['u_gp'] },
      gm: { id: 'gm', firstName: 'Grandmother', unionIds: ['u_gp'] },

      dad: { id: 'dad', firstName: 'Dad', parentUnionId: 'u_gp', unionIds: ['u1'] },
      mom: { id: 'mom', firstName: 'Mom', unionIds: ['u1'] },
      c1: { id: 'c1', firstName: 'Child 1', parentUnionId: 'u1', unionIds: [] },

      uncle: { id: 'uncle', firstName: 'Uncle', parentUnionId: 'u_gp', unionIds: ['u2'] },
      aunt: { id: 'aunt', firstName: 'Aunt', unionIds: ['u2'] },
      c2: { id: 'c2', firstName: 'Child 2', parentUnionId: 'u2', unionIds: [] },
      c3: { id: 'c3', firstName: 'Child 3', parentUnionId: 'u2', unionIds: [] },
    },
    unions: {
      u_gp: { id: 'u_gp', partnerIds: ['gf', 'gm'], childrenIds: ['dad', 'uncle'] },
      u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['c1'] },
      u2: { id: 'u2', partnerIds: ['uncle', 'aunt'], childrenIds: ['c2', 'c3'] },
    },
    rootPersonId: 'dad',
  };
}

describe('Adjusted Spacing Logic & Coordinate Verification', () => {
  it('Case 1: Single Family (Couple + 3 Kids) - widest row does not exceed 780px and parents center over kids', () => {
    const tree = createSingleFamilyTree();
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    // Gen 1: 3 children (780px, widest row)
    const c1 = layout.nodes['c1'];
    const c2 = layout.nodes['c2'];
    const c3 = layout.nodes['c3'];
    assert.strictEqual(c1.x, -390, 'c1 should be at -390');
    assert.strictEqual(c2.x, -110, 'c2 should be at -110');
    assert.strictEqual(c3.x, 170, 'c3 should be at 170');

    const gen1Width = (c3.x + CARD_WIDTH) - c1.x;
    assert.strictEqual(gen1Width, 780, 'Widest row should be exactly 780px and not become any wider');

    // Gen 0: 2 parents (500px, centered at 0 over children)
    const dad = layout.nodes['dad'];
    const mom = layout.nodes['mom'];
    assert.strictEqual(dad.x, -250, 'dad should be at -250');
    assert.strictEqual(mom.x, 30, 'mom should be at 30');

    const parentsCenter = (dad.x + mom.x + CARD_WIDTH) / 2;
    const kidsCenter = (c1.x + c3.x + CARD_WIDTH) / 2;
    assert.strictEqual(parentsCenter, kidsCenter, 'Parents center should align with kids center at 0');
  });

  it('Case 2: Single Family (Couple + 1 Kid) - widest row is parents (500px) and child centers under parents', () => {
    const tree = createSingleChildFamilyTree();
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    const dad = layout.nodes['dad'];
    const mom = layout.nodes['mom'];
    const c1 = layout.nodes['c1'];

    assert.strictEqual(dad.x, -250, 'dad should be at -250');
    assert.strictEqual(mom.x, 30, 'mom should be at 30');
    assert.strictEqual(c1.x, -110, 'c1 should be centered at 0 (-110)');

    const gen0Width = (mom.x + CARD_WIDTH) - dad.x;
    assert.strictEqual(gen0Width, 500, 'Widest row (parents) should be 500px and not become any wider');
  });

  it('Case 3: Two Uneven Families Side-by-Side - widest row does not exceed 1060px and parents align over children', () => {
    const tree = createTwoFamiliesUnevenTree();
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    const dad1 = layout.nodes['dad1'];
    const mom1 = layout.nodes['mom1'];
    const dad2 = layout.nodes['dad2'];
    const mom2 = layout.nodes['mom2'];
    const c1 = layout.nodes['c1'];
    const c2 = layout.nodes['c2'];
    const c3 = layout.nodes['c3'];
    const c4 = layout.nodes['c4'];

    assert.strictEqual(dad1.x, -600, 'dad1 should be at -600');
    assert.strictEqual(mom1.x, -320, 'mom1 should be at -320');
    assert.strictEqual(dad2.x, -40, 'dad2 should be at -40');
    assert.strictEqual(mom2.x, 240, 'mom2 should be at 240');

    assert.strictEqual(c1.x, -460, 'c1 should be centered under Fam 1 parents at -350');
    assert.strictEqual(c2.x, -180, 'c2 should be at -180');
    assert.strictEqual(c3.x, 100, 'c3 should be at 100');
    assert.strictEqual(c4.x, 380, 'c4 should be at 380');

    // Check widest row width constraint
    const gen0Width = (mom2.x + CARD_WIDTH) - dad1.x;
    const gen1Width = (c4.x + CARD_WIDTH) - c1.x;
    assert.strictEqual(gen0Width, 1060, 'Gen 0 width should not exceed 1060px');
    assert.strictEqual(gen1Width, 1060, 'Gen 1 width should not exceed 1060px');

    // Check alignments
    const fam1ParentsCenter = (dad1.x + mom1.x + CARD_WIDTH) / 2;
    const fam1ChildCenter = c1.x + CARD_WIDTH / 2;
    assert.strictEqual(fam1ParentsCenter, fam1ChildCenter, 'Fam 1 parents center should match C1 center (-350)');

    const fam2ParentsCenter = (dad2.x + mom2.x + CARD_WIDTH) / 2;
    const fam2KidsCenter = (c2.x + c4.x + CARD_WIDTH) / 2;
    assert.strictEqual(fam2ParentsCenter, fam2KidsCenter, 'Fam 2 parents center should match Fam 2 kids center (210)');

    // Check inter-family gaps: at tightest point it is 60px
    const gen0InterGap = dad2.x - (mom1.x + CARD_WIDTH);
    assert.strictEqual(gen0InterGap, 60, 'Gap between mom1 and dad2 should be 60px');

    const gen1InterGap = c2.x - (c1.x + CARD_WIDTH);
    assert.strictEqual(gen1InterGap, 60, 'Gap between c1 and c2 should be 60px');
  });

  it('Case 4: Three Generations Branching - widest row does not exceed 1060px and grandparents align over sons', () => {
    const tree = createThreeGenBranchingTree();
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    const gf = layout.nodes['gf'];
    const gm = layout.nodes['gm'];
    const dad = layout.nodes['dad'];
    const mom = layout.nodes['mom'];
    const uncle = layout.nodes['uncle'];
    const aunt = layout.nodes['aunt'];
    const c1 = layout.nodes['c1'];
    const c2 = layout.nodes['c2'];
    const c3 = layout.nodes['c3'];

    // Gen 1 is widest row (1060px)
    assert.strictEqual(dad.x, -530, 'dad should be at -530');
    assert.strictEqual(mom.x, -250, 'mom should be at -250');
    assert.strictEqual(uncle.x, 30, 'uncle should be at 30');
    assert.strictEqual(aunt.x, 310, 'aunt should be at 310');

    const gen1Width = (aunt.x + CARD_WIDTH) - dad.x;
    assert.strictEqual(gen1Width, 1060, 'Gen 1 widest row should be 1060px');

    // Gen 2 children align under parents
    assert.strictEqual(c1.x, -390, 'c1 should be centered under dad & mom (-280)');
    assert.strictEqual(c2.x, 30, 'c2 should be at 30');
    assert.strictEqual(c3.x, 310, 'c3 should be at 310');

    // Gen 0 Grandparents center over sons Dad (-420 center) and Uncle (140 center): midpoint = -140
    assert.strictEqual(gf.x, -390, 'gf should be at -390');
    assert.strictEqual(gm.x, -110, 'gm should be at -110');
    const gpCenter = (gf.x + gm.x + CARD_WIDTH) / 2;
    assert.strictEqual(gpCenter, -140, 'Grandparents center should be -140');
  });

  it('Case 5: Divorce & Blended Family - widest row does not exceed 1060px and all children align under parents', () => {
    const tree = createDivorceBlendedPreset();
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    const lisa = layout.nodes['p_lisa'];
    const dan = layout.nodes['p_dan'];
    const sarah = layout.nodes['p_sarah'];
    const mark = layout.nodes['p_mark'];

    const oliver = layout.nodes['c_dan'];
    const emma = layout.nodes['c_shared'];
    const sophia = layout.nodes['c_sarah'];

    // Gen 0 widest row (1060px)
    assert.strictEqual(lisa.x, -530);
    assert.strictEqual(dan.x, -250);
    assert.strictEqual(sarah.x, 30);
    assert.strictEqual(mark.x, 310);
    const gen0Width = (mark.x + CARD_WIDTH) - lisa.x;
    assert.strictEqual(gen0Width, 1060, 'Gen 0 width should be 1060px');

    // Children centered under their respective parent unions
    // Oliver under Lisa & Dan (-280)
    assert.strictEqual(oliver.x, -390);
    assert.strictEqual(oliver.x + CARD_WIDTH / 2, -280);

    // Emma under Dan & Sarah (0)
    assert.strictEqual(emma.x, -110);
    assert.strictEqual(emma.x + CARD_WIDTH / 2, 0);

    // Sophia under Sarah & Mark (280)
    assert.strictEqual(sophia.x, 170);
    assert.strictEqual(sophia.x + CARD_WIDTH / 2, 280);
  });

  it('Case 6: User Exported Tree - widest row does not exceed 1340px and all nodes align without overlaps', () => {
    const tree = clearManualPositions(userExportedTree);
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    const gen1Nodes = Object.values(layout.nodes).filter(n => n.generation === 1).sort((a, b) => a.x - b.x);
    const gen2Nodes = Object.values(layout.nodes).filter(n => n.generation === 2).sort((a, b) => a.x - b.x);

    const gen1Width = (gen1Nodes[gen1Nodes.length - 1].x + CARD_WIDTH) - gen1Nodes[0].x;
    const gen2Width = (gen2Nodes[gen2Nodes.length - 1].x + CARD_WIDTH) - gen2Nodes[0].x;

    assert.strictEqual(gen1Width, 4420, 'Gen 1 width should be exactly 4420px for 16 nodes');
    assert.strictEqual(gen2Width, 4420, 'Gen 2 width should be exactly 4420px for 16 nodes');

    // Verify all generations have non-overlapping nodes with at least 60px gap
    const nodesByGen: Record<number, typeof layout.nodes[string][]> = {};
    for (const node of Object.values(layout.nodes)) {
      if (!nodesByGen[node.generation]) nodesByGen[node.generation] = [];
      nodesByGen[node.generation].push(node);
    }
    for (const [gen, nodes] of Object.entries(nodesByGen)) {
      nodes.sort((a, b) => a.x - b.x);
      for (let i = 0; i < nodes.length - 1; i++) {
        const left = nodes[i];
        const right = nodes[i + 1];
        assert(
          right.x >= left.x + CARD_WIDTH + HORIZONTAL_SPACING - 1,
          `Overlap in gen ${gen}: ${left.id} and ${right.id}`
        );
      }
    }
  });

  it('Case 7: Toggle functionality: reverts to uniform equidistant layout when adjustSpacing is false', () => {
    const tree = createTwoFamiliesUnevenTree();
    const layoutAdjusted = computeLayout(tree, 'vertical', false, undefined, true);
    const layoutUniform = computeLayout(tree, 'vertical', false, undefined, false);

    // In uniform layout, all 4 nodes in Gen 0 (dad1, mom1, dad2, mom2) have equal 60px gaps
    const gen0Uniform = Object.values(layoutUniform.nodes).filter(n => n.generation === 0).sort((a, b) => a.x - b.x);
    const gap1 = gen0Uniform[1].x - (gen0Uniform[0].x + CARD_WIDTH);
    const gap2 = gen0Uniform[2].x - (gen0Uniform[1].x + CARD_WIDTH);
    const gap3 = gen0Uniform[3].x - (gen0Uniform[2].x + CARD_WIDTH);
    assert.strictEqual(gap1, HORIZONTAL_SPACING);
    assert.strictEqual(gap2, HORIZONTAL_SPACING);
    assert.strictEqual(gap3, HORIZONTAL_SPACING);

    // In adjusted layout, C1 (-460) is positioned under Fam 1 parents, differing from uniform layout (-530)
    assert.notStrictEqual(layoutAdjusted.nodes['c1'].x, layoutUniform.nodes['c1'].x);
  });
});
