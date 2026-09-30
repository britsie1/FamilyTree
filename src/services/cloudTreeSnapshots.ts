import type { Person, Union } from '../types/tree';

interface SnapshotDocument<T> {
  id: string;
  data(): T;
}

/**
 * Query snapshots are complete working sets, not just deltas. Rebuild from the
 * acknowledged snapshot so skipped optimistic events and hard removals cannot
 * leave the realtime cache permanently missing or retaining records.
 */
export function recordsFromSnapshot<T extends Person | Union>(documents: readonly SnapshotDocument<T>[]): Record<string, T> {
  return Object.fromEntries(documents.map((document) => [document.id, { ...document.data(), id: document.id }]));
}

/** Do not publish a subcollection tree until both collections have loaded. */
export class CloudCollectionSnapshots {
  people: Record<string, Person> = {};
  unions: Record<string, Union> = {};
  private peopleReady = false;
  private unionsReady = false;

  get ready(): boolean { return this.peopleReady && this.unionsReady; }

  acceptPeople(documents: readonly SnapshotDocument<Person>[], hasPendingWrites: boolean): boolean {
    if (hasPendingWrites) return false;
    this.people = recordsFromSnapshot(documents);
    this.peopleReady = true;
    return this.ready;
  }

  acceptUnions(documents: readonly SnapshotDocument<Union>[], hasPendingWrites: boolean): boolean {
    if (hasPendingWrites) return false;
    this.unions = recordsFromSnapshot(documents);
    this.unionsReady = true;
    return this.ready;
  }
}