import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeLayout } from '../src/services/layoutEngine.ts';
import {
  createDoubleInLawPreset,
  createThreeGenSampleTree,
  createDivorceBlendedPreset,
} from '../src/services/storage.ts';
import { userExportedTree } from './layoutEngine.test.ts';
import type { TreeData, LayoutEdge } from '../src/types/tree.ts';

export interface Segment {
  edgeId: string;
  edgeType: string;
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isVertical: boolean;
}

export interface OverlapResult {
  seg1: Segment;
  seg2: Segment;
  overlapLength: number;
}

/**
 * Extracts straight line segments from an SVG pathD string.
 * Handles M (move), L (line), and A (bridge-hop arc) commands.
 */
export function extractSegments(edge: LayoutEdge): Segment[] {
  const segments: Segment[] = [];
  const tokens = edge.pathD.trim().split(/\s+/);
  let i = 0;
  let currX = 0;
  let currY = 0;

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === 'M') {
      currX = parseFloat(tokens[i + 1]);
      currY = parseFloat(tokens[i + 2]);
      i += 3;
    } else if (cmd === 'L') {
      const nextX = parseFloat(tokens[i + 1]);
      const nextY = parseFloat(tokens[i + 2]);
      const isVert = Math.abs(currX - nextX) < 0.1;
      const isHoriz = Math.abs(currY - nextY) < 0.1;
      if (isVert || isHoriz) {
        segments.push({
          edgeId: edge.id,
          edgeType: edge.edgeType,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          x1: currX,
          y1: currY,
          x2: nextX,
          y2: nextY,
          isVertical: isVert,
        });
      }
      currX = nextX;
      currY = nextY;
      i += 3;
    } else if (cmd === 'A') {
      // SVG arc command: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
      currX = parseFloat(tokens[i + 6]);
      currY = parseFloat(tokens[i + 7]);
      i += 8;
    } else {
      i++;
    }
  }

  return segments;
}

/**
 * Detects any collinear overlapping line segments between distinct edges.
 */
export function findCollinearOverlaps(edges: LayoutEdge[], tolerance: number = 1.0): OverlapResult[] {
  const allSegments: Segment[] = [];
  for (const edge of edges) {
    allSegments.push(...extractSegments(edge));
  }

  const overlaps: OverlapResult[] = [];

  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const s1 = allSegments[i];
      const s2 = allSegments[j];

      if (s1.edgeId === s2.edgeId) continue;

      // Check horizontal collinear overlap
      if (!s1.isVertical && !s2.isVertical) {
        if (Math.abs(s1.y1 - s2.y1) < tolerance) {
          const s1MinX = Math.min(s1.x1, s1.x2);
          const s1MaxX = Math.max(s1.x1, s1.x2);
          const s2MinX = Math.min(s2.x1, s2.x2);
          const s2MaxX = Math.max(s2.x1, s2.x2);

          const start = Math.max(s1MinX, s2MinX);
          const end = Math.min(s1MaxX, s2MaxX);
          const overlap = end - start;

          if (overlap > tolerance) {
            overlaps.push({ seg1: s1, seg2: s2, overlapLength: Math.round(overlap * 10) / 10 });
          }
        }
      }

      // Check vertical collinear overlap
      if (s1.isVertical && s2.isVertical) {
        if (Math.abs(s1.x1 - s2.x1) < tolerance) {
          const s1MinY = Math.min(s1.y1, s1.y2);
          const s1MaxY = Math.max(s1.y1, s1.y2);
          const s2MinY = Math.min(s2.y1, s2.y2);
          const s2MaxY = Math.max(s2.y1, s2.y2);

          const start = Math.max(s1MinY, s2MinY);
          const end = Math.min(s1MaxY, s2MaxY);
          const overlap = end - start;

          if (overlap > tolerance) {
            overlaps.push({ seg1: s1, seg2: s2, overlapLength: Math.round(overlap * 10) / 10 });
          }
        }
      }
    }
  }

  return overlaps;
}

function assertNoLineOverlaps(tree: TreeData, layoutStyle: 'vertical' | 'horizontal' = 'vertical') {
  const layout = computeLayout(tree, layoutStyle);
  const overlaps = findCollinearOverlaps(layout.edges);

  if (overlaps.length > 0) {
    const details = overlaps
      .map(
        (o) =>
          `  - Overlap (${o.overlapLength}px): [${o.seg1.edgeId}] (${o.seg1.x1},${o.seg1.y1})->(${o.seg1.x2},${o.seg1.y2}) with [${o.seg2.edgeId}] (${o.seg2.x1},${o.seg2.y1})->(${o.seg2.x2},${o.seg2.y2})`
      )
      .join('\n');
    assert.fail(
      `Found ${overlaps.length} line overlap(s) in tree "${tree.name || tree.id}" (${layoutStyle} mode):\n${details}`
    );
  }
}

