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

---

## Getting Started Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

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
