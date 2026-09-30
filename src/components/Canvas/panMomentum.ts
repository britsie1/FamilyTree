export interface PanPoint { x: number; y: number }

// Pixels per millisecond; exponential friction is independent of refresh rate.
export function advancePanMomentum(velocity: PanPoint, elapsed: number) {
  const duration = Math.min(Math.max(elapsed, 0), 64);
  const decay = Math.exp(-duration / 220);
  return {
    offset: { x: velocity.x * 220 * (1 - decay), y: velocity.y * 220 * (1 - decay) },
    velocity: { x: velocity.x * decay, y: velocity.y * decay },
  };
}