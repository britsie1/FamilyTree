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
  2. Avoids bundle bloat (~50 KB minified/gzipped for Zod).
  3. TreeData schemas are clean Record maps (`Record<string, Person>`, `Record<string, Union>`). Hand-rolled validators provide exact error paths, structured violation reporting, and fast execution without overhead.
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

