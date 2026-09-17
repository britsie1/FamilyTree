import type { TreeData, LayoutNode, LayoutUnion, LayoutEdge, TreeLayout, LayoutOverrides } from '../../types/tree';
import { getPersonDisplayInfo } from '../displayUtils';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  HORIZONTAL_COL_SPACING,
  VERTICAL_ROW_SPACING,
  FAMILY_GROUP_GAP_H,
  FAMILY_GROUP_PADDING,
} from './constants';
import { calculateGenerations } from './generationalRanking';
import { detectFamilyGroups, orderGenerations } from './barycentricOrdering';
import { assignIntervalTracks, getUnionColors, type IntervalItem } from './edgeAndBusRouting';

/**
 * Computes multi-lane X positions for all union child buses in horizontal layout
 * to avoid collinear or overlapping vertical bus bars.
 */
export function computeMultiLaneBusX(
  unions: Record<string, LayoutUnion>
): Record<string, number> {
  const busXMap: Record<string, number> = {};
  const unionsWithChildren = Object.values(unions).filter((u) => u.childrenNodes.length > 0);

  if (unionsWithChildren.length === 0) return busXMap;

  // Group unions by target child generation tier along X so vertical buses stay within the column corridor
  const tiers: Record<number, LayoutUnion[]> = {};
  for (const u of unionsWithChildren) {
    const targetGen = Math.min(...u.childrenNodes.map((c) => c.generation));
    if (!tiers[targetGen]) tiers[targetGen] = [];
    tiers[targetGen].push(u);
  }

  for (const unionsInTier of Object.values(tiers)) {
    if (unionsInTier.length === 1) {
      const u = unionsInTier[0];
      const minChildX = Math.min(...u.childrenNodes.map((c) => c.x));
      const maxParentRightX = u.partnerNodes.length > 0
        ? Math.max(...u.partnerNodes.map((p) => p.x + p.width))
        : u.x;
      const leftBoundary = Math.max(u.x, maxParentRightX);
      busXMap[u.id] = Math.round(leftBoundary + (minChildX - leftBoundary) / 2);
      continue;
    }

    const intervals = unionsInTier.map((u) => {
      const childCenters = u.childrenNodes.map((c) => c.y + c.height / 2);
      const minY = Math.min(u.y, ...childCenters);
      const maxY = Math.max(u.y, ...childCenters);
      const minChildX = Math.min(...u.childrenNodes.map((c) => c.x));
      const maxParentRightX = u.partnerNodes.length > 0
        ? Math.max(...u.partnerNodes.map((p) => p.x + p.width))
        : u.x;
      const leftBoundary = Math.max(u.x, maxParentRightX);
      return {
        union: u,
        minY,
        maxY,
        minChildX,
        leftBoundary,
      };
    });

    intervals.sort((a, b) => a.minY - b.minY);

    const tracks: (typeof intervals)[] = [];
    const unionTrackMap: Record<string, number> = {};

    for (let i = 0; i < intervals.length; i++) {
      const item = intervals[i];
      const prevTrack = i > 0 ? unionTrackMap[intervals[i - 1].union.id] : -1;
      let assignedTrack = -1;

      for (let t = 0; t < tracks.length; t++) {
        if (t === prevTrack) continue;
        const overlaps = tracks[t].some(
          (other) => Math.max(item.minY, other.minY) <= Math.min(item.maxY, other.maxY) + 40
        );
        if (!overlaps) {
          assignedTrack = t;
          tracks[t].push(item);
          break;
        }
      }

      if (assignedTrack === -1) {
        for (let t = 0; t < tracks.length; t++) {
          const overlaps = tracks[t].some(
            (other) => Math.max(item.minY, other.minY) <= Math.min(item.maxY, other.maxY) + 40
          );
          if (!overlaps) {
            assignedTrack = t;
            tracks[t].push(item);
            break;
          }
        }
      }

      if (assignedTrack === -1 || (tracks.length === 1 && intervals.length > 1)) {
        if (tracks.length === 1 && intervals.length > 1 && assignedTrack === 0) {
          tracks[0].pop();
          assignedTrack = 1;
          tracks.push([item]);
        } else if (assignedTrack === -1) {
          assignedTrack = tracks.length;
          tracks.push([item]);
        }
      }

      unionTrackMap[item.union.id] = assignedTrack;
    }

    const numTracks = tracks.length;
    const minChildXOverall = Math.min(...intervals.map((i) => i.minChildX));
    const maxLeftBoundaryOverall = Math.max(...intervals.map((i) => i.leftBoundary));
    const channelLeft = maxLeftBoundaryOverall + 16;
    const channelRight = minChildXOverall - 16;
    const channelWidth = channelRight - channelLeft;
    const baseMidX = maxLeftBoundaryOverall + (minChildXOverall - maxLeftBoundaryOverall) / 2;

    if (numTracks <= 1) {
      for (const item of intervals) {
        busXMap[item.union.id] = Math.round(baseMidX);
      }
    } else {
      const minSpacing = 18;
      const trackSpacing = Math.max(minSpacing, Math.min(26, channelWidth / (numTracks + 1)));
      for (const item of intervals) {
        const t = unionTrackMap[item.union.id] ?? 0;
        const offset = (t - (numTracks - 1) / 2) * trackSpacing;
        busXMap[item.union.id] = Math.round(baseMidX + offset);
      }
    }
  }

  return busXMap;
}

