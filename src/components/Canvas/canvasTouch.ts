/**
 * Touch and gesture calculation helpers for the tree canvas.
 */

export interface TouchCoord {
  clientX: number;
  clientY: number;
}

/**
 * Calculates Euclidean distance between two touch points.
 */
export function getTouchDistance(t1: TouchCoord, t2: TouchCoord): number {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

/**
 * Calculates the midpoint between two touch points relative to the container element.
 */
export function getTouchMidpoint(
  t1: TouchCoord,
  t2: TouchCoord,
  containerRect: { left: number; top: number }
): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2 - containerRect.left,
    y: (t1.clientY + t2.clientY) / 2 - containerRect.top,
  };
}

/**
 * Calculates updated zoom and pan transformations during a two-finger pinch-to-zoom gesture.
 * Preserves the world position under the pinch midpoint so that zooming feels pinned to the fingers.
 */
export function calculatePinchTransform(
  startMidpoint: { x: number; y: number },
  currentMidpoint: { x: number; y: number },
  startPan: { x: number; y: number },
  startZoom: number,
  startDistance: number,
  currentDistance: number,
  minZoom = 0.2,
  maxZoom = 2.5
): { zoom: number; pan: { x: number; y: number } } {
  const safeStartDist = Math.max(startDistance, 1);
  const scaleRatio = currentDistance / safeStartDist;
  const newZoom = Math.min(Math.max(startZoom * scaleRatio, minZoom), maxZoom);

  // Keep the canvas point that was under startMidpoint positioned under currentMidpoint
  const newPanX = currentMidpoint.x - ((startMidpoint.x - startPan.x) / startZoom) * newZoom;
  const newPanY = currentMidpoint.y - ((startMidpoint.y - startPan.y) / startZoom) * newZoom;

  return {
    zoom: newZoom,
    pan: { x: newPanX, y: newPanY },
  };
}
