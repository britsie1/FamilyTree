import type { TreeData, Person, Union, LayoutNode, LayoutUnion, LayoutEdge, TreeLayout, LayoutStyle, FamilyGroup } from '../types/tree';

export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 104;
export const HORIZONTAL_SPACING = 60;
export const VERTICAL_SPACING = 150;
export const UNION_NODE_RADIUS = 13;

export const HORIZONTAL_COL_SPACING = 160;
export const VERTICAL_ROW_SPACING = 44;

export const FAMILY_GROUP_GAP = 260;
export const FAMILY_GROUP_GAP_H = 160;
export const FAMILY_GROUP_PADDING = 28;

export const BRANCH_PALETTE = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#0284c7', // Sky
  '#e11d48', // Rose
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#6366f1', // Indigo Accent
  '#10b981', // Emerald Accent
];

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

export interface IntervalItem {
  id: string;
  start: number;
  end: number;
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

export interface GenerationGroup {
  level: number;
  peopleIds: string[];
}

/**
 * Calculates the maximum generation a person can be placed at without
 * violating any parent-child constraints (they must be strictly above all their children).
 */
function getMaxAllowedGenForPerson(
  pId: string,
  tree: TreeData,
  generations: Record<string, number>
): number {
  const p = tree.people[pId];
  if (!p) return Infinity;
  let minChild = Infinity;
  for (const u of Object.values(tree.unions)) {
    if (u.partnerIds.includes(pId) && u.childrenIds) {
      for (const cId of u.childrenIds) {
        if (cId !== pId && generations[cId] !== undefined) {
          minChild = Math.min(minChild, generations[cId]);
        }
      }
    }
  }
  return minChild !== Infinity ? minChild - 1 : Infinity;
}

/**
 * Calculates topological generational levels for all individuals in the tree.
 * Uses a two-phase topological layout:
 * Phase 1 (Forward ASAP): Children must be strictly lower (>= maxParentGen + 1) than their parents,
 *                         and partners in a union share the same generation.
 * Phase 2 (Backward ALAP / Pull-Down): In-laws and ancestors who enter the tree without parents
 *                                      are pulled down so they align directly above their children
 *                                      (e.g. Ana Roque sits on generation 1, directly above daughter Daniela at 2).
 */
export function calculateGenerations(tree: TreeData): Record<string, number> {
  const generations: Record<string, number> = {};
  const peopleIds = Object.keys(tree.people).sort();

  if (peopleIds.length === 0) return generations;

  // Initialize with explicit generations if available, otherwise 0
  peopleIds.forEach((id) => {
    if (tree.people[id]?.generation !== undefined) {
      generations[id] = tree.people[id].generation!;
    } else {
      generations[id] = 0;
    }
  });

  const sortedUnions = Object.values(tree.unions).sort((a, b) => a.id.localeCompare(b.id));
  const sortedPeople = Object.values(tree.people).sort((a, b) => a.id.localeCompare(b.id));

  let changed = true;
  let iterations = 0;
  const maxIterations = peopleIds.length * 3 + 20;

  // Phase 1: Forward ASAP pass (ensures every child is >= parent + 1, and partners are equalized)
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 1. Children must be at least 1 generation lower than their parents
    for (const union of sortedUnions) {
      if (!union.partnerIds || union.partnerIds.length === 0) continue;

      let maxParentGen = -Infinity;
      for (const pId of union.partnerIds) {
        if (generations[pId] !== undefined) {
          maxParentGen = Math.max(maxParentGen, generations[pId]);
        }
      }
      if (maxParentGen === -Infinity) continue;

      // Partners in a union should be on the same generational rank
      for (const pId of union.partnerIds) {
        if (generations[pId] < maxParentGen) {
          generations[pId] = maxParentGen;
          changed = true;
        }
      }

      // Children are placed in maxParentGen + 1
      const requiredChildGen = maxParentGen + 1;
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined && generations[cId] < requiredChildGen) {
          generations[cId] = requiredChildGen;
          changed = true;
        }
      }

