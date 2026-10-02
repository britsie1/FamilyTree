import type { Person, Union, TreeData, TreeLink, PersonDocument, Gender, UnionType } from '../../types/tree';
import type { ValidationResult } from './types';

const VALID_GENDERS: Set<Gender> = new Set(['male', 'female', 'other', 'unspecified']);
const VALID_UNION_TYPES: Set<UnionType> = new Set(['married', 'divorced', 'separated', 'partner', 'other']);

function isObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((item) => typeof item === 'string');
}

export function validateTreeLink(raw: unknown): ValidationResult<TreeLink> {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { success: false, errors: ['TreeLink must be an object'] };
  }

  if (!isString(raw.treeId) || raw.treeId.trim() === '') {
    errors.push('TreeLink.treeId must be a non-empty string');
  }
  if (!isString(raw.treeName)) {
    errors.push('TreeLink.treeName must be a string');
  }
  if (raw.personId !== undefined && !isString(raw.personId)) {
    errors.push('TreeLink.personId must be a string if provided');
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? (raw as TreeLink) : undefined,
    errors,
  };
}

export function validatePersonDocument(raw: unknown): ValidationResult<PersonDocument> {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { success: false, errors: ['PersonDocument must be an object'] };
  }

  if (!isString(raw.id) || raw.id.trim() === '') {
    errors.push('PersonDocument.id must be a non-empty string');
  }
  if (!isString(raw.name)) {
    errors.push('PersonDocument.name must be a string');
  }
  if (!isString(raw.driveFileId)) {
    errors.push('PersonDocument.driveFileId must be a string');
  }
  if (!isString(raw.uploadedAt)) {
    errors.push('PersonDocument.uploadedAt must be a string');
  }
  for (const field of ['description', 'documentType', 'documentDate', 'documentPlace', 'sourceReference', 'transcription']) {
    if (raw[field] !== undefined && !isString(raw[field])) {
      errors.push(`PersonDocument.${field} must be a string if provided`);
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? (raw as PersonDocument) : undefined,
    errors,
  };
}

export function validatePerson(raw: unknown): ValidationResult<Person> {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { success: false, errors: ['Person record must be an object'] };
  }

  if (!isString(raw.id) || raw.id.trim() === '') {
    errors.push('Person.id must be a non-empty string');
  }

  if (raw.firstName !== undefined && !isString(raw.firstName)) {
    errors.push('Person.firstName must be a string');
  }
  if (raw.lastName !== undefined && !isString(raw.lastName)) {
    errors.push('Person.lastName must be a string');
  }
  if (raw.gender !== undefined && !VALID_GENDERS.has(raw.gender as Gender)) {
    errors.push(`Person.gender must be one of: male, female, other, unspecified; got "${raw.gender}"`);
  }
  if (raw.birthDate !== undefined && !isString(raw.birthDate)) {
    errors.push('Person.birthDate must be a string');
  }
  if (raw.deathDate !== undefined && !isString(raw.deathDate)) {
    errors.push('Person.deathDate must be a string');
  }
  if (raw.isDeceased !== undefined && typeof raw.isDeceased !== 'boolean') {
    errors.push('Person.isDeceased must be a boolean');
  }
  if (raw.parentUnionId !== undefined && !isString(raw.parentUnionId)) {
    errors.push('Person.parentUnionId must be a string');
  }
  if (!Array.isArray(raw.unionIds) || !isStringArray(raw.unionIds)) {
    errors.push('Person.unionIds must be an array of strings');
  }
  if (raw.generation !== undefined && typeof raw.generation !== 'number') {
    errors.push('Person.generation must be a number');
  }

  if (raw.linkedTrees !== undefined) {
    if (!Array.isArray(raw.linkedTrees)) {
      errors.push('Person.linkedTrees must be an array');
    } else {
      raw.linkedTrees.forEach((link, idx) => {
        const res = validateTreeLink(link);
        if (!res.success) {
          errors.push(`Person.linkedTrees[${idx}] invalid: ${res.errors.join(', ')}`);
        }
      });
    }
  }

  if (raw.documents !== undefined) {
    if (!Array.isArray(raw.documents)) {
      errors.push('Person.documents must be an array');
    } else {
      raw.documents.forEach((doc, idx) => {
        const res = validatePersonDocument(doc);
        if (!res.success) {
          errors.push(`Person.documents[${idx}] invalid: ${res.errors.join(', ')}`);
        }
      });
    }
  }

  if (raw.updatedAt !== undefined && !isString(raw.updatedAt)) {
    errors.push('Person.updatedAt must be a string');
  }
  if (raw.updatedBy !== undefined && !isString(raw.updatedBy)) {
    errors.push('Person.updatedBy must be a string');
  }
  if (raw.rev !== undefined && typeof raw.rev !== 'number') {
    errors.push('Person.rev must be a number');
  }
  if (raw.deleted !== undefined && typeof raw.deleted !== 'boolean') {
    errors.push('Person.deleted must be a boolean');
  }
  if (raw.deletedAt !== undefined && !isString(raw.deletedAt)) {
    errors.push('Person.deletedAt must be a string');
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? (raw as Person) : undefined,
    errors,
  };
}

