# FamilyTree Data Integrity & Synchronization Architecture

## Phase 0: Investigation & Data Integrity Audit Findings

### 1. Data Boundaries (Entry and Exit Points)

Every location where tree data enters or leaves the application represents a data boundary where data could be corrupted, outdated, or incomplete.

| Boundary | Mechanism & Module | Direction | Current Invariant / Validation State |
| :--- | :--- | :--- | :--- |
| **Local Storage** | `src/services/storage.ts` (`loadCurrentTree`, `loadTreeById`, `saveCurrentTree`) | Read / Write | Uses `JSON.parse` with minimal sanity check (`parsed.people && parsed.unions`), passes to `sanitizeTree()`. No schema version checking or invariant rejection. Corrupted records persist in `localStorage`. |
| **Cloud Firestore (Full Tree)** | `src/services/firestoreService.ts`, `src/hooks/useCloudSync.ts` | Read / Write | Read via `getCloudTree()` or `onSnapshot()`. Overwrite via `updateDoc()` or `runTransaction()` with `threeWayMergeTree()`. Missing validation of remote tree invariants prior to adoption. |
| **Cloud Firestore (Granular Patches)** | `src/services/firestoreService.ts`, `src/services/cloudSyncBridge.ts` | Write (debounced) | Patches individual person or union records (`patchCloudPerson`, `patchCloudUnion`, `deleteCloudPerson`, `deleteCloudUnion`). No tombstones; deletes are hard-deletes (`deleteField` or `deleteDoc`). |
| **GEDCOM 5.5.1 Import / Export** | `src/services/gedcomService.ts`, `src/hooks/useTreeIO.ts` | Read / Write | Line-based tokenizer constructs INDI/FAM records. Post-processed by `sanitizeTree()`. Does not reject or repair parent cycles or unresolvable family links. Export strips non-GEDCOM attributes. |
| **JSON File Backup Import / Export** | `src/services/storage.ts` (`importTreeFromJsonString`, `exportTreeToJsonFile`) | Read / Write | Unchecked JSON parsing; accepts invalid types, inverted dates, or malformed structure as long as `people` and `unions` keys exist. |
| **Three-Way Merge Engine** | `src/services/treeMerge.ts` (`threeWayMergeTree`, `threeWayMergePerson`, `threeWayMergeUnion`) | Read / Write | Combines base, local, and remote trees. Can leave dangling partner/child references when a person is deleted in one client while a union or child is edited/added in another. |
| **Cross-Tree Linking** | `src/hooks/useTreeLinking.ts`, `src/services/treeOperations.ts` | Read / Write | Attaches `TreeLink` references across distinct trees stored in `localStorage` or Firestore. No validation that target trees or target persons still exist over time. |
| **Google Drive Integration** | `src/services/googleDriveService.ts` | Read / Write | Stores folder configs and person attachments with Drive file IDs. |
| **Store State Mutations** | `src/stores/useTreeStore.ts`, `src/services/treeOperations.ts` | Internal Ingress | Immer produce/patch mutations. Unchecked developer mutations can violate relational integrity. |

---

### 2. Current Sync Granularity, Conflicts, and Deletions

1. **Sync Granularity**:
   - The application has two modes: monolithic tree document (`/trees/{treeId}`) and experimental people subcollection (`/trees/{treeId}/people/{personId}`).
   - However, mutations in `useTreeStore.ts` are inconsistent:
     - `updatePerson`, `updateUnion`, `deletePerson`, `deleteUnion` notify `cloudSyncBridge`.
     - `addChild`, `addSibling`, `addPartner`, `addParent`, `linkChild`, `linkPartner`, `linkParent`, `unlinkChildAction`, `unlinkPartnerAction` bypass `cloudSyncBridge` and rely on `useCloudSync` debounced full-tree auto-save (`updateCloudTreeData`).
2. **Conflict Resolution Today**:
   - `threeWayMergeTree` attempts 3-way reconciliation against `lastBaseTreeRef`.
   - Primitive conflicts are resolved by favoring local values while pushing a `ConflictRecord`.
   - Structural sets (like `unionIds` and `childrenIds`) are merged via set union/diff.
3. **Deletions Today**:
   - Deletions are **hard deletes** without tombstones (`deleteField()` on tree map or `deleteDoc()` on subcollection).
   - Problem: If Client A deletes person $P$, and Client B modifies $P$ offline or concurrently, the 3-way merge sees $P$ present in B and absent in A, resurrecting $P$ with broken or severed union references, or leaving orphan records.