describe('Line Overlap Prevention', () => {
  describe('Preset Trees: Zero Line Overlaps', () => {
    it('Double In-Law preset has zero line overlaps in vertical mode', () => {
      assertNoLineOverlaps(createDoubleInLawPreset(), 'vertical');
    });

    it('Double In-Law preset has zero line overlaps in horizontal mode', () => {
      assertNoLineOverlaps(createDoubleInLawPreset(), 'horizontal');
    });

    it('Three-Generation sample tree has zero line overlaps in vertical mode', () => {
      assertNoLineOverlaps(createThreeGenSampleTree(), 'vertical');
    });

    it('Three-Generation sample tree has zero line overlaps in horizontal mode', () => {
      assertNoLineOverlaps(createThreeGenSampleTree(), 'horizontal');
    });

    it('Divorce & Remarriage blended preset has zero line overlaps in vertical mode', () => {
      assertNoLineOverlaps(createDivorceBlendedPreset(), 'vertical');
    });

    it('Divorce & Remarriage blended preset has zero line overlaps in horizontal mode', () => {
      assertNoLineOverlaps(createDivorceBlendedPreset(), 'horizontal');
    });
  });

  describe('Complex & Edge-Case User Trees: Zero Line Overlaps', () => {
    it('User Exported Tree has zero line overlaps in vertical mode', () => {
      assertNoLineOverlaps(userExportedTree, 'vertical');
    });

    it('User Exported Tree has zero line overlaps in horizontal mode', () => {
      assertNoLineOverlaps(userExportedTree, 'horizontal');
    });

    it('User Edge Case Tree (with multiple unions, orphan unions, and remarriages) has zero line overlaps', () => {
      const userEdgeCaseTree: TreeData = {
        id: 'tree_double_in_law_edge_case',
        name: 'Double In-Law Marriage (Edge Case with Remarriages)',
        createdAt: '2026-09-07T09:00:08.904Z',
        updatedAt: '2026-09-07T09:48:35.685Z',
        people: {
          gf_smith: {
            id: 'gf_smith',
            firstName: 'Johannes',
            lastName: 'Brits',
            gender: 'male',
            unionIds: ['u_smith_grandparents'],
            parentUnionId: 'u_parents_z6qi9yz_mtr0j5ba',
          },
          parent_5cv7tb4_mtr0j5ba: {
            id: 'parent_5cv7tb4_mtr0j5ba',
            firstName: 'Jurie',
            lastName: 'Brits',
            gender: 'unspecified',
            unionIds: ['u_parents_z6qi9yz_mtr0j5ba', 'u_u8i6my7_mtr0jgdr', 'u_vhziwou_mtr159sx'],
            parentUnionId: 'u_parents_k8agv8s_mtr0p23l',
          },
          child_xseaxab_mtr0n7zw: {
            id: 'child_xseaxab_mtr0n7zw',
            firstName: 'Jacobus',
            lastName: 'Brits',
            gender: 'unspecified',
            unionIds: [],
            parentUnionId: 'u_parents_z6qi9yz_mtr0j5ba',
          },
          child_m6okaw7_mtr0nf0t: {
            id: 'child_m6okaw7_mtr0nf0t',
            firstName: 'Carlynne',
            lastName: 'Viljoen',
            gender: 'unspecified',
            unionIds: [],
            parentUnionId: 'u_parents_z6qi9yz_mtr0j5ba',
          },
          parent_reqwnvg_mtr17ezd: {
            id: 'parent_reqwnvg_mtr17ezd',
            firstName: 'Riana',
            lastName: 'Brits',
            gender: 'female',
            unionIds: ['u_parents_z6qi9yz_mtr0j5ba'],
            parentUnionId: 'u_parents_baep1oe_mtr18zda',
          },
          parent_9lmvc3d_mtr18zda: {
            id: 'parent_9lmvc3d_mtr18zda',
            firstName: 'Johannes',
            lastName: 'Du Plessis',
            gender: 'male',
            unionIds: ['u_parents_baep1oe_mtr18zda', 'u_o4aeqm2_mtr1ezve'],
          },
          sibling_m9lio21_mtr18zda: {
            id: 'sibling_m9lio21_mtr18zda',
            firstName: 'Marinda',
            lastName: 'Bezuidenhout',
            gender: 'female',
            unionIds: ['u_1bnka5g_mtr1bbpq', 'u_6i7fwzu_mtr1jngz', 'u_parents_6n1xsq6_mtr1lorj'],
            parentUnionId: 'u_parents_baep1oe_mtr18zda',
          },
          sibling_ycmvgyu_mtr1a27c: {
            id: 'sibling_ycmvgyu_mtr1a27c',
            firstName: 'Gerhard',
            lastName: 'Brits',
            gender: 'unspecified',
            unionIds: ['u_1bnka5g_mtr1bbpq', 'u_acg39f3_mtr1bn8s'],
            parentUnionId: 'u_parents_k8agv8s_mtr0p23l',
          },
          partner_iv13dvu_mtr1ezve: {
            id: 'partner_iv13dvu_mtr1ezve',
            firstName: 'Wilhelmina',
            lastName: 'Du Plessis',
            gender: 'female',
            unionIds: ['u_o4aeqm2_mtr1ezve', 'u_parents_baep1oe_mtr18zda'],
          },
          child_j2jnd61_mtr1j4jf: {
            id: 'child_j2jnd61_mtr1j4jf',
            firstName: 'Victoria',
            lastName: 'Brits',
            gender: 'female',
            unionIds: [],
            parentUnionId: 'u_1bnka5g_mtr1bbpq',
          },
          partner_oy0pagc_mtr1jngz: {
            id: 'partner_oy0pagc_mtr1jngz',
            firstName: 'Johan',
            lastName: 'Bezuidenhout',
            gender: 'male',
            unionIds: ['u_6i7fwzu_mtr1jngz', 'u_parents_6n1xsq6_mtr1lorj'],
          },
          child_uww2hzv_mtr1k9ms: {
            id: 'child_uww2hzv_mtr1k9ms',
            firstName: 'Laurika',
            lastName: 'Bezuidenhout',
            gender: 'female',
            unionIds: [],
            parentUnionId: 'u_parents_6n1xsq6_mtr1lorj',
          },
        },
        unions: {
          u_smith_grandparents: {
            id: 'u_smith_grandparents',
            partnerIds: ['gf_smith'],
            childrenIds: [],
            type: 'married',
          },
          u_parents_z6qi9yz_mtr0j5ba: {
            id: 'u_parents_z6qi9yz_mtr0j5ba',
            partnerIds: ['parent_5cv7tb4_mtr0j5ba', 'parent_reqwnvg_mtr17ezd'],
            childrenIds: ['gf_smith', 'child_xseaxab_mtr0n7zw', 'child_m6okaw7_mtr0nf0t'],
            type: 'married',
          },
          u_u8i6my7_mtr0jgdr: {
            id: 'u_u8i6my7_mtr0jgdr',
            partnerIds: ['parent_5cv7tb4_mtr0j5ba'],
            childrenIds: [],
            type: 'married',
          },
          u_parents_k8agv8s_mtr0p23l: {
            id: 'u_parents_k8agv8s_mtr0p23l',
            partnerIds: [],
            childrenIds: ['parent_5cv7tb4_mtr0j5ba', 'sibling_ycmvgyu_mtr1a27c'],
            type: 'married',
          },
          u_vhziwou_mtr159sx: {
            id: 'u_vhziwou_mtr159sx',
            partnerIds: ['parent_5cv7tb4_mtr0j5ba'],
            childrenIds: [],
            type: 'married',
          },
          u_parents_baep1oe_mtr18zda: {
            id: 'u_parents_baep1oe_mtr18zda',
            partnerIds: ['parent_9lmvc3d_mtr18zda', 'partner_iv13dvu_mtr1ezve'],
            childrenIds: ['parent_reqwnvg_mtr17ezd', 'sibling_m9lio21_mtr18zda'],
            type: 'married',
          },
          u_1bnka5g_mtr1bbpq: {
            id: 'u_1bnka5g_mtr1bbpq',
            partnerIds: ['sibling_ycmvgyu_mtr1a27c', 'sibling_m9lio21_mtr18zda'],
            childrenIds: ['child_j2jnd61_mtr1j4jf'],
            type: 'divorced',
          },
          u_acg39f3_mtr1bn8s: {
            id: 'u_acg39f3_mtr1bn8s',
            partnerIds: ['sibling_ycmvgyu_mtr1a27c'],
            childrenIds: [],
            type: 'married',
          },
          u_o4aeqm2_mtr1ezve: {
            id: 'u_o4aeqm2_mtr1ezve',
            partnerIds: ['parent_9lmvc3d_mtr18zda', 'partner_iv13dvu_mtr1ezve'],
            childrenIds: [],
            type: 'married',
          },
          u_6i7fwzu_mtr1jngz: {
            id: 'u_6i7fwzu_mtr1jngz',
            partnerIds: ['sibling_m9lio21_mtr18zda', 'partner_oy0pagc_mtr1jngz'],
            childrenIds: [],
            type: 'divorced',
          },
          u_parents_6n1xsq6_mtr1lorj: {
            id: 'u_parents_6n1xsq6_mtr1lorj',
            partnerIds: ['partner_oy0pagc_mtr1jngz', 'sibling_m9lio21_mtr18zda'],
            childrenIds: ['child_uww2hzv_mtr1k9ms'],
            type: 'married',
          },
        },
        rootPersonId: 'gf_smith',
      };

      assertNoLineOverlaps(userEdgeCaseTree, 'vertical');
      assertNoLineOverlaps(userEdgeCaseTree, 'horizontal');
    });
  });

  describe('Synthetic Edge Cases: Multiple Unions & Bus Routing', () => {
    it('prevents line overlaps when a person has multiple single-parent unions', () => {
      const tree: TreeData = {
        id: 'multi_single_parent',
        name: 'Multiple Single Parent Unions',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          parent: { id: 'parent', firstName: 'Single', lastName: 'Parent', unionIds: ['u1', 'u2', 'u3'], generation: 0 },
          c1: { id: 'c1', firstName: 'Child', lastName: 'One', unionIds: [], parentUnionId: 'u1', generation: 1 },
          c2: { id: 'c2', firstName: 'Child', lastName: 'Two', unionIds: [], parentUnionId: 'u2', generation: 1 },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['parent'], childrenIds: ['c1'] },
          u2: { id: 'u2', partnerIds: ['parent'], childrenIds: ['c2'] },
          u3: { id: 'u3', partnerIds: ['parent'], childrenIds: [] },
        },
      };

      assertNoLineOverlaps(tree, 'vertical');
      assertNoLineOverlaps(tree, 'horizontal');
    });

    it('prevents line overlaps when a couple has multiple unions (remarriage)', () => {
      const tree: TreeData = {
        id: 'remarried_couple',
        name: 'Remarried Couple',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'Person', lastName: 'A', unionIds: ['u1', 'u2'], generation: 0 },
          p2: { id: 'p2', firstName: 'Person', lastName: 'B', unionIds: ['u1', 'u2'], generation: 0 },
          c1: { id: 'c1', firstName: 'Child', lastName: 'One', unionIds: [], parentUnionId: 'u1', generation: 1 },
          c2: { id: 'c2', firstName: 'Child', lastName: 'Two', unionIds: [], parentUnionId: 'u2', generation: 1 },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: ['c1'], type: 'divorced' },
          u2: { id: 'u2', partnerIds: ['p1', 'p2'], childrenIds: ['c2'], type: 'married' },
        },
      };

      assertNoLineOverlaps(tree, 'vertical');
      assertNoLineOverlaps(tree, 'horizontal');
    });

    it('prevents bus bar overlaps when multiple unions have overlapping child X intervals', () => {
      const tree: TreeData = {
        id: 'overlapping_bus_ranges',
        name: 'Overlapping Bus Ranges',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'Parent', lastName: 'A', unionIds: ['u1'], generation: 0 },
          p2: { id: 'p2', firstName: 'Parent', lastName: 'B', unionIds: ['u1'], generation: 0 },
          p3: { id: 'p3', firstName: 'Parent', lastName: 'C', unionIds: ['u2'], generation: 0 },
          p4: { id: 'p4', firstName: 'Parent', lastName: 'D', unionIds: ['u2'], generation: 0 },
          c1: { id: 'c1', firstName: 'C1', lastName: 'X', unionIds: [], parentUnionId: 'u1', generation: 1 },
          c2: { id: 'c2', firstName: 'C2', lastName: 'X', unionIds: [], parentUnionId: 'u1', generation: 1 },
          c3: { id: 'c3', firstName: 'C3', lastName: 'Y', unionIds: [], parentUnionId: 'u2', generation: 1 },
          c4: { id: 'c4', firstName: 'C4', lastName: 'Y', unionIds: [], parentUnionId: 'u2', generation: 1 },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: ['c1', 'c2'] },
          u2: { id: 'u2', partnerIds: ['p3', 'p4'], childrenIds: ['c3', 'c4'] },
        },
      };

      assertNoLineOverlaps(tree, 'vertical');
      assertNoLineOverlaps(tree, 'horizontal');
    });

    it('prevents line overlaps when an individual has multiple non-adjacent unions (successive marriages with intervening nodes)', () => {
      const tree: TreeData = {
        id: 'multi_non_adjacent_spouses',
        name: 'Multiple Non-Adjacent Spouses',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
        people: {
          pb: { id: 'pb', firstName: 'Primary', lastName: 'Brits', gender: 'female', unionIds: ['u_pb_jb'], generation: 0 },
          jb: { id: 'jb', firstName: 'Johannes', lastName: 'Brits', gender: 'male', unionIds: ['u_pb_jb', 'u_jb_un1', 'u_jb_mb', 'u_jb_un2'], generation: 0 },
          un1: { id: 'un1', firstName: 'Unnamed', lastName: 'Person 1', gender: 'female', unionIds: ['u_jb_un1'], generation: 0 },
          mb: { id: 'mb', firstName: 'Maxi', lastName: 'Brits', gender: 'female', unionIds: ['u_jb_mb'], generation: 0 },
          un2: { id: 'un2', firstName: 'Unnamed', lastName: 'Person 2', gender: 'female', unionIds: ['u_jb_un2'], generation: 0 },
        },
        unions: {
          u_pb_jb: { id: 'u_pb_jb', partnerIds: ['pb', 'jb'], childrenIds: [], type: 'married' },
          u_jb_un1: { id: 'u_jb_un1', partnerIds: ['jb', 'un1'], childrenIds: [], type: 'married' },
          u_jb_mb: { id: 'u_jb_mb', partnerIds: ['jb', 'mb'], childrenIds: [], type: 'divorced' },
          u_jb_un2: { id: 'u_jb_un2', partnerIds: ['jb', 'un2'], childrenIds: [], type: 'married' },
        },
      };

      assertNoLineOverlaps(tree, 'vertical');
      assertNoLineOverlaps(tree, 'horizontal');
    });

    it('prevents line overlaps when multiple non-adjacent unions have children in the generation below', () => {
      const tree: TreeData = {
        id: 'multi_non_adjacent_spouses_with_children',
        name: 'Multiple Non-Adjacent Spouses With Children',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
        people: {
          pb: { id: 'pb', firstName: 'Primary', lastName: 'Brits', gender: 'female', unionIds: ['u_pb_jb'], generation: 0 },
          jb: { id: 'jb', firstName: 'Johannes', lastName: 'Brits', gender: 'male', unionIds: ['u_pb_jb', 'u_jb_un1', 'u_jb_mb', 'u_jb_un2'], generation: 0 },
          un1: { id: 'un1', firstName: 'Unnamed', lastName: 'Person 1', gender: 'female', unionIds: ['u_jb_un1'], generation: 0 },
          mb: { id: 'mb', firstName: 'Maxi', lastName: 'Brits', gender: 'female', unionIds: ['u_jb_mb'], generation: 0 },
          un2: { id: 'un2', firstName: 'Unnamed', lastName: 'Person 2', gender: 'female', unionIds: ['u_jb_un2'], generation: 0 },
          c_mb: { id: 'c_mb', firstName: 'Child', lastName: 'Maxi', gender: 'male', unionIds: [], parentUnionId: 'u_jb_mb', generation: 1 },
          c_un2: { id: 'c_un2', firstName: 'Child', lastName: 'Unnamed2', gender: 'female', unionIds: [], parentUnionId: 'u_jb_un2', generation: 1 },
        },
        unions: {
          u_pb_jb: { id: 'u_pb_jb', partnerIds: ['pb', 'jb'], childrenIds: [], type: 'married' },
          u_jb_un1: { id: 'u_jb_un1', partnerIds: ['jb', 'un1'], childrenIds: [], type: 'married' },
          u_jb_mb: { id: 'u_jb_mb', partnerIds: ['jb', 'mb'], childrenIds: ['c_mb'], type: 'divorced' },
          u_jb_un2: { id: 'u_jb_un2', partnerIds: ['jb', 'un2'], childrenIds: ['c_un2'], type: 'married' },
        },
      };

      assertNoLineOverlaps(tree, 'vertical');
      assertNoLineOverlaps(tree, 'horizontal');
    });
  });
});
