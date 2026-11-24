"use client";

// The glass in a melt segmented control: a pill that stretches between
// segments, its leading edge on a quick spring and its trailing edge on a
// slower one, keeping its area as it thins. License: lib/melt-glass.tsx.

import * as React from "react";

import {
  clamp,
  type GlassLens,
  type Spring,
  SPRINGS,
  stepSpring,
} from "@/registry/bases/radix/lib/liquid-glass-engine";
import {
  attach,
  css,
  luma,
  mix,
  onThemeChange,
  over,
  padFor,
  readColor,
  type Rgb,
  type Rgba,
  unit,
} from "@/registry/bases/radix/lib/melt-glass";

export const MELT_SEGMENT_SIZES = { sm: 32, default: 36, lg: 44 } as const;
export type MeltSegmentSize = keyof typeof MELT_SEGMENT_SIZES;

const spring = (x = 0): Spring => ({ x, v: 0 });
const LEAD = { omega: 18, zeta: 0.8 };
const TRAIL = { omega: 10, zeta: 0.62 };
// How fast the pill's resting size follows a segment of another width.
const SIZE = { omega: 14, zeta: 1 };

// Edges in px from the control's start (left in LTR, measured, so RTL needs
// nothing extra).
export interface SegmentSpan {
  start: number;
  end: number;
}

export function segmentModel() {
  const s = {
    a: spring(),
    b: spring(),
    to: { start: 0, end: 0 },
    rest: spring(),
    r: 0,
    press: spring(),
    pressed: false,
    placed: false,
  };
  return {
    // `r` is the pill's half height at rest.
    to: (span: SegmentSpan, r: number, snap = false) => {
      s.to = span;
      s.r = r;
      if (snap || !s.placed) {
        s.a = spring(span.start);
        s.b = spring(span.end);
        s.rest = spring((span.end - span.start) / 2);
        s.placed = true;
      }
    },
    press: (down: boolean) => {
      s.pressed = down;
    },
    step: (dt: number, reduced: boolean) => {
      if (!s.placed) return false;
      if (reduced) {
        s.a = spring(s.to.start);
        s.b = spring(s.to.end);
        s.rest = spring((s.to.end - s.to.start) / 2);
        return false;
      }
      // The edge on the side it travels toward leads.
      const right = s.to.start + s.to.end >= s.a.x + s.b.x;
      const m = stepSpring(s.a, s.to.start, right ? TRAIL : LEAD, dt);
      const n = stepSpring(s.b, s.to.end, right ? LEAD : TRAIL, dt);
      const q = stepSpring(s.rest, (s.to.end - s.to.start) / 2, SIZE, dt);
      const p = stepSpring(s.press, s.pressed ? 1 : 0, SPRINGS.press, dt);
      return m || n || q || p;
    },
    // Centre (px from the start), half width and half height.
    shape: () => {
      const r = s.r;
      const hx = Math.max((s.b.x - s.a.x) / 2, 0.5);
      // A pill of half width hx with the area of the pill at rest:
      // area = (π - 4)·hy² + 4·hx·hy.
      const k = Math.PI - 4;
      const area = k * r * r + 4 * r * Math.max(s.rest.x, r);
      const d = 16 * hx * hx + 4 * k * area;
      const hy = Math.min(
        d > 0 ? (-4 * hx + Math.sqrt(d)) / (2 * k) : r,
        r,
        hx,
      );
      const swell = 1 + 0.05 * clamp(s.press.x, -0.2, 1.2);
      return { x: (s.a.x + s.b.x) / 2, hx: hx * swell, hy: hy * swell };
    },
  };
}

interface Label {
  value: string;
  start: number;
  end: number;
  top: number;
  bottom: number;
  text: string;
  font: string;
  spacing: string;
  x: number;
  baseline: number;
}

interface Layout {
  W: number;
  H: number;
  labels: Label[];
}

// The box around an element's visible text, leaving out hidden inputs and
// other elements without text.
function textBox(el: HTMLElement) {
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let box: DOMRect | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    box = box
      ? new DOMRect(
          Math.min(box.left, r.left),
          Math.min(box.top, r.top),
          Math.max(box.right, r.right) - Math.min(box.left, r.left),
          Math.max(box.bottom, r.bottom) - Math.min(box.top, r.top),
        )
      : r;
  }
  return box ?? el.getBoundingClientRect();
}

