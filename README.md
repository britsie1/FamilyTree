# MyFamTree — Your Family, Connected

An advanced, fast, interactive, web-based family tree builder designed specifically to handle complex genealogical topologies—including **two brothers marrying two sisters (double in-laws)**, cousin intermarriages, multi-partner relationships, and pedigree collapse—without line tangles or rigid hierarchy restrictions.

Built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **Zustand**, **Immer**, and **Firebase Firestore**. Includes Web Worker offloading, spatial viewport culling, 4D temporal exploration, kinship calculation, ancestor sunburst charts, tree health audits, Google Drive document integration, durable offline sync, and automated version history snapshots.

Fully static and ready to deploy to Netlify, Vercel, or GitHub Pages.

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
  - [1. Graph Layout & Complex Topology Engine](#1-graph-layout--complex-topology-engine)
  - [2. Interactive Infinite Canvas & Manipulation](#2-interactive-infinite-canvas--manipulation)
  - [3. Kinship & Relationship Intelligence](#3-kinship--relationship-intelligence)
  - [4. 4D Temporal Exploration ("Who Was in the Room?")](#4-4d-temporal-exploration-who-was-in-the-room)
  - [5. Ancestor Sunburst Fan Chart](#5-ancestor-sunburst-fan-chart)
  - [6. Tree Health Audit & Demographic Statistics](#6-tree-health-audit--demographic-statistics)
  - [7. Primary Source Documents & Google Drive Integration](#7-primary-source-documents--google-drive-integration)
  - [8. Multi-Tree Management & Cross-Tree Linking](#8-multi-tree-management--cross-tree-linking)
  - [9. Data Integrity, Schema Migration & Automated Snapshots](#9-data-integrity-schema-migration--automated-snapshots)
  - [10. Real-Time Cloud Collaboration & Offline Outbox](#10-real-time-cloud-collaboration--offline-outbox)
  - [11. Comprehensive Import & Export](#11-comprehensive-import--export)
  - [12. Personalization, UI & Accessibility](#12-personalization-ui--accessibility)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Cloud Security & Firestore Rules](#cloud-security--firestore-rules)
- [Deployment & Social Link Previews](#deployment--social-link-previews)

---

## Core Capabilities

### 1. Graph Layout & Complex Topology Engine

- **Union-Centric Graph Architecture**:
  - Individual nodes (`Person`) are cleanly separated from partnership nodes (`Union`), enabling natural modeling of multi-partner marriages, serial remarriages, unmarried co-parents, and complex in-law entanglements without duplicating people.
- **Complex Edge-Case Solution (Double In-Laws & Pedigree Collapse)**:
  - Specially architected to untangle complex family structures—such as two brothers marrying two sisters, cousin marriages, or inter-generational unions.
- **Barycentric Generational Ranking & Multi-Lane Marriage Buses**:
  - Automatically clusters siblings and places partner couples side-by-side to minimize edge crossings.
  - Multi-lane marriage bus routing coordinates horizontal connector lines across overlapping generations to prevent collinear line clashes.
- **Smart Bridge-Hop (Jump-Over) SVG Routing**:
  - When vertical parent-child lines intersect horizontal marriage buses, an elevated circular bridge arc ("overpass") is automatically computed and rendered so viewers can trace relationships without visual ambiguity.
- **Dual Layout Styles**:
  - **Top-Down (Vertical)**: Traditional generational descent flowing from top to bottom.
  - **Left-to-Right (Horizontal)**: Pedigree layout flowing chronologically from left to right.
- **Generational Adjusted Spacing & Auto-Tidy**:
  - Toggle adaptive spacing to dynamically optimize generational gaps based on branch density.
  - **Auto-Tidy** instantly organizes custom manual card offsets back to clean algorithmic defaults.
- **Family Group Enclosures**:
  - Optional visual groupings render soft colored background enclosures and badges around family branches, clarifying distinct branches at a glance.
- **Asynchronous Web Worker & Viewport Culling**:
  - Layout calculations run off-thread in a dedicated Web Worker (`layoutWorker.ts`) with main-thread fallback, keeping the UI fluid and responsive even with thousands of nodes.
  - Spatial viewport culling renders only cards visible within the current canvas view (with generous padding for smooth panning), delivering 60 FPS performance on large trees.

---

### 2. Interactive Infinite Canvas & Manipulation

- **Fluid Navigation**:
  - Smooth pan and zoom centered on cursor or pinch midpoint.
  - Inertial pan momentum (`usePanMomentum`) gives canvas dragging a natural, tactile feel.
  - Fit-to-screen (`F`) instantly scales and centers the entire family tree into view.
- **Full Touch & Multi-Touch Gestures**:
  - Two-finger pan and pinch-to-zoom on touchscreens.
  - Touch-based node dragging with the same magnetic snapping and alignment guides available to mouse users.
- **Interactive MiniMap Radar & Compass Rose**:
  - Expandable MiniMap radar navigator displays the full family tree with an interactive viewport rectangle that can be dragged to navigate quickly across distant branches.
  - Floating compass rose provides spatial orientation cues.
- **Card Dragging with Magnetic Snapping & Alignment Guides**:
  - Drag individual cards or selections anywhere on the canvas.
  - Cards snap magnetically to a 32-unit grid or align with nearby card edges and centers, with real-time visual alignment guides.
  - Hold `Alt` to disable snapping for freehand placement; press `Escape` to cancel an in-progress drag.
  - Positions persist locally per tree layout orientation.
- **Interactive Ports & Connection Cables**:
  - Hovering over cards displays quick-action connection ports:
    - **Top / Left**: `+ Parent`
    - **Bottom / Right**: `+ Child`
    - **Left / Top**: `+ Sibling`
    - **Right / Bottom**: `+ Partner`
  - Click any port to immediately add a relative, or **drag an interactive connection cable**:
    - Drop onto another card to open the **Quick Link Menu** (`Link as Child`, `Link as Partner`, `Link as Sibling`, or `Link as Parent`).
    - Drop onto empty canvas space to **spawn a new relative** directly at that position.
- **Multi-Selection & Group Dragging**:
  - `Shift`-click individual cards or `Shift`-drag on canvas background for marquee box selection.
  - Drag any selected card to move the entire group together with automatic alignment guides.
  - Group movements are tracked as a single undo/redo step.
- **Branch Focus Mode & Descendant Collapsing**:
  - **Focus Mode**: Isolate any individual and their direct branch on the canvas to focus on specific lineages.
  - **Branch Collapsing**: Collapse descendant subtrees via card badges or the inspector to simplify large trees. Hidden descendant count badges display how many relatives are currently tucked away.
- **Dynamic Lineage Path Glow**:
  - Hovering over or selecting any card illuminates their direct ancestral and descendant lineage in vibrant indigo while subtly muting unrelated connections.
- **Animated Beacon Locator**:
  - Selecting a relative from search results, health audits, or relationship paths triggers a smooth camera animation with an expanding radar beacon ping to spotlight the card.

---

### 3. Kinship & Relationship Intelligence

- **Instant Relationship Computation**:
  - Select two individuals on the canvas to immediately calculate their exact genealogical relationship.
  - Computes natural titles: *Parent*, *Grandchild*, *Great-Aunt*, *First Cousin*, *Second Cousin Once Removed*, *Mother-in-law*, *Step-child*, *Double Cousin*, and more.
- **Consanguinity vs. Affinity**:
  - Distinguishes blood relations (consanguineous) from relations through marriage or legal adoption (affinity).
  - Identifies all shared common ancestors and notes generational differences.
- **Visual Connection Path**:
  - Highlights the shortest lineage path connecting the two individuals directly on the canvas, illuminating intermediate relatives and unions.
- **Floating Relationship Card HUD**:
  - Displays a concise summary card with relationship headline, natural explanation, common ancestors, and a 1-click **Swap** button to invert reference perspectives.
- **Kinship Calculator Modal**:
  - Dedicated full-featured relationship calculator modal to search and compare any two individuals across the tree.

---

### 4. 4D Temporal Exploration ("Who Was in the Room?")

- **Interactive Time-Travel Scrub Bar**:
  - Slide through historical years derived dynamically from the tree's earliest and latest vital dates.
  - Automated playback with variable playback speeds (**0.5x**, **1x**, **2x**).
- **Dynamic Visual Lifespan States**:
  - Visual status changes dynamically based on the active scrub year:
    - **Living**: Displayed in full color with exact age badge in that calendar year (`Age 34 (b. 1892)`).
    - **Unborn**: Rendered with dashed borders, muted grayscale, and transparency with a relative countdown label (`Born in 12 years`).
    - **Deceased**: Rendered with a dimmed grayscale appearance and passing label (`✝ Died 8 years ago`).
- **"Who Was in the Room?" Analytics**:
  - Real-time room metrics compute how many family members were alive in that exact calendar year and the average age of living relatives.
- **Historical Milestones & World Events**:
  - Synchronizes with major world historical events (e.g. World Wars, moon landing, historical treaties) relevant to the selected year.
  - Explores family moments (births, marriages, anniversaries) with celebratory confetti animations upon selecting milestone moments.

---

### 5. Ancestor Sunburst Fan Chart

- **Radial Pedigree Visualizer**:
  - Interactive multi-generation ancestor sunburst chart rooted at any selected individual.
  - Implements standard **Ahnentafel** numbering (1 = root, 2 = father, 3 = mother, etc.).
- **Configurable Arc Angles**:
  - **360° Full Circle**: Complete radial ancestor view.
  - **180° Half Circle (Fan Chart)**: Traditional half-circle pedigree fan chart.
  - **270° Fan**: Wide three-quarter radial spread.
- **Color Themes**:
  - **Lineage**: Visually distinguishes paternal and maternal ancestral lines.
  - **Generation**: Colors rings progressively by generational depth.
  - **Gender**: Distinguishes male and female ancestors.
  - **Parchment**: Classic antique genealogical palette.
- **Pedigree Completeness Metrics**:
  - Reports completion percentage and counts of filled vs. unfilled ancestor slots across selected depth levels (3 to 8+ generations).
- **Interactive Exploration**:
  - Click any arc to highlight ancestors, inspect details, center on the person in the main canvas, or export high-resolution vector graphics.

---

### 6. Tree Health Audit & Demographic Statistics

- **Automated Tree Health Audit**:
  - Analyzes the entire family graph and assigns a quality score (**0–100%**) with categorized health statuses (*Excellent*, *Good*, *Needs Attention*, *Critical*).
- **Comprehensive Anomaly Detection**:
  - **Chronology**: Birth after death, marriage before birth, death before marriage, or children born after parent's passing.
  - **Biology**: Unrealistic parent ages at child's birth (< 12 or > 70 years old), lifespans exceeding 120 years.
  - **Structure**: Pedigree cycles (acyclicity violations), dangling partner/child references, unlinked unions.
  - **Duplicates**: Flagging potential duplicate individuals with identical names and birth years.
  - **Completeness**: Missing vital dates, unnamed individuals, or missing parent unions.
- **In-Card Warning Badges**:
  - Anomalies display non-intrusive warning badges directly on affected person cards with 1-click jump to inspect and resolve issues.
- **Demographic & Tree Analytics**:
  - Total individuals, family unions, and gender ratios.
  - Living vs. deceased counts and average lifespan.
  - Generational span, average children per union, and largest families.
  - Top surnames and top birthplaces with percentage breakdowns.
  - **Tree Milestones**: Oldest living relative, longest-lived individual, earliest recorded birth, largest family branch, and most marriages.

---

### 7. Primary Source Documents & Google Drive Integration

- **Attach Documents & Historical Scans**:
  - Attach images, PDFs, birth certificates, census records, wills, and scans to individuals and family unions.
- **Structured Historical Record Metadata**:
  - **Document Type**: Birth certificate, marriage certificate, death certificate, census record, photograph, will, immigration record, etc.
  - **Partial & Approximate Dates**: Supports freeform historical dates (e.g. *"circa 1890"*, *"May 1912"*, *"between 1870 and 1875"*).
  - **Location & Source Citation**: Record document origin, archives, repository, or volume/page references.
  - **Multiline Transcription**: Dedicated transcription editor for manually transcribing handwritten cursive, letters, or historic records.
- **Split-Screen Document Preview**:
  - Preview modal presents original scans and photos alongside saved transcriptions and metadata.
  - Edit details while looking directly at the scan, with instant live saving.
- **Google Drive Integration**:
  - Link any existing Google Drive folder or auto-create a dedicated tree folder directly from the app.
  - Synchronize permissions across Drive folders and collaborators automatically.
  - Store files securely in Google Drive while caching metadata in the family tree.

---

### 8. Multi-Tree Management & Cross-Tree Linking

- **Multiple Tree Workspaces**:
  - Create, rename, duplicate, and manage multiple independent family trees within the same browser workspace.
  - Each tree maintains its own independent metadata, settings, layout overrides, and storage mode.
- **Extract Tree from Branch Selection**:
  - Select any group of relatives using marquee selection or Shift-click.
  - Click **Create Tree** to spin off a new tree with two options:
    - **Move**: Extracts selected relatives into the new tree and removes them from the source tree.
    - **Copy**: Duplicates selected relatives into the new tree while preserving the source.
  - Automatically bridges both trees via a shared bridge relative with bidirectional links.
- **Cross-Tree Linking (`TreeLink`)**:
  - Connect individuals across distinct trees (local or cloud).
  - Linked cards display a visual branch badge. Clicking the badge immediately switches trees and focuses on the linked person in the destination tree.

---

### 9. Data Integrity, Schema Migration & Automated Snapshots

- **Strict Schema Invariants (Zero-Dependency)**:
  - Enforces schema versioning (`schemaVersion: 1`) using hand-rolled TypeScript validators without bulky external validation libraries.
  - Guaranteed invariants:
    - Bi-directional referential integrity between people and unions.
    - Directed Acyclic Graph (DAG) parent-child structure (no circular ancestry).
    - Lifespan chronology ($\text{birthDate} \le \text{deathDate}$).
- **Boundary Interceptors & Self-Healing Repair**:
  - Every entry point (Local Storage, JSON import, GEDCOM import, Firestore sync) passes through `processTreeIngress()`.
  - Automatically heals malformed references (prunes orphaned partner IDs, repairs reciprocal child links, clears invalid dates) without dropping person entities, notifying the user via non-blocking toast notifications.
- **Automated IndexedDB Version History Snapshots**:
  - Stores full tree historical snapshots in browser IndexedDB (`familytree_snapshots_db`).
  - **Trigger Boundaries**:
    - Pre-import (before importing JSON or GEDCOM files).
    - Pre-delete (before deleting trees).
    - Pre-cloud merge (before reconciling remote changes).
    - Periodic auto-save (debounced 5-minute checkpoint during active editing).
    - Manual user checkpoints.
  - **3-Tier Retention Policy**:
    - *Tier 1*: 20 most recent snapshots kept unconditionally.
    - *Tier 2*: Snapshots older than the 20th within 14 days compacted to at most 1 snapshot per calendar day.
    - *Tier 3*: Snapshots older than 14 days beyond the 20th pruned automatically.
  - **Safety Undo**: Restoring any historical snapshot automatically takes a pre-restore snapshot of the active tree first, guaranteeing you can never accidentally lose work.

---

### 10. Real-Time Cloud Collaboration & Offline Outbox

- **Granular Firestore Subcollections**:
  - Cloud trees use granular documents:
    - `/trees/{treeId}/people/{personId}`
    - `/trees/{treeId}/unions/{unionId}`
    - `/trees/{treeId}` (root metadata, permissions, sharing settings)
- **Tombstones & 30-Day Retention**:
  - Deletions write minimal tombstone documents (`deleted: true`, `deletedAt`).
  - Deterministic conflict resolution: deletes win unless an offline edit timestamp is strictly newer than the tombstone's deletion time.
  - 30-day retention prevents stale offline clients from resurrecting deleted records.
  - Safe client-side and cloud compaction purges expired tombstones only when unreferenced in the active graph.
- **Durable Offline Sync Outbox**:
  - Every edit is saved synchronously to a per-tree durable sync outbox in `localStorage`.
  - Pending mutations survive browser restarts and network disconnections.
  - Replays queued mutations atomically upon reconnect with exponential backoff.
- **Granular Role-Based Permissions**:
  - **Owner**: Full control over tree content, sharing settings, Drive links, and tree deletion.
  - **Editor**: Can add, edit, and delete people, unions, and documents. Cannot alter sharing settings.
  - **Viewer**: Read-only access with canvas navigation, kinship calculation, document viewing, and 1-click **Make a Copy** to clone the tree into their own workspace.
- **Public & Private Sharing**:
  - Share via secret public URL (Viewer or Editor role) or restricted email invitations.
  - Explicit viewer invitations override public editor permissions.

---

### 11. Comprehensive Import & Export

- **GEDCOM 5.5.1 Support**:
  - **Import**: Full parser supporting multi-line `CONT`/`CONC` tags, `INDI` and `FAM` records, marriages, divorces, custom date formats (`ABT`, `EST`, `CAL`, `BEF`, `AFT`, `BET`), and freeform notes.
  - **Export**: Standard-compliant GEDCOM 5.5.1 export preserving family topologies and dates.
- **Standalone Vector SVG Export**:
  - Generates standalone, infinite-resolution vector SVG files complete with title headers, metadata banners, canvas background grid, card styling, silhouette/photo portraits, and bridge-hop arcs.
- **High-Resolution PNG Export**:
  - **Export Full Tree**: Renders the entire family tree canvas into a high-DPI raster image ready for printing or large posters.
  - **Export Current View**: Captures the current canvas viewport as a PNG snapshot.
- **Lossless JSON Backup**:
  - Full tree export to portable JSON files with schema versioning for easy backup and migration.

---

### 12. Personalization, UI & Accessibility

- **Dark & Light Mode**:
  - Full theme support with automatic system preference detection and smooth transitions.
- **Portraits & Silhouettes**:
  - Supports custom photo URLs with automatic fallback to high-quality gender silhouettes (male, female, neutral) when images are absent or fail to load.
- **Responsive Mobile Layout**:
  - Tailored mobile navbar with full-width search overlay, compact floating view controls popover, and optimized touch targets.
- **Accessible Toast Notifications**:
  - Non-intrusive toast notification system for self-healing repair reports, snapshot triggers, and sync warnings.

---

## Keyboard Shortcuts

Press `?` or `Shift + /` anywhere in the app to open the interactive cheat sheet:

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` / `⌘ + Z` | **Undo** last action |
| `Ctrl + Y` / `⌘ + Y` or `Ctrl + Shift + Z` | **Redo** action |
| `+` or `=` | **Zoom In** |
| `-` or `_` | **Zoom Out** |
| `Ctrl + 0` / `⌘ + 0` | **Reset Zoom & Pan** to 100% |
| `F` | **Fit to Screen** (center and scale tree) |
| `L` | **Toggle Layout Direction** (Top-Down ⇄ Left-to-Right) |
| `T` | **Toggle 4D Timeline** ("Who Was in the Room?") |
| `←` / `→` *(in timeline)* | **Scrub Year** backward / forward |
| `M` | **Toggle MiniMap** radar navigator |
| `/` | **Focus Search Bar** |
| `H` | **Open Tree Health & Statistics** |
| `Delete` / `Backspace` | **Delete Selected Relative** (with confirmation) |
| `Escape` | **Clear Selection**, cancel drag, or close modal |
| `Shift + Click` | **Multi-Select** individual relatives |
| `Shift + Drag` | **Marquee Select** multiple relatives |
| `Alt + Drag` | **Bypass Snapping** (free positioning) |

---

## Architecture & Tech Stack

```
src/
├── components/
│   ├── Canvas/         # Infinite canvas, PersonCard, ConnectorLines, MiniMap, Touch & Drag
│   ├── Common/         # Reusable inputs (DatePartsInput, etc.)
│   ├── Inspector/      # Person & Union side panel (Bio, Dates, Relations, Documents)
│   ├── Modal/          # Modals (Kinship, Sunburst, Stats, History, Share, Edge Cases)
│   └── Toolbar/        # TopNavbar, ZoomControls, TemporalScrubBar, ToastNotifications
├── contexts/           # AuthContext (Firebase authentication)
├── hooks/              # Custom hooks (useCloudSync, usePanMomentum, useTreeIO, useTreeRouting)
├── services/
│   ├── layout/         # Generational ranking, barycentric sorting, bus & bridge routing
│   ├── schema/         # Zero-dependency schema validation, invariants, and deterministic repair
│   ├── firestoreService.ts       # Cloud Firestore per-record subcollections & permissions
│   ├── gedcomService.ts          # GEDCOM 5.5.1 import and export engine
│   ├── googleDriveService.ts     # Google Drive folder linking, file uploads & permission sync
│   ├── relationshipFinder.ts     # Kinship graph traversal & relationship calculator
│   ├── snapshotService.ts        # IndexedDB version history snapshot engine with compaction
│   ├── temporalEngine.ts         # 4D timeline, historical world events, and room analytics
│   ├── tombstoneCompactor.ts     # Safe tombstone retention and garbage collection
│   ├── treeExportService.ts      # Standalone Vector SVG & high-resolution PNG rendering
│   └── treeHealthAndStatsService.ts # Health auditor, anomaly detector & tree statistics
├── stores/             # Centralized Zustand stores (useTreeStore, useCanvasStore, useTemporalStore, etc.)
├── types/              # TypeScript models (Person, Union, TreeData, CloudTreeData, etc.)
└── workers/            # Web Worker for asynchronous off-thread layout computation
```

### Centralized State Architecture

- **`useTreeStore`**: Graph state (`people`, `unions`), Immer mutations, undo/redo history stack, and invariant enforcement.
- **`useCanvasStore`**: Pan/zoom transforms, selection sets, comparison IDs, presentation layout overrides, and navigation mode.
- **`useTemporalStore`**: Timeline scrub year, playback status, active historical moment.
- **`useCollabStore`**: Cloud synchronization status, user permissions, offline outbox state.
- **`useModalStore`**: Centralized lifecycle management for all modals and dialogs.
- **`useThemeStore`**: Theme preferences (light, dark, system).
- **`useNotificationStore`**: Non-blocking toast alerts for repairs and snapshots.

---

## Getting Started Locally

### Prerequisites

- **Node.js**: 20.x or newer
- **npm**: 10.x or newer

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-username/FamilyTree.git
cd FamilyTree

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Testing & Quality Assurance

The project features a comprehensive automated testing suite with over 580 tests covering graph layouts, relationship calculations, schema migrations, durable sync outbox, and property invariants:

```bash
# Run the complete test suite (588+ unit & integration tests)
npm test

# Run End-to-End tests with Playwright
npm run test:e2e

# Run Firestore Security Rules against local emulator
npm run test:rules

# Check code formatting & linting with Oxlint
npm run lint

# TypeScript compilation check & production build
npm run build
```

---

## Cloud Security & Firestore Rules

Cloud authorization and document validation are strictly enforced by `firestore.rules`:

1. **Role Enforcement**:
   - **Viewers** have strictly read-only access.
   - **Editors** can update tree content (`/people` and `/unions` subcollections).
   - **Owners** exclusively manage sharing permissions, Google Drive settings, and tree deletion.
   - Explicit viewer invitations override public editor links.
2. **Document Shape Validation**:
   - Every subcollection document write is checked for strict type and schema validity (`isValidPersonDoc`, `isValidUnionDoc`).
3. **Compaction & Tombstones**:
   - Editors can delete documents only if `resource.data.deleted == true`. Non-tombstone hard deletions are restricted to tree owners.

### Deploying Security Rules

Deploy Firestore rules to your Firebase project:

```bash
npx firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

*(Note: Deploying the static frontend to Netlify does not deploy Firestore rules. Deploy rules separately to activate cloud protections).*

---

## Deployment & Social Link Previews

### Environment Variables

Configure environment variables (see `.env.example`):

```env
# Public website URL for Open Graph social link previews
VITE_SITE_URL=https://your-site.example

# Firebase Configuration (for cloud sync & sharing)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Social Link Previews

Shared links use a branded 1200 × 630 PNG with static Open Graph and Twitter card metadata so messaging apps (WhatsApp, iMessage, Twitter, Slack) display previews without running client-side JavaScript. No private family names, photos, or tree data are exposed.

- Artwork source: `public/social-preview.svg`
- Compiled crawler image: `public/social-preview.png`
- To regenerate after editing the SVG:
  ```bash
  node scripts/generateSocialPreview.mjs
  ```
  *(Requires Playwright Chromium: `npx playwright install chromium`)*.

### Deploying to Netlify

1. Push your repository to GitHub or GitLab.
2. In Netlify, select **"Add new site" > "Import an existing project"**.
3. Netlify automatically recognizes `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Set your environment variables in Netlify site settings.
5. Click **Deploy**.