---

### 3. Implicit Invariants Assumed by the System

The UI canvas, layout engine (`layoutEngine`), kinship calculations, sunburst, and timeline scrubbers rely on the following invariants:

1. **Unique Identity**: Every person and union has a globally unique, non-empty identifier.
2. **Referential Integrity (Bi-directional consistency)**:
   - For every person $P$ with `parentUnionId == U`, union $U$ exists and $U.\text{childrenIds}$ contains $P$.
   - For every union $U$ with child $C \in U.\text{childrenIds}$, person $C$ exists and $C.\text{parentUnionId} == U$.
   - For every person $P$ with $U \in P.\text{unionIds}$, union $U$ exists and $P \in U.\text{partnerIds}$.
   - For every union $U$ with partner $P \in U.\text{partnerIds}$, person $P$ exists and $U \in P.\text{unionIds}$.
3. **Acyclicity in Ancestry**:
   - The parent-child directed graph is a Directed Acyclic Graph (DAG). No person can be their own ancestor ($P \not\to^* P$).
   - A person cannot be both a partner and a child of the same union.
4. **Valid Chronology & Lifespans**:
   - For any individual with both dates: $\text{birthDate} \le \text{deathDate}$.
   - Note: Inter-generational unions (e.g. between people of different generations or large age differences) are explicitly legal and supported.
5. **Root Person Presence**:
   - If `rootPersonId` is set, it must resolve to an existing person in `tree.people`.
6. **Cross-Tree Link Validity**:
   - Every `TreeLink` has a valid non-empty `treeId`.

---

### 4. Analysis of Historical Bug Classes (from git history)

Recent commits highlight critical vulnerability patterns:

- **`f7b3c7f` (Merge, Canvas, and GEDCOM Export)**:
  - Three-way merge caused resurrection of deleted unions and severed children.
  - GEDCOM export fabricated bogus day numbers (`01`) for month-year dates (`YYYY-MM`).
  - Empty `DEAT` lines were exported for living individuals.
- **`a243607` (Cloud Synchronization & Deletion Handling)**:
  - Deletions in cloud trees were dropped or caused race conditions because delete operations lacked proper queuing in `cloudSyncBridge`.
- **`067baaa` (Temporal Clamping, Encoding, and Sanitization)**:
  - Ancestors prior to 1800 were incorrectly clamped in layout and timeline.
  - Non-Latin Unicode characters (Cyrillic, Arabic, CJK) caused corrupted filenames and broken SVG exports.
  - Death dates and places remained attached to individuals when `isDeceased` was toggled to `false`.
- **`c2313a5` (Relationship Invariants & Deadlocks)**:
  - Unlinking a child from an orphan union (0 partners) deadlocked or leaked empty unions in memory.
  - Pedigree cycle detection in health checks flagged innocent relatives who were not actual participants in the cycle.

---

### 5. Reproducible Failure Scenarios (`tests/dataIntegrityFailures.test.ts`)

Four concrete failure scenarios have been reproduced and codified into `tests/dataIntegrityFailures.test.ts`:

1. **Dangling Partner Reference via Concurrent Merge**:
   - Client A deletes partner $P_1$ from union $U_1$.
   - Client B concurrently updates the marriage date on $U_1$.
   - `threeWayMergeTree` accepts Client B's union (which still has $P_1$ in `partnerIds`), but accepts Client A's deletion of $P_1$.
   - Result: $U_1$ references deleted person $P_1$, causing layout crashes.
2. **Orphan Union Reference on Delete vs Child Addition**:
   - Client A deletes single parent $P_1$ and union $U_1$.
   - Client B concurrently adds child $C_1$ to $U_1$.
   - Result: Child $C_1$ references a union with zero partners that was deleted, or $U_1$ has no valid parents.
3. **GEDCOM Parser Cyclic Pedigree Acceptance**:
   - A malformed GEDCOM with mutual parent-child cross-references is parsed without error by `parseGedcom()`, introducing cycles into memory.
4. **Malformed JSON Import with Inverted Lifespans**:
   - `importTreeFromJsonString()` accepts JSON with `deathDate < birthDate` without invariant validation or repair.

---

### 6. Dependency Evaluation: `zod` vs Hand-Rolled Validation

