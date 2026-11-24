// Motion models for a knob of glass that crosses its track as liquid. Each
// model answers `step` (advance; true while moving), `shape` (the glass, in
// CSS px from the track's centre) and `fill` (how far on the track is, 0 to 1).
// `melt-surface.tsx` hands each shape to the Liquid Glass engine to draw.

import {
  clamp,
  smooth,
  type Spring,
  SPRINGS,
  stepSpring,
} from "@/registry/bases/aria/lib/liquid-glass-engine";

export type MeltPreset = "pour" | "stretch" | "drip";

export interface MeltShape {
  // Body centre (x from the track's centre), half width and half height.
  body: { x: number; hx: number; hy: number };
  // A circle on the axis, joined to the body by a bridge of softness k (px).
  drop?: { x: number; r: number; k: number };
}

export interface MeltModel {
  step: (dt: number, reduced: boolean) => boolean;
  shape: () => MeltShape;
  fill: () => number;
  set: (on: boolean) => void;
  press: (down: boolean) => void;
}

export interface MeltGeometry {
  H: number;
  W: number;
  r: number;
  left: number;
  right: number;
}

// A track H tall and W wide, the knob's radius and its two resting centres.
export function meltGeometry(H: number, W = Math.round(H * 1.9)) {
  const r = H / 2 - H * 0.085;
  return { H, W, r, left: -W / 2 + H / 2, right: W / 2 - H / 2 };
}

const spring = (x = 0): Spring => ({ x, v: 0 });
const POUR = { omega: 9, zeta: 0.92 };
const FILL = { omega: 7, zeta: 1 };
const STRETCH_FRONT = { omega: 17, zeta: 0.78 };
const STRETCH_BACK = { omega: 9, zeta: 0.6 };
const DRIP_BODY = { omega: 13, zeta: 0.72 };
const DRIP_BEAD = { omega: 7.5, zeta: 0.78 };
// The wobble springs stretch the drop by this much of their displacement:
// about 3% of its size with the engine's hover springs.
const WOBBLE_GAIN = 0.3;

// An arriving drop wobbles out of phase in width and height, on the engine's
// hover springs, kicked once.
function wobble() {
  const wx = spring();
  const wy = spring();
  return {
    kick: (a = 1) => {
      wx.v += 3.2 * a;
      wy.v -= 2.4 * a;
    },
    step: (dt: number) => {
      const a = stepSpring(wx, 0, SPRINGS.hoverX, dt);
      const b = stepSpring(wy, 0, SPRINGS.hoverY, dt);
      return a || b;
    },
    still: () => {
      wx.x = wx.v = wy.x = wy.v = 0;
    },
    x: () => 1 + WOBBLE_GAIN * wx.x,
    y: () => 1 + WOBBLE_GAIN * wy.x,
  };
}

const swellOf = (press: Spring) => 1 + 0.07 * clamp(press.x, -0.2, 1.2);

// Pour: the knob splits into two drops whose areas add up to one knob. The
// bridge between them thins and snaps at `snap` of the way.
function pour(g: MeltGeometry, on: boolean, snap = 0.78): MeltModel {
  const s = {
    on,
    t: spring(1),
    snapped: true,
    fill: spring(on ? 1 : 0),
    press: spring(),
    pressed: false,
  };
  const w = wobble();
  return {
    set: (next) => {
      if (next === s.on) return;
      s.on = next;
      // Mid-pour it reverses: what had arrived is now what leaves.
      s.t = { x: 1 - clamp(s.t.x), v: -s.t.v };
      s.snapped = s.t.x >= snap;
    },
    press: (down) => {
      s.pressed = down;
    },
    step: (dt, reduced) => {
      if (reduced) {
        s.t = spring(1);
        s.fill = spring(s.on ? 1 : 0);
        s.snapped = true;
        w.still();
        return false;
      }
      const a = stepSpring(s.t, 1, POUR, dt);
      if (s.t.x > 1) s.t.x = 1;
      if (!s.snapped && s.t.x >= snap) {
        s.snapped = true;
        w.kick();
      }
      const b = w.step(dt);
      const c = stepSpring(s.press, s.pressed ? 1 : 0, SPRINGS.press, dt);
      const d = stepSpring(s.fill, s.on ? 1 : 0, FILL, dt);
      return a || b || c || d;
    },
    shape: () => {
      const t = clamp(s.t.x);
      const swell = swellOf(s.press);
      const to = s.on ? g.right : g.left;
      const from = s.on ? g.left : g.right;
      const rd = g.r * Math.sqrt(t) * swell;
      const rs = g.r * Math.sqrt(1 - t) * swell;
      const k =
        g.H * 0.55 * smooth(0, 0.12, t) * (1 - smooth(snap - 0.2, snap, t));
      return {
        body: { x: to, hx: rd * w.x(), hy: rd * w.y() },
        drop:
          rs > 0.4 ? { x: from + (to - from) * 0.22 * t, r: rs, k } : undefined,
      };
    },
    fill: () => clamp(s.fill.x),
  };
}

