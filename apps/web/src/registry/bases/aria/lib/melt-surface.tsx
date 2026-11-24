/*
 * The glass is drawn by liquid-glass-engine.ts, copied unedited from the
 * Liquid Glass kit by Bilal Gürşen: https://github.com/bilalgursen/liquid-glass
 * (commit d4ef632). Its license:
 *
 * MIT License
 *
 * Copyright (c) 2026 Bilal Abdullah Gürşen
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
"use client";

import * as React from "react";

import {
  clamp,
  getGlassEngine,
  type GlassLens,
  type GlassView,
  stepSpring,
} from "@/registry/bases/aria/lib/liquid-glass-engine";
import {
  meltGeometry,
  type MeltGeometry,
  meltModel,
  type MeltModel,
  type MeltPreset,
} from "@/registry/bases/aria/lib/melt";

type Rgba = [number, number, number, number];

type Rgb = [number, number, number];

interface Theme {
  on: string;
  off: string;
  dots: string;
  edge: string;
  surface: Rgb;
  // The knob's color at rest, off and on, as 0-1 RGB.
  thumbOff: Rgb;
  thumbOn: Rgb;
  rtl: boolean;
}

// Room around the track for the knob's swell and its shadow.
function padFor(H: number) {
  return {
    x: Math.round(H * 0.4),
    top: Math.round(H * 0.35),
    bottom: Math.round(H * 0.95),
  };
}

// Any CSS color, like oklch(0.2 0 0), as 0-255 RGBA, by painting one pixel.
function toRgba(color: string, probe: CanvasRenderingContext2D): Rgba {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}

const css = ([r, g, b]: Rgba, alpha: number) =>
  `rgb(${r} ${g} ${b} / ${alpha})`;
const unit = ([r, g, b]: Rgba): Rgb => [r / 255, g / 255, b / 255];
const luma = ([r, g, b]: Rgba) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// The track takes the project's theme, as shadcn/ui's switch does: --primary
// when on, --input when off, and a knob that stands out from each.
function readTheme(el: HTMLElement, probe: CanvasRenderingContext2D): Theme {
  const style = getComputedStyle(el);
  const read = (name: string, fallback: string) =>
    toRgba(style.getPropertyValue(name).trim() || fallback, probe);
  const background = read("--background", "#fff");
  const foreground = read("--foreground", "#000");
  const input = read("--input", "#e5e5e5");
  // An --input with alpha, as in dark themes, sits on the page background.
  const a = (input[3] ?? 255) / 255;
  const off: Rgba = [0, 1, 2].map((i) =>
    Math.round((input[i] ?? 0) * a + (background[i] ?? 0) * (1 - a)),
  ) as Rgba;
  const primary = read("--primary", "#171717");
  // shadcn/ui's thumb: --background when off, or --foreground on a dark page.
  const dark = luma(background) < 128;
  return {
    on: css(primary, 1),
    off: css(off, 1),
    dots: css(background, 0.3),
    edge: css(foreground, 0.1),
    surface: unit(background),
    thumbOff: unit(dark ? foreground : background),
    thumbOn: unit(read("--primary-foreground", "#fafafa")),
    rtl: style.direction === "rtl",
  };
}

// Registers a surface with the engine's one shared WebGL2 canvas, which skips
// views it believes are off screen, so this keeps `visible` up to date.
function attach(
  canvas: HTMLCanvasElement,
  view: Omit<GlassView, "canvas" | "ctx" | "dirty" | "visible">,
) {
  const engine = getGlassEngine();
  const ctx = canvas.getContext("2d");
  if (!engine || !ctx) return null;
  const registered: GlassView = {
    ...view,
    canvas,
    ctx,
    dirty: true,
    visible: false,
  };
  const io = new IntersectionObserver(([entry]) => {
    registered.visible = entry?.isIntersecting ?? false;
    registered.dirty = true;
    engine.wake();
  });
  io.observe(canvas.parentElement ?? canvas);
  engine.add(registered);
  return {
    wake: () => {
      registered.dirty = true;
      engine.wake();
    },
    detach: () => {
      io.disconnect();
      engine.remove(registered);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

// The knob is frosted in the theme's thumb color at rest and clears to glass
// while it's held and for CLEAR_FOR seconds after it flips, so the pour,
// stretch or drip shows through.
const FROST_REST = 0.72;
const FROST_CLEAR = 0.08;
const CLEAR_FOR = 0.6;
const CLARITY = { omega: 16, zeta: 1 };

function useMeltSurface(
  g: MeltGeometry,
  model: MeltModel,
  pressed: React.RefObject<boolean>,
  onReady: (ready: boolean) => void,
) {
  const track = React.useRef<HTMLCanvasElement>(null);
  const lens = React.useRef<HTMLCanvasElement>(null);
  const wake = React.useRef(() => {});
  const clear = React.useRef(() => {});

  React.useEffect(() => {
    const trackCanvas = track.current;
    const lensCanvas = lens.current;
    const tctx = trackCanvas?.getContext("2d");
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!trackCanvas || !lensCanvas || !tctx || !probe) return;

    const pad = padFor(g.H);
    const w = g.W + 2 * pad.x;
    const h = g.H + pad.top + pad.bottom;
    const cx = pad.x + g.W / 2;
    const cy = pad.top + g.H / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    trackCanvas.width = Math.round(w * dpr);
    trackCanvas.height = Math.round(h * dpr);
    let theme = readTheme(trackCanvas, probe);

    const paint = (c: CanvasRenderingContext2D) => {
      const { H, W } = g;
      c.save();
      c.beginPath();
      c.roundRect(pad.x, pad.top, W, H, H / 2);
      c.clip();
      c.fillStyle = theme.off;
      c.fillRect(pad.x, pad.top, W, H);
      c.globalAlpha = model.fill();
      c.fillStyle = theme.on;
      c.fillRect(pad.x, pad.top, W, H);
      c.globalAlpha = 1;
      // A grid of dots gives the lens something to bend.
      c.fillStyle = theme.dots;
      const step = Math.max(5, H / 9);
      for (let y = pad.top + step / 2; y < pad.top + H; y += step)
        for (let x = pad.x + step / 2; x < pad.x + W; x += step)
          c.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      c.restore();
      c.strokeStyle = theme.edge;
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(pad.x + 0.5, pad.top + 0.5, W - 1, H - 1, H / 2 - 0.5);
      c.stroke();
    };
    const drawTrack = () => {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(tctx);
    };
    drawTrack();
    let lastFill = model.fill();
    const clarity = { x: 0, v: 0 };
    let clearFor = 0;

    const surface = attach(lensCanvas, {
      step: (dt, reduced) => {
        const moving = model.step(dt, reduced);
        const f = model.fill();
        if (f !== lastFill || reduced) {
          lastFill = f;
          drawTrack();
        }
        clearFor = Math.max(0, clearFor - dt);
        const target = clearFor > 0 || pressed.current ? 1 : 0;
        if (reduced) {
          clarity.x = target;
          clarity.v = 0;
          return moving;
        }
        const clearing = stepSpring(clarity, target, CLARITY, dt);
        return moving || clearing || clearFor > 0;
      },
      lens: (): GlassLens => {
        const sh = model.shape();
        // The models run left to right; RTL mirrors them, so on is at the start.
        const flip = theme.rtl ? -1 : 1;
        const rect = lensCanvas.getBoundingClientRect();
        const d = sh.drop;
        const f = model.fill();
        const thumb = theme.thumbOff.map(
          (c, i) => c + ((theme.thumbOn[i] ?? c) - c) * f,
        ) as Rgb;
        return {
          left: 0,
          top: 0,
          width: w,
          height: h,
          unit: g.H / 120,
          cx,
          cy,
          hx: Math.max(sh.body.hx, 0.3),
          hy: Math.max(sh.body.hy, 0.3),
          radius: 999,
          bodyX: flip * sh.body.x,
          droplet:
            d && d.r > 0.4
              ? { x: flip * d.x, r: d.r, k: Math.max(d.k, 0.001) }
              : undefined,
          bevel: 120 * 0.42,
          shadow: 0.1,
          shadowSoftness: 26,
          shadowOffset: 14,
          strength: 1,
          color: thumb,
          surface: theme.surface,
          edgeClear: 0.2,
          cursorLight: true,
          reflection: { height: g.H, live: true, paint },
          refraction: {
            paint,
            refract: 40,
            magnify: 0.1,
            dispersion: 0.14,
            blurCenter: 0.35,
            blurEdge: 2.2,
            frost: FROST_REST + (FROST_CLEAR - FROST_REST) * clamp(clarity.x),
          },
          screenX: rect.left + cx + clamp(flip * sh.body.x, -g.W, g.W),
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

    // A theme or direction change repaints the track and the glass over it.
    const retheme = () => {
      theme = readTheme(trackCanvas, probe);
      drawTrack();
      surface.wake();
    };
    const observer = new MutationObserver(retheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "dir", "data-theme"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", retheme);
    wake.current = surface.wake;
    clear.current = () => {
      clearFor = CLEAR_FOR;
      surface.wake();
    };

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", retheme);
      surface.detach();
      wake.current = () => {};
      clear.current = () => {};
    };
  }, [g, model, pressed, onReady]);

  return { track, lens, wake, clear };
}

// A CSS linear() curve sampled from a spring, for the plain thumb shown when
// the browser has no WebGL2.
function springEasing(omega: number, zeta: number, samples = 40) {
  const s = { x: 0, v: 0 };
  const points: string[] = [];
  const duration = 0.6;
  for (let i = 0; i <= samples; i++) {
    points.push(s.x.toFixed(4));
    for (let k = 0; k < 4; k++)
      stepSpring(s, 1, { omega, zeta }, duration / samples / 4);
  }
  return { easing: `linear(${points.join(", ")})`, duration };
}
const FALLBACK = springEasing(17, 0.78);

export const MELT_SIZES = { sm: 28, default: 36, lg: 48 } as const;
export type MeltSize = keyof typeof MELT_SIZES;

export function meltSize(size: MeltSize) {
  const g = meltGeometry(MELT_SIZES[size]);
  return { width: g.W, height: g.H };
}

// The glass inside a melt switch: a track painted in the theme's colors, and a
// knob of glass that crosses it with `preset`'s motion.
export function MeltGlass({
  preset,
  size,
  on,
  pressed,
  onReady,
}: {
  preset: MeltPreset;
  size: MeltSize;
  on: boolean;
  pressed: boolean;
  onReady: (ready: boolean) => void;
}) {
  const g = React.useMemo(() => meltGeometry(MELT_SIZES[size]), [size]);
  // The model is made once, from the state at mount; the effects below keep it
  // in step. The switch remounts this when the preset or size changes.
  const [model] = React.useState(() => meltModel(preset, g, on));
  const [glass, setGlass] = React.useState<boolean | null>(null);
  const ready = React.useCallback(
    (value: boolean) => {
      setGlass(value);
      onReady(value);
    },
    [onReady],
  );
  const held = React.useRef(pressed);
  const { track, lens, wake, clear } = useMeltSurface(g, model, held, ready);
  const was = React.useRef(on);

  React.useEffect(() => {
    model.set(on);
    if (was.current !== on) clear.current();
    was.current = on;
    wake.current();
  }, [model, on, wake, clear]);
  React.useEffect(() => {
    held.current = pressed;
    model.press(pressed);
    wake.current();
  }, [model, pressed, wake]);

  const pad = padFor(g.H);
  const layer = "pointer-events-none absolute max-w-none";
  return (
    <span
      aria-hidden
      className={layer}
      style={{
        left: -pad.x,
        top: -pad.top,
        width: g.W + 2 * pad.x,
        height: g.H + pad.top + pad.bottom,
      }}
    >
      <canvas ref={track} className={`${layer} start-0 top-0 size-full`} />
      <span className={`${layer} start-0 top-0 size-full`}>
        <canvas ref={lens} className={`${layer} start-0 top-0 size-0`} />
      </span>
      {glass === false && (
        // Mirrored in RTL, so on is at the start.
        <span className={`${layer} inset-0 rtl:-scale-x-100`}>
          <span
            className={`${layer} rounded-full bg-background shadow-sm`}
            style={{
              top: pad.top + g.H / 2 - g.r,
              left: pad.x + g.H / 2 - g.r,
              width: 2 * g.r,
              height: 2 * g.r,
              translate: `${on ? g.right - g.left : 0}px 0`,
              transition: `translate ${FALLBACK.duration}s ${FALLBACK.easing}`,
            }}
          />
        </span>
      )}
    </span>
  );
}