- **Decision**: Hand-rolled TypeScript validation in `src/services/schema/`.
- **Justification**:
  1. Zero extra runtime dependencies (adheres strictly to repo constraints).
  2. Avoids adding external library bundle overhead when clean TypeScript validators fully satisfy our requirements.
  3. TreeData schemas are structured Record maps (`Record<string, Person>`, `Record<string, Union>`). Hand-rolled validators provide exact error paths, structured violation reporting, and fast execution without framework overhead.
  4. Keeps TypeScript types in `src/types/tree.ts` as the single source of truth.

---

### 7. Phase 1 Architecture (Versioned Schema, Migration & Invariants)

1. **Schema Versioning**:
   - Define `CURRENT_SCHEMA_VERSION = 1` in `src/services/schema/constants.ts`.
   - Persisted trees contain `schemaVersion: number`.
2. **Validation & Migration Pipeline**:
   - `migrate(raw: unknown): TreeData`: Handles legacy trees (`schemaVersion == null` or older), migrating step-by-step.
   - `validateTreeSchema(raw: unknown): ValidationResult`: Strict shape validation.
   - `checkInvariants(tree: TreeData): InvariantViolation[]`: Deep semantic integrity check returning structured violations without throwing.
   - `repair(tree: TreeData): { tree: TreeData; report: RepairReport }`: Deterministic repair of fixable issues (pruning dangling partner/child references, repairing reciprocal links, normalizing dates). Never deletes persons.
3. **Boundary Interceptors**:
   - Intercept loads in `storage.ts`, `firestoreService.ts`, `gedcomService.ts`, `treeIO.ts`, and `treeMerge.ts`.

---

### 8. Phase 2 Architecture (Per-Record Sync with Tombstones)

1. **Firestore Data Model**:
   - Store individual records in dedicated subcollections:
     - `/trees/{treeId}/people/{personId}`: Individual person document.
     - `/trees/{treeId}/unions/{unionId}`: Individual relationship/union document.
     - Root document `/trees/{treeId}`: Metadata (`name`, `description`, `rootPersonId`, `collapsedPersonIds`, `googleDriveConfig`, `ownerId`, `isPublic`, `publicRole`, `sharedWith`, `sharedEmails`, `storageMode: 'subcollections'`, `schemaVersion: 1`, `updatedAt`, `version`).
   - Each person and union record contains sync metadata:
     - `updatedAt`: ISO 8601 timestamp string
     - `updatedBy`: UID of user who authored the change
     - `rev`: monotonic incrementing revision number
     - `deleted?: boolean`: tombstone flag (`true` when deleted)
     - `deletedAt?: string`: ISO 8601 deletion timestamp
2. **Conflict & Tombstone Resolution (`src/services/syncMerge.ts`)**:
   - Pure, deterministic merge function: `syncMerge(localTree, remoteTree, options)`.
   - **Active vs Active Resolution**: Last-Writer-Wins (LWW) using `updatedAt`. If timestamps are equal or missing, higher `rev` wins. Deterministic tie-breaker for identical timestamps/revisions.
   - **Tombstone vs Tombstone**: Stays deleted, retains latest deletion timestamp.
   - **Delete vs Edit Rule**:
     - A delete wins unless the edit has an `updatedAt` timestamp strictly newer than the tombstone's `deletedAt`.
     - If the edit timestamp is strictly newer (`edit.updatedAt > tombstone.deletedAt`), the record is **resurrected** (restored from tombstone). The `deleted` flag is cleared, prior attributes are retained and updated, and an informational notice is logged in `SyncMergeResult`.
     - If `tombstone.deletedAt >= edit.updatedAt`, the delete wins. The record remains deleted.
   - **Post-Merge Invariant Enforcement**:
     - Deleted records are pruned from the active memory graph (`TreeData.people` and `TreeData.unions`) into a separate `tombstones` record map.
     - Relational repair (`repair(tree)`) automatically cascades to clean dangling references (pruning deleted partners and children from unions, clearing `parentUnionId` on orphaned children, and safely dropping empty unions as tombstones).
     - `checkInvariants(repairedTree)` confirms 0 invariant violations on the merged result.
