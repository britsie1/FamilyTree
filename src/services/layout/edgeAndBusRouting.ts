import type { LayoutNode, LayoutUnion, LayoutEdge } from '../../types/tree';
import { BRANCH_PALETTE } from './constants';

export interface IntervalItem {
  id: string;
  start: number;
  end: number;
}

export interface RawSegment {
  edgeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isVertical: boolean;
}

/**
 * Assigns tracks (0, 1, 2, ...) to items with 1D intervals [start, end]
 * using greedy interval graph coloring so that overlapping intervals
 * receive distinct tracks.
 */
export function assignIntervalTracks(items: IntervalItem[], padding: number = 5): Record<string, number> {
  const trackMap: Record<string, number> = {};
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const trackIntervals: Array<Array<{ start: number; end: number }>> = [];

  for (const item of sorted) {
    let assignedTrack = -1;
    for (let t = 0; t < trackIntervals.length; t++) {
      const hasOverlap = trackIntervals[t].some(
        (existing) => Math.max(existing.start, item.start) < Math.min(existing.end, item.end) + padding
      );
      if (!hasOverlap) {
        assignedTrack = t;
        trackIntervals[t].push({ start: item.start, end: item.end });
        break;
      }
    }
    if (assignedTrack === -1) {
      assignedTrack = trackIntervals.length;
      trackIntervals.push([{ start: item.start, end: item.end }]);
    }
    trackMap[item.id] = assignedTrack;
  }

  return trackMap;
}

/**
 * Assigns distinct branch colors from the palette to unions.
 */
export function getUnionColors(
  unions: Record<string, LayoutUnion>
): Record<string, string> {
  const unionColors: Record<string, string> = {};
  const unionList = Object.values(unions);
  unionList.forEach((u, idx) => {
    unionColors[u.id] = BRANCH_PALETTE[idx % BRANCH_PALETTE.length];
  });
  return unionColors;
}

/**
 * Computes multi-lane Y positions for all union child buses in vertical layout
 * to avoid collinear or overlapping bus bars at the same generational gap.
 */
