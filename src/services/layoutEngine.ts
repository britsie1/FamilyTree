/**
 * Layout Engine Façade
 *
 * Provides backwards-compatible exports for the modular multi-stage layout pipeline
 * located under `src/services/layout/`:
 * - `generationalRanking.ts`: Generational tier assignment (`calculateGenerations`), cycle handling, and branch traversal.
 * - `barycentricOrdering.ts`: Sibling clustering, crossing minimization, and partner order calculation.
 * - `coordinateAssignment.ts`: Metric node placement, family group spacing (`adjustedSpacing`), and bounding boxes.
 * - `edgeAndBusRouting.ts`: Multi-lane bus Y calculations (`computeMultiLaneBusY`), interval graph coloring (`assignIntervalTracks`), SVG paths, and bridge-hops (`findOverpasses`).
 * - `layoutTransforms.ts`: Horizontal pedigree coordinates and mapping for horizontal layout style.
 * - `pipeline.ts`: Orchestrates the stages and assembles the final `TreeLayout` object.
 */

export * from './layout';