3. **Lazy Idempotent Migration**:
   - On first open of a legacy monolithic cloud tree by an authorized client, `migrateTreeToSubcollections(treeId)`:
     1. Batch-writes all existing `people` to `/trees/{treeId}/people/{personId}` with `deleted: false`, `rev: 1`, and `updatedAt`.
     2. Batch-writes all existing `unions` to `/trees/{treeId}/unions/{unionId}` with `deleted: false`, `rev: 1`, and `updatedAt`.
     3. Updates the root document with `storageMode: 'subcollections'`, `people: {}`, `unions: {}`, and bumped `version`.
   - Idempotent: safe to run multiple times without duplicating or overwriting newer subcollection data.
4. **Offline Queueing and Loop Suppression**:
   - `cloudSyncBridge` queues per-record patches and tombstone deletions during network outages.
   - Upon reconnect (`online` event), pending queue is flushed with exponential retry backoff.
   - Real-time listeners suppress local echo updates by checking `snapshot.metadata.hasPendingWrites` and content fingerprints.
5. **Compaction Policy**:
   - Retain tombstones for 30 days before purge.

---

### 9. Phase 3 Architecture (Invariant, Property, and Round-Trip Testing in CI)

1. **Seeded Random Tree Generator (`src/test-utils/treeGenerator.ts`)**:
   - Pure, deterministic pseudo-random generator (Linear Congruential Generator) producing reproducible family graphs.
   - Generates multi-generational pedigrees with customizable depth, partners, child branching factors, and cross-line in-law connections.
   - Guarantees 100% adherence to schema version 1 invariants.
2. **Round-Trip & Mathematical Property Test Suites (`tests/propertyAndRoundTrip.test.ts`)**:
   - **JSON Export / Import Preservation**: Verifies lossless preservation of graph topology, notes, and positions across `exportTreeToJsonFile` and `importTreeFromJsonString`.
   - **GEDCOM 5.5.1 Export / Import Round-Trip**: Verifies family relationship recovery, date normalization, and INDI/FAM parsing.
   - **Mathematical Merge Properties**:
     - *Idempotence*: `syncMerge(A, A) == A`
     - *Commutativity*: `syncMerge(A, B) == syncMerge(B, A)`
     - *Associativity*: `syncMerge(syncMerge(A, B), C) == syncMerge(A, syncMerge(B, C))`
   - **Operation Invariant Preservation**: Every operation in `src/services/treeOperations.ts` preserves zero invariant violations.
   - **Migration Idempotence**: `migrate(migrate(T)) === migrate(T)`.
   - **Multi-Client Concurrent Simulation**: 3 concurrent clients with network delays, offline edits, and tombstone exchanges converging to identical state.
3. **Continuous Integration Pipeline (`.github/workflows/ci.yml`)**:
   - Automated checks on every push and pull request to `main`.
   - Runs `npm run lint` (`oxlint`), `npm test` (`tsx --test`), and `npm run build` (`tsc -b && vite build`).

---

### 10. Phase 4 Architecture (Automatic Local Snapshots and Restore Option)

1. **Snapshot Storage Engine (`src/services/snapshotService.ts`)**:
   - Built on native IndexedDB (`window.indexedDB`, DB `familytree_snapshots_db`, object store `snapshots`).
   - Pure in-memory fallback layer when running in Node.js test environments or private browser contexts without IndexedDB.
   - Indexed on `treeId`, `timestamp`, and composite `['treeId', 'timestamp']`.
   - Metadata payload: `id`, `treeId`, `treeName`, `createdAt`, `timestamp`, `reason`, `description`, `treeData`, `personCount`, `unionCount`, `schemaVersion`.
2. **Bounded Retention Policy (`calculateSnapshotIdsToPrune`)**:
   - **Tier 1 (Recent)**: The most recent 20 snapshots are kept unconditionally.
   - **Tier 2 (Daily Compaction)**: Snapshots older than the 20th within a 14-day window are compacted to at most 1 snapshot per calendar day.
   - **Tier 3 (Expiry)**: Snapshots older than 14 days beyond the 20th are pruned automatically upon new snapshot creation.
3. **Trigger Boundaries**:
   - **Pre-Import**: Captured in `useTreeIO.ts` before importing `.ged` or `.json` files.
   - **Pre-Preset Switch & Clear**: Captured before applying preset templates or blanking trees.
   - **Pre-Tree Deletion**: Captured in `TreeManagerModal.tsx` before removing trees from storage.
   - **Pre-Cloud Merge**: Captured in `useCloudSync.ts` before executing 3-way/syncMerge against remote updates.
   - **Periodic Editing Auto-Save**: Throttled 5-minute debounced checkpoint in `usePeriodicSnapshot.ts` while user actively modifies tree data.
