import type { TreeData, Person } from '../types/tree';
import { getOrdinal } from './relationshipFinder';
import { getPersonDisplayName } from './displayUtils';

export type ChartAngleMode = '360' | '180' | '270';
export type ColorThemeMode = 'lineage' | 'generation' | 'gender' | 'parchment';

export interface PedigreeSlot {
  slotIndex: number; // Ahnentafel index: 1 = root, 2 = father, 3 = mother, etc.
  generation: number; // 0 = root, 1 = parents, 2 = grandparents, etc.
  person: Person | null;
  relationshipTitle: string;
  lineagePath: ('father' | 'mother')[]; // e.g. ['father', 'mother'] = father's mother
  branch: 'root' | 'paternal' | 'maternal';
  quadrant?: 'paternal-father' | 'paternal-mother' | 'maternal-father' | 'maternal-mother';
}

export interface SunburstArcNode extends PedigreeSlot {
  id: string;
  startAngle: number; // in radians
  endAngle: number; // in radians
  innerRadius: number; // in px
  outerRadius: number; // in px
  pathD: string; // SVG path command string
  centroidX: number;
  centroidY: number;
  labelAngleDeg: number;
  isUpsideDown: boolean;
  fillColor: string;
  textColor: string;
  strokeColor: string;
}

export interface GenerationRingInfo {
  generation: number;
  innerRadius: number;
  outerRadius: number;
  thickness: number;
  longestName: string;
  longestNameLength: number;
}

