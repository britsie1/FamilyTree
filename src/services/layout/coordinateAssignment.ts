import type { TreeData, LayoutNode, LayoutUnion, FamilyGroup, TreeLayout, LayoutOverrides } from '../../types/tree';
import { getPersonDisplayInfo } from '../displayUtils';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING,
  FAMILY_GROUP_GAP,
  FAMILY_GROUP_PADDING,
} from './constants';
import type { GenerationGroup } from './generationalRanking';
import { assignIntervalTracks, type IntervalItem } from './edgeAndBusRouting';

/**
 * Computes horizontal X coordinates for all individuals by anchoring at the
 * widest generation row and propagating upward (centering parents over children)
 * and downward (centering sibling pods under parents), maintaining intra-family
 * grouping and collision-free inter-family gaps.
 */
export function computeWidestRowAdjustedCoordinates(
  tree: TreeData,
  generationGroups: GenerationGroup[]
): Record<string, number> {
  const positions: Record<string, number> = {};
  if (generationGroups.length === 0) return positions;

  // 1. Helper to partition generation into atomic pods:
  // - Partners sharing a union form a pod (including partner chains for remarriage).
  // - Unmarried siblings of the same parent union form a pod.
  // - Otherwise, each person is an individual pod.
  const partitionIntoPods = (ids: string[]): string[][] => {
    if (ids.length === 0) return [];

    // Partner graph for this generation
    const partnerGraph: Record<string, Set<string>> = {};
    for (const id of ids) partnerGraph[id] = new Set();

    for (const id of ids) {
      const p = tree.people[id];
      if (!p) continue;
      for (const uId of p.unionIds || []) {
        const u = tree.unions[uId];
        if (u) {
          for (const partnerId of u.partnerIds) {
            if (partnerId !== id && ids.includes(partnerId)) {
              partnerGraph[id].add(partnerId);
              partnerGraph[partnerId].add(id);
            }
          }
        }
      }
    }

    const hasSpouseAtThisGen = (id: string): boolean => partnerGraph[id].size > 0;

    const pods: string[][] = [];
    let currentPod: string[] = [ids[0]];

    for (let i = 1; i < ids.length; i++) {
      const prevId = ids[i - 1];
      const currId = ids[i];

      // Are they spouses?
      const areSpouses = partnerGraph[prevId].has(currId);

      // Are they unmarried siblings?
      const prevPerson = tree.people[prevId];
      const currPerson = tree.people[currId];
      const areUnmarriedSiblings =
        !hasSpouseAtThisGen(prevId) &&
        !hasSpouseAtThisGen(currId) &&
        Boolean(prevPerson?.parentUnionId) &&
        Boolean(currPerson?.parentUnionId) &&
        prevPerson?.parentUnionId === currPerson?.parentUnionId;

      if (areSpouses || areUnmarriedSiblings) {
        currentPod.push(currId);
      } else {
        pods.push(currentPod);
        currentPod = [currId];
      }
    }
    if (currentPod.length > 0) pods.push(currentPod);
    return pods;
  };

  // 2. Find widest row (row with maximum packed width)
  let widestIndex = 0;
  let maxScore = -1;

  generationGroups.forEach((group, idx) => {
    const n = group.peopleIds.length;
    const packedW = n * CARD_WIDTH + Math.max(0, n - 1) * HORIZONTAL_SPACING;
    const hasKids = group.peopleIds.some((pId) => {
      const p = tree.people[pId];
      return p?.unionIds?.some((uId) => (tree.unions[uId]?.childrenIds?.length || 0) > 0);
    });
    const score = packedW * 10 + (hasKids ? 1 : 0);
    if (score > maxScore) {
      maxScore = score;
      widestIndex = idx;
    }
  });

  const widestGroup = generationGroups[widestIndex];
  const widestN = widestGroup.peopleIds.length;
  const widestWidth = widestN * CARD_WIDTH + Math.max(0, widestN - 1) * HORIZONTAL_SPACING;
  const widestStartX = -widestWidth / 2;

  // Lay out widest row: standard packed spacing (widest row DOES NOT BECOME ANY WIDER)
  widestGroup.peopleIds.forEach((pId, idx) => {
    positions[pId] = widestStartX + idx * (CARD_WIDTH + HORIZONTAL_SPACING);
  });

  // Helper: pod width
  const getPodWidth = (pod: string[]): number =>
    pod.length * CARD_WIDTH + Math.max(0, pod.length - 1) * HORIZONTAL_SPACING;

  // 3. Upward pass: from widestIndex - 1 down to 0
  for (let gIdx = widestIndex - 1; gIdx >= 0; gIdx--) {
    const group = generationGroups[gIdx];
    const pods = partitionIntoPods(group.peopleIds);
    let prevPodEnd = -Infinity;

    pods.forEach((pod) => {
      const podW = getPodWidth(pod);

      // Find children of this pod placed below
      const childXList: number[] = [];
      for (const pId of pod) {
        const p = tree.people[pId];
        if (!p) continue;
        for (const uId of p.unionIds || []) {
          const u = tree.unions[uId];
          if (u) {
            for (const cId of u.childrenIds || []) {
              if (positions[cId] !== undefined) {
                childXList.push(positions[cId]);
                childXList.push(positions[cId] + CARD_WIDTH);
              }
            }
          }
        }
      }

      let startX: number;
      if (childXList.length > 0) {
        const minChildX = Math.min(...childXList);
        const maxChildX = Math.max(...childXList);
        const childrenCenter = (minChildX + maxChildX) / 2;
        startX = childrenCenter - podW / 2;
      } else {
        startX = prevPodEnd === -Infinity ? -podW / 2 : prevPodEnd + HORIZONTAL_SPACING;
      }

      // Prevent overlapping left neighbor
      if (prevPodEnd !== -Infinity && startX < prevPodEnd + HORIZONTAL_SPACING) {
        startX = prevPodEnd + HORIZONTAL_SPACING;
      }

      pod.forEach((pId, idx) => {
        positions[pId] = startX + idx * (CARD_WIDTH + HORIZONTAL_SPACING);
      });

      prevPodEnd = startX + podW;
    });
  }

  // 4. Downward pass: from widestIndex + 1 up to generationGroups.length - 1
  for (let gIdx = widestIndex + 1; gIdx < generationGroups.length; gIdx++) {
    const group = generationGroups[gIdx];
    const pods = partitionIntoPods(group.peopleIds);
    let prevPodEnd = -Infinity;

    pods.forEach((pod) => {
      const podW = getPodWidth(pod);

      // Find parents of this pod placed above:
      // The first person in the pod with placed parents guides this pod's alignment
      // to avoid averaging unrelated in-law parents across the tree.
      const parentXList: number[] = [];
      for (const pId of pod) {
        const p = tree.people[pId];
        if (p?.parentUnionId) {
          const u = tree.unions[p.parentUnionId];
          if (u) {
            for (const partnerId of u.partnerIds) {
              if (positions[partnerId] !== undefined) {
                parentXList.push(positions[partnerId]);
                parentXList.push(positions[partnerId] + CARD_WIDTH);
              }
            }
            if (parentXList.length > 0) break;
          }
        }
      }

      let startX: number;
      if (parentXList.length > 0) {
        const minPX = Math.min(...parentXList);
        const maxPX = Math.max(...parentXList);
        const parentCenter = (minPX + maxPX) / 2;
        startX = parentCenter - podW / 2;
      } else {
        startX = prevPodEnd === -Infinity ? -podW / 2 : prevPodEnd + HORIZONTAL_SPACING;
      }

      // Prevent overlapping left neighbor
      if (prevPodEnd !== -Infinity && startX < prevPodEnd + HORIZONTAL_SPACING) {
        startX = prevPodEnd + HORIZONTAL_SPACING;
      }

      pod.forEach((pId, idx) => {
        positions[pId] = startX + idx * (CARD_WIDTH + HORIZONTAL_SPACING);
      });

      prevPodEnd = startX + podW;
    });
  }

  // 5. Global Center at X = 0
  const allX = Object.values(positions);
  if (allX.length > 0) {
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX.map((x) => x + CARD_WIDTH));
    const offset = -(minX + maxX) / 2;
    for (const pId of Object.keys(positions)) {
      positions[pId] = Math.round(positions[pId] + offset);
    }
  }

  return positions;
}