4. **Restore Safety Guarantee ("Safety Undo")**:
   - Restoring any snapshot via `restoreSnapshot(snapshotId, currentTree)` automatically takes a `pre-restore` snapshot of the active tree before applying restored data.
   - If the user restores by mistake, their previous state is immediately available in the snapshot history.
5. **Non-blocking UI Feedback (`useNotificationStore.ts`, `NotificationToastContainer.tsx`)**:
   - Lightweight, accessible toast notifications (dismissible, auto-fading) for automatic snapshot creation and data boundary repairs (`registerIngressRepairListener`).
6. **Version History Modal (`src/components/Modal/VersionHistoryModal.tsx`)**:
   - Integrated into `TopNavbar` and `TreeModals`.
   - Lists snapshots with color-coded reason badges, relative timestamps, record count diffs (+/- people and unions).
   - Allows instant snapshot restoration, standalone JSON backup download, deletion, and manual checkpoint creation.

---

### 11. Known Limitations

1. **LWW Field-Level vs Document-Level Granularity**:
   - While `patchCloudPerson` and `patchCloudUnion` send granular field updates to Firestore, `syncMerge` operates at the entity (person or union) level using `updatedAt` and `rev`.
   - If two collaborators modify different fields of the same person offline concurrently (e.g. Collaborator A edits `birthPlace` while Collaborator B edits `notes`), the winning entity revision overwrites the entire record rather than performing a CRDT property-level merge.
2. **Tombstone Storage Overhead Prior to Compaction**:
   - Deleted entities persist as tombstone documents (`deleted: true`) for 30 days to guarantee offline collaborators do not accidentally resurrect them.
   - For family trees undergoing large bulk deletions, subcollections will retain tombstone documents until the 30-day retention threshold expires and compaction is triggered.
3. **Offline Mutation Queue Capacity**:
   - `cloudSyncBridge` caches offline changes locally. Extremely long offline editing sessions spanning thousands of continuous operations are bounded by local browser memory and localStorage limits before re-establishing connectivity.
4. **Cross-Tree Link Transitive Integrity**:
   - `TreeLink` entities reference remote trees and person IDs across accounts. When a remote tree or person is deleted or moved, the source link remains until manually inspected or cleared by the user.

---

### 12. Open Questions

1. **Real-Time Presence and Cursor Awareness**:
   - Would active collaborators benefit from live presence markers (e.g. subtle card borders or avatar badges) indicating which person card another user is currently viewing or editing to prevent simultaneous LWW collisions?
2. **Complex Family Models (Multi-Parent & Formal Adoption Schemas)**:
   - The current data schema models primary descent through a single `parentUnionId`. Families with foster parents, multi-parent adoptions, or gestational surrogacy currently rely on descriptive notes or separate union records; should schema v2 introduce typed parental relationships (e.g. `biological`, `adoptive`, `foster`)?
3. **Interactive Visual Conflict Resolution UI**:
   - Currently, concurrent conflicts are resolved automatically and deterministically via LWW and invariant repair, logging notices. Would users benefit from an interactive visual diff modal allowing manual field-by-field selection when concurrent edits occur within a narrow time window?
4. **Automated Server-Side Scheduled Compaction**:
   - Client-side compaction is implemented via `compactCloudTombstones` and `compactTombstones`. Would an automated Firebase Cloud Function or Cloud Run scheduled cron job running nightly provide better storage hygiene without requiring client triggering?

---

### 13. Rollout and Deployment Steps

1. **Step 1: Security Rules Deployment**:
   - Deploy the hardened Firestore security rules to Firebase:
     ```bash
     firebase deploy --only firestore:rules
     ```
   - Verify that shape validators (`isValidPersonDoc`, `isValidUnionDoc`) and compaction delete permissions (`resource.data.deleted == true`) are enforced in the Firebase Emulator or Console.
2. **Step 2: Subcollection Migration**:
   - Legacy monolithic cloud trees are migrated lazily and idempotently upon first access by an authorized owner or editor via `migrateTreeToSubcollections(treeId)`.
   - For zero-downtime batch migration across all legacy trees in production, run an administrative batch script invoking `migrateTreeToSubcollections` across all documents in `/trees`.
