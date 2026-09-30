import type { LayoutNode, LayoutOverrides } from '../../types/tree';

export interface Point { x: number; y: number }
export interface DragSession {
  nodes: LayoutNode[];
  bounds: { x: number; y: number; width: number; height: number };
  targets: { x: number[]; y: number[] };
}

/** Snapshot once per gesture; selected nodes never snap to each other. */
export function createDragSession(
  nodes: Record<string, LayoutNode>, personId: string, selectedIds: Set<string>
): DragSession {
  const ids = selectedIds.has(personId) ? selectedIds : new Set([personId]);
  const moving = [...ids].map((id) => nodes[id]).filter(Boolean);
  const x = Math.min(...moving.map((node) => node.x));
  const y = Math.min(...moving.map((node) => node.y));
  const bounds = {
    x, y,
    width: Math.max(...moving.map((node) => node.x + node.width)) - x,
    height: Math.max(...moving.map((node) => node.y + node.height)) - y,
  };
  const targets = { x: [] as number[], y: [] as number[] };
  for (const node of Object.values(nodes)) {
    if (ids.has(node.id)) continue;
    targets.x.push(node.x, node.x + node.width / 2, node.x + node.width);
    targets.y.push(node.y, node.y + node.height / 2, node.y + node.height);
  }
  targets.x.sort((a, b) => a - b);
  targets.y.sort((a, b) => a - b);
  return { nodes: moving, bounds, targets };
}

function nearest(values: number[], value: number): number | undefined {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const left = values[lo - 1];
  const right = values[lo];
  if (left === undefined) return right;
  if (right === undefined) return left;
  return value - left <= right - value ? left : right;
}

/** Screen-space tolerance stays consistent at every zoom level. */
export function snapDrag(session: DragSession, raw: Point, zoom: number, bypass = false) {
  const offset = { ...raw };
  const guides: { x?: number; y?: number } = {};
  if (bypass) return { offset, guides };
  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? session.bounds.width : session.bounds.height;
    const start = session.bounds[axis] + raw[axis];
    let correction: number | undefined;
    for (const anchor of [start, start + size / 2, start + size]) {
      const target = nearest(session.targets[axis], anchor);
      if (target === undefined) continue;
      const delta = target - anchor;
      if (Math.abs(delta) * zoom <= 8 &&
          (correction === undefined || Math.abs(delta) < Math.abs(correction))) {
        correction = delta;
        guides[axis] = target;
      }
    }
    if (correction === undefined) {
      const grid = Math.round(start / 32) * 32;
      if (Math.abs(grid - start) * zoom <= 4) {
        correction = grid - start;
        guides[axis] = grid;
      }
    }
    offset[axis] += correction ?? 0;
  }
  return { offset, guides };
}

export function getDragPositions(session: DragSession, offset: Point): LayoutOverrides {
  return Object.fromEntries(session.nodes.map((node) => [
    node.id, { x: node.x + offset.x, y: node.y + offset.y },
  ]));
}