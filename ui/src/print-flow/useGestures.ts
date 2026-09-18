// Multitouch gesture engine on Pointer Events (replaces HammerJS).
// Fixes the legacy limitations: one finger pans; two fingers pinch-zoom AND
// pan at the same time (centroid tracking); desktop gets drag + wheel-zoom.
// Rotation is computed but only applied when `rotateEnabled` is true — the
// two-finger angle feeds through the same math, gated by a small threshold so
// a plain pinch doesn't wobble the photo.
import { RefObject, useEffect, useRef } from "react";
import { PhotoTransform } from "@/core/models";

const MIN_SCALE = 0.4;
const MAX_SCALE = 8;
const ROTATE_THRESHOLD_RAD = 0.12; // ~7° before rotation engages

interface Point {
  x: number;
  y: number;
}

interface Options {
  transform: PhotoTransform;
  onTransformChange: (next: PhotoTransform) => void;
  disabled?: boolean;
  rotateEnabled?: boolean;
}

export function useGestures(ref: RefObject<HTMLElement | null>, options: Options) {
  // listeners are bound once; they read the latest options through this ref
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.touchAction = "none"; // we own all gestures on this surface

    const pointers = new Map<number, Point>();
    let pinchStart: {
      dist: number;
      angle: number;
      centroid: Point;
      base: PhotoTransform;
      rotating: boolean;
    } | null = null;
    let dragStart: { x: number; y: number; base: PhotoTransform } | null = null;

    const emit = (next: PhotoTransform) => {
      // keep the local copy fresh so consecutive moves chain before React re-renders
      latest.current = { ...latest.current, transform: next };
      latest.current.onTransformChange(next);
    };

    /** (Re)anchor drag/pinch state to current pointers + current transform. */
    const rebaseline = () => {
      const pts = [...pointers.values()];
      dragStart = null;
      pinchStart = null;
      if (pts.length === 1) {
        dragStart = { x: pts[0].x, y: pts[0].y, base: { ...latest.current.transform } };
      } else if (pts.length >= 2) {
        pinchStart = {
          dist: dist(pts[0], pts[1]),
          angle: angle(pts[0], pts[1]),
          centroid: centroid(pts[0], pts[1]),
          base: { ...latest.current.transform },
          rotating: false,
        };
      }
    };

    const onDown = (ev: PointerEvent) => {
      if (latest.current.disabled) return;
      node.setPointerCapture(ev.pointerId);
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      rebaseline();
    };

    const onUp = (ev: PointerEvent) => {
      pointers.delete(ev.pointerId);
      rebaseline();
    };

    const onMove = (ev: PointerEvent) => {
      if (latest.current.disabled || !pointers.has(ev.pointerId)) return;
      ev.preventDefault();
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const pts = [...pointers.values()];

      if (pts.length === 1 && dragStart) {
        const { base } = dragStart;
        emit({
          ...base,
          x: base.x + (pts[0].x - dragStart.x),
          y: base.y + (pts[0].y - dragStart.y),
        });
      } else if (pts.length >= 2 && pinchStart) {
        const start = pinchStart;
        const scale = clamp(
          start.base.scale * (dist(pts[0], pts[1]) / start.dist),
          MIN_SCALE,
          MAX_SCALE
        );
        const c = centroid(pts[0], pts[1]);
        let rotation = start.base.rotation;
        if (latest.current.rotateEnabled) {
          const delta = normalizeAngle(angle(pts[0], pts[1]) - start.angle);
          if (start.rotating || Math.abs(delta) > ROTATE_THRESHOLD_RAD) {
            start.rotating = true;
            rotation = start.base.rotation + delta;
          }
        }
        emit({
          scale,
          rotation,
          x: start.base.x + (c.x - start.centroid.x),
          y: start.base.y + (c.y - start.centroid.y),
        });
      }
    };

    const onWheel = (ev: WheelEvent) => {
      if (latest.current.disabled) return;
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
      const { transform } = latest.current;
      emit({ ...transform, scale: clamp(transform.scale * factor, MIN_SCALE, MAX_SCALE) });
    };

    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onUp);
      node.removeEventListener("wheel", onWheel);
    };
  }, [ref]);
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
const centroid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const normalizeAngle = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
