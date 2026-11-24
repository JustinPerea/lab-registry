"use client";

/*
 * The glass is drawn by liquid-glass-engine.ts, copied from the Liquid Glass
 * kit by Bilal Gürşen: https://github.com/bilalgursen/liquid-glass (commit
 * d4ef632). The shadcn CLI drops a file's leading comment on install, so the
 * kit's license sits here, below "use client", where it survives:
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

// What the melt components share: room around a track for the glass, theme
// colors read from the page, and registering a surface with the engine.

import {
  getGlassEngine,
  type GlassView,
} from "@/registry/bases/radix/lib/liquid-glass-engine";

export type Rgba = [number, number, number, number];
export type Rgb = [number, number, number];

// Room around a track for the glass's swell and its shadow.
export function padFor(H: number) {
  return {
    x: Math.round(H * 0.4),
    top: Math.round(H * 0.35),
    bottom: Math.round(H * 0.95),
  };
}

// Any CSS color, like oklch(0.2 0 0), as 0-255 RGBA, by painting one pixel.
export function toRgba(color: string, probe: CanvasRenderingContext2D): Rgba {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}

export const css = ([r, g, b]: Rgba, alpha = 1) =>
  `rgb(${r} ${g} ${b} / ${alpha})`;
export const unit = ([r, g, b]: Rgba): Rgb => [r / 255, g / 255, b / 255];
export const luma = ([r, g, b]: Rgba) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// `top` laid over `bottom` by its alpha, as an opaque color.
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = (top[3] ?? 255) / 255;
  return [0, 1, 2]
    .map((i) => Math.round((top[i] ?? 0) * a + (bottom[i] ?? 0) * (1 - a)))
    .concat(255) as Rgba;
}

export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return [0, 1, 2, 3].map((i) =>
    Math.round((a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * t),
  ) as Rgba;
}

// A probe element's background color. The color comes from shadcn/ui classes
// on hidden elements, so a Tailwind prefix or inlined colors (cssVariables:
// false) work too.
export function readColor(
  probes: HTMLElement,
  name: string,
  fallback: string,
  probe: CanvasRenderingContext2D,
): Rgba {
  const el = probes.querySelector<HTMLElement>(`[data-melt-color="${name}"]`);
  const color = el ? getComputedStyle(el).backgroundColor : "";
  return toRgba(color || fallback, probe);
}

// Calls `change` when the page's theme or direction may have changed.
export function onThemeChange(change: () => void) {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "dir", "data-theme"],
  });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", change);
  return () => {
    observer.disconnect();
    scheme.removeEventListener("change", change);
  };
}

// Registers a surface with the engine's one shared WebGL2 canvas, which skips
// views it believes are off screen, so this keeps `visible` up to date.
export function attach(
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
    // What lies behind the glass changed: paint it again.
    repaint: () => {
      registered.dirty = true;
      registered.repaint = true;
      engine.wake();
    },
    detach: () => {
      io.disconnect();
      engine.remove(registered);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
