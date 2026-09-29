import type { TreeData, Person, Union, Gender, UnionType } from '../types/tree';
import { CURRENT_SCHEMA_VERSION } from '../services/schema/constants';
import { repair } from '../services/schema/repair';
import { checkInvariants } from '../services/schema/invariants';

export function createRng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES_MALE = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles'];
const FIRST_NAMES_FEMALE = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'];

export interface TreeGeneratorOptions {
  seed?: number;
  personCount?: number;
  maxGenerations?: number;
  includeDocuments?: boolean;
  includeCrossTreeLinks?: boolean;
}

/**
 * Generates a topologically valid family tree with pseudo-random seedable structure.
 * Supports multiple unions, siblings, generational tiers, and verified invariants.
 */
export function generateRandomTree(options: TreeGeneratorOptions = {}): TreeData {
  const seed = options.seed ?? 12345;
  const rng = createRng(seed);
  const targetCount = options.personCount ?? 15;
  const includeDocs = options.includeDocuments ?? true;
  const includeLinks = options.includeCrossTreeLinks ?? true;

  const people: Record<string, Person> = {};
  const unions: Record<string, Union> = {};

  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randomYear = (min: number, max: number) => min + Math.floor(rng() * (max - min));

  // Create root person
  const rootId = 'p_root';
  const rootGender: Gender = rng() > 0.5 ? 'male' : 'female';
  const rootBirthYear = randomYear(1940, 1960);
  const rootLastName = pick(LAST_NAMES);

  people[rootId] = {
    id: rootId,
    firstName: rootGender === 'male' ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE),
    lastName: rootLastName,
    gender: rootGender,
    birthDate: `${rootBirthYear}-05-15`,
    birthPlace: 'Springfield, USA',
    unionIds: [],
    generation: 0,
    documents: includeDocs
      ? [
          {
            id: 'doc_root_1',
            name: 'Birth Certificate',
            driveFileId: 'drive_file_root_1',
            uploadedAt: '2026-01-01T00:00:00Z',
          },
        ]
      : undefined,
    linkedTrees: includeLinks
      ? [
          {
            treeId: 'tree_maternal_line',
            treeName: 'Maternal Lineage',
            personId: 'p_root',
          },
        ]
      : undefined,
  };

  let personIdx = 1;
  let unionIdx = 1;

  // Track living/available nodes for partners and children
  const generationalTiers: Record<number, string[]> = { 0: [rootId] };

  while (Object.keys(people).length < targetCount) {
    // Pick an existing person to expand
    const currentGenerations = Object.keys(generationalTiers).map(Number);
    const gen = pick(currentGenerations);
    const pool = generationalTiers[gen] || [];
    if (pool.length === 0) break;
    const anchorId = pick(pool);
    const anchor = people[anchorId];
    if (!anchor) break;

    const actionRoll = rng();

    if (actionRoll < 0.45 || anchor.unionIds.length === 0) {
      // Add Partner and Union
      const partnerId = `p_${personIdx++}`;
      const partnerGender: Gender = anchor.gender === 'male' ? 'female' : 'male';
      const anchorYear = parseInt(anchor.birthDate?.slice(0, 4) || '1950', 10);
      const partnerBirthYear = anchorYear + Math.floor(rng() * 7) - 3;
      const unionId = `u_${unionIdx++}`;

      const unionType: UnionType = rng() > 0.3 ? 'married' : rng() > 0.5 ? 'divorced' : 'partner';
      const marriageYear = Math.max(anchorYear, partnerBirthYear) + randomYear(20, 30);

      people[partnerId] = {
        id: partnerId,
        firstName: partnerGender === 'male' ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE),
        lastName: partnerGender === 'female' ? rootLastName : pick(LAST_NAMES),
        maidenName: partnerGender === 'female' ? pick(LAST_NAMES) : undefined,
        gender: partnerGender,
        birthDate: `${partnerBirthYear}-08-20`,
        unionIds: [unionId],
        generation: gen,
      };

      unions[unionId] = {
        id: unionId,
        partnerIds: [anchorId, partnerId],
        childrenIds: [],
        type: unionType,
        marriageDate: `${marriageYear}-06-12`,
        divorceDate: unionType === 'divorced' ? `${marriageYear + 10}-09-01` : undefined,
      };

      anchor.unionIds.push(unionId);
      generationalTiers[gen].push(partnerId);
    } else {
      // Add Child to one of anchor's unions
      const uId = pick(anchor.unionIds);
      const union = unions[uId];
      if (union) {
        const childId = `p_${personIdx++}`;
        const childGender: Gender = rng() > 0.5 ? 'male' : 'female';
        const marriageYear = parseInt(union.marriageDate?.slice(0, 4) || '1975', 10);
        const childBirthYear = marriageYear + randomYear(1, 10);
        const childGen = gen + 1;

        people[childId] = {
          id: childId,
          firstName: childGender === 'male' ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE),
          lastName: rootLastName,
          gender: childGender,
          birthDate: `${childBirthYear}-03-10`,
          parentUnionId: uId,
          unionIds: [],
          generation: childGen,
        };

        union.childrenIds.push(childId);

        if (!generationalTiers[childGen]) {
          generationalTiers[childGen] = [];
        }
        generationalTiers[childGen].push(childId);
      }
    }
  }

  const rawTree: TreeData = {
    id: `tree_seed_${seed}`,
    name: `Generated Tree ${seed}`,
    description: `Seeded synthetic family tree for property and invariant testing.`,
    rootPersonId: rootId,
    people,
    unions,
    storageMode: 'subcollections',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Run repair to guarantee reciprocal consistency and no dangling references
  const repairResult = repair(rawTree);
  const validTree = repairResult.tree;

  // Confirm invariants
  const violations = checkInvariants(validTree);
  if (violations.length > 0) {
    throw new Error(`Generated tree ${seed} failed invariant checks: ${violations.map((v) => v.message).join('; ')}`);
  }

  return validTree;
}