// Where each segment and its text sit, in px from the control's top-left
// corner. offsetLeft and offsetWidth ignore transforms on the page.
function measure(root: HTMLElement, probe: CanvasRenderingContext2D): Layout {
  const box = root.getBoundingClientRect();
  const scale = box.width ? root.offsetWidth / box.width : 1;
  const items = [
    ...root.querySelectorAll<HTMLElement>("[data-melt-value]"),
  ].filter((el) => el.closest("[data-melt-segments]") === root);
  const labels = items.map((el) => {
    const style = getComputedStyle(el);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = (el.textContent ?? "").trim();
    const rect = textBox(el);
    probe.font = font;
    const m = probe.measureText(text || "M");
    const ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
    const top = (rect.top - box.top) * scale;
    const height = rect.height * scale;
    return {
      value: el.dataset.meltValue ?? "",
      start: el.offsetLeft,
      end: el.offsetLeft + el.offsetWidth,
      top: el.offsetTop,
      bottom: el.offsetTop + el.offsetHeight,
      text,
      font,
      spacing: style.letterSpacing === "normal" ? "0px" : style.letterSpacing,
      x: (rect.left - box.left) * scale,
      baseline: top + (height - ascent - descent) / 2 + ascent,
    };
  });
  return { W: root.offsetWidth, H: root.offsetHeight, labels };
}

interface Theme {
  track: string;
  muted: Rgba;
  text: Rgba;
  knob: Rgb;
  surface: Rgb;
}

function readTheme(
  probes: HTMLElement,
  probe: CanvasRenderingContext2D,
): Theme {
  const background = readColor(probes, "background", "#fff", probe);
  const muted = over(readColor(probes, "muted", "#f5f5f5", probe), background);
  const dark = luma(background) < 128;
  // The selected segment's fill in shadcn/ui's tabs: the background, or a
  // lift of the input color on a dark page.
  const knob = dark
    ? over(readColor(probes, "knob-dark", "#ffffff10", probe), muted)
    : background;
  return {
    track: css(muted),
    muted: over(readColor(probes, "muted-foreground", "#737373", probe), muted),
    text: over(readColor(probes, "foreground", "#0a0a0a", probe), muted),
    knob: unit(knob),
    surface: unit(background),
  };
}

// Never shown: each element carries one theme color the canvas paints with.
function ThemeProbe({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} hidden>
      <span data-melt-color="muted" className="bg-muted" />
      <span
        data-melt-color="muted-foreground"
        className="bg-muted-foreground"
      />
      <span data-melt-color="foreground" className="bg-foreground" />
      <span data-melt-color="background" className="bg-background" />
      <span data-melt-color="knob-dark" className="bg-input/30" />
    </span>
  );
}

// The pill is lightly frosted in the selected segment's fill, so the label
// under it reads, and clears while it moves so the stretch shows.
const FROST_REST = 0.2;
const FROST_CLEAR = 0.04;
const CLEAR_FOR = 0.5;
const CLARITY = { omega: 16, zeta: 1 };

