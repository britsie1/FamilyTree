import type { TreeData, LayoutStyle, TreeLayout, LayoutOverrides } from '../../types/tree';
import { calculateGenerations, filterCollapsedTree } from './generationalRanking';
import { detectFamilyGroups, orderGenerations } from './barycentricOrdering';
import {
  assignVerticalNodeCoordinates,
  assignVerticalUnionCoordinates,
  computeLayoutBoundingBox,
} from './coordinateAssignment';
import { computeMultiLaneBusY, getUnionColors, generateEdgesWithBridgeHops } from './edgeAndBusRouting';
import { computeHorizontalLayout } from './layoutTransforms';

/**
 * Computes layout coordinates for all individuals and unions using the
 * classic vertical (top-down) generational layout.
 * When adjustSpacing is true, adjusts horizontal spacing based on the widest
 * generation row upwards and downwards so parents and children are closer together.
 */
export function computeVerticalLayout(
  tree: TreeData,
  groupByFamily: boolean = false,
  adjustSpacing: boolean = true,
  layoutOverrides?: LayoutOverrides
): TreeLayout {
  const generations = calculateGenerations(tree);
  const { familyGroups, personFamilyMap } = detectFamilyGroups(tree);
  const canonicalFamilyOrder = familyGroups.map((g) => g.id);
  const generationGroups = orderGenerations(
    tree,
    generations,
    groupByFamily ? personFamilyMap : undefined,
    groupByFamily ? canonicalFamilyOrder : undefined
  );

  // 1. Assign Person node positions
  const nodes = assignVerticalNodeCoordinates(
    tree,
    generationGroups,
    personFamilyMap,
    familyGroups,
    groupByFamily,
    adjustSpacing,
    layoutOverrides
  );

  // 2. Assign Union node positions and avoid collinear stems
  const unions = assignVerticalUnionCoordinates(tree, nodes);

  // 3. Multi-lane bus coordination & branch color assignment for vertical layout
  const busYMap = computeMultiLaneBusY(unions);
  const unionColors = getUnionColors(unions);
  for (const [uId, u] of Object.entries(unions)) {
    u.busCoord = busYMap[uId];
    u.color = unionColors[uId];
  }

  // 4. Generate edges with crossing detection & bridge-hops
  const { edges } = generateEdgesWithBridgeHops(nodes, unions);

  // 5. Compute bounding boxes
  const bounds = computeLayoutBoundingBox(nodes, unions, familyGroups, groupByFamily);

  return {
    nodes,
    unions,
    edges,
    familyGroups: groupByFamily ? familyGroups : undefined,
    bounds,
  };
}

/**
 * Main entry point: Computes full coordinate layout and SVG edges.
 * Supports 'vertical' (top-down, default) and 'horizontal' (left-to-right pedigree).
 * When groupByFamily is true, branches are grouped and separated with an extra gap.
 * When collapsedPersonIds is provided, descendant branches are hidden and bounds compacted.
 */
export function computeLayout(
  tree: TreeData,
  layoutStyle: LayoutStyle = 'vertical',
  groupByFamily: boolean = false,
  collapsedPersonIds?: Set<string> | string[],
  adjustSpacing: boolean = true,
  layoutOverrides?: LayoutOverrides
): TreeLayout {
  const collapsedSet = new Set<string>(
    collapsedPersonIds
      ? (Array.isArray(collapsedPersonIds) ? collapsedPersonIds : Array.from(collapsedPersonIds))
      : (tree.collapsedPersonIds || [])
  );

  const { visibleTree, hiddenCounts } = filterCollapsedTree(tree, collapsedSet);

  const layout = layoutStyle === 'horizontal'
    ? computeHorizontalLayout(visibleTree, groupByFamily, layoutOverrides)
    : computeVerticalLayout(visibleTree, groupByFamily, adjustSpacing, layoutOverrides);

  for (const pId of collapsedSet) {
    if (layout.nodes[pId]) {
      layout.nodes[pId].isCollapsed = true;
      layout.nodes[pId].hiddenCount = hiddenCounts[pId] || 0;
    }
  }

  return layout;
}