/**
 * Computes layout coordinates for all individuals and unions using the
 * horizontal (left-to-right) pedigree layout.
 * Generations advance as columns from left to right, with clean vertical buses
 * and rightward branch lines into children.
 */
export function computeHorizontalLayout(
  tree: TreeData,
  groupByFamily: boolean = false,
  layoutOverrides?: LayoutOverrides
): TreeLayout {
  const overrides = layoutOverrides || tree.horizontalOverrides || tree.layoutOverrides;
  const generations = calculateGenerations(tree);
  const { familyGroups, personFamilyMap } = detectFamilyGroups(tree);
  const canonicalFamilyOrder = familyGroups.map((g) => g.id);
  const generationGroups = orderGenerations(
    tree,
    generations,
    groupByFamily ? personFamilyMap : undefined,
    groupByFamily ? canonicalFamilyOrder : undefined
  );

  const nodes: Record<string, LayoutNode> = {};
  const unions: Record<string, LayoutUnion> = {};

  // First pass: compute automatic coordinates for each generation column
  if (!groupByFamily) {
    // Ungrouped horizontal layout: each generation column centered on Y=0
    for (const group of generationGroups) {
      const level = group.level;
      const peopleCount = group.peopleIds.length;

      let totalColHeight = 0;
      const yOffsets: number[] = [];

      for (let i = 0; i < peopleCount; i++) {
        yOffsets.push(totalColHeight);
        if (i < peopleCount - 1) {
          totalColHeight += CARD_HEIGHT + VERTICAL_ROW_SPACING;
        } else {
          totalColHeight += CARD_HEIGHT;
        }
      }

      const startY = -totalColHeight / 2;
      const currentX = level * (CARD_WIDTH + HORIZONTAL_COL_SPACING);

      group.peopleIds.forEach((pId, index) => {
        const person = tree.people[pId];
        if (!person) return;

        const autoX = currentX;
        const autoY = startY + yOffsets[index];

        // Use manually dragged position if exists for horizontal layout, otherwise auto
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
    // Grouped horizontal layout:
    // 1. Each family group occupies its own dedicated horizontal band along Y.
    // 2. People in each generation column of a family are center-aligned along Y within their family band.
    // 3. Adjacent family groups are separated so their bounding boxes never overlap.
    const activeFamilyGroups = familyGroups.filter((fg) =>
      fg.memberIds.some((id) => tree.people[id])
    );

    const famLevelPeople: Record<string, Record<number, string[]>> = {};
    const famLevelHeights: Record<string, Record<number, number>> = {};
    const maxGroupHeight: Record<string, number> = {};

    activeFamilyGroups.forEach((fg) => {
      famLevelPeople[fg.id] = {};
      famLevelHeights[fg.id] = {};
      maxGroupHeight[fg.id] = CARD_HEIGHT;
    });

    for (const group of generationGroups) {
      const level = group.level;
      for (const fg of activeFamilyGroups) {
        const peopleInFamAtLevel = group.peopleIds.filter(
          (pId) => personFamilyMap[pId] === fg.id
        );
        famLevelPeople[fg.id][level] = peopleInFamAtLevel;
        if (peopleInFamAtLevel.length > 0) {
          const colH =
            peopleInFamAtLevel.length * CARD_HEIGHT +
            (peopleInFamAtLevel.length - 1) * VERTICAL_ROW_SPACING;
          famLevelHeights[fg.id][level] = colH;
          if (colH > maxGroupHeight[fg.id]) {
            maxGroupHeight[fg.id] = colH;
          }
        }
      }
    }

    const groupSeparationH = FAMILY_GROUP_GAP_H + FAMILY_GROUP_PADDING * 2;

    let totalAllGroupsHeight = 0;
    for (let i = 0; i < activeFamilyGroups.length; i++) {
      totalAllGroupsHeight += maxGroupHeight[activeFamilyGroups[i].id];
      if (i < activeFamilyGroups.length - 1) {
        totalAllGroupsHeight += groupSeparationH;
      }
    }

    let currentGroupTop = -totalAllGroupsHeight / 2;
    const groupCenterY: Record<string, number> = {};

    for (const fg of activeFamilyGroups) {
      const h = maxGroupHeight[fg.id];
      groupCenterY[fg.id] = currentGroupTop + h / 2;
      currentGroupTop += h + groupSeparationH;
    }

    for (const group of generationGroups) {
      const level = group.level;
      const currentX = level * (CARD_WIDTH + HORIZONTAL_COL_SPACING);

      for (const fg of activeFamilyGroups) {
        const people = famLevelPeople[fg.id][level] || [];
        if (people.length === 0) continue;

        const colH = famLevelHeights[fg.id][level];
        // Center-aligned along Y within respective family group band!
        const colStartY = groupCenterY[fg.id] - colH / 2;

        people.forEach((pId, index) => {
          const person = tree.people[pId];
          if (!person) return;

          const autoX = currentX;
          const autoY = colStartY + index * (CARD_HEIGHT + VERTICAL_ROW_SPACING);

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
          const autoX = currentX;
          const autoY = idx * (CARD_HEIGHT + VERTICAL_ROW_SPACING);
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

  // Helper to group unions by partner signature so multiple unions for the same pair/single person are staggered
  const partnerGroupUnionsH: Record<string, string[]> = {};
  for (const [uId, union] of Object.entries(tree.unions)) {
    let key: string;
    if (union.partnerIds.length >= 2) {
      key = 'pair_' + [...union.partnerIds].sort().join('_');
    } else if (union.partnerIds.length === 1) {
      key = 'single_' + union.partnerIds[0];
    } else {
      key = 'orphan_' + [...union.childrenIds].sort().join('_');
    }
    if (!partnerGroupUnionsH[key]) partnerGroupUnionsH[key] = [];
    partnerGroupUnionsH[key].push(uId);
  }

  // Pre-calculate non-adjacent intervals and assign multi-lane tracks per generation column
  const nonAdjIntervalsByGenH: Record<number, IntervalItem[]> = {};
  for (const [uId, union] of Object.entries(tree.unions)) {
    const partnerNodes = union.partnerIds
      .map((id) => nodes[id])
      .filter((n): n is LayoutNode => Boolean(n));
    if (partnerNodes.length === 2) {
      const p1 = partnerNodes[0];
      const p2 = partnerNodes[1];
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.y > minY && n.y < maxY
      );
      if (hasIntervening) {
        const gen = p1.generation;
        if (!nonAdjIntervalsByGenH[gen]) nonAdjIntervalsByGenH[gen] = [];
        const startY = Math.min(p1.y + p1.height / 2, p2.y + p2.height / 2);
        const endY = Math.max(p1.y + p1.height / 2, p2.y + p2.height / 2);
        nonAdjIntervalsByGenH[gen].push({ id: uId, start: startY, end: endY });
      }
    }
  }

  const nonAdjTrackMapH: Record<string, number> = {};
  for (const intervals of Object.values(nonAdjIntervalsByGenH)) {
    const tracks = assignIntervalTracks(intervals, 10);
    Object.assign(nonAdjTrackMapH, tracks);
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
    const group = partnerGroupUnionsH[key] || [uId];
    const groupIndex = group.indexOf(uId);
    const groupCount = group.length;

    if (partnerNodes.length === 2) {
      const p1 = partnerNodes[0];
      const p2 = partnerNodes[1];

      // Check if p1 and p2 have intervening nodes between them vertically
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.y > minY && n.y < maxY
      );

      const maxXCard = Math.max(p1.x + p1.width, p2.x + p2.width);
      const baseY = (p1.y + p1.height / 2 + p2.y + p2.height / 2) / 2;
      const yOffset = groupCount > 1 ? (groupIndex - (groupCount - 1) / 2) * 32 : 0;
      unionY = baseY + yOffset;

      if (!hasIntervening) {
        unionX = maxXCard + 28 + (groupCount > 1 ? groupIndex * 24 : 0);
      } else {
        const track = nonAdjTrackMapH[uId] ?? 0;
        unionX = maxXCard + 44 + track * 24;
      }
      unionGen = p1.generation;
    } else if (partnerNodes.length === 1) {
      const p = partnerNodes[0];
      const yOffset = groupCount > 1 ? (groupIndex - (groupCount - 1) / 2) * 32 : 0;
      unionX = p.x + p.width + 28 + (groupCount > 1 ? groupIndex * 24 : 0);
      unionY = p.y + p.height / 2 + yOffset;
      unionGen = p.generation;
    } else if (childrenNodes.length > 0) {
      const avgChildY =
        childrenNodes.reduce((sum, c) => sum + (c.y + c.height / 2), 0) / childrenNodes.length;
      const minChildX = Math.min(...childrenNodes.map((c) => c.x));
      const targetGen = childrenNodes[0].generation;
      if (targetGen <= 0) {
        unionX = minChildX - 42;
      } else {
        const parentGenRight = minChildX - HORIZONTAL_COL_SPACING;
        unionX = parentGenRight + 28;
      }
      unionY = avgChildY;
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

  // Avoid collinear horizontal stems between unions in the same tier
  const unionListH = Object.values(unions);
  for (let i = 0; i < unionListH.length; i++) {
    for (let j = i + 1; j < unionListH.length; j++) {
      const u1 = unionListH[i];
      const u2 = unionListH[j];
      if (u1.generation === u2.generation && Math.abs(u1.y - u2.y) < 20) {
        if (u2.partnerNodes.length === 0) {
          u2.y += 28;
        } else if (u1.partnerNodes.length === 0) {
          u1.y += 28;
        } else {
          u2.y += 28;
        }
      }
    }
  }

  // Multi-lane vertical bus coordination & branch color assignment for horizontal layout
  const busXMap = computeMultiLaneBusX(unions);
  const unionColors = getUnionColors(unions);
  for (const [uId, u] of Object.entries(unions)) {
    u.busCoord = busXMap[uId];
    u.color = unionColors[uId];
  }

  // Track person union count and indices for port offsets in horizontal layout
  const personUnionsMapH: Record<string, string[]> = {};
  for (const union of Object.values(unions)) {
    for (const pNode of union.partnerNodes) {
      if (!personUnionsMapH[pNode.id]) personUnionsMapH[pNode.id] = [];
      personUnionsMapH[pNode.id].push(union.id);
    }
  }

  // Third pass: generate edges for horizontal layout
  const edges: LayoutEdge[] = [];

  // 1. Partner to Union lines
  for (const union of Object.values(unions)) {
    const { partnerNodes, x: ux, y: uy } = union;
    const unionType = union.data.type || 'married';
    const isDivorced = unionType === 'divorced';
    const isSeparated = unionType === 'separated';
    let partnerColor = union.color || '#6366f1';
    if (isDivorced) partnerColor = '#ef4444';
    else if (isSeparated) partnerColor = '#f59e0b';

    if (partnerNodes.length === 2) {
      const p1 = partnerNodes[0];
      const p2 = partnerNodes[1];

      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.y > minY && n.y < maxY
      );

      const p1RightX = p1.x + p1.width;
      const p1Unions = personUnionsMapH[p1.id] || [union.id];
      const p1Index = p1Unions.indexOf(union.id);
      const p1Offset = p1Unions.length > 1 ? (p1Index - (p1Unions.length - 1) / 2) * 16 : 0;
      const p1CenterY = p1.y + p1.height / 2 + p1Offset;

      const p2RightX = p2.x + p2.width;
      const p2Unions = personUnionsMapH[p2.id] || [union.id];
      const p2Index = p2Unions.indexOf(union.id);
      const p2Offset = p2Unions.length > 1 ? (p2Index - (p2Unions.length - 1) / 2) * 16 : 0;
      const p2CenterY = p2.y + p2.height / 2 + p2Offset;

      const uIndex = Math.max(p1Index, p2Index);
      const maxUnions = Math.max(p1Unions.length, p2Unions.length);
      const midXOffset = maxUnions > 1 ? (uIndex - (maxUnions - 1) / 2) * 8 : 0;

      if (!hasIntervening) {
        const midX = (Math.max(p1RightX, p2RightX) + ux) / 2 + midXOffset;
        edges.push({
          id: `edge_${p1.id}_${union.id}`,
          sourceId: p1.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: `M ${p1RightX} ${p1CenterY} L ${midX} ${p1CenterY} L ${midX} ${uy} L ${ux} ${uy}`,
          unionType,
          color: partnerColor,
        });
        edges.push({
          id: `edge_${p2.id}_${union.id}`,
          sourceId: p2.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: `M ${p2RightX} ${p2CenterY} L ${midX} ${p2CenterY} L ${midX} ${uy}`,
          unionType,
          color: partnerColor,
        });
      } else {
        const track = nonAdjTrackMapH[union.id] ?? 0;
        const routeX = Math.max(p1RightX, p2RightX) + 16 + track * 24 + midXOffset;
        edges.push({
          id: `edge_${p1.id}_${union.id}`,
          sourceId: p1.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: `M ${p1RightX} ${p1CenterY} L ${routeX} ${p1CenterY} L ${routeX} ${uy} L ${ux} ${uy}`,
          unionType,
          color: partnerColor,
        });
        edges.push({
          id: `edge_${p2.id}_${union.id}`,
          sourceId: p2.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: `M ${p2RightX} ${p2CenterY} L ${routeX} ${p2CenterY} L ${routeX} ${uy}`,
          unionType,
          color: partnerColor,
        });
      }
    } else if (partnerNodes.length === 1) {
      const p = partnerNodes[0];
      const pUnions = personUnionsMapH[p.id] || [union.id];
      const pIndex = pUnions.indexOf(union.id);
      const pOffset = pUnions.length > 1 ? (pIndex - (pUnions.length - 1) / 2) * 16 : 0;
      const px = p.x + p.width;
      const py = p.y + p.height / 2 + pOffset;
      edges.push({
        id: `edge_${p.id}_${union.id}`,
        sourceId: p.id,
        targetId: union.id,
        edgeType: 'partner-union',
        pathD: `M ${px} ${py} L ${ux} ${uy}`,
        unionType,
        color: partnerColor,
      });
    }

    // 2. Union to Children lines (Horizontal bus)
    if (union.childrenNodes.length > 0) {
      const children = union.childrenNodes;
      const minChildX = Math.min(...children.map((c) => c.x));
      const busX = union.busCoord ?? Math.max(ux + 24, ux + (minChildX - ux) / 2);
      const unionColor = union.color || '#6366f1';

      // Central stem from union going right to vertical bus bar
      edges.push({
        id: `edge_stem_${union.id}`,
        sourceId: union.id,
        targetId: union.id,
        edgeType: 'union-child',
        pathD: `M ${ux} ${uy} L ${busX} ${uy}`,
        color: unionColor,
      });

      // Vertical bus bar at busX
      const childCenterYList = children.map((c) => c.y + c.height / 2);
      const minY = Math.min(uy, ...childCenterYList);
      const maxY = Math.max(uy, ...childCenterYList);

      if (maxY > minY) {
        edges.push({
          id: `edge_bus_${union.id}`,
          sourceId: union.id,
          targetId: union.id,
          edgeType: 'union-child',
          pathD: `M ${busX} ${minY} L ${busX} ${maxY}`,
          color: unionColor,
        });
      }

      // Drop/branch lines into each child
      children.forEach((child) => {
        const cx = child.x;
        const cy = child.y + child.height / 2;
        edges.push({
          id: `edge_child_${union.id}_${child.id}`,
          sourceId: union.id,
          targetId: child.id,
          edgeType: 'union-child',
          pathD: `M ${busX} ${cy} L ${cx} ${cy}`,
          color: unionColor,
        });
      });
    }
  }

  // Compute family groups bounding boxes if active
  if (groupByFamily && familyGroups.length > 0) {
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

  // Compute bounding box
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
    if (groupByFamily) {
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
    nodes,
    unions,
    edges,
    familyGroups: groupByFamily ? familyGroups : undefined,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(800, maxX - minX),
      height: Math.max(600, maxY - minY),
    },
  };
}
