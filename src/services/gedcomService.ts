import type { TreeData, Person, Union, Gender, UnionType } from '../types/tree';
import { generateId } from './storage';
import { sanitizeTree } from './treeOperations';

interface GedcomLine {
  level: number;
  xref?: string;
  tag: string;
  value?: string;
}

interface GedcomNode {
  level: number;
  xref?: string;
  tag: string;
  value?: string;
  children: GedcomNode[];
}

/**
 * Tokenizes raw GEDCOM string into structured lines.
 */
function tokenizeGedcom(rawText: string): GedcomLine[] {
  const lines = rawText.split(/\r?\n/);
  const result: GedcomLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // GEDCOM line regex: level [optional @xref@] tag [optional value]
    // e.g.: "0 @I1@ INDI", "1 NAME John /Doe/", "2 DATE 15 JAN 1980", "0 HEAD"
    const match = trimmed.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/);
    if (!match) continue;

    const level = parseInt(match[1], 10);
    const xref = match[2];
    const tag = match[3].toUpperCase();
    const value = match[4] !== undefined ? match[4].trim() : undefined;

    result.push({ level, xref, tag, value });
  }

  return result;
}

/**
 * Builds a hierarchical tree of GedcomNodes from tokenized lines,
 * automatically handling CONT and CONC multi-line tags.
 */
function buildGedcomTree(lines: GedcomLine[]): GedcomNode[] {
  const rootNodes: GedcomNode[] = [];
  const stack: GedcomNode[] = [];

  for (const line of lines) {
    // Handle CONT (newline) and CONC (concatenation)
    if (line.tag === 'CONT' || line.tag === 'CONC') {
      const parent = stack[stack.length - 1];
      if (parent) {
        const addedVal = line.value || '';
        if (line.tag === 'CONT') {
          parent.value = (parent.value || '') + '\n' + addedVal;
        } else {
          parent.value = (parent.value || '') + addedVal;
        }
        continue;
      }
    }

    const node: GedcomNode = {
      level: line.level,
      xref: line.xref,
      tag: line.tag,
      value: line.value,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= line.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return rootNodes;
}

/**
 * Helper to find the first child node with a given tag.
 */
function findChild(node: GedcomNode, tag: string): GedcomNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

/**
 * Helper to get the value of a sub-tag.
 */
function getSubtagValue(node: GedcomNode, tag: string): string | undefined {
  const child = findChild(node, tag);
  return child ? child.value : undefined;
}

/**
 * Converts standard GEDCOM date strings (e.g. "15 JAN 1980", "MAY 1995", "1965")
 * to ISO YYYY-MM-DD format if possible, otherwise returns trimmed string.
 */
export function normalizeGedcomDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };

  // Match e.g. "15 JAN 1980" or "1 JAN 1980"
  const dayMonthYear = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (dayMonthYear) {
    const day = dayMonthYear[1].padStart(2, '0');
    const m = dayMonthYear[2].toUpperCase();
    const month = months[m] || '01';
    const year = dayMonthYear[3];
    return `${year}-${month}-${day}`;
  }

  // If prefixed by ABT, BEF, AFT, CAL, EST, BET, etc., strip qualifier first
  const qualifierMatch = trimmed.match(/^(?:ABT|BEF|AFT|CAL|EST|BET)\s+(.*)$/i);
  if (qualifierMatch) {
    return normalizeGedcomDate(qualifierMatch[1]);
  }

  // Match e.g. "JAN 1980"
  const monthYear = trimmed.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (monthYear) {
    const m = monthYear[1].toUpperCase();
    if (months[m]) {
      const month = months[m];
      const year = monthYear[2];
      return `${year}-${month}-01`;
    }
  }

  // Match e.g. "1980"
  const justYear = trimmed.match(/^(\d{4})$/);
  if (justYear) {
    return justYear[1];
  }

  return trimmed;
}

