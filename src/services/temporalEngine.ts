import type { Person, TreeData, Union } from '../types/tree';
import { getPersonDisplayName } from './treeOperations';

export interface WorldEvent {
  id: string;
  year: number;
  endYear?: number;
  title: string;
  category: 'war' | 'science' | 'culture' | 'politics' | 'milestone';
  description: string;
}

export interface HistoricalMoment {
  id: string;
  year: number;
  title: string;
  subtitle?: string;
  type: 'world' | 'birthday' | 'wedding' | 'birth' | 'memorial';
  personId?: string;
  unionId?: string;
  details?: string;
}

export type TemporalPersonStatus = 'unborn' | 'living' | 'deceased';

export interface PersonTemporalInfo {
  personId: string;
  status: TemporalPersonStatus;
  age: number | null;
  birthYear: number | null;
  deathYear: number | null;
  ageLabel: string;
  isLivingInYear: boolean;
  wasJustBorn: boolean;
  passedThisYear: boolean;
  isMilestoneAge: boolean;
}

export interface UnionTemporalInfo {
  unionId: string;
  isMarried: boolean;
  marriageYear: number | null;
  divorceYear: number | null;
  isDivorced: boolean;
  isJustWed: boolean;
  yearsMarried: number | null;
  statusLabel: string;
}

export interface RoomStats {
  year: number;
  totalPeople: number;
  livingCount: number;
  unbornCount: number;
  deceasedCount: number;
  livingPeople: Person[];
  worldEventsInYear: WorldEvent[];
  activeMoment?: HistoricalMoment | null;
  narrativeSummary: string;
}

