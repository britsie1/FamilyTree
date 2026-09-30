# FamilyTree — Visual Pedigree & Family Tree Builder

A fast, interactive, web-based family tree builder designed specifically to address complex genealogical edge cases—such as **two brothers marrying two sisters (double in-laws)**, intermarriages, and pedigree collapse—without line tangles or rigid hierarchy restrictions.

Built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**. Fully static and ready to deploy to Netlify, Vercel, or GitHub Pages.

---

## Key Features

1. **No Required Fields**:
   - Create any relative instantly with a single click.
   - All attributes (first name, last name, maiden name, gender, dates, places, photos, notes) are completely optional and auto-save in real time.

2. **Frictionless Relationship Creation & Linking**:
   - Hover over any person card or use the side Inspector to add relationships:
     - `+ Child`: Add a brand new child OR link an existing person on the tree as a child.
     - `+ Sibling`: Add a brand new sibling OR link an existing person on the tree as a sibling.
     - `+ Partner`: Add a brand new partner OR link an existing person on the tree as a spouse.
     - `+ Parent`: Add a brand new parent OR link an existing person on the tree as a parent.
   - **Search & Link Existing Nodes**: Easily connect distant branches or existing nodes (e.g. cousin marriages, double in-laws) without duplicating people.
   - **Unlink Anytime**: Disconnect mislinked relationships with 1-click unlink buttons in the Inspector.

3. **Complex Edge-Case Solution (Double In-Law Marriages & Crossings)**:
   - **Union-Centric Graph Architecture**: Separates individuals from unions (marriages/partnerships), supporting any multi-partner, remarriage, or double in-law structure.
   - **Barycentric Generational Layout**: Automatically clusters siblings and places partner couples side-by-side to minimize cross-cutting edges.
   - **Smart Bridge-Hop (Jump-Over) SVG Routing**: When vertical parent-child lines intersect horizontal marriage buses, an elevated circular bridge arc ("overpass") is automatically calculated and rendered so you can track relationships without confusion.
   - **Dynamic Lineage Path Glow**: Hovering or clicking on any individual highlights their direct lineage in vibrant indigo while subtly muting unrelated connections.
   - **Free Drag-and-Drop Repositioning**: Need a specific artistic layout? Drag any card anywhere on the infinite canvas. Positions are persisted locally.

4. **Zero-Setup Local Storage Persistence**:
   - Automatically saves every change to browser `localStorage`.
   - **Export JSON**: Download your entire tree as a portable JSON file.
   - **Import JSON**: Restore or switch between trees anytime.
   - **Export Image (PNG)**: Snapshot your tree into a high-resolution image for printing or sharing.
   - **Preset Templates**: Includes the "Double In-Law Marriage" edge-case demo, a 3-generation royal family, and blank templates.

5. **Infinite Canvas**:
   - Smooth pan & zoom (mouse wheel zoom centered on cursor, canvas dragging, and zoom controls).
   - Fit-to-screen button to center and scale the tree instantly.
   - Search bar to locate and jump to any relative quickly.
   - Drag cards smoothly; Shift-click cards (or Shift-drag the background) to select a group, then drag any selected card to move them together. Each drop is one undo step.
   - Dragging snaps to nearby card edges/centres or the 32-unit grid, with alignment guides. Hold Alt for free positioning; Escape cancels a drag. Touch dragging uses the same snapping and group movement.

---

## Getting Started Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

### Tests and cloud security

```bash
npm test
npm run test:rules
npm run lint
npm run build
```

`test:rules` requires Java 21 or newer and runs the actual Firestore rules in a
local emulator using the isolated `demo-familytree` project. It does not access
production data. CI runs this suite as well as the ordinary unit tests.

Cloud permissions are enforced by `firestore.rules`: viewers are read-only,
editors can change tree content, and only owners can change sharing settings or
delete a tree. Explicit viewer invitations override public editor links. Legacy
`sharedEmails`-only invitations are read-only; owners must assign an explicit
editor role in the sharing dialog to grant write access. Ownership transfers are
not supported. Public editing requires Firebase authentication (anonymous
authentication is supported).

**Deploy the rules separately from the static website** to activate these
protections in your Firebase project:

```bash
npx firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

Deploying to Netlify alone does not update Firestore security rules.

### Offline saving and recovery

Cloud edits are saved synchronously to a per-tree **durable sync outbox** in
`localStorage`. One atomic write stores both the working tree and its pending
person, relationship, deletion, and metadata operations. Reloading a cloud tree
replays those pending fields onto the latest cloud data before displaying it;
unrelated edits from collaborators are retained. Pending writes are removed only
after server acknowledgment, and uploads are serialized. Field removals and
deletion timestamps survive reloads and retries. Undo/redo also enters the outbox.

The save indicator distinguishes **Saved on this device**, **Offline**, and
**Saved to cloud**. Browser storage failures produce a persistent warning: keep
the tab open and export a JSON backup before closing it. Cloud sync errors retain
pending work; signed-in users can click the sync error indicator to retry.
Reconnection reloads cloud permissions before replaying recovered work. Viewer
or revoked access never uploads pending changes.

The outbox uses the existing browser storage without additional dependencies.
Browser quotas still apply, and clearing site data removes local trees and pending
edits; JSON exports remain important backups. Simultaneous offline editing in
multiple tabs of the **same browser profile** is not coordinated; use one editing
tab per tree. Concurrent edits to the same field use pending local intent on
replay; this is not a conflict-resolution UI or a CRDT. Browser regression tests
exercise real storage and reload with a simulated cloud transport, not production
Firebase.

---

## Deploying to Netlify

### Option A: 1-Click Git Deployment
1. Push this repository to GitHub / GitLab.
2. In Netlify, click **"Add new site" > "Import an existing project"**.
3. Netlify will detect `netlify.toml` automatically:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy**.

### Option B: Drag-and-Drop Static Folder
1. Run `npm run build`.
2. Drag the generated `dist/` folder directly into [Netlify Drop](https://app.netlify.com/drop).