export interface SunburstTreeLayout {
  rootPerson: Person;
  maxLevel: number;
  totalSlots: number;
  filledSlots: number;
  completionPercentage: number;
  nodes: SunburstArcNode[];
  ringRadii: GenerationRingInfo[];
  rootNode: {
    person: Person;
    radius: number;
    fillColor: string;
    textColor: string;
    strokeColor: string;
  };
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Returns parent persons for a given person, split by biological/gender assignment:
 * [father, mother]
 */
export function getDirectParents(tree: TreeData, personId: string): { father: Person | null; mother: Person | null } {
  const person = tree.people[personId];
  if (!person) return { father: null, mother: null };

  const candidateParentIds = new Set<string>();

  // 1. Check person.parentUnionId
  if (person.parentUnionId && tree.unions[person.parentUnionId]) {
    const union = tree.unions[person.parentUnionId];
    for (const partnerId of union.partnerIds) {
      if (partnerId !== personId && tree.people[partnerId]) {
        candidateParentIds.add(partnerId);
      }
    }
  }

  // 2. Check any union listing this person as child
  for (const union of Object.values(tree.unions)) {
    if (union.childrenIds && union.childrenIds.includes(personId)) {
      for (const partnerId of union.partnerIds) {
        if (partnerId !== personId && tree.people[partnerId]) {
          candidateParentIds.add(partnerId);
        }
      }
    }
  }

  const parents = Array.from(candidateParentIds).map((id) => tree.people[id]);
  if (parents.length === 0) {
    return { father: null, mother: null };
  }

  if (parents.length === 1) {
    const p = parents[0];
    if (p.gender === 'female') {
      return { father: null, mother: p };
    }
    return { father: p, mother: null };
  }

  // Two or more parents: inspect gender
  const maleParent = parents.find((p) => p.gender === 'male');
  const femaleParent = parents.find((p) => p.gender === 'female');

  if (maleParent && femaleParent) {
    return { father: maleParent, mother: femaleParent };
  }

  // If both have same or unspecified gender, assign the first to father slot and second to mother slot
  return {
    father: parents[0] || null,
    mother: parents[1] || null,
  };
}

/**
 * Computes descriptive genealogical title for an ancestor at a given Ahnentafel slot.
 */
export function getAncestorRelationshipTitle(
  generation: number,
  lineagePath: ('father' | 'mother')[],
  personGender?: string
): string {
  if (generation === 0) return 'Self (Root)';

  const lastStep = lineagePath[lineagePath.length - 1];
  const isFatherLine = lastStep === 'father';
  const effectiveGender = personGender || (isFatherLine ? 'male' : 'female');

  if (generation === 1) {
    if (effectiveGender === 'male') return 'Father';
    if (effectiveGender === 'female') return 'Mother';
    return 'Parent';
  }

  const prefix = lineagePath.length > 1 && lineagePath[0] === 'father' ? 'Paternal ' : 'Maternal ';

  if (generation === 2) {
    const term = effectiveGender === 'male' ? 'Grandfather' : effectiveGender === 'female' ? 'Grandmother' : 'Grandparent';
    return prefix + term;
  }

  if (generation === 3) {
    const term = effectiveGender === 'male' ? 'Great-grandfather' : effectiveGender === 'female' ? 'Great-grandmother' : 'Great-grandparent';
    return prefix + term;
  }

  if (generation === 4) {
    const term = effectiveGender === 'male' ? 'Great-great-grandfather' : effectiveGender === 'female' ? 'Great-great-grandmother' : 'Great-great-grandparent';
    return prefix + term;
  }

  const ordinal = getOrdinal(generation - 2);
  const term = effectiveGender === 'male' ? 'Great-grandfather' : effectiveGender === 'female' ? 'Great-grandmother' : 'Great-grandparent';
  return `${prefix}${ordinal} ${term}`;
}

/**
 * Returns descriptive label for an ancestor depth level (1 to 8+).
 */
export function getLevelDescription(level: number): { title: string; subtitle: string; maxAncestors: number; outerSlots: number } {
  const outerSlots = Math.pow(2, level);
  const maxAncestors = Math.pow(2, level + 1) - 2;

  switch (level) {
    case 1:
      return {
        title: 'Parents',
        subtitle: 'Level 1: Parents (2 on ring)',
        maxAncestors,
        outerSlots,
      };
    case 2:
      return {
        title: 'Grandparents',
        subtitle: 'Level 2: Grandparents (4 on outer ring, up to 6 total)',
        maxAncestors,
        outerSlots,
      };
    case 3:
      return {
        title: 'Great-grandparents',
        subtitle: 'Level 3: Great-grandparents (8 on outer ring, up to 14 total)',
        maxAncestors,
        outerSlots,
      };
    case 4:
      return {
        title: 'Great-great-grandparents',
        subtitle: 'Level 4: Great-great-grandparents (16 on outer ring, up to 30 total)',
        maxAncestors,
        outerSlots,
      };
    case 5:
      return {
        title: '3x Great-grandparents',
        subtitle: 'Level 5: 3x Great-grandparents (32 on outer ring, up to 62 total)',
        maxAncestors,
        outerSlots,
      };
    case 6:
      return {
        title: '4x Great-grandparents',
        subtitle: 'Level 6: 4x Great-grandparents (64 on outer ring, up to 126 total)',
        maxAncestors,
        outerSlots,
      };
    case 7:
      return {
        title: '5x Great-grandparents',
        subtitle: 'Level 7: 5x Great-grandparents (128 on outer ring, up to 254 total)',
        maxAncestors,
        outerSlots,
      };
    case 8:
    default:
      return {
        title: `${level - 2}x Great-grandparents`,
        subtitle: `Level ${level}: ${level - 2}x Great-grandparents (${outerSlots} on outer ring, up to ${maxAncestors} total)`,
        maxAncestors,
        outerSlots,
      };
  }
}

/**
 * Extracts binary pedigree slots from the tree up to `maxLevel` depth using Ahnentafel numbers.
 */
export function extractPedigreeSlots(
  tree: TreeData,
  rootPersonId: string,
  maxLevel: number
): PedigreeSlot[] {
  const root = tree.people[rootPersonId];
  if (!root) return [];

  const clampedLevel = Math.max(1, Math.min(maxLevel, 10));
  const slots: PedigreeSlot[] = [];

  // Root slot (Ahnentafel 1)
  slots.push({
    slotIndex: 1,
    generation: 0,
    person: root,
    relationshipTitle: 'Self (Root)',
    lineagePath: [],
    branch: 'root',
  });

  // Iteratively resolve generations 1 to clampedLevel
  // Map of slotIndex -> Person | null
  const personBySlot = new Map<number, Person | null>();
  personBySlot.set(1, root);

  for (let gen = 1; gen <= clampedLevel; gen++) {
    const startSlot = Math.pow(2, gen);
    const endSlot = Math.pow(2, gen + 1) - 1;

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const parentSlot = Math.floor(slot / 2);
      const isFatherSlot = slot % 2 === 0;
      const childPerson = personBySlot.get(parentSlot);

      let person: Person | null = null;
      if (childPerson) {
        const parents = getDirectParents(tree, childPerson.id);
        person = isFatherSlot ? parents.father : parents.mother;
      }
      personBySlot.set(slot, person);

      // Construct lineage path from root
      const lineagePath: ('father' | 'mother')[] = [];
      let tempSlot = slot;
      while (tempSlot > 1) {
        lineagePath.unshift(tempSlot % 2 === 0 ? 'father' : 'mother');
        tempSlot = Math.floor(tempSlot / 2);
      }

      const branch: 'paternal' | 'maternal' = lineagePath[0] === 'father' ? 'paternal' : 'maternal';

      let quadrant: 'paternal-father' | 'paternal-mother' | 'maternal-father' | 'maternal-mother' | undefined;
      if (lineagePath.length >= 2) {
        const q0 = lineagePath[0];
        const q1 = lineagePath[1];
        if (q0 === 'father' && q1 === 'father') quadrant = 'paternal-father';
        else if (q0 === 'father' && q1 === 'mother') quadrant = 'paternal-mother';
        else if (q0 === 'mother' && q1 === 'father') quadrant = 'maternal-father';
        else quadrant = 'maternal-mother';
      } else if (lineagePath.length === 1) {
        quadrant = lineagePath[0] === 'father' ? 'paternal-father' : 'maternal-mother';
      }

      const relationshipTitle = getAncestorRelationshipTitle(gen, lineagePath, person?.gender);

      slots.push({
        slotIndex: slot,
        generation: gen,
        person,
        relationshipTitle,
        lineagePath,
        branch,
        quadrant,
      });
    }
  }

