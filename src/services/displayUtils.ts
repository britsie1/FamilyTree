import type { Person, PersonDisplayInfo } from '../types/tree';
import { parseDateParts, calculateAge } from './dateUtils';

/**
 * Returns the display name of a person for tree cards, headers, and relative lists.
 * Uses `knownAs` with `lastName` if present, falling back to `firstName` with `lastName`.
 */
export function getPersonDisplayName(person?: Person | null): string {
  if (!person) return 'Unnamed Person';
  const namePart = (person.knownAs && person.knownAs.trim()) ? person.knownAs.trim() : (person.firstName?.trim() || '');
  const surname = person.lastName?.trim() || '';
  const result = [namePart, surname].filter(Boolean).join(' ');
  return result || 'Unnamed Person';
}

/**
 * Returns the full legal name of a person (firstName + middleNames + lastName).
 */
export function getPersonFullName(person?: Person | null): string {
  if (!person) return 'Unnamed Person';
  const parts = [
    person.firstName?.trim(),
    person.middleNames?.trim(),
    person.lastName?.trim(),
  ].filter(Boolean);
  return parts.join(' ') || 'Unnamed Person';
}

/**
 * Precomputes formatted display values for a person so that components like
 * PersonCard do not recalculate date regexes, names, and age on every render.
 */
export function computePersonDisplayInfo(person?: Person | null): PersonDisplayInfo {
  if (!person) {
    return {
      displayName: 'Unnamed Person',
      fullName: 'Unnamed Person',
      isUnnamed: true,
      initials: '?',
      birthYear: '',
      deathYear: '',
      age: null,
      standardDateText: '',
    };
  }

  const displayName = getPersonDisplayName(person);
  const fullName = getPersonFullName(person);
  const isUnnamed = !person.knownAs?.trim() && !person.firstName?.trim() && !person.lastName?.trim();

  const birthParts = person.birthDate ? parseDateParts(person.birthDate) : null;
  const deathParts = person.deathDate ? parseDateParts(person.deathDate) : null;
  const birthYear = birthParts?.year || '';
  const deathYear = deathParts?.year || '';

  let age: number | null = null;
  let standardDateText = '';

  if (birthYear && deathYear) {
    age = calculateAge(person.birthDate, person.deathDate);
    standardDateText = age !== null
      ? `${birthYear} – ${deathYear} (age ${age})`
      : `${birthYear} – ${deathYear}`;
  } else if (birthYear) {
    if (person.isDeceased) {
      standardDateText = `b. ${birthYear} (deceased)`;
    } else {
      age = calculateAge(person.birthDate);
      standardDateText = age !== null
        ? `b. ${birthYear} (age ${age})`
        : `b. ${birthYear}`;
    }
  } else if (deathYear) {
    standardDateText = `d. ${deathYear}`;
  }

  const namePart = (person.knownAs && person.knownAs.trim()) ? person.knownAs.trim() : (person.firstName?.trim() || '');
  const initials = (
    (namePart ? namePart[0] : '') +
    (person.lastName?.trim() ? person.lastName.trim()[0] : '')
  ).toUpperCase() || '?';

  return {
    displayName,
    fullName,
    isUnnamed,
    initials,
    birthYear,
    deathYear,
    age,
    standardDateText,
  };
}

const displayInfoCache = new WeakMap<Person, PersonDisplayInfo>();

/**
 * Returns cached or precomputed display info for a Person object.
 * Caches by object identity in a WeakMap for automatic memory management.
 */
export function getPersonDisplayInfo(person?: Person | null): PersonDisplayInfo {
  if (!person) {
    return computePersonDisplayInfo(null);
  }

  const cached = displayInfoCache.get(person);
  if (cached) {
    return cached;
  }

  const computed = computePersonDisplayInfo(person);
  displayInfoCache.set(person, computed);
  return computed;
}

/**
 * Formats a person's lifespan with their age at death in brackets for deceased individuals.
 * For living individuals, age is omitted.
 * Examples:
 * - '1925 – 2002 (77)' (deceased with age at death)
 * - 'b. 1960' (living, age omitted)
 * - 'b. 1920 (†)' (deceased with unknown death date)
 * - 'd. 1985' (only death date known)
 */
export function formatLifespanWithAge(person?: Person | null): string {
  if (!person) return '';

  const birthParts = person.birthDate ? parseDateParts(person.birthDate) : null;
  const deathParts = person.deathDate ? parseDateParts(person.deathDate) : null;
  const birthYear = birthParts?.year || '';
  const deathYear = deathParts?.year || '';

  if (birthYear && deathYear) {
    const age = calculateAge(person.birthDate, person.deathDate);
    return age !== null ? `${birthYear} – ${deathYear} (${age})` : `${birthYear} – ${deathYear}`;
  }

  if (birthYear) {
    if (person.isDeceased) {
      return `b. ${birthYear} (†)`;
    }
    return `b. ${birthYear}`;
  }

  if (deathYear) {
    return `d. ${deathYear}`;
  }

  if (person.isDeceased) {
    return '(†)';
  }

  return '';
}

/**
 * Returns formatted maiden name (e.g. 'née Smith') if maidenName is present.
 */
export function getPersonMaidenNameLabel(person?: Person | null): string {
  if (!person || !person.maidenName?.trim()) return '';
  return `née ${person.maidenName.trim()}`;
}