/**
 * Assigns X, Y coordinates and display info to all Person nodes in vertical layout.
 */
export function assignVerticalNodeCoordinates(
  tree: TreeData,
  generationGroups: GenerationGroup[],
  personFamilyMap: Record<string, string>,
  familyGroups: FamilyGroup[],
  groupByFamily: boolean = false,
  adjustSpacing: boolean = true,
  layoutOverrides?: LayoutOverrides
): Record<string, LayoutNode> {
  const nodes: Record<string, LayoutNode> = {};
  const overrides = layoutOverrides || tree.layoutOverrides;

  if (!groupByFamily) {
    // If adjustSpacing is active, compute positions based on widest row upwards/downwards
    const adjustedPositions = adjustSpacing
      ? computeWidestRowAdjustedCoordinates(tree, generationGroups)
      : null;

    // Ungrouped layout: each generation level centered on the board
    for (const group of generationGroups) {
      const level = group.level;
      const peopleCount = group.peopleIds.length;

      let totalRowWidth = 0;
      const xOffsets: number[] = [];

      for (let i = 0; i < peopleCount; i++) {
        xOffsets.push(totalRowWidth);
        if (i < peopleCount - 1) {
          totalRowWidth += CARD_WIDTH + HORIZONTAL_SPACING;
        } else {
          totalRowWidth += CARD_WIDTH;
        }
      }

      const startX = -totalRowWidth / 2;
      const currentY = level * (CARD_HEIGHT + VERTICAL_SPACING);

      group.peopleIds.forEach((pId, index) => {
        const person = tree.people[pId];
        if (!person) return;

        const defaultAutoX = startX + xOffsets[index];
        const autoX = (adjustedPositions && adjustedPositions[pId] !== undefined)
          ? adjustedPositions[pId]
          : defaultAutoX;
        const autoY = currentY;

        // Use manually dragged position if exists, otherwise auto
        const override = overrides?.[pId];
        const x = override?.x !== undefined ? override.x : autoX;
        const y = override?.y !== undefined ? override.y : autoY;

        nodes[pId] = {
          id: pId,
          type: 'person',
          data: person,
          x,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          generation: level,
          order: index,
          familyId: personFamilyMap[pId],
          displayInfo: getPersonDisplayInfo(person),
        };
      });
    }
  } else {
    // Grouped layout:
    // 1. Each family group occupies its own dedicated corridor.
    // 2. People in each generation of a family are center-aligned within their family corridor.
    // 3. Adjacent family groups are separated so their bounding boxes never overlap.
    const activeFamilyGroups = familyGroups.filter((fg) =>
      fg.memberIds.some((id) => tree.people[id])
    );

    const famLevelPeople: Record<string, Record<number, string[]>> = {};
    const famLevelWidths: Record<string, Record<number, number>> = {};
    const maxGroupWidth: Record<string, number> = {};

    activeFamilyGroups.forEach((fg) => {
      famLevelPeople[fg.id] = {};
      famLevelWidths[fg.id] = {};
      maxGroupWidth[fg.id] = CARD_WIDTH;
    });

    for (const group of generationGroups) {
      const level = group.level;
      for (const fg of activeFamilyGroups) {
        const peopleInFamAtLevel = group.peopleIds.filter(
          (pId) => personFamilyMap[pId] === fg.id
        );
        famLevelPeople[fg.id][level] = peopleInFamAtLevel;
        if (peopleInFamAtLevel.length > 0) {
          const rowW =
            peopleInFamAtLevel.length * CARD_WIDTH +
            (peopleInFamAtLevel.length - 1) * HORIZONTAL_SPACING;
          famLevelWidths[fg.id][level] = rowW;
          if (rowW > maxGroupWidth[fg.id]) {
            maxGroupWidth[fg.id] = rowW;
          }
        }
      }
    }

    // Visual separation between family bounding boxes is FAMILY_GROUP_GAP
    const groupSeparation = FAMILY_GROUP_GAP + FAMILY_GROUP_PADDING * 2;

    let totalAllGroupsWidth = 0;
    for (let i = 0; i < activeFamilyGroups.length; i++) {
      totalAllGroupsWidth += maxGroupWidth[activeFamilyGroups[i].id];
      if (i < activeFamilyGroups.length - 1) {
        totalAllGroupsWidth += groupSeparation;
      }
    }

    let currentGroupLeft = -totalAllGroupsWidth / 2;
    const groupCenterX: Record<string, number> = {};

    for (const fg of activeFamilyGroups) {
      const w = maxGroupWidth[fg.id];
      groupCenterX[fg.id] = currentGroupLeft + w / 2;
      currentGroupLeft += w + groupSeparation;
    }

    // Place people centered within their respective family group
    for (const group of generationGroups) {
      const level = group.level;
      const currentY = level * (CARD_HEIGHT + VERTICAL_SPACING);

      for (const fg of activeFamilyGroups) {
        const people = famLevelPeople[fg.id][level] || [];
        if (people.length === 0) continue;

        const rowW = famLevelWidths[fg.id][level];
        // Center-aligned within respective family group corridor!
        const rowStartX = groupCenterX[fg.id] - rowW / 2;

        people.forEach((pId, index) => {
          const person = tree.people[pId];
          if (!person) return;

          const autoX = rowStartX + index * (CARD_WIDTH + HORIZONTAL_SPACING);
          const autoY = currentY;

          const override = overrides?.[pId];
          const x = override?.x !== undefined ? override.x : autoX;
          const y = override?.y !== undefined ? override.y : autoY;

          nodes[pId] = {
            id: pId,
            type: 'person',
            data: person,
            x,
            y,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            generation: level,
            order: index,
            familyId: fg.id,
            displayInfo: getPersonDisplayInfo(person),
          };
        });
      }

      // Fallback for any person not assigned to an active family group
      const placedIds = new Set(Object.keys(nodes));
      const unplaced = group.peopleIds.filter((id) => !placedIds.has(id));
      if (unplaced.length > 0) {
        unplaced.forEach((pId, idx) => {
          const person = tree.people[pId];
          if (!person) return;
          const autoX = idx * (CARD_WIDTH + HORIZONTAL_SPACING);
          const autoY = currentY;
          const override = overrides?.[pId];
          nodes[pId] = {
            id: pId,
            type: 'person',
            data: person,
            x: override?.x !== undefined ? override.x : autoX,
            y: override?.y !== undefined ? override.y : autoY,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            generation: level,
            order: idx,
            familyId: personFamilyMap[pId],
            displayInfo: getPersonDisplayInfo(person),
          };
        });
      }
    }
  }

  return nodes;
}