// Stretch: one body whose front edge runs ahead on a quick spring while its
// back edge follows on a slower one. The height gives way to keep its area.
function stretch(g: MeltGeometry, on: boolean): MeltModel {
  const at = (v: boolean) => (v ? g.right : g.left);
  const s = {
    target: at(on),
    a: spring(at(on)),
    b: spring(at(on)),
    press: spring(),
    pressed: false,
  };
  const area = Math.PI * g.r * g.r;
  return {
    set: (next) => {
      s.target = at(next);
    },
    press: (down) => {
      s.pressed = down;
    },
    step: (dt, reduced) => {
      if (reduced) {
        s.a = spring(s.target);
        s.b = spring(s.target);
        return false;
      }
      // Whichever edge is ahead in the direction of travel leads.
      const ahead = Math.sign(s.target - (s.a.x + s.b.x) / 2);
      const front =
        ahead >= 0 ? (s.a.x >= s.b.x ? s.a : s.b) : s.a.x <= s.b.x ? s.a : s.b;
      const back = front === s.a ? s.b : s.a;
      const m = stepSpring(front, s.target, STRETCH_FRONT, dt);
      const n = stepSpring(back, s.target, STRETCH_BACK, dt);
      const p = stepSpring(s.press, s.pressed ? 1 : 0, SPRINGS.press, dt);
      return m || n || p;
    },
    shape: () => {
      const len = Math.abs(s.a.x - s.b.x) / 2;
      // A capsule of half length `len` with the area of the knob at rest.
      const hy = Math.min(
        (-4 * len + Math.sqrt(16 * len * len + 4 * Math.PI * area)) /
          (2 * Math.PI),
        g.r,
      );
      const swell = swellOf(s.press);
      return {
        body: {
          x: (s.a.x + s.b.x) / 2,
          hx: (len + hy) * swell,
          hy: hy * swell,
        },
      };
    },
    fill: () => clamp(((s.a.x + s.b.x) / 2 - g.left) / (g.right - g.left)),
  };
}

// Drip: the knob crosses as one drop and leaves `bead` of its glass behind.
// The bead holds on for a moment, then follows on a softer spring.
function drip(g: MeltGeometry, on: boolean, bead = 0.2): MeltModel {
  const at = (v: boolean) => (v ? g.right : g.left);
  const s = {
    on,
    body: spring(at(on)),
    bead: spring(at(on)),
    fill: spring(on ? 1 : 0),
    late: 0,
    wasApart: false,
    press: spring(),
    pressed: false,
  };
  const w = wobble();
  return {
    set: (next) => {
      if (next === s.on) return;
      s.on = next;
      // The bead holds on this long, in seconds, before it follows.
      s.late = 0.14;
    },
    press: (down) => {
      s.pressed = down;
    },
    step: (dt, reduced) => {
      if (reduced) {
        s.body = spring(at(s.on));
        s.bead = spring(at(s.on));
        s.fill = spring(s.on ? 1 : 0);
        s.late = 0;
        w.still();
        return false;
      }
      const a = stepSpring(s.body, at(s.on), DRIP_BODY, dt);
      let b = false;
      if (s.late > 0) {
        s.late = Math.max(0, s.late - dt);
        b = true;
      } else b = stepSpring(s.bead, at(s.on), DRIP_BEAD, dt);
      const apart = Math.abs(s.body.x - s.bead.x) > g.r * 0.9;
      // The bead melting back in jolts the drop a little.
      if (s.wasApart && !apart) w.kick(0.6);
      s.wasApart = apart;
      const c = w.step(dt);
      const d = stepSpring(s.fill, s.on ? 1 : 0, FILL, dt);
      const p = stepSpring(s.press, s.pressed ? 1 : 0, SPRINGS.press, dt);
      return a || b || c || d || p;
    },
    shape: () => {
      const swell = swellOf(s.press);
      const sep = smooth(0, g.r, Math.abs(s.body.x - s.bead.x));
      const rb = g.r * Math.sqrt(1 - bead * sep);
      const rd = g.r * Math.sqrt(bead * sep);
      return {
        body: {
          x: s.body.x,
          hx: rb * w.x() * swell,
          hy: rb * w.y() * swell,
        },
        drop: rd > 0.4 ? { x: s.bead.x, r: rd, k: g.H * 0.48 } : undefined,
      };
    },
    fill: () => clamp(s.fill.x),
  };
}

export function meltModel(
  preset: MeltPreset,
  g: MeltGeometry,
  on: boolean,
): MeltModel {
  if (preset === "stretch") return stretch(g, on);
  if (preset === "drip") return drip(g, on);
  return pour(g, on);
}
