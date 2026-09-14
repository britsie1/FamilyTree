import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getTouchDistance,
  getTouchMidpoint,
  calculatePinchTransform,
  type TouchCoord,
} from '../src/components/Canvas/canvasTouch.ts';

describe('Canvas Touch & Pinch-to-Zoom Engine', () => {
  it('correctly calculates touch distance between two points', () => {
    const t1: TouchCoord = { clientX: 10, clientY: 20 };
    const t2: TouchCoord = { clientX: 40, clientY: 60 };
    // 30^2 + 40^2 = 900 + 1600 = 2500 -> sqrt = 50
    const dist = getTouchDistance(t1, t2);
    assert.strictEqual(dist, 50);
  });

  it('correctly calculates touch midpoint relative to container bounding rect', () => {
    const t1: TouchCoord = { clientX: 100, clientY: 200 };
    const t2: TouchCoord = { clientX: 300, clientY: 400 };
    const containerRect = { left: 50, top: 50 };

    const mid = getTouchMidpoint(t1, t2, containerRect);
    // Midpoint in viewport: ((100+300)/2, (200+400)/2) = (200, 300)
    // In container: (200 - 50, 300 - 50) = (150, 250)
    assert.strictEqual(mid.x, 150);
    assert.strictEqual(mid.y, 250);
  });

  it('smoothly scales zoom in place without drifting the world point under the fingers', () => {
    const startMidpoint = { x: 200, y: 300 };
    const currentMidpoint = { x: 200, y: 300 };
    const startPan = { x: 50, y: 100 };
    const startZoom = 1.0;
    const startDistance = 100;
    const currentDistance = 150; // 1.5x zoom

    const { zoom: newZoom, pan: newPan } = calculatePinchTransform(
      startMidpoint,
      currentMidpoint,
      startPan,
      startZoom,
      startDistance,
      currentDistance
    );

    assert.strictEqual(newZoom, 1.5);
    // World point at midpoint: (200 - 50) / 1.0 = 150, (300 - 100) / 1.0 = 200
    // Screen position with new zoom and pan must equal (200, 300):
    const screenX = newPan.x + 150 * newZoom;
    const screenY = newPan.y + 200 * newZoom;
    assert.strictEqual(Math.round(screenX), 200);
    assert.strictEqual(Math.round(screenY), 300);
  });

  it('handles simultaneous zooming and panning (finger translation during pinch)', () => {
    const startMidpoint = { x: 200, y: 300 };
    const currentMidpoint = { x: 250, y: 350 }; // fingers moved (+50, +50)
    const startPan = { x: 0, y: 0 };
    const startZoom = 1.0;
    const startDistance = 100;
    const currentDistance = 200; // 2.0x zoom

    const { zoom: newZoom, pan: newPan } = calculatePinchTransform(
      startMidpoint,
      currentMidpoint,
      startPan,
      startZoom,
      startDistance,
      currentDistance
    );

    assert.strictEqual(newZoom, 2.0);
    // World point that was under startMidpoint (200, 300):
    // (200 - 0) / 1.0 = 200, (300 - 0) / 1.0 = 300
    // After pinch & pan, that world point must now sit under currentMidpoint (250, 350):
    const screenX = newPan.x + 200 * newZoom;
    const screenY = newPan.y + 300 * newZoom;
    assert.strictEqual(Math.round(screenX), 250);
    assert.strictEqual(Math.round(screenY), 350);
  });

  it('clamps zoom values within minZoom (0.2) and maxZoom (2.5)', () => {
    const mid = { x: 100, y: 100 };
    const pan = { x: 0, y: 0 };

    // Excessive zoom-in attempt (10x)
    const clampedMax = calculatePinchTransform(mid, mid, pan, 1.0, 100, 1000);
    assert.strictEqual(clampedMax.zoom, 2.5);

    // Excessive zoom-out attempt (0.01x)
    const clampedMin = calculatePinchTransform(mid, mid, pan, 1.0, 100, 1);
    assert.strictEqual(clampedMin.zoom, 0.2);
  });
});