  return slots;
}

/**
 * Returns colors for a slot according to the selected theme and dark/light mode.
 */
export function getSlotColors(
  slot: PedigreeSlot,
  theme: ColorThemeMode,
  isDark: boolean
): { fill: string; text: string; stroke: string } {
  const isFilled = Boolean(slot.person);

  if (!isFilled) {
    return {
      fill: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.65)',
      text: isDark ? '#64748b' : '#94a3b8',
      stroke: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
    };
  }

  const stroke = isDark ? '#0f172a' : '#ffffff';

  if (theme === 'gender') {
    const gender = slot.person?.gender || (slot.slotIndex % 2 === 0 ? 'male' : 'female');
    if (gender === 'male') {
      return {
        fill: isDark ? '#1e3a8a' : '#bfdbfe',
        text: isDark ? '#dbeafe' : '#1e3a8a',
        stroke,
      };
    }
    if (gender === 'female') {
      return {
        fill: isDark ? '#831843' : '#fbcfe8',
        text: isDark ? '#fce7f3' : '#831843',
        stroke,
      };
    }
    return {
      fill: isDark ? '#334155' : '#e2e8f0',
      text: isDark ? '#e2e8f0' : '#334155',
      stroke,
    };
  }

  if (theme === 'generation') {
    // Gradient spectrum across generation rings
    const paletteLight = ['#c7d2fe', '#bae6fd', '#a7f3d0', '#fde68a', '#fed7aa', '#fecdd3', '#e9d5ff', '#ddd6fe'];
    const paletteDark = ['#312e81', '#0c4a6e', '#064e3b', '#713f12', '#7c2d12', '#881337', '#581c87', '#4c1d95'];
    const textLight = ['#312e81', '#0369a1', '#065f46', '#854d0e', '#9a3412', '#9f1239', '#6b21a8', '#5b21b6'];
    const textDark = ['#e0e7ff', '#e0f2fe', '#d1fae5', '#fef3c7', '#ffedd5', '#ffe4e6', '#f3e8ff', '#ede9fe'];

    const idx = Math.min(slot.generation - 1, paletteLight.length - 1);
    return {
      fill: isDark ? paletteDark[idx] : paletteLight[idx],
      text: isDark ? textDark[idx] : textLight[idx],
      stroke,
    };
  }

  if (theme === 'parchment') {
    if (!isFilled) {
      return {
        fill: isDark ? 'rgba(41, 33, 27, 0.45)' : 'rgba(247, 243, 233, 0.65)',
        text: isDark ? '#8a7968' : '#9c8c7c',
        stroke: isDark ? 'rgba(74, 58, 46, 0.55)' : 'rgba(217, 205, 190, 0.75)',
      };
    }

    const parchmentStroke = isDark ? '#1a1410' : '#fdfbf7';
    const q = slot.quadrant || (slot.branch === 'paternal' ? 'paternal-father' : 'maternal-mother');

    // Antique Archival Palettes:
    // Paternal-Father: Rich Warm Sepia & Walnut
    // Paternal-Mother: Antique Sage & Herbal Verdigris
    // Maternal-Father: Vintage Ochre & Honey Saffron
    // Maternal-Mother: Dusty Rose Madder & Terracotta
    if (q === 'paternal-father') {
      return {
        fill: isDark ? '#382a20' : '#ecdcc9',
        text: isDark ? '#f2e5d7' : '#3e2917',
        stroke: parchmentStroke,
      };
    }
    if (q === 'paternal-mother') {
      return {
        fill: isDark ? '#242c1f' : '#e1e3d3',
        text: isDark ? '#e8ede0' : '#2e3522',
        stroke: parchmentStroke,
      };
    }
    if (q === 'maternal-father') {
      return {
        fill: isDark ? '#382b18' : '#f5e7c8',
        text: isDark ? '#faeed2' : '#4a3311',
        stroke: parchmentStroke,
      };
    }
    // maternal-mother
    return {
      fill: isDark ? '#37201b' : '#f1dcd4',
      text: isDark ? '#f7e3dd' : '#4c251c',
      stroke: parchmentStroke,
    };
  }

  // Default: Lineage Quadrants (Classic Genealogical Fan Chart Colors)
  // Paternal Grandfather = Blue/Sky
  // Paternal Grandmother = Teal/Cyan
  // Maternal Grandfather = Amber/Orange
  // Maternal Grandmother = Rose/Pink
  const q = slot.quadrant || (slot.branch === 'paternal' ? 'paternal-father' : 'maternal-mother');

  if (q === 'paternal-father') {
    return {
      fill: isDark ? '#1e3a8a' : '#dbeafe',
      text: isDark ? '#bfdbfe' : '#1e40af',
      stroke,
    };
  }
  if (q === 'paternal-mother') {
    return {
      fill: isDark ? '#134e4a' : '#ccfbf1',
      text: isDark ? '#99f6e4' : '#115e59',
      stroke,
    };
  }
  if (q === 'maternal-father') {
    return {
      fill: isDark ? '#78350f' : '#fef3c7',
      text: isDark ? '#fde68a' : '#92400e',
      stroke,
    };
  }
  // maternal-mother
  return {
    fill: isDark ? '#831843' : '#ffe4e6',
    text: isDark ? '#fbcfe8' : '#9f1239',
    stroke,
  };
}