/**
 * Parses names in GEDCOM format: "First Middle /Last/"
 */
function parseGedcomName(nameNode?: GedcomNode): {
  firstName: string;
  middleNames: string;
  lastName: string;
  maidenName: string;
  knownAs: string;
} {
  let firstName = '';
  let middleNames = '';
  let lastName = '';
  let maidenName = '';
  let knownAs = '';

  if (!nameNode) {
    return { firstName, middleNames, lastName, maidenName, knownAs };
  }

  const raw = nameNode.value || '';
  const slashMatch = raw.match(/^(.*?)\s*\/([^/]*)\/(.*)$/);

  if (slashMatch) {
    const beforeSlash = slashMatch[1].trim();
    lastName = slashMatch[2].trim();
    const afterSlash = slashMatch[3].trim();

    if (beforeSlash) {
      const parts = beforeSlash.split(/\s+/);
      firstName = parts[0] || '';
      if (parts.length > 1) {
        middleNames = parts.slice(1).join(' ');
      }
    }
    if (afterSlash && !lastName) {
      lastName = afterSlash;
    }
  } else if (raw) {
    const parts = raw.trim().split(/\s+/);
    firstName = parts[0] || '';
    if (parts.length > 1) {
      lastName = parts[parts.length - 1];
      middleNames = parts.slice(1, -1).join(' ');
    }
  }

  // Check sub-tags for explicit GIVN, SURN, NICK, _MARNM
  const givn = getSubtagValue(nameNode, 'GIVN');
  const surn = getSubtagValue(nameNode, 'SURN');
  const nick = getSubtagValue(nameNode, 'NICK');
  const marnm = getSubtagValue(nameNode, '_MARNM');

  if (givn) firstName = givn;
  if (surn) lastName = surn;
  if (nick) knownAs = nick;
  if (marnm) maidenName = marnm;

  return { firstName, middleNames, lastName, maidenName, knownAs };
}

/**
 * Parses a GEDCOM 5.5.1 or 7.0 string into a TreeData model.
 */