export function validateUnion(raw: unknown): ValidationResult<Union> {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { success: false, errors: ['Union record must be an object'] };
  }

  if (!isString(raw.id) || raw.id.trim() === '') {
    errors.push('Union.id must be a non-empty string');
  }
  if (!Array.isArray(raw.partnerIds) || !isStringArray(raw.partnerIds)) {
    errors.push('Union.partnerIds must be an array of strings');
  }
  if (!Array.isArray(raw.childrenIds) || !isStringArray(raw.childrenIds)) {
    errors.push('Union.childrenIds must be an array of strings');
  }
  if (raw.type !== undefined && !VALID_UNION_TYPES.has(raw.type as UnionType)) {
    errors.push(`Union.type must be one of: married, divorced, separated, partner, other; got "${raw.type}"`);
  }
  if (raw.marriageDate !== undefined && !isString(raw.marriageDate)) {
    errors.push('Union.marriageDate must be a string');
  }
  if (raw.divorceDate !== undefined && !isString(raw.divorceDate)) {
    errors.push('Union.divorceDate must be a string');
  }
  if (raw.updatedAt !== undefined && !isString(raw.updatedAt)) {
    errors.push('Union.updatedAt must be a string');
  }
  if (raw.updatedBy !== undefined && !isString(raw.updatedBy)) {
    errors.push('Union.updatedBy must be a string');
  }
  if (raw.rev !== undefined && typeof raw.rev !== 'number') {
    errors.push('Union.rev must be a number');
  }
  if (raw.deleted !== undefined && typeof raw.deleted !== 'boolean') {
    errors.push('Union.deleted must be a boolean');
  }
  if (raw.deletedAt !== undefined && !isString(raw.deletedAt)) {
    errors.push('Union.deletedAt must be a string');
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? (raw as Union) : undefined,
    errors,
  };
}

export function validateTree(raw: unknown): ValidationResult<TreeData> {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { success: false, errors: ['TreeData must be an object'] };
  }

  if (!isString(raw.id) || raw.id.trim() === '') {
    errors.push('TreeData.id must be a non-empty string');
  }
  if (!isString(raw.name)) {
    errors.push('TreeData.name must be a string');
  }
  if (!isString(raw.createdAt)) {
    errors.push('TreeData.createdAt must be an ISO date string');
  }
  if (!isString(raw.updatedAt)) {
    errors.push('TreeData.updatedAt must be an ISO date string');
  }

  if (raw.schemaVersion !== undefined && (typeof raw.schemaVersion !== 'number' || isNaN(raw.schemaVersion))) {
    errors.push('TreeData.schemaVersion must be a number');
  }

  if (!isObject(raw.people)) {
    errors.push('TreeData.people must be a dictionary object (Record<string, Person>)');
  } else {
    for (const [pId, person] of Object.entries(raw.people)) {
      const pRes = validatePerson(person);
      if (!pRes.success) {
        errors.push(`Person "${pId}" invalid: ${pRes.errors.join('; ')}`);
      } else if (person.id !== pId) {
        errors.push(`Person dictionary key "${pId}" does not match person.id "${person.id}"`);
      }
    }
  }

  if (!isObject(raw.unions)) {
    errors.push('TreeData.unions must be a dictionary object (Record<string, Union>)');
  } else {
    for (const [uId, union] of Object.entries(raw.unions)) {
      const uRes = validateUnion(union);
      if (!uRes.success) {
        errors.push(`Union "${uId}" invalid: ${uRes.errors.join('; ')}`);
      } else if (union.id !== uId) {
        errors.push(`Union dictionary key "${uId}" does not match union.id "${union.id}"`);
      }
    }
  }

  if (raw.collapsedPersonIds !== undefined && !isStringArray(raw.collapsedPersonIds)) {
    errors.push('TreeData.collapsedPersonIds must be an array of strings');
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? (raw as TreeData) : undefined,
    errors,
  };
}
