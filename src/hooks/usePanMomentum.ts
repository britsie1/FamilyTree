import { useCallback, useEffect, useRef } from 'react';
import { advancePanMomentum, type PanPoint } from '../components/Canvas/panMomentum';

export function usePanMomentum(setPan: (updater: (pan: PanPoint) => PanPoint) => void) {
  const frame = useRef<number | null>(null);
  const sample = useRef({ x: 0, y: 0, time: 0 });
  const velocity = useRef<PanPoint>({ x: 0, y: 0 });
  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    velocity.current = { x: 0, y: 0 };
  }, []);
  const begin = useCallback((x: number, y: number) => {
    stop();
    sample.current = { x, y, time: performance.now() };
  }, [stop]);
  const track = useCallback((x: number, y: number) => {
    const time = performance.now();
    const previous = sample.current;
    const elapsed = Math.max(time - previous.time, 8);
    velocity.current = {
      x: Math.max(-2.5, Math.min(2.5, (x - previous.x) / elapsed)),
      y: Math.max(-2.5, Math.min(2.5, (y - previous.y) / elapsed)),
    };
    sample.current = { x, y, time };
  }, []);
  const release = useCallback(() => {
    if (performance.now() - sample.current.time > 100 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stop();
      return;
    }
    let lastTime = performance.now();
    const tick = (time: number) => {
      const next = advancePanMomentum(velocity.current, time - lastTime);
      lastTime = time;
      velocity.current = next.velocity;
      setPan((pan) => ({ x: pan.x + next.offset.x, y: pan.y + next.offset.y }));
      if (Math.hypot(next.velocity.x, next.velocity.y) > 0.02) frame.current = requestAnimationFrame(tick);
      else stop();
    };
    if (Math.hypot(velocity.current.x, velocity.current.y) > 0.02) frame.current = requestAnimationFrame(tick);
  }, [setPan, stop]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') stop(); };
    window.addEventListener('blur', stop);
    window.addEventListener('mousedown', stop, true);
    window.addEventListener('touchstart', stop, true);
    window.addEventListener('wheel', stop, true);
    window.addEventListener('keydown', keydown);
    return () => {
      stop();
      window.removeEventListener('blur', stop);
      window.removeEventListener('mousedown', stop, true);
      window.removeEventListener('touchstart', stop, true);
      window.removeEventListener('wheel', stop, true);
      window.removeEventListener('keydown', keydown);
    };
  }, [stop]);
  return { begin, track, release, stop };
}