      // Siblings in a union share the same generation rank (aligned with their siblings)
      let maxChildGen = requiredChildGen;
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined) {
          maxChildGen = Math.max(maxChildGen, generations[cId]);
        }
      }
      for (const cId of union.childrenIds) {
        if (generations[cId] !== undefined && generations[cId] < maxChildGen) {
          generations[cId] = maxChildGen;
          changed = true;
        }
      }
    }

    // 2. Individuals with explicit parentUnionId
    for (const person of sortedPeople) {
      if (person.parentUnionId && tree.unions[person.parentUnionId]) {
        const pUnion = tree.unions[person.parentUnionId];
        if (pUnion.partnerIds && pUnion.partnerIds.length > 0) {
          let maxParentGen = -Infinity;
          for (const pId of pUnion.partnerIds) {
            if (generations[pId] !== undefined) {
              maxParentGen = Math.max(maxParentGen, generations[pId]);
            }
          }
          if (maxParentGen !== -Infinity && generations[person.id] <= maxParentGen) {
            generations[person.id] = maxParentGen + 1;
            changed = true;
          }
        }
      }
    }
  }

  // Phase 2: Pull-down pass (aligns rootless ancestors directly above their children)
  // Prevents in-law parents (like Ana Roque) from floating up on level 0 with great-grandparents
  // when their child (Daniela) is on level 2.
  changed = true;
  iterations = 0;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 2a. Pull parents down towards their children
    for (const union of sortedUnions) {
      if (!union.childrenIds || union.childrenIds.length === 0) continue;

      // Find the lowest generation of any child in this union
      const minChildGen = Math.min(...union.childrenIds.map((cId) => generations[cId] ?? 999));
      if (minChildGen === Infinity || minChildGen === 999) continue;

      let targetGen = minChildGen - 1;
      for (const pId of union.partnerIds) {
        const maxForP = getMaxAllowedGenForPerson(pId, tree, generations);
        targetGen = Math.min(targetGen, maxForP);
      }

      for (const pId of union.partnerIds) {
        if (targetGen > generations[pId]) {
          generations[pId] = targetGen;
          changed = true;
        }
      }
    }

    // 2b. Equalize partners across ALL unions (even childless ones), bounded by max allowed generation
    for (const union of Object.values(tree.unions)) {
      if (union.partnerIds.length < 2) continue;
      const maxPartnerGen = Math.max(...union.partnerIds.map((pId) => generations[pId] ?? -Infinity));
      for (const pId of union.partnerIds) {
        const maxAllowed = getMaxAllowedGenForPerson(pId, tree, generations);
        const target = Math.min(maxPartnerGen, maxAllowed);
        if (target > generations[pId]) {
          generations[pId] = target;
          changed = true;
        }
      }
    }
  }

  // Normalize so lowest generation starts at 0 ONLY IF no negative or explicit generations are present
  const hasNegativeGen = Object.values(generations).some((g) => g < 0);
  const hasExplicitGen = Object.values(tree.people).some((p) => p.generation !== undefined);
  if (!hasNegativeGen && !hasExplicitGen) {
    const minGen = Math.min(...Object.values(generations), 0);
    if (minGen < 0) {
      peopleIds.forEach((id) => {
        generations[id] -= minGen;
      });
    }
  }

  return generations;
}

export interface DetectedFamilies {
  familyGroups: FamilyGroup[];
  personFamilyMap: Record<string, string>;
}

/**
 * Automatically detects distinct family groups/lineages across marriage bridges.
 * Finds the primary person and their spouse, cuts the inter-family marriage link,
 * and traverses both sides to determine the two family branches (e.g. Brits Family vs. Roque Family).
 */