export function parseGedcom(rawText: string, defaultTreeName: string = 'Imported GEDCOM Tree'): TreeData {
  const lines = tokenizeGedcom(rawText);
  const rootNodes = buildGedcomTree(lines);

  const people: Record<string, Person> = {};
  const unions: Record<string, Union> = {};

  // Cross-reference mapping: GEDCOM ID -> internal ID
  const xrefToPersonId: Record<string, string> = {};
  const xrefToUnionId: Record<string, string> = {};

  // Extract tree title from HEAD if available
  let treeName = defaultTreeName;
  const headNode = rootNodes.find((n) => n.tag === 'HEAD');
  if (headNode) {
    const titleNode = findChild(headNode, 'FILE') || findChild(headNode, 'NAME') || findChild(headNode, 'NOTE');
    if (titleNode && titleNode.value) {
      treeName = titleNode.value.replace(/\.[^/.]+$/, '').trim() || defaultTreeName;
    }
  }

  // 1. First pass: Collect all INDI records
  for (const node of rootNodes) {
    if (node.tag === 'INDI' && node.xref) {
      const personId = generateId('p');
      xrefToPersonId[node.xref] = personId;

      const nameNode = findChild(node, 'NAME');
      const { firstName, middleNames, lastName, maidenName, knownAs } = parseGedcomName(nameNode);

      // Gender
      const sexVal = getSubtagValue(node, 'SEX')?.toUpperCase();
      let gender: Gender = 'unspecified';
      if (sexVal === 'M' || sexVal === 'MALE') gender = 'male';
      else if (sexVal === 'F' || sexVal === 'FEMALE') gender = 'female';
      else if (sexVal === 'O' || sexVal === 'OTHER') gender = 'other';

      // Birth
      const birtNode = findChild(node, 'BIRT');
      const birthDate = birtNode ? normalizeGedcomDate(getSubtagValue(birtNode, 'DATE')) : undefined;
      const birthPlace = birtNode ? getSubtagValue(birtNode, 'PLAC') : undefined;

      // Death
      const deatNode = findChild(node, 'DEAT');
      const isDeceased = Boolean(deatNode);
      const deathDate = deatNode ? normalizeGedcomDate(getSubtagValue(deatNode, 'DATE')) : undefined;
      const deathPlace = deatNode ? getSubtagValue(deatNode, 'PLAC') : undefined;

      // Notes
      const noteParts: string[] = [];
      for (const child of node.children) {
        if (child.tag === 'NOTE' && child.value) {
          noteParts.push(child.value);
        }
      }
      const notes = noteParts.length > 0 ? noteParts.join('\n\n') : undefined;

      // Known As / Nickname from top-level NICK
      const topNick = getSubtagValue(node, 'NICK');
      const finalKnownAs = topNick || knownAs || undefined;

      people[personId] = {
        id: personId,
        firstName,
        middleNames: middleNames || undefined,
        lastName,
        maidenName: maidenName || undefined,
        knownAs: finalKnownAs,
        gender,
        birthDate: birthDate || undefined,
        birthPlace: birthPlace || undefined,
        deathDate: deathDate || undefined,
        deathPlace: deathPlace || undefined,
        isDeceased,
        notes,
        unionIds: [],
      };
    }
  }

  // 2. Second pass: Collect all FAM records
  for (const node of rootNodes) {
    if (node.tag === 'FAM' && node.xref) {
      const unionId = generateId('u');
      xrefToUnionId[node.xref] = unionId;

      const partnerIds: string[] = [];
      const childrenIds: string[] = [];

      for (const child of node.children) {
        if ((child.tag === 'HUSB' || child.tag === 'WIFE') && child.value) {
          const pId = xrefToPersonId[child.value];
          if (pId && !partnerIds.includes(pId)) {
            partnerIds.push(pId);
          }
        } else if (child.tag === 'CHIL' && child.value) {
          const cId = xrefToPersonId[child.value];
          if (cId && !childrenIds.includes(cId)) {
            childrenIds.push(cId);
          }
        }
      }

      // Marriage & Divorce
      let type: UnionType = 'married';
      const marrNode = findChild(node, 'MARR');
      const marriageDate = marrNode ? normalizeGedcomDate(getSubtagValue(marrNode, 'DATE')) : undefined;

      const divNode = findChild(node, 'DIV');
      let divorceDate: string | undefined;
      if (divNode) {
        type = 'divorced';
        divorceDate = normalizeGedcomDate(getSubtagValue(divNode, 'DATE'));
      }

      unions[unionId] = {
        id: unionId,
        partnerIds,
        childrenIds,
        type,
        marriageDate: marriageDate || undefined,
        divorceDate: divorceDate || undefined,
      };

      // Cross-link partners
      for (const pId of partnerIds) {
        if (people[pId]) {
          if (!people[pId].unionIds.includes(unionId)) {
            people[pId].unionIds.push(unionId);
          }
        }
      }

      // Cross-link children
      for (const cId of childrenIds) {
        if (people[cId]) {
          people[cId].parentUnionId = unionId;
        }
      }
    }
  }

  // Also check FAMC / FAMS directly on INDI if any FAM was referenced
  for (const node of rootNodes) {
    if (node.tag === 'INDI' && node.xref) {
      const personId = xrefToPersonId[node.xref];
      if (!personId || !people[personId]) continue;

      for (const child of node.children) {
        if (child.tag === 'FAMC' && child.value) {
          const uId = xrefToUnionId[child.value];
          if (uId && unions[uId]) {
            people[personId].parentUnionId = uId;
            if (!unions[uId].childrenIds.includes(personId)) {
              unions[uId].childrenIds.push(personId);
            }
          }
        } else if (child.tag === 'FAMS' && child.value) {
          const uId = xrefToUnionId[child.value];
          if (uId && unions[uId]) {
            if (!people[personId].unionIds.includes(uId)) {
              people[personId].unionIds.push(uId);
            }
            if (!unions[uId].partnerIds.includes(personId)) {
              unions[uId].partnerIds.push(personId);
            }
          }
        }
      }
    }
  }

  // Pick suitable root person: one with both parents and children or first person
  let rootPersonId = Object.keys(people)[0] || '';
  for (const p of Object.values(people)) {
    if (p.parentUnionId && p.unionIds.length > 0) {
      rootPersonId = p.id;
      break;
    }
  }

  const now = new Date().toISOString();
  const rawTree: TreeData = {
    id: generateId('tree'),
    name: treeName,
    description: `Imported from GEDCOM on ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    people,
    unions,
    rootPersonId,
  };

  return sanitizeTree(rawTree);
}

/**
 * Converts ISO/raw date string to GEDCOM date format (e.g. "1995-05-19" -> "19 MAY 1995")
 */
function formatGedcomDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const m = months[monthIndex] || 'JAN';
    return `${day} ${m} ${year}`;
  }

  const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const monthIndex = parseInt(ymMatch[2], 10) - 1;
    const m = months[monthIndex] || 'JAN';
    return `${m} ${year}`;
  }

  return trimmed;
}

/**
 * Splits multi-line notes into GEDCOM CONT lines.
 */
function appendGedcomNote(lines: string[], noteText: string, level: number = 1): void {
  const noteLines = noteText.split('\n');
  if (noteLines.length > 0) {
    lines.push(`${level} NOTE ${noteLines[0]}`);
    for (let i = 1; i < noteLines.length; i++) {
      lines.push(`${level + 1} CONT ${noteLines[i]}`);
    }
  }
}

/**
 * Exports a TreeData model to a standard GEDCOM 5.5.1 format string with UTF-8 encoding.
 */
export function exportGedcom(tree: TreeData): string {
  const sanitized = sanitizeTree(tree);
  const lines: string[] = [];

  // 1. Header
  lines.push('0 HEAD');
  lines.push('1 SOUR FamilyTree');
  lines.push('2 VERS 1.0');
  lines.push('2 NAME FamilyTree Visual Pedigree Builder');
  lines.push('1 DEST ANY');
  lines.push(`1 DATE ${new Date().toISOString().split('T')[0].replace(/-/g, ' ')}`);
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');
  if (sanitized.name) {
    lines.push(`1 NOTE ${sanitized.name}`);
  }

  // Mapping internal IDs to safe GEDCOM XREFs
  const personToXref: Record<string, string> = {};
  const unionToXref: Record<string, string> = {};

  let pIndex = 1;
  for (const personId of Object.keys(sanitized.people)) {
    personToXref[personId] = `@I${pIndex++}@`;
  }

  let uIndex = 1;
  for (const unionId of Object.keys(sanitized.unions)) {
    unionToXref[unionId] = `@F${uIndex++}@`;
  }

  // 2. Individual Records
  for (const person of Object.values(sanitized.people)) {
    const xref = personToXref[person.id];
    lines.push(`0 ${xref} INDI`);

    // NAME
    const givenName = [person.firstName, person.middleNames].filter(Boolean).join(' ');
    const surname = person.lastName ? `/${person.lastName}/` : '//';
    lines.push(`1 NAME ${givenName} ${surname}`.trim());
    if (person.firstName) {
      lines.push(`2 GIVN ${person.firstName}`);
    }
    if (person.lastName) {
      lines.push(`2 SURN ${person.lastName}`);
    }
    if (person.knownAs) {
      lines.push(`2 NICK ${person.knownAs}`);
    }
    if (person.maidenName) {
      lines.push(`2 _MARNM ${person.maidenName}`);
    }

    // SEX
    if (person.gender === 'male') {
      lines.push('1 SEX M');
    } else if (person.gender === 'female') {
      lines.push('1 SEX F');
    } else {
      lines.push('1 SEX U');
    }

    // BIRT
    if (person.birthDate || person.birthPlace) {
      lines.push('1 BIRT');
      if (person.birthDate) {
        lines.push(`2 DATE ${formatGedcomDate(person.birthDate)}`);
      }
      if (person.birthPlace) {
        lines.push(`2 PLAC ${person.birthPlace}`);
      }
    }

    // DEAT
    if (person.isDeceased || person.deathDate || person.deathPlace) {
      lines.push('1 DEAT');
      if (person.deathDate) {
        lines.push(`2 DATE ${formatGedcomDate(person.deathDate)}`);
      }
      if (person.deathPlace) {
        lines.push(`2 PLAC ${person.deathPlace}`);
      }
    }

    // Family links
    if (person.parentUnionId && unionToXref[person.parentUnionId]) {
      lines.push(`1 FAMC ${unionToXref[person.parentUnionId]}`);
    }
    for (const uId of person.unionIds) {
      if (unionToXref[uId]) {
        lines.push(`1 FAMS ${unionToXref[uId]}`);
      }
    }

    // Notes
    if (person.notes) {
      appendGedcomNote(lines, person.notes, 1);
    }
  }

  // 3. Family Records
  for (const union of Object.values(sanitized.unions)) {
    const xref = unionToXref[union.id];
    lines.push(`0 ${xref} FAM`);

    // Assign HUSB / WIFE based on partners' genders if possible
    const partners = union.partnerIds.map((id) => sanitized.people[id]).filter(Boolean);
    let husbandAssigned = false;
    let wifeAssigned = false;

    for (const partner of partners) {
      const pXref = personToXref[partner.id];
      if (partner.gender === 'male' && !husbandAssigned) {
        lines.push(`1 HUSB ${pXref}`);
        husbandAssigned = true;
      } else if (partner.gender === 'female' && !wifeAssigned) {
        lines.push(`1 WIFE ${pXref}`);
        wifeAssigned = true;
      }
    }

    // Unassigned partners fallback to HUSB then WIFE
    for (const partner of partners) {
      const pXref = personToXref[partner.id];
      const isAlreadyHusb = lines.includes(`1 HUSB ${pXref}`);
      const isAlreadyWife = lines.includes(`1 WIFE ${pXref}`);
      if (!isAlreadyHusb && !isAlreadyWife) {
        if (!husbandAssigned) {
          lines.push(`1 HUSB ${pXref}`);
          husbandAssigned = true;
        } else if (!wifeAssigned) {
          lines.push(`1 WIFE ${pXref}`);
          wifeAssigned = true;
        } else {
          // Additional partner
          lines.push(`1 HUSB ${pXref}`);
        }
      }
    }

    // Children
    for (const childId of union.childrenIds) {
      if (personToXref[childId]) {
        lines.push(`1 CHIL ${personToXref[childId]}`);
      }
    }

    // Marriage
    if (union.marriageDate || union.type === 'married') {
      lines.push('1 MARR');
      if (union.marriageDate) {
        lines.push(`2 DATE ${formatGedcomDate(union.marriageDate)}`);
      }
    }

    // Divorce
    if (union.type === 'divorced' || union.divorceDate) {
      lines.push('1 DIV');
      if (union.divorceDate) {
        lines.push(`2 DATE ${formatGedcomDate(union.divorceDate)}`);
      }
    }
  }

  // 4. Trailer
  lines.push('0 TRLR');
  return lines.join('\n') + '\n';
}

/**
 * Triggers a browser download of the tree as a .ged file.
 */
export function exportGedcomToFile(tree: TreeData): void {
  const content = exportGedcom(tree);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sanitizedName = (tree.name || 'family_tree').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${sanitizedName}.ged`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