/**
 * Assigns X, Y coordinates to Union nodes for vertical layout.
 */
export function assignVerticalUnionCoordinates(
  tree: TreeData,
  nodes: Record<string, LayoutNode>
): Record<string, LayoutUnion> {
  const unions: Record<string, LayoutUnion> = {};

  // Helper to group unions by partner signature so multiple unions for the same pair/single person are staggered
  const partnerGroupUnions: Record<string, string[]> = {};
  for (const [uId, union] of Object.entries(tree.unions)) {
    let key: string;
    if (union.partnerIds.length >= 2) {
      key = 'pair_' + [...union.partnerIds].sort().join('_');
    } else if (union.partnerIds.length === 1) {
      key = 'single_' + union.partnerIds[0];
    } else {
      key = 'orphan_' + [...union.childrenIds].sort().join('_');
    }
    if (!partnerGroupUnions[key]) partnerGroupUnions[key] = [];
    partnerGroupUnions[key].push(uId);
  }

  // Pre-calculate non-adjacent intervals and assign multi-lane tracks per generation
  const nonAdjIntervalsByGen: Record<number, IntervalItem[]> = {};
  const personBottomUnionsMap: Record<string, string[]> = {};

  for (const [uId, union] of Object.entries(tree.unions)) {
    const partnerNodes = union.partnerIds
      .map((id) => nodes[id])
      .filter((n): n is LayoutNode => Boolean(n));

    if (partnerNodes.length === 2) {
      const p1 = partnerNodes[0];
      const p2 = partnerNodes[1];
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.x > minX && n.x < maxX
      );
      if (hasIntervening) {
        const gen = p1.generation;
        if (!nonAdjIntervalsByGen[gen]) nonAdjIntervalsByGen[gen] = [];
        const startX = Math.min(p1.x + p1.width / 2, p2.x + p2.width / 2);
        const endX = Math.max(p1.x + p1.width / 2, p2.x + p2.width / 2);
        nonAdjIntervalsByGen[gen].push({ id: uId, start: startX, end: endX });

        if (!personBottomUnionsMap[p1.id]) personBottomUnionsMap[p1.id] = [];
        personBottomUnionsMap[p1.id].push(uId);
        if (!personBottomUnionsMap[p2.id]) personBottomUnionsMap[p2.id] = [];
        personBottomUnionsMap[p2.id].push(uId);
      }
    } else if (partnerNodes.length === 1) {
      const p = partnerNodes[0];
      if (!personBottomUnionsMap[p.id]) personBottomUnionsMap[p.id] = [];
      personBottomUnionsMap[p.id].push(uId);
    }
  }

  const nonAdjTrackMap: Record<string, number> = {};
  for (const intervals of Object.values(nonAdjIntervalsByGen)) {
    const tracks = assignIntervalTracks(intervals, 10);
    Object.assign(nonAdjTrackMap, tracks);
  }

  // Second pass: position union anchor nodes
  for (const [uId, union] of Object.entries(tree.unions)) {
    const partnerNodes = union.partnerIds
      .map((id) => nodes[id])
      .filter((n): n is LayoutNode => Boolean(n));

    const childrenNodes = union.childrenIds
      .map((id) => nodes[id])
      .filter((n): n is LayoutNode => Boolean(n));

    let unionX = 0;
    let unionY = 0;
    let unionGen = 0;

    let key: string;
    if (partnerNodes.length >= 2) {
      key = 'pair_' + [...union.partnerIds].sort().join('_');
    } else if (partnerNodes.length === 1) {
      key = 'single_' + union.partnerIds[0];
    } else {
      key = 'orphan_' + [...union.childrenIds].sort().join('_');
    }
    const group = partnerGroupUnions[key] || [uId];
    const groupIndex = group.indexOf(uId);
    const groupCount = group.length;

    if (partnerNodes.length === 2) {
      const p1 = partnerNodes[0];
      const p2 = partnerNodes[1];

      // Check if p1 and p2 have intervening nodes between them
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.x > minX && n.x < maxX
      );

      const p1Center = { x: p1.x + p1.width / 2, y: p1.y + p1.height / 2 };
      const p2Center = { x: p2.x + p2.width / 2, y: p2.y + p2.height / 2 };

      if (!hasIntervening) {
        // Direct adjacent partners: union sits at midpoint in the horizontal gap
        unionX = (p1Center.x + p2Center.x) / 2;
        const baseY = (p1Center.y + p2Center.y) / 2;
        const yOffset = groupCount > 1 ? (groupIndex - (groupCount - 1) / 2) * 32 : 0;
        unionY = baseY + yOffset;
      } else {
        // Non-adjacent partners: multi-lane bypass rails under cards
        unionX = (p1Center.x + p2Center.x) / 2;
        const track = nonAdjTrackMap[uId] ?? 0;
        const baseY = p1.y + CARD_HEIGHT + 24;
        unionY = baseY + track * 24;
      }
      unionGen = p1.generation;
    } else if (partnerNodes.length === 1) {
      // Single parent union
      const p = partnerNodes[0];
      const bottomUnions = personBottomUnionsMap[p.id] || [uId];
      const pIndex = bottomUnions.indexOf(uId);
      const xOffset = bottomUnions.length > 1 ? (pIndex - (bottomUnions.length - 1) / 2) * 36 : 0;
      unionX = p.x + p.width / 2 + xOffset;
      unionY = p.y + p.height + 25;
      unionGen = p.generation;
    } else if (childrenNodes.length > 0) {
      // Orphan children union
      const avgChildX =
        childrenNodes.reduce((sum, c) => sum + (c.x + c.width / 2), 0) / childrenNodes.length;
      const minChildY = Math.min(...childrenNodes.map((c) => c.y));
      const targetGen = childrenNodes[0].generation;
      unionX = avgChildX;
      if (targetGen <= 0) {
        unionY = minChildY - 40;
      } else {
        const parentGenBottom = minChildY - VERTICAL_SPACING;
        unionY = parentGenBottom + 24;
      }
      unionGen = targetGen - 1;
    }

    unions[uId] = {
      id: uId,
      type: 'union',
      data: union,
      x: unionX,
      y: unionY,
      generation: unionGen,
      partnerNodes,
      childrenNodes,
    };
  }

  // Avoid collinear vertical stems between unions in the same tier
  const unionList = Object.values(unions);
  for (let i = 0; i < unionList.length; i++) {
    for (let j = i + 1; j < unionList.length; j++) {
      const u1 = unionList[i];
      const u2 = unionList[j];
      if (u1.generation === u2.generation && Math.abs(u1.x - u2.x) < 20) {
        if (u2.partnerNodes.length === 0) {
          u2.x += 28;
        } else if (u1.partnerNodes.length === 0) {
          u1.x += 28;
        } else {
          u2.x += 28;
        }
      }
    }
  }

  return unions;
}