export function detectFamilyGroups(tree: TreeData): DetectedFamilies {
  const peopleIds = Object.keys(tree.people).sort();
  if (peopleIds.length === 0) {
    return { familyGroups: [], personFamilyMap: {} };
  }

  // 1. Determine root / primary person
  const rootPersonId =
    tree.rootPersonId && tree.people[tree.rootPersonId]
      ? tree.rootPersonId
      : peopleIds[0];
  const rootPerson = tree.people[rootPersonId];

  // 2. Identify primary bridge spouse and union if exists
  let bridgeUnionId: string | null = null;
  let spouseId: string | null = null;

  if (rootPerson) {
    for (const uId of rootPerson.unionIds || []) {
      const u = tree.unions[uId];
      if (!u) continue;
      const otherPartners = u.partnerIds.filter((id) => id !== rootPersonId && tree.people[id]);
      if (otherPartners.length > 0) {
        for (const candidateSpouseId of otherPartners) {
          const candidate = tree.people[candidateSpouseId];
          if (candidate) {
            bridgeUnionId = uId;
            spouseId = candidateSpouseId;
            // Strong family bridge if candidate has parents or other unions
            if (candidate.parentUnionId || (candidate.unionIds && candidate.unionIds.length > 1)) break;
          }
        }
        if (bridgeUnionId) break;
      }
    }
  }

  const personFamilyMap: Record<string, string> = {};
  const familyMembers: Record<string, string[]> = {};

  // If a bridge connection exists between rootPerson and spouse
  if (bridgeUnionId && spouseId) {
    const fam1Id = 'family_primary';
    const fam2Id = 'family_spouse';
    familyMembers[fam1Id] = [];
    familyMembers[fam2Id] = [];

    const traverseFamily = (
      startId: string,
      famId: string,
      blockedUnionId: string,
      blockedPartnerId: string
    ) => {
      const queue = [startId];
      const visited = new Set<string>([startId, blockedPartnerId]);

      while (queue.length > 0) {
        const currId = queue.shift()!;
        if (!personFamilyMap[currId]) {
          personFamilyMap[currId] = famId;
          familyMembers[famId].push(currId);
        }

        const curr = tree.people[currId];
        if (!curr) continue;

        // Ancestors & parents via parentUnionId
        if (curr.parentUnionId) {
          const pu = tree.unions[curr.parentUnionId];
          if (pu) {
            for (const parentId of pu.partnerIds) {
              if (parentId !== blockedPartnerId && !visited.has(parentId) && tree.people[parentId]) {
                visited.add(parentId);
                queue.push(parentId);
              }
            }
            if (curr.parentUnionId !== blockedUnionId) {
              for (const sibId of pu.childrenIds) {
                if (!visited.has(sibId) && tree.people[sibId]) {
                  visited.add(sibId);
                  queue.push(sibId);
                }
              }
            }
          }
        }

        // Unions where curr is a partner
        for (const uId of curr.unionIds || []) {
          const u = tree.unions[uId];
          if (!u) continue;

          // If this is the bridge union, do NOT cross to the blocked spouse
          if (uId === blockedUnionId) {
            // Traverse shared children under primary family
            if (startId === rootPersonId) {
              for (const cId of u.childrenIds || []) {
                if (!visited.has(cId) && tree.people[cId]) {
                  visited.add(cId);
                  queue.push(cId);
                }
              }
            }
            continue;
          }

          for (const partnerId of u.partnerIds) {
            if (partnerId !== blockedPartnerId && !visited.has(partnerId) && tree.people[partnerId]) {
              visited.add(partnerId);
              queue.push(partnerId);
            }
          }
          for (const cId of u.childrenIds || []) {
            if (!visited.has(cId) && tree.people[cId]) {
              visited.add(cId);
              queue.push(cId);
            }
          }
        }

        // Any unions where curr is listed as a child
        for (const u of Object.values(tree.unions)) {
          if (u.id !== blockedUnionId && u.childrenIds?.includes(currId) && u.id !== curr.parentUnionId) {
            for (const parentId of u.partnerIds) {
              if (parentId !== blockedPartnerId && !visited.has(parentId) && tree.people[parentId]) {
                visited.add(parentId);
                queue.push(parentId);
              }
            }
          }
        }
      }
    };

    // Traverse Primary Family (from rootPerson, blocking bridge to spouse)
    traverseFamily(rootPersonId, fam1Id, bridgeUnionId, spouseId);

    // Traverse Spouse Family (from spouse, blocking bridge to rootPerson)
    traverseFamily(spouseId, fam2Id, bridgeUnionId, rootPersonId);
  }

  // Handle any remaining unassigned nodes
  let extraCounter = 1;
  for (const pId of peopleIds) {
    if (!personFamilyMap[pId]) {
      const famId = Object.keys(familyMembers).length === 0 ? 'family_primary' : `family_extra_${extraCounter++}`;
      if (!familyMembers[famId]) familyMembers[famId] = [];

      const queue = [pId];
      const visited = new Set<string>([pId]);
      while (queue.length > 0) {
        const currId = queue.shift()!;
        personFamilyMap[currId] = famId;
        familyMembers[famId].push(currId);

        const curr = tree.people[currId];
        if (!curr) continue;

        if (curr.parentUnionId && tree.unions[curr.parentUnionId]) {
          const pu = tree.unions[curr.parentUnionId];
          for (const relId of [...pu.partnerIds, ...pu.childrenIds]) {
            if (!visited.has(relId) && !personFamilyMap[relId] && tree.people[relId]) {
              visited.add(relId);
              queue.push(relId);
            }
          }
        }
        for (const uId of curr.unionIds || []) {
          const u = tree.unions[uId];
          if (!u) continue;
          for (const relId of [...u.partnerIds, ...u.childrenIds]) {
            if (!visited.has(relId) && !personFamilyMap[relId] && tree.people[relId]) {
              visited.add(relId);
              queue.push(relId);
            }
          }
        }
      }
    }
  }

  // Helper to determine family name from member surnames
  const getFamilyName = (memberIds: string[], defaultLabel: string): string => {
    const surnameCounts: Record<string, number> = {};
    for (const id of memberIds) {
      const p = tree.people[id];
      if (p) {
        if (p.lastName && p.lastName.trim()) {
          const ln = p.lastName.trim();
          surnameCounts[ln] = (surnameCounts[ln] || 0) + 1;
        }
        if (p.maidenName && p.maidenName.trim()) {
          const mn = p.maidenName.trim();
          surnameCounts[mn] = (surnameCounts[mn] || 0) + 1;
        }
      }
    }
    const topSurname = Object.keys(surnameCounts).sort(
      (a, b) => (surnameCounts[b] - surnameCounts[a]) || a.localeCompare(b)
    )[0];
    if (topSurname) {
      return `${topSurname} Family`;
    }
    return defaultLabel;
  };

  const PALETTES = [
    {
      color: '#4f46e5',
      badgeBg: 'bg-indigo-50 border-indigo-200',
      badgeText: 'text-indigo-700',
      borderColor: '#c7d2fe',
      bgColor: 'rgba(238, 242, 255, 0.45)',
    },
    {
      color: '#059669',
      badgeBg: 'bg-emerald-50 border-emerald-200',
      badgeText: 'text-emerald-700',
      borderColor: '#a7f3d0',
      bgColor: 'rgba(236, 253, 245, 0.45)',
    },
    {
      color: '#d97706',
      badgeBg: 'bg-amber-50 border-amber-200',
      badgeText: 'text-amber-700',
      borderColor: '#fde68a',
      bgColor: 'rgba(254, 243, 199, 0.45)',
    },
    {
      color: '#9333ea',
      badgeBg: 'bg-purple-50 border-purple-200',
      badgeText: 'text-purple-700',
      borderColor: '#e9d5ff',
      bgColor: 'rgba(250, 245, 255, 0.45)',
    },
  ];

  const familyGroups: FamilyGroup[] = [];
  const famIds = Object.keys(familyMembers);

  famIds.forEach((famId, idx) => {
    const members = familyMembers[famId];
    if (members.length === 0) return;

    const palette = PALETTES[idx % PALETTES.length];
    const defaultLabel = idx === 0 ? 'My Family' : idx === 1 ? "Wife's Family" : `Family Branch ${idx + 1}`;
    const name = getFamilyName(members, defaultLabel);

    familyGroups.push({
      id: famId,
      name,
      color: palette.color,
      badgeBg: palette.badgeBg,
      badgeText: palette.badgeText,
      borderColor: palette.borderColor,
      bgColor: palette.bgColor,
      memberIds: members,
    });
  });

  return {
    familyGroups,
    personFamilyMap,
  };
}

