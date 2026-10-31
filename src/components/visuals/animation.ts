import type { VisualSpec } from "./model";

export type AnimationClock = {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
  reducedMotion(): boolean;
};
const browserClock: AnimationClock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
  reducedMotion: () => typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};
type Animation = { frame: number; velocity: number };
export type VisualSnapshot = { spec: VisualSpec; animating: boolean };

/** A per-visual store: parameter updates redraw the existing React node without remounting it. */
export class VisualStore {
  private snapshot: VisualSnapshot;
  private listeners = new Set<() => void>();
  private animations = new Map<string, Animation>();
  private disposed = false;

  constructor(spec: VisualSpec, private clock: AnimationClock = browserClock) {
    this.snapshot = { spec, animating: false };
  }
  getSnapshot = (): VisualSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(param?: string, value?: number) {
    if (this.disposed) return;
    this.snapshot = {
      spec: param === undefined ? this.snapshot.spec : {
        ...this.snapshot.spec, params: { ...this.snapshot.spec.params, [param]: value! },
      },
      animating: this.animations.size > 0,
    };
    this.listeners.forEach((listener) => listener());
  }
  setParam = (param: string, value: number): void => {
    if (this.disposed || !Number.isFinite(value)) return;
    const animation = this.animations.get(param);
    if (animation) this.clock.cancel(animation.frame);
    this.animations.delete(param);
    this.publish(param, value);
  };
  animate(param: string, from: number, to: number, ms: number): void {
    if (this.disposed) return;
    const previous = this.animations.get(param);
    if (previous) this.clock.cancel(previous.frame);
    this.animations.delete(param);
    const start = this.snapshot.spec.params[param] ?? from;
    if (this.clock.reducedMotion() || ms === 0 || start === to) {
      this.publish(param, to);
      return;
    }
    const started = this.clock.now();
    const duration = ms / 1000;
    const omega = 12 / duration;
    const displacement = start - to;
    const initialVelocity = previous?.velocity ?? 0;
    const coefficient = initialVelocity + omega * displacement;
    const animation: Animation = { frame: 0, velocity: initialVelocity };
    this.animations.set(param, animation);
    this.publish(param, start);
    const tick = (time: number) => {
      if (this.disposed || this.animations.get(param) !== animation) return;
      const elapsed = Math.max(0, (time - started) / 1000);
      if (elapsed >= duration || this.clock.reducedMotion()) {
        this.animations.delete(param);
        this.publish(param, to);
        return;
      }
      const decay = Math.exp(-omega * elapsed);
      const value = to + (displacement + coefficient * elapsed) * decay;
      animation.velocity = (initialVelocity - omega * coefficient * elapsed) * decay;
      this.publish(param, value);
      animation.frame = this.clock.request(tick);
    };
    animation.frame = this.clock.request(tick);
  }
  stop = (): void => {
    this.animations.forEach((animation) => this.clock.cancel(animation.frame));
    this.animations.clear();
    this.publish();
  };
  dispose = (): void => {
    this.stop();
    this.disposed = true;
    this.listeners.clear();
  };
}