export function computeMultiLaneBusY(
  unions: Record<string, LayoutUnion>
): Record<string, number> {
  const busYMap: Record<string, number> = {};
  const unionsWithChildren = Object.values(unions).filter((u) => u.childrenNodes.length > 0);

  if (unionsWithChildren.length === 0) return busYMap;

  // Group unions by target child generation tier so buses stay strictly within the generational channel
  const tiers: Record<number, LayoutUnion[]> = {};
  for (const u of unionsWithChildren) {
    const targetGen = Math.min(...u.childrenNodes.map((c) => c.generation));
    if (!tiers[targetGen]) tiers[targetGen] = [];
    tiers[targetGen].push(u);
  }

  for (const unionsInTier of Object.values(tiers)) {
    if (unionsInTier.length === 1) {
      const u = unionsInTier[0];
      const minChildY = Math.min(...u.childrenNodes.map((c) => c.y));
      const maxParentBottomY = u.partnerNodes.length > 0
        ? Math.max(...u.partnerNodes.map((p) => p.y + p.height))
        : u.y;
      const topBoundary = Math.max(u.y, maxParentBottomY);
      busYMap[u.id] = Math.round(topBoundary + (minChildY - topBoundary) / 2);
      continue;
    }

    // Calculate the X interval and vertical channel boundaries for each union's bus bar:
    const intervals = unionsInTier.map((u) => {
      const childCenters = u.childrenNodes.map((c) => c.x + c.width / 2);
      const minX = Math.min(u.x, ...childCenters);
      const maxX = Math.max(u.x, ...childCenters);
      const minChildY = Math.min(...u.childrenNodes.map((c) => c.y));
      const maxParentBottomY = u.partnerNodes.length > 0
        ? Math.max(...u.partnerNodes.map((p) => p.y + p.height))
        : u.y;
      const topBoundary = Math.max(u.y, maxParentBottomY);
      return {
        union: u,
        minX,
        maxX,
        minChildY,
        topBoundary,
      };
    });

    // Sort intervals by left edge
    intervals.sort((a, b) => a.minX - b.minX);

    const tracks: (typeof intervals)[] = [];
    const unionTrackMap: Record<string, number> = {};

    for (let i = 0; i < intervals.length; i++) {
      const item = intervals[i];
      const prevTrack = i > 0 ? unionTrackMap[intervals[i - 1].union.id] : -1;
      let assignedTrack = -1;

      // 1. Try to find a track that differs from immediate predecessor and doesn't overlap in X
      for (let t = 0; t < tracks.length; t++) {
        if (t === prevTrack) continue;
        const overlaps = tracks[t].some(
          (other) => Math.max(item.minX, other.minX) <= Math.min(item.maxX, other.maxX) + 40
        );
        if (!overlaps) {
          assignedTrack = t;
          tracks[t].push(item);
          break;
        }
      }

      // 2. If no alternating track found, try ANY track without horizontal overlap
      if (assignedTrack === -1) {
        for (let t = 0; t < tracks.length; t++) {
          const overlaps = tracks[t].some(
            (other) => Math.max(item.minX, other.minX) <= Math.min(item.maxX, other.maxX) + 40
          );
          if (!overlaps) {
            assignedTrack = t;
            tracks[t].push(item);
            break;
          }
        }
      }

      // 3. Open a new track if needed, or split 1 track into 2 for visual staggering
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
    const minChildYOverall = Math.min(...intervals.map((i) => i.minChildY));
    const maxTopBoundaryOverall = Math.max(...intervals.map((i) => i.topBoundary));
    const channelTop = maxTopBoundaryOverall + 16;
    const channelBottom = minChildYOverall - 16;
    const channelHeight = channelBottom - channelTop;
    const baseMidY = maxTopBoundaryOverall + (minChildYOverall - maxTopBoundaryOverall) / 2;

    if (numTracks <= 1) {
      for (const item of intervals) {
        busYMap[item.union.id] = Math.round(baseMidY);
      }
    } else {
      const minSpacing = 18;
      const trackSpacing = Math.max(minSpacing, Math.min(26, channelHeight / (numTracks + 1)));
      for (const item of intervals) {
        const t = unionTrackMap[item.union.id] ?? 0;
        const offset = (t - (numTracks - 1) / 2) * trackSpacing;
        busYMap[item.union.id] = Math.round(baseMidY + offset);
      }
    }
  }

  return busYMap;
}

/**
 * Finds all horizontal segment Y-coordinates intersecting a vertical line segment.
 */
export function findOverpasses(
  vX: number,
  vYStart: number,
  vYEnd: number,
  horizontalSegments: RawSegment[],
  excludeEdgeId?: string
): number[] {
  const minY = Math.min(vYStart, vYEnd);
  const maxY = Math.max(vYStart, vYEnd);
  const crossings: number[] = [];

  for (const hSeg of horizontalSegments) {
    if (
      (!excludeEdgeId || hSeg.edgeId !== excludeEdgeId) &&
      hSeg.y1 > minY + 4 &&
      hSeg.y1 < maxY - 4 &&
      vX > Math.min(hSeg.x1, hSeg.x2) + 2 &&
      vX < Math.max(hSeg.x1, hSeg.x2) - 2
    ) {
      crossings.push(hSeg.y1);
    }
  }

  return crossings;
}

/**
 * Builds an SVG path string for a vertical line segment from (x, yStart) to (x, yEnd),
 * inserting smooth arc "bridge-hops" over any given crossing Y coordinates.
 */
export function buildVerticalPathWithHops(
  x: number,
  yStart: number,
  yEnd: number,
  crossings: number[],
  radius: number
): string {
  if (crossings.length === 0) {
    return `M ${x} ${yStart} L ${x} ${yEnd}`;
  }

  const sortedCrossings = [...crossings].sort((a, b) => (yEnd > yStart ? a - b : b - a));

  let path = `M ${x} ${yStart}`;

  for (const crossY of sortedCrossings) {
    const hopStartY = yEnd > yStart ? crossY - radius : crossY + radius;
    const hopEndY = yEnd > yStart ? crossY + radius : crossY - radius;

    path += ` L ${x} ${hopStartY}`;
    path += ` A ${radius} ${radius} 0 0 1 ${x} ${hopEndY}`;
  }

  path += ` L ${x} ${yEnd}`;
  return path;
}

/**
 * Generates all tree connection paths and automatically calculates
 * bridge-hops (jump-over arcs) wherever vertical lines cross horizontal lines.
 */
export function generateEdgesWithBridgeHops(
  nodes: Record<string, LayoutNode>,
  unions: Record<string, LayoutUnion>
): { edges: LayoutEdge[] } {
  const edges: LayoutEdge[] = [];
  const horizontalSegments: RawSegment[] = [];
  const HOP_RADIUS = 7;

  // Track bottom-exiting unions (non-adjacent unions and single-parent unions) per person
  const personBottomUnionsMap: Record<string, string[]> = {};
  for (const [uId, union] of Object.entries(unions)) {
    if (union.partnerNodes.length === 2) {
      const p1 = union.partnerNodes[0];
      const p2 = union.partnerNodes[1];
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.x > minX && n.x < maxX
      );
      if (hasIntervening) {
        if (!personBottomUnionsMap[p1.id]) personBottomUnionsMap[p1.id] = [];
        personBottomUnionsMap[p1.id].push(uId);
        if (!personBottomUnionsMap[p2.id]) personBottomUnionsMap[p2.id] = [];
        personBottomUnionsMap[p2.id].push(uId);
      }
    } else if (union.partnerNodes.length === 1) {
      const p = union.partnerNodes[0];
      if (!personBottomUnionsMap[p.id]) personBottomUnionsMap[p.id] = [];
      personBottomUnionsMap[p.id].push(uId);
    }
  }

  // 1. Collect all horizontal segments (partner rails and child buses)
  for (const union of Object.values(unions)) {
    const { partnerNodes, x: ux, y: uy } = union;

    if (partnerNodes.length === 2) {
      const p1 = partnerNodes[0];
      const p2 = partnerNodes[1];
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.x > minX && n.x < maxX
      );

      if (!hasIntervening) {
        const p1X = p1.x < ux ? p1.x + p1.width : p1.x;
        const p2X = p2.x < ux ? p2.x + p2.width : p2.x;
        horizontalSegments.push({
          edgeId: `partner_bus_${union.id}`,
          x1: Math.min(p1X, p2X),
          y1: uy,
          x2: Math.max(p1X, p2X),
          y2: uy,
          isVertical: false,
        });
      } else {
        const p1BottomUnions = personBottomUnionsMap[p1.id] || [union.id];
        const p1Index = p1BottomUnions.indexOf(union.id);
        const p1Offset = p1BottomUnions.length > 1 ? (p1Index - (p1BottomUnions.length - 1) / 2) * 18 : 0;
        const p1BottomX = p1.x + p1.width / 2 + p1Offset;

        const p2BottomUnions = personBottomUnionsMap[p2.id] || [union.id];
        const p2Index = p2BottomUnions.indexOf(union.id);
        const p2Offset = p2BottomUnions.length > 1 ? (p2Index - (p2BottomUnions.length - 1) / 2) * 18 : 0;
        const p2BottomX = p2.x + p2.width / 2 + p2Offset;

        horizontalSegments.push({
          edgeId: `partner_bus_${union.id}`,
          x1: Math.min(p1BottomX, p2BottomX),
          y1: uy,
          x2: Math.max(p1BottomX, p2BottomX),
          y2: uy,
          isVertical: false,
        });
      }
    }

    if (union.childrenNodes.length > 0) {
      const children = union.childrenNodes;
      const minChildY = Math.min(...children.map((c) => c.y));
      const busY = union.busCoord ?? Math.max(uy + 20, uy + (minChildY - uy) / 2);
      const childCenterXList = children.map((c) => c.x + c.width / 2);
      const minX = Math.min(ux, ...childCenterXList);
      const maxX = Math.max(ux, ...childCenterXList);
      if (maxX > minX) {
        horizontalSegments.push({
          edgeId: `bus_${union.id}`,
          x1: minX,
          y1: busY,
          x2: maxX,
          y2: busY,
          isVertical: false,
        });
      }
    }
  }

  // 2. Generate Partner to Union lines (with bridge hops for non-adjacent drops crossing horizontal rails)
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
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const hasIntervening = Object.values(nodes).some(
        (n) => n.generation === p1.generation && n.id !== p1.id && n.id !== p2.id && n.x > minX && n.x < maxX
      );

      if (!hasIntervening) {
        const p1X = p1.x < ux ? p1.x + p1.width : p1.x;
        const p2X = p2.x < ux ? p2.x + p2.width : p2.x;

        edges.push({
          id: `edge_${p1.id}_${union.id}`,
          sourceId: p1.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: `M ${p1X} ${uy} L ${ux} ${uy}`,
          unionType,
          color: partnerColor,
        });

        edges.push({
          id: `edge_${p2.id}_${union.id}`,
          sourceId: p2.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: `M ${p2X} ${uy} L ${ux} ${uy}`,
          unionType,
          color: partnerColor,
        });
      } else {
        const p1BottomUnions = personBottomUnionsMap[p1.id] || [union.id];
        const p1Index = p1BottomUnions.indexOf(union.id);
        const p1Offset = p1BottomUnions.length > 1 ? (p1Index - (p1BottomUnions.length - 1) / 2) * 18 : 0;
        const p1BottomX = p1.x + p1.width / 2 + p1Offset;
        const p1BottomY = p1.y + p1.height;

        const p2BottomUnions = personBottomUnionsMap[p2.id] || [union.id];
        const p2Index = p2BottomUnions.indexOf(union.id);
        const p2Offset = p2BottomUnions.length > 1 ? (p2Index - (p2BottomUnions.length - 1) / 2) * 18 : 0;
        const p2BottomX = p2.x + p2.width / 2 + p2Offset;
        const p2BottomY = p2.y + p2.height;

        const p1Crossings = findOverpasses(p1BottomX, p1BottomY, uy, horizontalSegments, `partner_bus_${union.id}`);
        const p1Path = buildVerticalPathWithHops(p1BottomX, p1BottomY, uy, p1Crossings, HOP_RADIUS) + ` L ${ux} ${uy}`;

        const p2Crossings = findOverpasses(p2BottomX, p2BottomY, uy, horizontalSegments, `partner_bus_${union.id}`);
        const p2Path = buildVerticalPathWithHops(p2BottomX, p2BottomY, uy, p2Crossings, HOP_RADIUS) + ` L ${ux} ${uy}`;

        edges.push({
          id: `edge_${p1.id}_${union.id}`,
          sourceId: p1.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: p1Path,
          unionType,
          color: partnerColor,
        });

        edges.push({
          id: `edge_${p2.id}_${union.id}`,
          sourceId: p2.id,
          targetId: union.id,
          edgeType: 'partner-union',
          pathD: p2Path,
          unionType,
          color: partnerColor,
        });
      }
    } else if (partnerNodes.length === 1) {
      const p = partnerNodes[0];
      const px = ux;
      const py = p.y + p.height;
      const singleCrossings = findOverpasses(px, py, uy, horizontalSegments, `bus_${union.id}`);
      const singlePath = buildVerticalPathWithHops(px, py, uy, singleCrossings, HOP_RADIUS);

      edges.push({
        id: `edge_${p.id}_${union.id}`,
        sourceId: p.id,
        targetId: union.id,
        edgeType: 'partner-union',
        pathD: singlePath,
        unionType,
        color: partnerColor,
      });
    }
  }

  // 3. Process Union Stems and Drops with Bridge Hops
  for (const union of Object.values(unions)) {
    if (union.childrenNodes.length === 0) continue;

    const children = union.childrenNodes;
    const minChildY = Math.min(...children.map((c) => c.y));
    const busY = union.busCoord ?? Math.max(union.y + 20, union.y + (minChildY - union.y) / 2);
    const unionColor = union.color || '#6366f1';

    // A) Central stem from union down to bus
    const stemCrossings = findOverpasses(union.x, union.y, busY, horizontalSegments);
    const stemPath = buildVerticalPathWithHops(union.x, union.y, busY, stemCrossings, HOP_RADIUS);
    edges.push({
      id: `edge_stem_${union.id}`,
      sourceId: union.id,
      targetId: union.id,
      edgeType: 'union-child',
      pathD: stemPath,
      color: unionColor,
      hasHop: stemCrossings.length > 0,
    });

    // B) Horizontal bus bar
    const childCenterXList = children.map((c) => c.x + c.width / 2);
    const minX = Math.min(union.x, ...childCenterXList);
    const maxX = Math.max(union.x, ...childCenterXList);

    if (maxX > minX) {
      edges.push({
        id: `edge_bus_${union.id}`,
        sourceId: union.id,
        targetId: union.id,
        edgeType: 'union-child',
        pathD: `M ${minX} ${busY} L ${maxX} ${busY}`,
        color: unionColor,
      });
    }

    // C) Drop lines to each child
    children.forEach((child) => {
      const cx = child.x + child.width / 2;
      const cy = child.y;

      const dropCrossings = findOverpasses(cx, busY, cy, horizontalSegments);
      const dropPath = buildVerticalPathWithHops(cx, busY, cy, dropCrossings, HOP_RADIUS);
      edges.push({
        id: `edge_child_${union.id}_${child.id}`,
        sourceId: union.id,
        targetId: child.id,
        edgeType: 'union-child',
        pathD: dropPath,
        color: unionColor,
        hasHop: dropCrossings.length > 0,
      });
    });
  }

  return { edges };
}
