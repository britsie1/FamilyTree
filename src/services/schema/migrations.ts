import type { TreeData, Person, Union, LayoutOverrides } from '../../types/tree';
import { CURRENT_SCHEMA_VERSION } from './constants';

function generateId(prefix = 'tree'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

/**
 * Migrates legacy unversioned tree data (v0) to Schema Version 1.
 * - Adds schemaVersion: 1
 * - Extracts deprecated person.x, person.y, person.horizontalX, person.horizontalY into tree.layoutOverrides / horizontalOverrides
 * - Normalizes missing arrays (unionIds, partnerIds, childrenIds)
 * - Ensures required top-level metadata
 */
function migrateV0ToV1(raw: any): TreeData {
  const now = new Date().toISOString();

  const id = typeof raw?.id === 'string' && raw.id.trim() !== '' ? raw.id : generateId('tree');
  const name = typeof raw?.name === 'string' ? raw.name : 'Untitled Tree';
  const createdAt = typeof raw?.createdAt === 'string' ? raw.createdAt : now;
  const updatedAt = typeof raw?.updatedAt === 'string' ? raw.updatedAt : now;

  const layoutOverrides: LayoutOverrides = { ...(raw?.layoutOverrides || {}) };
  const horizontalOverrides: LayoutOverrides = { ...(raw?.horizontalOverrides || {}) };

  // Normalize people
  const people: Record<string, Person> = {};
  if (raw?.people && typeof raw.people === 'object') {
    const rawPeopleEntries = Array.isArray(raw.people)
      ? raw.people.map((p: any) => [p?.id, p])
      : Object.entries(raw.people);

    for (const [pKey, rawPerson] of rawPeopleEntries) {
      if (!rawPerson || typeof rawPerson !== 'object') continue;
      const pId = typeof rawPerson.id === 'string' && rawPerson.id.trim() !== '' ? rawPerson.id : String(pKey);
      if (!pId) continue;

      // Extract legacy visual positions
      if (rawPerson.x !== undefined && rawPerson.y !== undefined && !layoutOverrides[pId]) {
        layoutOverrides[pId] = { x: Number(rawPerson.x), y: Number(rawPerson.y) };
      }
      if (rawPerson.horizontalX !== undefined && rawPerson.horizontalY !== undefined && !horizontalOverrides[pId]) {
        horizontalOverrides[pId] = { x: Number(rawPerson.horizontalX), y: Number(rawPerson.horizontalY) };
      }

      const { x: _x, y: _y, horizontalX: _hx, horizontalY: _hy, ...restPerson } = rawPerson;

      people[pId] = {
        ...restPerson,
        id: pId,
        unionIds: Array.isArray(rawPerson.unionIds)
          ? rawPerson.unionIds.filter((u: any) => typeof u === 'string')
          : [],
      };
    }
  }

  // Normalize unions
  const unions: Record<string, Union> = {};
  if (raw?.unions && typeof raw.unions === 'object') {
    const rawUnionEntries = Array.isArray(raw.unions)
      ? raw.unions.map((u: any) => [u?.id, u])
      : Object.entries(raw.unions);

    for (const [uKey, rawUnion] of rawUnionEntries) {
      if (!rawUnion || typeof rawUnion !== 'object') continue;
      const uId = typeof rawUnion.id === 'string' && rawUnion.id.trim() !== '' ? rawUnion.id : String(uKey);
      if (!uId) continue;

      unions[uId] = {
        ...rawUnion,
        id: uId,
        partnerIds: Array.isArray(rawUnion.partnerIds)
          ? rawUnion.partnerIds.filter((p: any) => typeof p === 'string')
          : [],
        childrenIds: Array.isArray(rawUnion.childrenIds)
          ? rawUnion.childrenIds.filter((c: any) => typeof c === 'string')
          : [],
      };
    }
  }

  const migrated: TreeData = {
    ...raw,
    id,
    name,
    description: typeof raw?.description === 'string' ? raw.description : '',
    createdAt,
    updatedAt,
    schemaVersion: 1,
    people,
    unions,
  };

  if (Object.keys(layoutOverrides).length > 0) {
    migrated.layoutOverrides = layoutOverrides;
  }
  if (Object.keys(horizontalOverrides).length > 0) {
    migrated.horizontalOverrides = horizontalOverrides;
  }

  return migrated;
}

/**
 * Migration registry that upgrades any raw or older tree payload step-by-step
 * to the CURRENT_SCHEMA_VERSION.
 */
export function migrate(raw: unknown): TreeData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Cannot migrate non-object tree payload');
  }

  let current = raw as any;
  const initialVersion = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0;

  // Stepwise upgrade path
  if (initialVersion < 1) {
    current = migrateV0ToV1(current);
  }

  // Ensure current version is recorded
  return { ...current, schemaVersion: CURRENT_SCHEMA_VERSION } as TreeData;
}