// Comprehensive database of major world events (1850 - 2026)
export const MAJOR_WORLD_EVENTS: WorldEvent[] = [
  {
    id: 'we_1861_civil_war',
    year: 1861,
    endYear: 1865,
    title: 'American Civil War',
    category: 'war',
    description: 'Conflict between Northern and Southern states; ends with abolition of slavery in 1865.',
  },
  {
    id: 'we_1869_transcon_rr',
    year: 1869,
    title: 'First Transcontinental Railroad',
    category: 'science',
    description: 'Golden Spike driven at Promontory Summit, Utah, connecting Atlantic and Pacific coasts.',
  },
  {
    id: 'we_1879_lightbulb',
    year: 1879,
    title: 'Incandescent Light Bulb',
    category: 'science',
    description: 'Thomas Edison perfects practical long-lasting electric lighting.',
  },
  {
    id: 'we_1903_wright_flight',
    year: 1903,
    title: 'Wright Brothers First Flight',
    category: 'science',
    description: 'Orville and Wilbur Wright achieve first controlled powered airplane flight in Kitty Hawk, NC.',
  },
  {
    id: 'we_1912_titanic',
    year: 1912,
    title: 'Sinking of the Titanic',
    category: 'milestone',
    description: 'The RMS Titanic sinks in the North Atlantic after striking an iceberg.',
  },
  {
    id: 'we_1914_wwi',
    year: 1914,
    endYear: 1918,
    title: 'World War I',
    category: 'war',
    description: 'Global conflict across Europe and beyond; concludes with the 1918 Armistice.',
  },
  {
    id: 'we_1918_spanish_flu',
    year: 1918,
    endYear: 1920,
    title: 'Spanish Flu Pandemic',
    category: 'milestone',
    description: 'Deadly influenza pandemic sweeps across the world.',
  },
  {
    id: 'we_1920_womens_suffrage',
    year: 1920,
    title: "Women's Right to Vote",
    category: 'politics',
    description: '19th Amendment ratified in the United States, granting women the right to vote.',
  },
  {
    id: 'we_1928_penicillin',
    year: 1928,
    title: 'Discovery of Penicillin',
    category: 'science',
    description: 'Alexander Fleming discovers penicillin, heralding the antibiotic era of modern medicine.',
  },
  {
    id: 'we_1929_great_depression',
    year: 1929,
    endYear: 1939,
    title: 'Great Depression Begins',
    category: 'politics',
    description: 'Wall Street Crash triggers a decade-long worldwide economic depression.',
  },
  {
    id: 'we_1939_wwii',
    year: 1939,
    endYear: 1945,
    title: 'World War II',
    category: 'war',
    description: 'Deadliest global conflict in human history across Europe, the Pacific, and Africa.',
  },
  {
    id: 'we_1944_dday',
    year: 1944,
    title: 'D-Day Normandy Landings (WWII)',
    category: 'war',
    description: 'Allied forces launch Operation Overlord on the beaches of Normandy, France.',
  },
  {
    id: 'we_1945_end_wwii',
    year: 1945,
    title: 'End of WWII & UN Founded',
    category: 'politics',
    description: 'World War II ends; United Nations established to promote international peace.',
  },
  {
    id: 'we_1953_dna_everest',
    year: 1953,
    title: 'DNA Double Helix & Everest Summited',
    category: 'science',
    description: 'Watson and Crick describe DNA structure; Hillary & Norgay reach summit of Mt. Everest.',
  },
  {
    id: 'we_1961_human_in_space',
    year: 1961,
    title: 'First Human in Space',
    category: 'science',
    description: 'Soviet cosmonaut Yuri Gagarin orbits Earth in Vostok 1.',
  },
  {
    id: 'we_1963_mlk_dream',
    year: 1963,
    title: 'MLK "I Have a Dream" Speech',
    category: 'culture',
    description: 'Martin Luther King Jr. delivers his historic address during March on Washington.',
  },
  {
    id: 'we_1968_year_of_change',
    year: 1968,
    title: 'Apollo 8 & Year of Global Change',
    category: 'culture',
    description: 'First humans orbit the Moon capturing "Earthrise"; pivotal year of cultural movements.',
  },
  {
    id: 'we_1969_moon_landing',
    year: 1969,
    title: 'Apollo 11 Moon Landing',
    category: 'science',
    description: 'Neil Armstrong and Buzz Aldrin become the first humans to walk on the Moon.',
  },
  {
    id: 'we_1977_voyager_pc',
    year: 1977,
    title: 'Dawn of Personal Computing & Voyager',
    category: 'science',
    description: 'Apple II released; Voyager 1 and 2 probes launched toward interstellar space.',
  },
  {
    id: 'we_1989_berlin_wall',
    year: 1989,
    title: 'Fall of the Berlin Wall',
    category: 'politics',
    description: 'The barrier dividing East and West Berlin falls, marking the symbolic end of the Cold War.',
  },
  {
    id: 'we_1991_web_and_cold_war',
    year: 1991,
    title: 'World Wide Web & End of Cold War',
    category: 'science',
    description: 'Tim Berners-Lee opens World Wide Web to public; Soviet Union dissolves.',
  },
  {
    id: 'we_2001_sep_11',
    year: 2001,
    title: 'September 11 Attacks',
    category: 'politics',
    description: 'Terrorist attacks in New York, Washington, and Pennsylvania transform world security.',
  },
  {
    id: 'we_2008_financial_crisis',
    year: 2008,
    title: 'Global Financial Crisis & Smartphone Boom',
    category: 'politics',
    description: 'Worldwide recession triggered by subprime mortgage collapse; app stores launch modern smartphone era.',
  },
  {
    id: 'we_2020_covid',
    year: 2020,
    endYear: 2022,
    title: 'COVID-19 Global Pandemic',
    category: 'milestone',
    description: 'Coronavirus pandemic leads to global lockdowns, telework revolution, and rapid mRNA vaccines.',
  },
  {
    id: 'we_2024_ai_revolution',
    year: 2024,
    endYear: 2026,
    title: 'The AI Era & Present Day',
    category: 'science',
    description: 'Frontier AI models and renewable energy breakthroughs reshape global technology.',
  },
];

/**
 * Extract 4-digit year from date string (handles 'YYYY-MM-DD', 'YYYY', '12 APR 1938', etc.)
 */