// The glass layers inside a melt segmented control. The track sits under the
// segments' own text and the lens over it, so text outside the pill is the
// page's and the lens shows it painted, bent and magnified, inside the pill.
export function MeltSegmentsGlass({
  value,
  pressed,
  onReady,
  onDirection,
}: {
  value: string | null | undefined;
  pressed: boolean;
  onReady: (ready: boolean) => void;
  // The control's CSS direction, so arrow keys can follow it.
  onDirection?: (dir: "ltr" | "rtl") => void;
}) {
  const host = React.useRef<HTMLSpanElement>(null);
  const track = React.useRef<HTMLCanvasElement>(null);
  const lens = React.useRef<HTMLCanvasElement>(null);
  const colors = React.useRef<HTMLSpanElement>(null);
  const [model] = React.useState(segmentModel);
  const [box, setBox] = React.useState<{ W: number; H: number } | null>(null);
  const held = React.useRef(pressed);
  const selected = React.useRef(value);
  const api = React.useRef({ select: () => {}, wake: () => {} });

  React.useEffect(() => {
    const root = host.current?.closest<HTMLElement>("[data-melt-segments]");
    const trackCanvas = track.current;
    const lensCanvas = lens.current;
    const probes = colors.current;
    const tctx = trackCanvas?.getContext("2d");
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!root || !trackCanvas || !lensCanvas || !probes || !tctx || !probe)
      return;

    const direction = () =>
      onDirection?.(getComputedStyle(root).direction === "rtl" ? "rtl" : "ltr");
    direction();
    let layout = measure(root, probe);
    let theme = readTheme(probes, probe);
    let pad = padFor(layout.H);
    let dpr = 1;
    const clarity = spring();
    let clearFor = 0;

    const spanOf = (v: string | null | undefined) => {
      const l = layout.labels.find((label) => label.value === v);
      return l
        ? { span: { start: l.start, end: l.end }, r: (l.bottom - l.top) / 2 }
        : null;
    };
    const place = (snap: boolean) => {
      const at = spanOf(selected.current);
      if (at) model.to(at.span, at.r, snap);
    };
    place(true);

    // The track: a pill in the theme's muted color.
    const paintTrack = (c: CanvasRenderingContext2D) => {
      const { W, H } = layout;
      c.fillStyle = theme.track;
      c.beginPath();
      c.roundRect(pad.x, pad.top, W, H, H / 2);
      c.fill();
    };
    // What the lens bends: the track and every label, each darkening as the
    // pill reaches it.
    const paintBehind = (c: CanvasRenderingContext2D) => {
      paintTrack(c);
      const shape = model.shape();
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
      for (const l of layout.labels) {
        const half = (l.end - l.start) / 2;
        const near = clamp(1 - Math.abs(shape.x - (l.start + half)) / half);
        c.font = l.font;
        c.letterSpacing = l.spacing;
        c.fillStyle = css(mix(theme.muted, theme.text, near));
        c.fillText(l.text, pad.x + l.x, pad.top + l.baseline);
      }
      c.letterSpacing = "0px";
    };
    const size = () => {
      pad = padFor(layout.H);
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      trackCanvas.width = Math.round((layout.W + 2 * pad.x) * dpr);
      trackCanvas.height = Math.round((layout.H + pad.top + pad.bottom) * dpr);
      setBox({ W: layout.W, H: layout.H });
    };
    const drawTrack = () => {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintTrack(tctx);
    };
    size();
    drawTrack();

    const surface = attach(lensCanvas, {
      step: (dt, reduced) => {
        const moving = model.step(dt, reduced);
        clearFor = Math.max(0, clearFor - dt);
        const target = clearFor > 0 || held.current ? 1 : 0;
        if (reduced) {
          clarity.x = target;
          clarity.v = 0;
          return moving;
        }
        return (
          stepSpring(clarity, target, CLARITY, dt) || moving || clearFor > 0
        );
      },
      lens: (): GlassLens | null => {
        // Nothing selected: no pill.
        if (!spanOf(selected.current)) return null;
        const { W, H } = layout;
        const shape = model.shape();
        const w = W + 2 * pad.x;
        const h = H + pad.top + pad.bottom;
        // The lens magnifies around cx, so it follows the pill.
        const cx = pad.x + shape.x;
        const cy = pad.top + H / 2;
        const rect = lensCanvas.getBoundingClientRect();
        return {
          left: 0,
          top: 0,
          width: w,
          height: h,
          unit: H / 120,
          cx,
          cy,
          hx: Math.max(shape.hx, 0.3),
          hy: Math.max(shape.hy, 0.3),
          radius: 999,
          bodyX: 0,
          bevel: 120 * 0.36,
          shadow: 0.08,
          shadowSoftness: 22,
          shadowOffset: 10,
          strength: 1,
          color: theme.knob,
          surface: theme.surface,
          edgeClear: 0.2,
          cursorLight: true,
          reflection: { height: H, live: true, paint: paintTrack },
          refraction: {
            paint: paintBehind,
            refract: 14,
            magnify: 0.12,
            dispersion: 0.03,
            blurCenter: 0.2,
            blurEdge: 1.6,
            frost: FROST_REST + (FROST_CLEAR - FROST_REST) * clamp(clarity.x),
          },
          screenX: rect.left + cx,
          screenY: rect.top + cy,
        };
      },
      drawn: () => onReady(true),
      lost: () => onReady(false),
    });
    if (!surface) {
      onReady(false);
      return;
    }

    // Segments move when the page reflows, the text changes or a font loads.
    const relayout = () => {
      layout = measure(root, probe);
      size();
      drawTrack();
      place(true);
      surface.repaint();
    };
    const resize = new ResizeObserver(relayout);
    resize.observe(root);
    const text = new MutationObserver(relayout);
    text.observe(root, { subtree: true, childList: true, characterData: true });
    void document.fonts?.ready.then(relayout);
    const stopTheme = onThemeChange(() => {
      direction();
      theme = readTheme(probes, probe);
      drawTrack();
      surface.repaint();
    });

    api.current = {
      select: () => {
        place(false);
        clearFor = CLEAR_FOR;
        surface.wake();
      },
      wake: surface.wake,
    };
    return () => {
      resize.disconnect();
      text.disconnect();
      stopTheme();
      surface.detach();
      api.current = { select: () => {}, wake: () => {} };
    };
  }, [model, onReady, onDirection]);

  React.useEffect(() => {
    if (selected.current === value) return;
    selected.current = value;
    api.current.select();
  }, [value]);
  React.useEffect(() => {
    held.current = pressed;
    model.press(pressed);
    api.current.wake();
  }, [model, pressed]);

  const pad = padFor(box?.H ?? 0);
  return (
    <span ref={host} aria-hidden className="contents">
      <ThemeProbe ref={colors} />
      <canvas
        ref={track}
        className="pointer-events-none absolute z-0 max-w-none"
        style={
          box
            ? {
                left: -pad.x,
                top: -pad.top,
                width: box.W + 2 * pad.x,
                height: box.H + pad.top + pad.bottom,
              }
            : { width: 0, height: 0 }
        }
      />
      <span
        className="pointer-events-none absolute z-2"
        style={{
          left: -pad.x,
          top: -pad.top,
          width: (box?.W ?? 0) + 2 * pad.x,
          height: (box?.H ?? 0) + pad.top + pad.bottom,
        }}
      >
        <canvas
          ref={lens}
          className="pointer-events-none absolute top-0 left-0 size-0 max-w-none"
        />
      </span>
    </span>
  );
}
