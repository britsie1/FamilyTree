import type { TreeData, Person, Union } from '../types/tree';
import { parseDateParts, calculateAge } from './dateUtils';
import { getPersonDisplayName } from './treeOperations';

export interface SurnameStat {
  surname: string;
  count: number;
  percentage: number;
}

export interface BirthplaceStat {
  place: string;
  count: number;
  percentage: number;
}

export interface TreeMilestones {
  oldestLiving: { person: Person; age: number } | null;
  longestLived: { person: Person; age: number } | null;
  earliestBirth: { person: Person; year: number } | null;
  largestFamily: { union: Union; parents: Person[]; childCount: number } | null;
  mostMarriages: { person: Person; unionCount: number } | null;
}

export interface TreeStatistics {
  totalPeople: number;
  totalUnions: number;
  genderCounts: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
  genderPercentages: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
  livingCount: number;
  deceasedCount: number;
  averageLifespan: number | null;
  minGeneration: number | null;
  maxGeneration: number | null;
  generationSpan: number;
  averageChildrenPerUnion: number;
  maxChildrenInUnion: number;
  topSurnames: SurnameStat[];
  topBirthplaces: BirthplaceStat[];
  milestones: TreeMilestones;
}

export type HealthAnomalySeverity = 'error' | 'warning' | 'info';
export type HealthAnomalyCategory =
  | 'chronology'
  | 'biology'
  | 'duplicate'
  | 'structure'
  | 'completeness';

export interface HealthAnomaly {
  id: string;
  code: string;
  severity: HealthAnomalySeverity;
  category: HealthAnomalyCategory;
  title: string;
  description: string;
  personId?: string;
  personName?: string;
  relatedPersonId?: string;
  relatedPersonName?: string;
  unionId?: string;
}

export interface TreeHealthReport {
  score: number;
  status: 'excellent' | 'good' | 'needs_attention' | 'critical';
  errorCount: number;
  warningCount: number;
  infoCount: number;
  anomalies: HealthAnomaly[];
}

/**
 * Compares two date strings chronologically.
 * Returns:
 *  - negative if a < b
 *  - 0 if a === b
 *  - positive if a > b
 *  - null if comparison cannot be made (missing/invalid years)
 */
export function compareDates(
  dateStrA?: string | null,
  dateStrB?: string | null
): number | null {
  if (!dateStrA || !dateStrB) return null;
  const pA = parseDateParts(dateStrA);
  const pB = parseDateParts(dateStrB);
  if (!pA.year || !pB.year) return null;

  const yA = parseInt(pA.year, 10);
  const yB = parseInt(pB.year, 10);
  if (Number.isNaN(yA) || Number.isNaN(yB)) return null;
  if (yA !== yB) return yA - yB;

  if (pA.month && pB.month) {
    const mA = parseInt(pA.month, 10);
    const mB = parseInt(pB.month, 10);
    if (mA !== mB) return mA - mB;

    if (pA.day && pB.day) {
      const dA = parseInt(pA.day, 10);
      const dB = parseInt(pB.day, 10);
      return dA - dB;
    }
  }

  return 0;
}

/**
 * Extracts numeric year from a date string, or null.
 */