/**
 * Computes bounding box for layout and family groups.
 */
export function computeLayoutBoundingBox(
  nodes: Record<string, LayoutNode>,
  unions: Record<string, LayoutUnion>,
  familyGroups?: FamilyGroup[],
  groupByFamily: boolean = false
): TreeLayout['bounds'] {
  // Compute family groups bounding boxes if active
  if (groupByFamily && familyGroups && familyGroups.length > 0) {
    const PADDING = FAMILY_GROUP_PADDING;
    for (const fg of familyGroups) {
      const famNodes = fg.memberIds.map((id) => nodes[id]).filter(Boolean);
      if (famNodes.length > 0) {
        let fMinX = Infinity;
        let fMinY = Infinity;
        let fMaxX = -Infinity;
        let fMaxY = -Infinity;
        for (const n of famNodes) {
          fMinX = Math.min(fMinX, n.x);
          fMinY = Math.min(fMinY, n.y);
          fMaxX = Math.max(fMaxX, n.x + n.width);
          fMaxY = Math.max(fMaxY, n.y + n.height);
        }
        fg.bounds = {
          minX: fMinX - PADDING,
          minY: fMinY - PADDING,
          maxX: fMaxX + PADDING,
          maxY: fMaxY + PADDING,
          width: fMaxX - fMinX + PADDING * 2,
          height: fMaxY - fMinY + PADDING * 2,
        };
      }
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const allItems = [...Object.values(nodes), ...Object.values(unions)];
  if (allItems.length === 0) {
    minX = -400;
    minY = -300;
    maxX = 400;
    maxY = 300;
  } else {
    for (const item of Object.values(nodes)) {
      minX = Math.min(minX, item.x - 60);
      minY = Math.min(minY, item.y - 60);
      maxX = Math.max(maxX, item.x + item.width + 60);
      maxY = Math.max(maxY, item.y + item.height + 60);
    }
    for (const item of Object.values(unions)) {
      minX = Math.min(minX, item.x - 30);
      minY = Math.min(minY, item.y - 30);
      maxX = Math.max(maxX, item.x + 30);
      maxY = Math.max(maxY, item.y + 30);
    }
    if (groupByFamily && familyGroups) {
      for (const fg of familyGroups) {
        if (fg.bounds) {
          minX = Math.min(minX, fg.bounds.minX);
          minY = Math.min(minY, fg.bounds.minY);
          maxX = Math.max(maxX, fg.bounds.maxX);
          maxY = Math.max(maxY, fg.bounds.maxY);
        }
      }
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(800, maxX - minX),
    height: Math.max(600, maxY - minY),
  };
}