3. **Step 3: Web Application Build & Deployment**:
   - Execute the production build:
     ```bash
     npm run build
     ```
   - Deploy the generated `dist/` directory to the hosting environment (Firebase Hosting, Vercel, Netlify, or Cloudflare Pages).
4. **Step 4: Local Storage and IndexedDB Migration**:
   - On application launch, `loadCurrentTree()` automatically routes local trees through `processTreeIngress()`. Trees without a schema version are upgraded, repaired, and stamped with `schemaVersion: 1`.
   - The snapshot subsystem automatically provisions `familytree_snapshots_db` in IndexedDB.
5. **Step 5: Post-Deployment Smoke Verification**:
   - Verify that creating, updating, and deleting people and unions persists granular subcollection documents in Firestore.
   - Verify that offline edits queue and sync cleanly upon reconnect.
   - Verify that Version History snapshots appear after major actions and can be restored cleanly.

---

### 14. Tombstone Compaction Policy & Implementation

1. **Retention Period**:
   - Default 30 days (`DEFAULT_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000`).
   - Guarantees that collaborators who work offline or check the family tree once a month have their deletions and concurrent edits synchronized safely without resurrecting stale records.
2. **Pure Referential Safety Guarantees**:
   - `compactTombstones(activeTree, tombstones, maxAgeMs, now)` in `src/services/tombstoneCompactor.ts` guarantees that **no tombstone is ever purged if it is referenced in the active graph**:
     - If a person tombstone is older than 30 days, but is still listed as a partner or child in an active union, it is **retained** and a safety violation notice is reported in `safetyViolationsPrevented`.
     - If a union tombstone is older than 30 days, but is still referenced as `parentUnionId` or in `unionIds` by an active person, it is **retained**.
3. **Execution Environments**:
   - **Local Storage / In-Memory**: `compactTombstones` purges expired tombstones from local storage and memory caches.
   - **Cloud Firestore**: `compactCloudTombstones(treeId, maxAgeMs)` loads subcollection documents, evaluates retention and active graph safety, and executes batch hard-deletes (`batch.delete()`) for all eligible expired tombstones.
4. **Security Rule Permission Alignment**:
   - Firestore security rules restrict hard deletes to tree owners, **except** during compaction where authorized editors are allowed to delete documents if and only if `resource.data.get('deleted', false) == true`.
---

### 15. Firestore Rules: Scope of Automated Tests and Required Manual Verification

1. **Shape validators are tolerant of optional fields.**
   - `Person.firstName`, `lastName`, `gender` and `unionIds` (and `Union.partnerIds` / `childrenIds`) are optional in `src/types/tree.ts`, and `cleanForFirestore` strips `undefined` values before writing. The rules therefore only type-check these fields **when present**.
   - `id` must match the document path. `deleted`, `rev` and `updatedAt` are type-checked when present.
   - Tombstones (`deleted == true`) skip the content checks, because `deleteCloudPerson` / `deleteCloudUnion` write minimal `{ id, deleted, deletedAt, updatedAt, updatedBy }` documents.
2. **What `tests/firestoreRules.test.ts` does and does not prove.**
   - It verifies that `firestore.rules` and `RECOMMENDED_FIRESTORE_RULES` are identical, that expected functions exist, and that a TypeScript *mirror* of the validators behaves as intended.
    - These fast checks do not execute the rules language. `tests/firestoreAuthorization.rules.ts` separately executes actual rules with `@firebase/rules-unit-testing` and the Firestore emulator via `npm run test:rules`; CI runs both suites.
3. **Emulator coverage and deployment verification**:
    - Owners, explicit invited editors (`sharedWith` role), viewers, legacy email-only invitees, public editors and strangers are covered by emulator read/write tests on root documents and `/people` and `/unions`.
   - A person with only `{ id }` or with no `lastName` can be written; a person with `gender: 'robot'` is rejected.
   - A tombstone write succeeds for editors; an editor cannot delete a non-tombstone; an editor can delete a tombstone; an owner can delete anything.
    - Missing sharing fields use safe defaults; missing subcollection records and orphaned subcollections never bypass parent permissions.
    - After deploying, verify representative owner, editor and viewer access in a staging project before relying on these protections in production.
4. **Authorization policy:** explicit viewers (and legacy email-only invitees) are read-only even on public editor trees. Editors can only update allowed content fields, not sharing or owner metadata. Only owners manage sharing and delete trees; ownership transfers are rejected. Deploy `firestore.rules` separately to the production Firebase project to activate these protections.