export function extractYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const { year } = parseDateParts(dateStr);
  if (!year) return null;
  const num = parseInt(year, 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Normalizes surname for frequency aggregation (trims, standardizes case).
 */
export function normalizeSurname(surname?: string | null): string {
  if (!surname) return '';
  const trimmed = surname.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Computes comprehensive genealogical statistics for the family tree.
 */
export function computeTreeStatistics(tree: TreeData): TreeStatistics {
  const people = Object.values(tree.people || {});
  const unions = Object.values(tree.unions || {});
  const totalPeople = people.length;
  const totalUnions = unions.length;

  const genderCounts = {
    male: 0,
    female: 0,
    other: 0,
    unspecified: 0,
  };

  let livingCount = 0;
  let deceasedCount = 0;
  const lifespans: number[] = [];

  let minGen: number | null = null;
  let maxGen: number | null = null;

  const surnameMap = new Map<string, number>();
  const birthplaceMap = new Map<string, number>();

  let oldestLiving: { person: Person; age: number } | null = null;
  let longestLived: { person: Person; age: number } | null = null;
  let earliestBirth: { person: Person; year: number } | null = null;
  let mostMarriages: { person: Person; unionCount: number } | null = null;

  for (const person of people) {
    // Gender counts
    const g = person.gender || 'unspecified';
    if (g === 'male') genderCounts.male++;
    else if (g === 'female') genderCounts.female++;
    else if (g === 'other') genderCounts.other++;
    else genderCounts.unspecified++;

    // Living vs Deceased
    const isDeceased = Boolean(person.isDeceased || person.deathDate || person.deathPlace);
    if (isDeceased) {
      deceasedCount++;
    } else {
      livingCount++;
    }

    // Lifespan & Oldest
    const bYear = extractYear(person.birthDate);

    if (bYear !== null) {
      if (!earliestBirth || bYear < earliestBirth.year) {
        earliestBirth = { person, year: bYear };
      }
    }

    if (isDeceased) {
      if (person.birthDate && person.deathDate) {
        const ageAtDeath = calculateAge(person.birthDate, person.deathDate);
        if (ageAtDeath !== null && ageAtDeath >= 0 && ageAtDeath <= 130) {
          lifespans.push(ageAtDeath);
          if (!longestLived || ageAtDeath > longestLived.age) {
            longestLived = { person, age: ageAtDeath };
          }
        }
      }
    } else {
      if (person.birthDate) {
        const age = calculateAge(person.birthDate);
        if (age !== null && age >= 0 && age <= 130) {
          if (!oldestLiving || age > oldestLiving.age) {
            oldestLiving = { person, age };
          }
        }
      }
    }

    // Generation bounds
    if (typeof person.generation === 'number') {
      if (minGen === null || person.generation < minGen) minGen = person.generation;
      if (maxGen === null || person.generation > maxGen) maxGen = person.generation;
    }

    // Surnames (prefer maiden name to reflect birth lineage)
    const sName = normalizeSurname(person.maidenName || person.lastName);
    if (sName) {
      surnameMap.set(sName, (surnameMap.get(sName) || 0) + 1);
    }

    // Birthplaces
    if (person.birthPlace && person.birthPlace.trim()) {
      const place = person.birthPlace.trim();
      birthplaceMap.set(place, (birthplaceMap.get(place) || 0) + 1);
    }

    // Most marriages
    const uCount = (person.unionIds || []).length;
    if (uCount > 0) {
      if (!mostMarriages || uCount > mostMarriages.unionCount) {
        mostMarriages = { person, unionCount: uCount };
      }
    }
  }

  // Unions & Children stats
  let totalChildren = 0;
  let maxChildrenInUnion = 0;
  let largestFamily: { union: Union; parents: Person[]; childCount: number } | null = null;

  for (const u of unions) {
    const cCount = (u.childrenIds || []).length;
    totalChildren += cCount;
    if (cCount > maxChildrenInUnion) {
      maxChildrenInUnion = cCount;
    }
    if (cCount > 0 && (!largestFamily || cCount > largestFamily.childCount)) {
      const parents = (u.partnerIds || [])
        .map((id) => tree.people[id])
        .filter((p): p is Person => Boolean(p));
      largestFamily = { union: u, parents, childCount: cCount };
    }
  }

  const averageLifespan =
    lifespans.length > 0
      ? Math.round((lifespans.reduce((a, b) => a + b, 0) / lifespans.length) * 10) / 10
      : null;

  const averageChildrenPerUnion =
    totalUnions > 0 ? Math.round((totalChildren / totalUnions) * 10) / 10 : 0;

  // Gender percentages
  const safeTotal = totalPeople || 1;
  const genderPercentages = {
    male: Math.round((genderCounts.male / safeTotal) * 100),
    female: Math.round((genderCounts.female / safeTotal) * 100),
    other: Math.round((genderCounts.other / safeTotal) * 100),
    unspecified: Math.round((genderCounts.unspecified / safeTotal) * 100),
  };

  // Top Surnames
  const topSurnames: SurnameStat[] = Array.from(surnameMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([surname, count]) => ({
      surname,
      count,
      percentage: Math.round((count / safeTotal) * 100),
    }));

  // Top Birthplaces
  const topBirthplaces: BirthplaceStat[] = Array.from(birthplaceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([place, count]) => ({
      place,
      count,
      percentage: Math.round((count / safeTotal) * 100),
    }));

  const generationSpan =
    minGen !== null && maxGen !== null ? Math.max(1, maxGen - minGen + 1) : 1;

  return {
    totalPeople,
    totalUnions,
    genderCounts,
    genderPercentages,
    livingCount,
    deceasedCount,
    averageLifespan,
    minGeneration: minGen,
    maxGeneration: maxGen,
    generationSpan,
    averageChildrenPerUnion,
    maxChildrenInUnion,
    topSurnames,
    topBirthplaces,
    milestones: {
      oldestLiving,
      longestLived,
      earliestBirth,
      largestFamily,
      mostMarriages,
    },
  };
}

/**
 * Audits the family tree for data quality, logical consistency, and genealogical anomalies.
 */
export function auditTreeHealth(tree: TreeData): TreeHealthReport {
  const anomalies: HealthAnomaly[] = [];
  const people = Object.values(tree.people || {});
  const unions = Object.values(tree.unions || {});

  // 1. Check for individual chronological errors
  for (const person of people) {
    const pName = getPersonDisplayName(person);

    // Death before birth
    if (person.birthDate && person.deathDate) {
      const cmp = compareDates(person.deathDate, person.birthDate);
      if (cmp !== null && cmp < 0) {
        anomalies.push({
          id: `death_before_birth_${person.id}`,
          code: 'death_before_birth',
          severity: 'error',
          category: 'chronology',
          title: 'Death precedes birth',
          description: `${pName} has recorded death date (${person.deathDate}) earlier than birth date (${person.birthDate}).`,
          personId: person.id,
          personName: pName,
        });
      }
    }

    // Unlikely centenarian (> 115 years old and marked living)
    const isDeceased = Boolean(person.isDeceased || person.deathDate || person.deathPlace);
    if (!isDeceased && person.birthDate) {
      const age = calculateAge(person.birthDate);
      if (age !== null && age > 115) {
        anomalies.push({
          id: `unlikely_centenarian_${person.id}`,
          code: 'unlikely_centenarian',
          severity: 'warning',
          category: 'biology',
          title: 'Unusually high living age',
          description: `${pName} is recorded as living with a calculated age of ${age} years (born ${person.birthDate}). Verify if deceased.`,
          personId: person.id,
          personName: pName,
        });
      }
    }

    // Unnamed person
    const hasFirstName = Boolean(person.firstName && person.firstName.trim());
    const hasLastName = Boolean(person.lastName && person.lastName.trim());
    const hasKnownAs = Boolean(person.knownAs && person.knownAs.trim());
    if (!hasFirstName && !hasLastName && !hasKnownAs) {
      anomalies.push({
        id: `unnamed_person_${person.id}`,
        code: 'unnamed_person',
        severity: 'info',
        category: 'completeness',
        title: 'Unnamed relative',
        description: `Person ID ${person.id.slice(0, 8)} has no first name, last name, or nickname recorded.`,
        personId: person.id,
        personName: 'Unnamed relative',
      });
    }

    // Missing birth date
    if (!person.birthDate || !person.birthDate.trim()) {
      anomalies.push({
        id: `missing_birth_date_${person.id}`,
        code: 'missing_birth_date',
        severity: 'info',
        category: 'completeness',
        title: 'Missing birth date',
        description: `${pName} does not have a birth date or year recorded.`,
        personId: person.id,
        personName: pName,
      });
    }

    // Orphan check: isolated individual with no parents, partners, or children
    const inAnyUnionAsChild = unions.some((u) => (u.childrenIds || []).includes(person.id));
    const inAnyUnionAsPartner = unions.some((u) => (u.partnerIds || []).includes(person.id));
    if (!person.parentUnionId && !inAnyUnionAsChild && !inAnyUnionAsPartner) {
      anomalies.push({
        id: `orphan_person_${person.id}`,
        code: 'orphan_person',
        severity: 'info',
        category: 'structure',
        title: 'Isolated relative',
        description: `${pName} has no connected parents, partners, or children in this tree.`,
        personId: person.id,
        personName: pName,
      });
    }
  }

  // 2. Check Union-level relationships (parent-child age gaps, post-mortem births, marriage dates)
  for (const union of unions) {
    const partners = (union.partnerIds || [])
      .map((id) => tree.people[id])
      .filter((p): p is Person => Boolean(p));
    const children = (union.childrenIds || [])
      .map((id) => tree.people[id])
      .filter((c): c is Person => Boolean(c));

    // Marriage before partner birth
    if (union.marriageDate) {
      for (const partner of partners) {
        if (partner.birthDate) {
          const cmp = compareDates(union.marriageDate, partner.birthDate);
          if (cmp !== null && cmp < 0) {
            const pName = getPersonDisplayName(partner);
            anomalies.push({
              id: `marriage_before_birth_${union.id}_${partner.id}`,
              code: 'marriage_before_birth',
              severity: 'warning',
              category: 'chronology',
              title: 'Marriage before birth',
              description: `Marriage date (${union.marriageDate}) is recorded before ${pName}'s birth date (${partner.birthDate}).`,
              personId: partner.id,
              personName: pName,
              unionId: union.id,
            });
          }
        }
      }
    }

    // Parent-child biological checks
    for (const child of children) {
      const childName = getPersonDisplayName(child);
      const childBirthYear = extractYear(child.birthDate);

      for (const parent of partners) {
        const parentName = getPersonDisplayName(parent);
        const parentBirthYear = extractYear(parent.birthDate);
        const parentDeathYear = extractYear(parent.deathDate);

        // Parent too young or too old at child birth
        if (childBirthYear !== null && parentBirthYear !== null) {
          const ageAtChildBirth = childBirthYear - parentBirthYear;

          if (ageAtChildBirth < 13) {
            anomalies.push({
              id: `parent_too_young_${parent.id}_${child.id}`,
              code: 'parent_too_young',
              severity: 'warning',
              category: 'biology',
              title: 'Parent very young at birth',
              description: `${parentName} was only ${ageAtChildBirth} years old when child ${childName} was born (${parentBirthYear} vs ${childBirthYear}).`,
              personId: parent.id,
              personName: parentName,
              relatedPersonId: child.id,
              relatedPersonName: childName,
              unionId: union.id,
            });
          } else if (parent.gender === 'female' && ageAtChildBirth > 55) {
            anomalies.push({
              id: `mother_too_old_${parent.id}_${child.id}`,
              code: 'mother_too_old',
              severity: 'warning',
              category: 'biology',
              title: 'Mother unusually old at childbirth',
              description: `Mother ${parentName} was ${ageAtChildBirth} years old when ${childName} was born.`,
              personId: parent.id,
              personName: parentName,
              relatedPersonId: child.id,
              relatedPersonName: childName,
              unionId: union.id,
            });
          } else if (parent.gender === 'male' && ageAtChildBirth > 80) {
            anomalies.push({
              id: `father_too_old_${parent.id}_${child.id}`,
              code: 'father_too_old',
              severity: 'warning',
              category: 'biology',
              title: 'Father unusually old at childbirth',
              description: `Father ${parentName} was ${ageAtChildBirth} years old when ${childName} was born.`,
              personId: parent.id,
              personName: parentName,
              relatedPersonId: child.id,
              relatedPersonName: childName,
              unionId: union.id,
            });
          }
        }

        // Child born after parent's death
        if (childBirthYear !== null && parentDeathYear !== null) {
          const isMother = parent.gender === 'female';
          const maxPosthumousYears = isMother ? 0 : 1; // Father can pass during pregnancy
          if (childBirthYear > parentDeathYear + maxPosthumousYears) {
            anomalies.push({
              id: `born_after_parent_death_${parent.id}_${child.id}`,
              code: 'born_after_parent_death',
              severity: 'error',
              category: 'chronology',
              title: 'Child born after parent death',
              description: `${childName} (born ${childBirthYear}) was born after ${parentName} passed away (${parentDeathYear}).`,
              personId: parent.id,
              personName: parentName,
              relatedPersonId: child.id,
              relatedPersonName: childName,
              unionId: union.id,
            });
          }
        }
      }
    }
  }

  // 3. Cyclic pedigree detection (person is their own ancestor)
  const getParentsOf = (pId: string): string[] => {
    const p = tree.people[pId];
    if (!p) return [];
    // Check person's parentUnionId
    if (p.parentUnionId && tree.unions[p.parentUnionId]) {
      return tree.unions[p.parentUnionId].partnerIds || [];
    }
    // Fallback: check any union listing p as child
    for (const u of unions) {
      if ((u.childrenIds || []).includes(pId)) {
        return u.partnerIds || [];
      }
    }
    return [];
  };

  const visitedGlobal = new Set<string>();
  const inStack = new Set<string>();
  const cycleDetected = new Set<string>();

  function dfsCycle(currId: string): boolean {
    if (inStack.has(currId)) {
      cycleDetected.add(currId);
      return true;
    }
    if (visitedGlobal.has(currId)) return false;

    visitedGlobal.add(currId);
    inStack.add(currId);

    const parents = getParentsOf(currId);
    for (const parentId of parents) {
      if (parentId && tree.people[parentId]) {
        if (dfsCycle(parentId)) {
          cycleDetected.add(currId);
        }
      }
    }

    inStack.delete(currId);
    return cycleDetected.has(currId);
  }

  for (const person of people) {
    if (!visitedGlobal.has(person.id)) {
      dfsCycle(person.id);
    }
  }

  for (const pId of cycleDetected) {
    const person = tree.people[pId];
    if (person) {
      const pName = getPersonDisplayName(person);
      anomalies.push({
        id: `cyclic_pedigree_${pId}`,
        code: 'cyclic_pedigree',
        severity: 'error',
        category: 'structure',
        title: 'Pedigree cycle detected',
        description: `${pName} is looped into their own ancestral lineage (a person cannot be their own ancestor).`,
        personId: pId,
        personName: pName,
      });
    }
  }

  // 4. Potential duplicates detection
  // Compare pairs of people with identical first & last name and similar birth years
  for (let i = 0; i < people.length; i++) {
    const pA = people[i];
    const firstA = (pA.firstName || '').trim().toLowerCase();
    const lastA = (pA.lastName || '').trim().toLowerCase();
    if (!firstA || !lastA || firstA.length < 2 || lastA.length < 2) continue;

    for (let j = i + 1; j < people.length; j++) {
      const pB = people[j];
      const firstB = (pB.firstName || '').trim().toLowerCase();
      const lastB = (pB.lastName || '').trim().toLowerCase();
      if (firstA === firstB && lastA === lastB) {
        const yA = extractYear(pA.birthDate);
        const yB = extractYear(pB.birthDate);

        // Exact birth year match OR both missing birth year OR within 2 years
        const yearsMatch =
          (yA !== null && yB !== null && Math.abs(yA - yB) <= 2) ||
          (yA === null && yB === null);

        if (yearsMatch) {
          const nameA = getPersonDisplayName(pA);
          const nameB = getPersonDisplayName(pB);
          anomalies.push({
            id: `potential_duplicate_${pA.id}_${pB.id}`,
            code: 'potential_duplicate',
            severity: 'warning',
            category: 'duplicate',
            title: 'Potential duplicate record',
            description: `${nameA} (${pA.birthDate || 'No birth date'}) and ${nameB} (${pB.birthDate || 'No birth date'}) share identical names and similar birth timing.`,
            personId: pA.id,
            personName: nameA,
            relatedPersonId: pB.id,
            relatedPersonName: nameB,
          });
        }
      }
    }
  }

  // Compute summary and overall health score
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const a of anomalies) {
    if (a.severity === 'error') errorCount++;
    else if (a.severity === 'warning') warningCount++;
    else infoCount++;
  }

  // Scoring: 100 base score
  // Each error deducts 10 points
  // Each warning deducts 3 points
  // Each info suggestion deducts 0.2 points (max 10 points for suggestions)
  const penalty =
    errorCount * 10 + warningCount * 3 + Math.min(10, infoCount * 0.2);
  const rawScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  let status: TreeHealthReport['status'] = 'excellent';
  if (errorCount > 0 || rawScore < 60) {
    status = 'critical';
  } else if (warningCount > 3 || rawScore < 80) {
    status = 'needs_attention';
  } else if (warningCount > 0 || rawScore < 95) {
    status = 'good';
  }

  return {
    score: rawScore,
    status,
    errorCount,
    warningCount,
    infoCount,
    anomalies,
  };
}

/**
 * Generates a clean Markdown report summarizing tree statistics and health audit results.
 */
export function generateHealthReportMarkdown(tree: TreeData): string {
  const stats = computeTreeStatistics(tree);
  const health = auditTreeHealth(tree);

  let md = `# Family Tree Report: ${tree.name || 'Untitled Tree'}\n\n`;
  md += `**Overall Health Score**: ${health.score}% (${health.status.toUpperCase()})\n`;
  md += `- **Errors**: ${health.errorCount}\n`;
  md += `- **Warnings**: ${health.warningCount}\n`;
  md += `- **Research Suggestions**: ${health.infoCount}\n\n`;

  md += `## Demographics & Population\n`;
  md += `- **Total Relatives**: ${stats.totalPeople}\n`;
  md += `- **Family Unions**: ${stats.totalUnions}\n`;
  md += `- **Living / Deceased**: ${stats.livingCount} living / ${stats.deceasedCount} deceased\n`;
  md += `- **Gender Breakdown**: Male ${stats.genderCounts.male} (${stats.genderPercentages.male}%), Female ${stats.genderCounts.female} (${stats.genderPercentages.female}%), Other/Unspecified ${stats.genderCounts.other + stats.genderCounts.unspecified}\n`;
  if (stats.averageLifespan !== null) {
    md += `- **Average Lifespan**: ${stats.averageLifespan} years\n`;
  }
  md += `- **Generations Span**: ${stats.generationSpan} generations\n\n`;

  if (stats.topSurnames.length > 0) {
    md += `## Common Surnames\n`;
    for (const s of stats.topSurnames.slice(0, 5)) {
      md += `- **${s.surname}**: ${s.count} members (${s.percentage}%)\n`;
    }
    md += `\n`;
  }

  if (health.anomalies.length > 0) {
    md += `## Health Audit Issues (${health.anomalies.length})\n`;
    for (const a of health.anomalies) {
      const icon = a.severity === 'error' ? '🔴' : a.severity === 'warning' ? '⚠️' : 'ℹ️';
      md += `- ${icon} **${a.title}** (${a.severity.toUpperCase()}): ${a.description}\n`;
    }
  } else {
    md += `## Health Audit Issues\nNo issues detected! Your family tree data is 100% clean.\n`;
  }

  return md;
}