/**
 * Generates an SVG path data string for an annular ring slice between radii and angles.
 */
export function createArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  // Clamp start and end to prevent precision overflow
  const p1 = {
    x: innerRadius * Math.cos(startAngle),
    y: innerRadius * Math.sin(startAngle),
  };
  const p2 = {
    x: outerRadius * Math.cos(startAngle),
    y: outerRadius * Math.sin(startAngle),
  };
  const p3 = {
    x: outerRadius * Math.cos(endAngle),
    y: outerRadius * Math.sin(endAngle),
  };
  const p4 = {
    x: innerRadius * Math.cos(endAngle),
    y: innerRadius * Math.sin(endAngle),
  };

  const angleDiff = endAngle - startAngle;
  const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Builds the complete layout for a Sunburst / Fan chart of ancestors.
 */
export function buildSunburstLayout(
  tree: TreeData,
  rootPersonId: string,
  options: {
    maxLevel?: number;
    angleMode?: ChartAngleMode;
    colorTheme?: ColorThemeMode;
    isDark?: boolean;
    baseRadius?: number;
    rootRadius?: number;
    dynamicRingSizes?: boolean;
  } = {}
): SunburstTreeLayout | null {
  const rootPerson = tree.people[rootPersonId];
  if (!rootPerson) return null;

  const maxLevel = Math.max(1, Math.min(options.maxLevel ?? 4, 8));
  const angleMode = options.angleMode || '360';
  const colorTheme = options.colorTheme || 'lineage';
  const isDark = Boolean(options.isDark);
  const dynamicRingSizes = options.dynamicRingSizes !== false;

  const rawSlots = extractPedigreeSlots(tree, rootPersonId, maxLevel);

  const rootDisplayName = getPersonDisplayName(rootPerson);
  const rootMaidenStr = rootPerson.maidenName?.trim() ? `née ${rootPerson.maidenName.trim()}` : '';
  const longestRootStrLength = Math.max(rootDisplayName.length, rootMaidenStr.length);
  const dynamicRootRadius = Math.max(
    options.rootRadius ?? 74,
    Math.round((longestRootStrLength * 7.5) / 2 + 28)
  );
  const rootRadius = dynamicRingSizes ? dynamicRootRadius : (options.rootRadius || 74);

  // Compute ring thicknesses tailored to the longest name in each generation
  const ringRadii: GenerationRingInfo[] = [];
  let currentRadius = rootRadius;

  if (dynamicRingSizes) {
    for (let gen = 1; gen <= maxLevel; gen++) {
      const slotsInGen = rawSlots.filter((s) => s.generation === gen);
      let longestName = '';
      let longestNameLength = 0;

      for (const slot of slotsInGen) {
        if (slot.person) {
          const name = getPersonDisplayName(slot.person);
          if (name.length > longestNameLength) {
            longestNameLength = name.length;
            longestName = name;
          }
          if (slot.person.maidenName?.trim()) {
            const maidenStr = `née ${slot.person.maidenName.trim()}`;
            if (maidenStr.length > longestNameLength) {
              longestNameLength = maidenStr.length;
              longestName = maidenStr;
            }
          }
        }
      }

      // Font size estimation for this generation
      const genFontSize = Math.max(8.5, Math.min(12, 13 - gen * 0.45));
      const charWidth = genFontSize * 0.62;
      const radialPadding = 34;

      const effectiveCharCount = longestNameLength > 0 ? longestNameLength : 7;
      const requiredWidth = Math.round(effectiveCharCount * charWidth + radialPadding);
      const thickness = Math.max(54, requiredWidth);

      ringRadii.push({
        generation: gen,
        innerRadius: currentRadius,
        outerRadius: currentRadius + thickness,
        thickness,
        longestName,
        longestNameLength,
      });

      currentRadius += thickness;
    }
  } else {
    const baseRadius = options.baseRadius || 360;
    const uniformThickness = (baseRadius - rootRadius) / maxLevel;
    for (let gen = 1; gen <= maxLevel; gen++) {
      ringRadii.push({
        generation: gen,
        innerRadius: rootRadius + (gen - 1) * uniformThickness,
        outerRadius: rootRadius + gen * uniformThickness,
        thickness: uniformThickness,
        longestName: '',
        longestNameLength: 0,
      });
    }
    currentRadius = rootRadius + maxLevel * uniformThickness;
  }

  // Total angular span and starting rotation
  let totalSpan: number;
  let baseStartAngle: number;

  if (angleMode === '180') {
    // 180° Half Fan: arches from left (-PI) to right (0) in upper half, centered at -PI/2 (upwards)
    totalSpan = Math.PI;
    baseStartAngle = -Math.PI;
  } else if (angleMode === '270') {
    totalSpan = (3 * Math.PI) / 2;
    baseStartAngle = -Math.PI - Math.PI / 4;
  } else {
    // 360° Circle: Paternal on left/top (-PI to 0 or -PI/2 to PI/2), Mother on other side
    totalSpan = 2 * Math.PI;
    baseStartAngle = -Math.PI / 2; // start from 12 o'clock
  }

  let filledCount = 0;
  for (const s of rawSlots) {
    if (s.generation > 0 && s.person) {
      filledCount++;
    }
  }

  const totalAncestorsPossible = Math.pow(2, maxLevel + 1) - 2;
  const completionPercentage = totalAncestorsPossible > 0
    ? Math.round((filledCount / totalAncestorsPossible) * 100)
    : 0;

  const nodes: SunburstArcNode[] = [];

  for (const slot of rawSlots) {
    if (slot.generation === 0) continue; // Root handled separately in center circle

    const gen = slot.generation;
    const slotsInGen = Math.pow(2, gen);
    const genIndex = slot.slotIndex - slotsInGen; // 0 to 2^gen - 1

    const arcSpan = totalSpan / slotsInGen;
    const startAngle = baseStartAngle + genIndex * arcSpan;
    const endAngle = startAngle + arcSpan;

    const genRing = ringRadii[gen - 1];
    const innerRadius = genRing.innerRadius;
    const outerRadius = genRing.outerRadius;

    const pathD = createArcPath(innerRadius, outerRadius, startAngle, endAngle);

    const midAngle = (startAngle + endAngle) / 2;
    const midRadius = (innerRadius + outerRadius) / 2;
    const centroidX = midRadius * Math.cos(midAngle);
    const centroidY = midRadius * Math.sin(midAngle);

    // Calculate rotation angle in degrees for radial label
    let labelAngleDeg = (midAngle * 180) / Math.PI;
    // Normalize to [0, 360)
    labelAngleDeg = (labelAngleDeg + 360) % 360;

    // Flip upside down text so it's always readable
    let isUpsideDown = false;
    if (labelAngleDeg > 90 && labelAngleDeg < 270) {
      labelAngleDeg += 180;
      isUpsideDown = true;
    }

    const colors = getSlotColors(slot, colorTheme, isDark);

    nodes.push({
      ...slot,
      id: `slot_${slot.slotIndex}`,
      startAngle,
      endAngle,
      innerRadius,
      outerRadius,
      pathD,
      centroidX,
      centroidY,
      labelAngleDeg,
      isUpsideDown,
      fillColor: colors.fill,
      textColor: colors.text,
      strokeColor: colors.stroke,
    });
  }

  const rootStroke = colorTheme === 'parchment'
    ? (isDark ? '#6b513b' : '#c4ab8e')
    : (isDark ? '#334155' : '#e2e8f0');
  const rootFill = colorTheme === 'parchment'
    ? (isDark ? '#2a1f18' : '#faf5eb')
    : (isDark ? '#1e293b' : '#f8fafc');
  const rootText = colorTheme === 'parchment'
    ? (isDark ? '#fbf4e8' : '#2b1b11')
    : (isDark ? '#f8fafc' : '#0f172a');

  const boundsPadding = 30;
  const maxExtent = currentRadius + boundsPadding;

  let bounds: SunburstTreeLayout['bounds'];
  if (angleMode === '180') {
    bounds = {
      minX: -maxExtent,
      minY: -maxExtent,
      maxX: maxExtent,
      maxY: boundsPadding,
      width: maxExtent * 2,
      height: maxExtent + boundsPadding,
    };
  } else {
    bounds = {
      minX: -maxExtent,
      minY: -maxExtent,
      maxX: maxExtent,
      maxY: maxExtent,
      width: maxExtent * 2,
      height: maxExtent * 2,
    };
  }

  return {
    rootPerson,
    maxLevel,
    totalSlots: totalAncestorsPossible,
    filledSlots: filledCount,
    completionPercentage,
    nodes,
    ringRadii,
    rootNode: {
      person: rootPerson,
      radius: rootRadius,
      fillColor: rootFill,
      textColor: rootText,
      strokeColor: rootStroke,
    },
    bounds,
  };
}