/**
 * Orders a subset of people within a generation level,
 * grouping siblings and chaining partners.
 */
function orderPeopleSubset(
  ids: string[],
  tree: TreeData,
  unionOrderMap: Record<string, number>
): string[] {
  const visited = new Set<string>();
  const orderedIds: string[] = [];

  const partnerGraph: Record<string, string[]> = {};
  ids.forEach((id) => {
    partnerGraph[id] = [];
  });

  const deterministicIds = [...ids].sort();

  deterministicIds.forEach((id) => {
    const p = tree.people[id];
    if (!p) return;
    for (const uId of p.unionIds) {
      const u = tree.unions[uId];
      if (u) {
        for (const partnerId of u.partnerIds) {
          if (partnerId !== id && ids.includes(partnerId)) {
            if (!partnerGraph[id].includes(partnerId)) partnerGraph[id].push(partnerId);
            if (!partnerGraph[partnerId].includes(id)) partnerGraph[partnerId].push(id);
          }
        }
      }
    }
  });

  // Ensure deterministic partner neighbor ordering
  for (const id of Object.keys(partnerGraph)) {
    partnerGraph[id].sort();
  }

  const tracePartnerChain = (startId: string): string[] => {
    const chain: string[] = [];
    const chainSet = new Set<string>();
    const componentNodes: string[] = [];
    const queue = [startId];
    chainSet.add(startId);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      componentNodes.push(curr);
      for (const neighbor of partnerGraph[curr]) {
        if (!chainSet.has(neighbor) && !visited.has(neighbor)) {
          chainSet.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (componentNodes.length <= 1) {
      return componentNodes;
    }

    let minDegree = Infinity;
    const candidates: string[] = [];
    for (const node of componentNodes) {
      const deg = partnerGraph[node].filter((n) => chainSet.has(n)).length;
      if (deg < minDegree) {
        minDegree = deg;
        candidates.length = 0;
        candidates.push(node);
      } else if (deg === minDegree) {
        candidates.push(node);
      }
    }

    // Deterministically pick the best endpoint among minDegree candidates:
    // 1. If startId is an endpoint, prefer starting from startId to preserve local context
    // 2. Otherwise, sort candidates deterministically (prefer native descendant with parents, then birthDate, then id)
    let endpoint = candidates[0];
    if (candidates.includes(startId)) {
      endpoint = startId;
    } else {
      candidates.sort((a, b) => {
        const aHasParents = Boolean(tree.people[a]?.parentUnionId);
        const bHasParents = Boolean(tree.people[b]?.parentUnionId);
        if (aHasParents !== bHasParents) return aHasParents ? -1 : 1;
        return a.localeCompare(b);
      });
      endpoint = candidates[0];
    }

    const walked = new Set<string>();
    let current: string | null = endpoint;
    while (current && !walked.has(current)) {
      chain.push(current);
      walked.add(current);
      const nextCandidates: string[] = partnerGraph[current].filter((n) => chainSet.has(n) && !walked.has(n));
      nextCandidates.sort();
      current = nextCandidates[0] || null;
    }

    const remaining = componentNodes.filter((n) => !walked.has(n)).sort();
    for (const node of remaining) {
      chain.push(node);
      walked.add(node);
    }

    return chain;
  };

  const byParentUnion: Record<string, string[]> = {};
  const withoutParents: string[] = [];

  for (const id of deterministicIds) {
    const p = tree.people[id];
    if (p && p.parentUnionId) {
      if (!byParentUnion[p.parentUnionId]) byParentUnion[p.parentUnionId] = [];
      byParentUnion[p.parentUnionId].push(id);
    } else {
      withoutParents.push(id);
    }
  }

  const sortedParentUnionIds = Object.keys(byParentUnion).sort((a, b) => {
    const orderA = unionOrderMap[a] ?? 9999;
    const orderB = unionOrderMap[b] ?? 9999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  for (const uId of sortedParentUnionIds) {
    const siblingIds = byParentUnion[uId];
    const parentUnion = tree.unions[uId];
    const canonicalChildren = parentUnion?.childrenIds || [];
    // Sort siblings deterministically (by birthDate, canonical childrenIds order, then id)
    siblingIds.sort((a, b) => {
      const personA = tree.people[a];
      const personB = tree.people[b];
      if (personA?.birthDate && personB?.birthDate) {
        const cmp = personA.birthDate.localeCompare(personB.birthDate);
        if (cmp !== 0) return cmp;
      } else if (personA?.birthDate) {
        return -1;
      } else if (personB?.birthDate) {
        return 1;
      }
      const idxA = canonicalChildren.indexOf(a);
      const idxB = canonicalChildren.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const sId of siblingIds) {
      if (!visited.has(sId)) {
        const chain = tracePartnerChain(sId);
        for (const personInChain of chain) {
          if (!visited.has(personInChain)) {
            visited.add(personInChain);
            orderedIds.push(personInChain);
          }
        }
      }
    }
  }


  for (const id of withoutParents) {
    if (!visited.has(id)) {
      const chain = tracePartnerChain(id);
      for (const personInChain of chain) {
        if (!visited.has(personInChain)) {
          visited.add(personInChain);
          orderedIds.push(personInChain);
        }
      }
    }
  }

  return orderedIds;
}

/**
 * Orders individuals horizontally within each generation level.
 * 1. Solves partnership chains (e.g. D - A - B - E for remarriages) so partner pairs are adjacent.
 * 2. Groups sibling pods together under their parents.
 * 3. Orders children on descendant generations according to the horizontal position of their parent unions.
 * 4. When personFamilyMap is provided, preserves contiguous family groupings.
 */
export function orderGenerations(
  tree: TreeData,
  generations: Record<string, number>,
  personFamilyMap?: Record<string, string>,
  familyOrder?: string[]
): GenerationGroup[] {
  const genMap: Record<number, string[]> = {};
  const sortedPeopleIds = Object.keys(generations).sort();

  for (const id of sortedPeopleIds) {
    const gen = generations[id];
    if (!genMap[gen]) genMap[gen] = [];
    genMap[gen].push(id);
  }

  const levels = Object.keys(genMap).map(Number).sort((a, b) => a - b);
  const orderedGroups: GenerationGroup[] = [];

  const unionOrderMap: Record<string, number> = {};
  let unionCounter = 0;

  for (const level of levels) {
    const ids = genMap[level];
    let orderedIds: string[] = [];

    if (personFamilyMap) {
      // Find all distinct families present at this level in canonical order
      const levelFamilyOrder: string[] = [];
      const seenFams = new Set<string>();

      // First add families in global canonical order
      if (familyOrder) {
        for (const famId of familyOrder) {
          if (ids.some((id) => (personFamilyMap[id] || 'unknown') === famId)) {
            levelFamilyOrder.push(famId);
            seenFams.add(famId);
          }
        }
      }

      // Then any other remaining families present
      for (const id of ids) {
        const famId = personFamilyMap[id] || 'unknown';
        if (!seenFams.has(famId)) {
          seenFams.add(famId);
          levelFamilyOrder.push(famId);
        }
      }

      // Order each family group sequentially
      for (const famId of levelFamilyOrder) {
        const famSubset = ids.filter((id) => (personFamilyMap[id] || 'unknown') === famId);
        if (famSubset.length > 0) {
          orderedIds.push(...orderPeopleSubset(famSubset, tree, unionOrderMap));
        }
      }
    } else {
      orderedIds = orderPeopleSubset(ids, tree, unionOrderMap);
    }

    orderedIds.forEach((pId) => {
      const p = tree.people[pId];
      if (p) {
        const unions = [...(p.unionIds || [])].sort();
        unions.forEach((uId) => {
          if (unionOrderMap[uId] === undefined) {
            unionOrderMap[uId] = unionCounter++;
          }
        });
      }
    });

    orderedGroups.push({
      level,
      peopleIds: orderedIds,
    });
  }

  return orderedGroups;
}

/**
 * Computes layout coordinates for all individuals and unions,
 * with collision avoidance and smooth routing for multiple partners.
 */
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

      // Find parents of this pod placed above
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
 * Computes layout coordinates for all individuals and unions using the
 * classic vertical (top-down) generational layout.
 * When adjustSpacing is true, adjusts horizontal spacing based on the widest
 * generation row upwards and downwards so parents and children are closer together.
 */
export function computeVerticalLayout(
  tree: TreeData,
  groupByFamily: boolean = false,
  adjustSpacing: boolean = true
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

  const nodes: Record<string, LayoutNode> = {};
  const unions: Record<string, LayoutUnion> = {};

  // First pass: compute coordinates for each generation level
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
        const x = person.x !== undefined ? person.x : autoX;
        const y = person.y !== undefined ? person.y : autoY;

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

          const x = person.x !== undefined ? person.x : autoX;
          const y = person.y !== undefined ? person.y : autoY;

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
          nodes[pId] = {
            id: pId,
            type: 'person',
            data: person,
            x: person.x !== undefined ? person.x : autoX,
            y: person.y !== undefined ? person.y : autoY,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            generation: level,
            order: idx,
            familyId: personFamilyMap[pId],
          };
        });
      }
    }
  }

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

  // Multi-lane bus coordination & branch color assignment for vertical layout
  const busYMap = computeMultiLaneBusY(unions);
  const unionColors = getUnionColors(unions);
  for (const [uId, u] of Object.entries(unions)) {
    u.busCoord = busYMap[uId];
    u.color = unionColors[uId];
  }

  // Third pass: generate edges with crossing detection & bridge-hops
  const { edges } = generateEdgesWithBridgeHops(nodes, unions);

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

/**
 * Computes layout coordinates for all individuals and unions using the
 * horizontal (left-to-right) pedigree layout.
 * Generations advance as columns from left to right, with clean vertical buses
 * and rightward branch lines into children.
 */
export function computeHorizontalLayout(tree: TreeData, groupByFamily: boolean = false): TreeLayout {
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
        const x = person.horizontalX !== undefined ? person.horizontalX : autoX;
        const y = person.horizontalY !== undefined ? person.horizontalY : autoY;

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

          const x = person.horizontalX !== undefined ? person.horizontalX : autoX;
          const y = person.horizontalY !== undefined ? person.horizontalY : autoY;

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
          nodes[pId] = {
            id: pId,
            type: 'person',
            data: person,
            x: person.horizontalX !== undefined ? person.horizontalX : autoX,
            y: person.horizontalY !== undefined ? person.horizontalY : autoY,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            generation: level,
            order: idx,
            familyId: personFamilyMap[pId],
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
      const minChildX = Math.min(...childrenNodes.map((c) => c.x));
      const avgChildY =
        childrenNodes.reduce((sum, c) => sum + (c.y + c.height / 2), 0) / childrenNodes.length;
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

/**
 * Computes layout coordinates for all individuals and unions.
/**
 * Recursively collects all descendant person IDs for a given person.
 */
export function getDescendantPersonIds(tree: TreeData, rootPersonId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootPersonId];
  const visited = new Set<string>([rootPersonId]);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const person = tree.people[currId];
    if (!person) continue;

    for (const uId of person.unionIds) {
      const union = tree.unions[uId];
      if (!union) continue;
      for (const cId of union.childrenIds) {
        if (!visited.has(cId)) {
          visited.add(cId);
          descendants.add(cId);
          queue.push(cId);
        }
      }
    }
  }

  return descendants;
}

/**
 * Builds a filtered TreeData removing all descendants of the specified collapsed persons.
 */
export function filterCollapsedTree(
  tree: TreeData,
  collapsedPersonIds: Set<string>
): { visibleTree: TreeData; hiddenCounts: Record<string, number> } {
  if (!collapsedPersonIds || collapsedPersonIds.size === 0) {
    return { visibleTree: tree, hiddenCounts: {} };
  }

  const hiddenPersonIds = new Set<string>();
  const hiddenCounts: Record<string, number> = {};

  for (const pId of collapsedPersonIds) {
    const descendants = getDescendantPersonIds(tree, pId);
    hiddenCounts[pId] = descendants.size;
    for (const dId of descendants) {
      hiddenPersonIds.add(dId);
    }
  }

  if (hiddenPersonIds.size === 0) {
    return { visibleTree: tree, hiddenCounts };
  }

  const nextPeople: Record<string, Person> = {};
  for (const [id, person] of Object.entries(tree.people)) {
    if (!hiddenPersonIds.has(id)) {
      nextPeople[id] = {
        ...person,
        unionIds: (person.unionIds || []).filter((uId) => {
          const u = tree.unions[uId];
          return u && (u.partnerIds.some((pId) => !hiddenPersonIds.has(pId)) || u.childrenIds.some((cId) => !hiddenPersonIds.has(cId)));
        }),
      };
    }
  }

  const nextUnions: Record<string, Union> = {};
  for (const [id, union] of Object.entries(tree.unions)) {
    const visiblePartners = union.partnerIds.filter((pId) => !hiddenPersonIds.has(pId));
    const visibleChildren = union.childrenIds.filter((cId) => !hiddenPersonIds.has(cId));

    if (visiblePartners.length > 0 || visibleChildren.length > 0) {
      nextUnions[id] = {
        ...union,
        partnerIds: visiblePartners,
        childrenIds: visibleChildren,
      };
    }
  }

  const visibleTree: TreeData = {
    ...tree,
    people: nextPeople,
    unions: nextUnions,
  };

  return { visibleTree, hiddenCounts };
}

/**
 * Finds all persons in the lineage of a target person (ancestors, descendants, spouses, and siblings).
 */
export function getBranchPersonIds(tree: TreeData, rootPersonId: string): Set<string> {
  const branchIds = new Set<string>([rootPersonId]);

  // 1. Ancestors
  const ancestorQueue = [rootPersonId];
  while (ancestorQueue.length > 0) {
    const id = ancestorQueue.shift()!;
    const p = tree.people[id];
    if (!p) continue;
    if (p.parentUnionId) {
      const u = tree.unions[p.parentUnionId];
      if (u) {
        for (const partnerId of u.partnerIds) {
          if (!branchIds.has(partnerId)) {
            branchIds.add(partnerId);
            ancestorQueue.push(partnerId);
          }
        }
        for (const siblingId of u.childrenIds) {
          branchIds.add(siblingId);
        }
      }
    }
  }

  // 2. Descendants and Spouses
  const descQueue = Array.from(branchIds);
  while (descQueue.length > 0) {
    const id = descQueue.shift()!;
    const p = tree.people[id];
    if (!p) continue;
    for (const uId of p.unionIds) {
      const u = tree.unions[uId];
      if (u) {
        for (const partnerId of u.partnerIds) {
          branchIds.add(partnerId);
        }
        for (const childId of u.childrenIds) {
          if (!branchIds.has(childId)) {
            branchIds.add(childId);
            descQueue.push(childId);
          }
        }
      }
    }
  }

  return branchIds;
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
  adjustSpacing: boolean = true
): TreeLayout {
  const collapsedSet = new Set<string>(
    collapsedPersonIds
      ? (Array.isArray(collapsedPersonIds) ? collapsedPersonIds : Array.from(collapsedPersonIds))
      : (tree.collapsedPersonIds || [])
  );

  const { visibleTree, hiddenCounts } = filterCollapsedTree(tree, collapsedSet);

  const layout = layoutStyle === 'horizontal'
    ? computeHorizontalLayout(visibleTree, groupByFamily)
    : computeVerticalLayout(visibleTree, groupByFamily, adjustSpacing);

  for (const pId of collapsedSet) {
    if (layout.nodes[pId]) {
      layout.nodes[pId].isCollapsed = true;
      layout.nodes[pId].hiddenCount = hiddenCounts[pId] || 0;
    }
  }

  return layout;
}

interface RawSegment {
  edgeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isVertical: boolean;
}

/**
 * Generates all tree connection paths and automatically calculates
 * bridge-hops (jump-over arcs) wherever vertical lines cross horizontal lines.
 */
function generateEdgesWithBridgeHops(
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

        const p1Crossings: number[] = [];
        for (const hSeg of horizontalSegments) {
          if (
            hSeg.edgeId !== `partner_bus_${union.id}` &&
            hSeg.y1 > p1BottomY + 4 &&
            hSeg.y1 < uy - 4 &&
            p1BottomX > Math.min(hSeg.x1, hSeg.x2) + 2 &&
            p1BottomX < Math.max(hSeg.x1, hSeg.x2) - 2
          ) {
            p1Crossings.push(hSeg.y1);
          }
        }
        const p1Path = buildVerticalPathWithHops(p1BottomX, p1BottomY, uy, p1Crossings, HOP_RADIUS) + ` L ${ux} ${uy}`;

        const p2Crossings: number[] = [];
        for (const hSeg of horizontalSegments) {
          if (
            hSeg.edgeId !== `partner_bus_${union.id}` &&
            hSeg.y1 > p2BottomY + 4 &&
            hSeg.y1 < uy - 4 &&
            p2BottomX > Math.min(hSeg.x1, hSeg.x2) + 2 &&
            p2BottomX < Math.max(hSeg.x1, hSeg.x2) - 2
          ) {
            p2Crossings.push(hSeg.y1);
          }
        }
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
      const singleCrossings: number[] = [];
      for (const hSeg of horizontalSegments) {
        if (
          hSeg.edgeId !== `bus_${union.id}` &&
          hSeg.y1 > py + 4 &&
          hSeg.y1 < uy - 4 &&
          px > Math.min(hSeg.x1, hSeg.x2) + 2 &&
          px < Math.max(hSeg.x1, hSeg.x2) - 2
        ) {
          singleCrossings.push(hSeg.y1);
        }
      }
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
    const stemCrossings: number[] = [];
    for (const hSeg of horizontalSegments) {
      if (
        hSeg.y1 > union.y + 4 &&
        hSeg.y1 < busY - 4 &&
        union.x > Math.min(hSeg.x1, hSeg.x2) + 2 &&
        union.x < Math.max(hSeg.x1, hSeg.x2) - 2
      ) {
        stemCrossings.push(hSeg.y1);
      }
    }

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

      const dropCrossings: number[] = [];
      for (const hSeg of horizontalSegments) {
        if (
          hSeg.y1 > busY + 4 &&
          hSeg.y1 < cy - 4 &&
          cx > Math.min(hSeg.x1, hSeg.x2) + 2 &&
          cx < Math.max(hSeg.x1, hSeg.x2) - 2
        ) {
          dropCrossings.push(hSeg.y1);
        }
      }

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

/**
 * Builds an SVG path string for a vertical line segment from (x, yStart) to (x, yEnd),
 * inserting smooth arc "bridge-hops" over any given crossing Y coordinates.
 */
function buildVerticalPathWithHops(
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
