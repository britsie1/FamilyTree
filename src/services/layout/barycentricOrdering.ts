import type { TreeData, FamilyGroup } from '../../types/tree';
import type { GenerationGroup } from './generationalRanking';

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
export function orderPeopleSubset(
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
