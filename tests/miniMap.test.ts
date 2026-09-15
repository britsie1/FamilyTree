import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('MiniMap Radar Navigator Coordinate Mathematics', () => {
  const MAP_WIDTH = 220;
  const MAP_HEIGHT = 140;
  const PADDING = 12;

  function calculateMiniMapMetrics(
    bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number },
    pan: { x: number; y: number },
    zoom: number,
    containerWidth: number,
    containerHeight: number
  ) {
    const contentWidth = Math.max(bounds.width, 1000);
    const contentHeight = Math.max(bounds.height, 700);

    const availableW = MAP_WIDTH - PADDING * 2;
    const availableH = MAP_HEIGHT - PADDING * 2;

    const scale = Math.min(availableW / contentWidth, availableH / contentHeight);
    const offsetX = PADDING + (availableW - contentWidth * scale) / 2;
    const offsetY = PADDING + (availableH - contentHeight * scale) / 2;

    // Viewport world coordinates
    const worldViewportMinX = -pan.x / zoom;
    const worldViewportMinY = -pan.y / zoom;
    const worldViewportWidth = containerWidth / zoom;
    const worldViewportHeight = containerHeight / zoom;

    // Map viewport to MiniMap coordinates
    const viewportBoxX = offsetX + (worldViewportMinX - bounds.minX) * scale;
    const viewportBoxY = offsetY + (worldViewportMinY - bounds.minY) * scale;
    const viewportBoxW = worldViewportWidth * scale;
    const viewportBoxH = worldViewportHeight * scale;

    const worldToMap = (worldX: number, worldY: number) => ({
      x: offsetX + (worldX - bounds.minX) * scale,
      y: offsetY + (worldY - bounds.minY) * scale,
    });

    const mapToWorld = (mapX: number, mapY: number) => ({
      x: (mapX - offsetX) / scale + bounds.minX,
      y: (mapY - offsetY) / scale + bounds.minY,
    });

    const centerOnWorldCoord = (worldX: number, worldY: number) => ({
      x: containerWidth / 2 - worldX * zoom,
      y: containerHeight / 2 - worldY * zoom,
    });

    return {
      scale,
      offsetX,
      offsetY,
      viewportBoxX,
      viewportBoxY,
      viewportBoxW,
      viewportBoxH,
      worldToMap,
      mapToWorld,
      centerOnWorldCoord,
    };
  }

  it('computes scale respecting available area and aspect ratio', () => {
    const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1000, width: 2000, height: 1000 };
    const pan = { x: 0, y: 0 };
    const zoom = 1;
    const containerWidth = 1200;
    const containerHeight = 800;

    const metrics = calculateMiniMapMetrics(bounds, pan, zoom, containerWidth, containerHeight);

    assert.ok(metrics.scale > 0, 'Scale must be positive');
    // availableW = 196, contentWidth = 2000 => scale <= 196/2000 = 0.098
    assert.strictEqual(metrics.scale, 196 / 2000);
  });

  it('accurately converts world coordinates to minimap coordinates and back (round-trip)', () => {
    const bounds = { minX: 100, minY: 200, maxX: 1500, maxY: 900, width: 1400, height: 700 };
    const pan = { x: -300, y: -150 };
    const zoom = 0.8;
    const containerWidth = 1280;
    const containerHeight = 720;

    const metrics = calculateMiniMapMetrics(bounds, pan, zoom, containerWidth, containerHeight);

    const testWorldPoints = [
      { x: 100, y: 200 },
      { x: 800, y: 550 },
      { x: 1500, y: 900 },
    ];

    for (const pt of testWorldPoints) {
      const mapPt = metrics.worldToMap(pt.x, pt.y);
      assert.ok(mapPt.x >= 0 && mapPt.x <= MAP_WIDTH);
      assert.ok(mapPt.y >= 0 && mapPt.y <= MAP_HEIGHT);

      const roundTrip = metrics.mapToWorld(mapPt.x, mapPt.y);
      assert.ok(Math.abs(roundTrip.x - pt.x) < 0.001, `World X mismatch for ${pt.x}: got ${roundTrip.x}`);
      assert.ok(Math.abs(roundTrip.y - pt.y) < 0.001, `World Y mismatch for ${pt.y}: got ${roundTrip.y}`);
    }
  });

  it('calculates pan that accurately centers on the requested world coordinate', () => {
    const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1000, width: 2000, height: 1000 };
    const zoom = 1.2;
    const containerWidth = 1000;
    const containerHeight = 600;
    const targetWorldPoint = { x: 500, y: 300 };

    const metrics = calculateMiniMapMetrics(bounds, { x: 0, y: 0 }, zoom, containerWidth, containerHeight);
    const newPan = metrics.centerOnWorldCoord(targetWorldPoint.x, targetWorldPoint.y);

    // Verify: screen center is (500, 300).
    // Screen X for target point = newPan.x + targetWorldPoint.x * zoom
    // = (containerWidth / 2 - targetWorldPoint.x * zoom) + targetWorldPoint.x * zoom
    // = containerWidth / 2!
    const targetScreenX = newPan.x + targetWorldPoint.x * zoom;
    const targetScreenY = newPan.y + targetWorldPoint.y * zoom;

    assert.strictEqual(targetScreenX, containerWidth / 2);
    assert.strictEqual(targetScreenY, containerHeight / 2);
  });
});