export function extractYear(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/\b(\d{4})\b/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Calculate dynamic temporal year bounds based on tree data
 */
export function getTreeYearBounds(tree: TreeData): { minYear: number; maxYear: number; defaultYear: number } {
  const currentYear = new Date().getFullYear();
  let minFoundYear = currentYear;
  let hasValidYear = false;

  Object.values(tree.people).forEach((p) => {
    const bYear = extractYear(p.birthDate);
    if (bYear && bYear > 1500 && bYear <= currentYear) {
      minFoundYear = Math.min(minFoundYear, bYear);
      hasValidYear = true;
    }
  });

  Object.values(tree.unions).forEach((u) => {
    const mYear = extractYear(u.marriageDate);
    if (mYear && mYear > 1500 && mYear <= currentYear) {
      minFoundYear = Math.min(minFoundYear, mYear);
      hasValidYear = true;
    }
  });

  // Default floor rounded down to decade or 1850 minimum
  const minYear = hasValidYear ? Math.max(1800, Math.floor((minFoundYear - 5) / 10) * 10) : 1850;
  const maxYear = currentYear;
  const defaultYear = hasValidYear
    ? Math.min(Math.max(minFoundYear + 30, minYear), maxYear)
    : Math.min(1968, maxYear);

  return { minYear, maxYear, defaultYear };
}

/**
 * Evaluate temporal status for a single person at a specific year
 */
export function getPersonTemporalInfo(person: Person, targetYear: number): PersonTemporalInfo {
  const birthYear = extractYear(person.birthDate);
  const deathYear = extractYear(person.deathDate);

  // If no birth year is recorded
  if (birthYear === null) {
    if (deathYear !== null && targetYear > deathYear) {
      return {
        personId: person.id,
        status: 'deceased',
        age: null,
        birthYear: null,
        deathYear,
        ageLabel: `Passed in ${deathYear}`,
        isLivingInYear: false,
        wasJustBorn: false,
        passedThisYear: targetYear === deathYear,
        isMilestoneAge: false,
      };
    }
    // Assume alive with unknown age
    return {
      personId: person.id,
      status: 'living',
      age: null,
      birthYear: null,
      deathYear,
      ageLabel: 'Age unknown',
      isLivingInYear: true,
      wasJustBorn: false,
      passedThisYear: false,
      isMilestoneAge: false,
    };
  }

  // 1. Unborn
  if (targetYear < birthYear) {
    const yearsUntil = birthYear - targetYear;
    return {
      personId: person.id,
      status: 'unborn',
      age: null,
      birthYear,
      deathYear,
      ageLabel: yearsUntil === 1 ? 'Born next year' : `Unborn (b. ${birthYear})`,
      isLivingInYear: false,
      wasJustBorn: false,
      passedThisYear: false,
      isMilestoneAge: false,
    };
  }

  // 2. Deceased
  if (deathYear !== null && targetYear > deathYear) {
    const finalAge = deathYear - birthYear;
    return {
      personId: person.id,
      status: 'deceased',
      age: null,
      birthYear,
      deathYear,
      ageLabel: finalAge >= 0 ? `Passed in ${deathYear} (age ${finalAge})` : `Passed in ${deathYear}`,
      isLivingInYear: false,
      wasJustBorn: false,
      passedThisYear: false,
      isMilestoneAge: false,
    };
  }

  // If flagged isDeceased but no death date specified, and age > 105, treat as deceased
  const age = targetYear - birthYear;
  if (person.isDeceased && deathYear === null && age > 105) {
    return {
      personId: person.id,
      status: 'deceased',
      age: null,
      birthYear,
      deathYear: null,
      ageLabel: `Passed away (b. ${birthYear})`,
      isLivingInYear: false,
      wasJustBorn: false,
      passedThisYear: false,
      isMilestoneAge: false,
    };
  }

  // 3. Living
  const wasJustBorn = targetYear === birthYear;
  const passedThisYear = deathYear !== null && targetYear === deathYear;
  const isMilestoneAge = [1, 18, 21, 30, 40, 50, 60, 70, 75, 80, 85, 90, 95, 100].includes(age);

  let ageLabel = `Age ${age}`;
  if (wasJustBorn) {
    ageLabel = 'Newborn (Age 0)';
  } else if (age === 1) {
    ageLabel = 'Age 1';
  }

  return {
    personId: person.id,
    status: 'living',
    age,
    birthYear,
    deathYear,
    ageLabel,
    isLivingInYear: true,
    wasJustBorn,
    passedThisYear,
    isMilestoneAge,
  };
}

/**
 * Evaluate temporal status for a union at a specific year
 */
export function getUnionTemporalInfo(union: Union, targetYear: number): UnionTemporalInfo {
  const marriageYear = extractYear(union.marriageDate);
  const divorceYear = extractYear(union.divorceDate);

  if (marriageYear === null) {
    // If no marriage date is recorded, treat as established union
    return {
      unionId: union.id,
      isMarried: true,
      marriageYear: null,
      divorceYear,
      isDivorced: Boolean(divorceYear && targetYear >= divorceYear),
      isJustWed: false,
      yearsMarried: null,
      statusLabel: union.type || 'Partnership',
    };
  }

  // Pre-marriage
  if (targetYear < marriageYear) {
    return {
      unionId: union.id,
      isMarried: false,
      marriageYear,
      divorceYear,
      isDivorced: false,
      isJustWed: false,
      yearsMarried: null,
      statusLabel: `Unmarried in ${targetYear} (wed in ${marriageYear})`,
    };
  }

  // Married / Celebratory / Divorced
  const yearsMarried = targetYear - marriageYear;
  const isJustWed = targetYear === marriageYear;
  const isDivorced = Boolean(divorceYear && targetYear >= divorceYear);

  let statusLabel = isJustWed ? `Wed this year (${marriageYear})` : `Married (${yearsMarried} yrs)`;
  if (isDivorced) {
    statusLabel = targetYear === divorceYear ? `Divorced in ${divorceYear}` : `Divorced (${divorceYear})`;
  }

  return {
    unionId: union.id,
    isMarried: !isDivorced,
    marriageYear,
    divorceYear,
    isDivorced,
    isJustWed,
    yearsMarried,
    statusLabel,
  };
}

/**
 * Find world events active or matching in the given year
 */
export function getWorldEventsInYear(year: number): WorldEvent[] {
  return MAJOR_WORLD_EVENTS.filter((e) => {
    if (e.endYear) {
      return year >= e.year && year <= e.endYear;
    }
    return e.year === year;
  });
}

/**
 * Extract all family life milestones from the tree (Weddings, Landmark Birthdays, Births)
 * and combine them with major world events
 */
export function getHistoricalMoments(tree: TreeData): HistoricalMoment[] {
  const moments: HistoricalMoment[] = [];

  // 1. Major World Events
  MAJOR_WORLD_EVENTS.forEach((we) => {
    moments.push({
      id: `moment_${we.id}`,
      year: we.year,
      title: we.title,
      subtitle: we.description,
      type: 'world',
      details: we.category.toUpperCase(),
    });
  });

  // 2. Family Weddings
  Object.values(tree.unions).forEach((u) => {
    const mYear = extractYear(u.marriageDate);
    if (!mYear) return;

    const partnerNames = u.partnerIds
      .map((pId) => (tree.people[pId] ? getPersonDisplayName(tree.people[pId]) : ''))
      .filter(Boolean);

    const coupleTitle = partnerNames.length >= 2 ? `${partnerNames[0]} & ${partnerNames[1]}` : 'Family Wedding';

    moments.push({
      id: `moment_wedding_${u.id}`,
      year: mYear,
      title: `${coupleTitle}'s Wedding`,
      subtitle: `United in ${mYear}`,
      type: 'wedding',
      unionId: u.id,
      details: 'Wedding Celebration',
    });
  });

  // 3. Significant Birthdays & Births
  const currentYear = new Date().getFullYear();
  const landmarkAges = [18, 50, 75, 80, 90, 100];

  Object.values(tree.people).forEach((p) => {
    const bYear = extractYear(p.birthDate);
    if (!bYear) return;

    const dYear = extractYear(p.deathDate);
    const pName = getPersonDisplayName(p);

    // Birth Moment
    moments.push({
      id: `moment_birth_${p.id}`,
      year: bYear,
      title: `Birth of ${pName}`,
      subtitle: p.birthPlace ? `Born in ${p.birthPlace}` : `Born in ${bYear}`,
      type: 'birth',
      personId: p.id,
      details: 'New Generation',
    });

    // Milestone Birthdays while alive
    landmarkAges.forEach((age) => {
      const celebrationYear = bYear + age;
      if (celebrationYear <= currentYear) {
        if (!dYear || celebrationYear <= dYear) {
          moments.push({
            id: `moment_bday_${p.id}_${age}`,
            year: celebrationYear,
            title: `${pName}'s ${age}th Birthday`,
            subtitle: `Celebrated in ${celebrationYear} (born ${bYear})`,
            type: 'birthday',
            personId: p.id,
            details: `Milestone Birthday: Age ${age}`,
          });
        }
      }
    });

    // Memorial Moment if deceased
    if (dYear) {
      const finalAge = dYear - bYear;
      moments.push({
        id: `moment_memorial_${p.id}`,
        year: dYear,
        title: `Memorial for ${pName}`,
        subtitle: finalAge >= 0 ? `Passed away at age ${finalAge}` : `Passed away in ${dYear}`,
        type: 'memorial',
        personId: p.id,
        details: 'Memorial Life Event',
      });
    }
  });

  // Sort chronologically by year
  moments.sort((a, b) => a.year - b.year);

  return moments;
}

/**
 * Compute Room Stats & Generational Overlap for a given year or historical moment
 */
export function computeRoomStats(
  tree: TreeData,
  year: number,
  activeMoment?: HistoricalMoment | null
): RoomStats {
  const people = Object.values(tree.people);
  const totalPeople = people.length;

  const livingPeople: Person[] = [];
  let unbornCount = 0;
  let deceasedCount = 0;

  people.forEach((p) => {
    const info = getPersonTemporalInfo(p, year);
    if (info.status === 'living') {
      livingPeople.push(p);
    } else if (info.status === 'unborn') {
      unbornCount++;
    } else {
      deceasedCount++;
    }
  });

  const worldEventsInYear = getWorldEventsInYear(year);

  // Generate an emotional, evocative generational overlap narrative
  let narrativeSummary = '';
  if (activeMoment) {
    narrativeSummary = `${activeMoment.title} (${year}): ${livingPeople.length} of ${totalPeople} relatives were alive in the world to be in the room.`;
  } else if (livingPeople.length === 0 && unbornCount > 0) {
    narrativeSummary = `In ${year}, none of the relatives in this tree had been born yet.`;
  } else if (livingPeople.length === 0) {
    narrativeSummary = `In ${year}, all ${totalPeople} relatives in this tree had passed away.`;
  } else {
    // Pick notable age highlights
    const sampleHighlights: string[] = [];
    livingPeople.slice(0, 3).forEach((p) => {
      const info = getPersonTemporalInfo(p, year);
      const name = p.knownAs?.trim() || p.firstName || 'Relative';
      if (info.age !== null) {
        sampleHighlights.push(`${name} was ${info.age}`);
      }
    });

    const highlightText = sampleHighlights.length > 0 ? ` (${sampleHighlights.join(', ')})` : '';
    narrativeSummary = `In ${year}: ${livingPeople.length} of ${totalPeople} family members were physically in the world${highlightText}.`;
  }

  return {
    year,
    totalPeople,
    livingCount: livingPeople.length,
    unbornCount,
    deceasedCount,
    livingPeople,
    worldEventsInYear,
    activeMoment,
    narrativeSummary,
  };
}
