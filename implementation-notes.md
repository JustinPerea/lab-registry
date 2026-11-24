# Implementation notes

The registry for justinperea.com/lab components. Justin approved building it on 2026-11-24, and making it
public at registry.justinperea.com the same day. The brief: start from sadmann7's registry-kit, install into
any base and style with RTL, first item the melt switch with all three presets.

## Licenses

- **registry-kit** (github.com/sadmann7/registry-kit): MIT, Copyright (c) 2026 Sadman Sakib. This repo was
  made from it with GitHub's template feature at commit `aae92e0` (2026-11-24). `LICENSE` at the root is the
  kit's, unchanged.
- **Liquid Glass** (github.com/bilalgursen/liquid-glass): MIT, Copyright (c) 2026 Bilal Abdullah Gürşen.
  `lib/liquid-glass-engine.ts` in each base is its `engine.ts` at commit `d4ef632`, byte for byte (sha256
  `c2c8f6c0…bc74f`, checked by `scripts/melt-switch.test.ts`). It is the same file personal-profile vendors.

## Setup

- `registry:init --name justinperea --homepage https://registry.justinperea.com --github
  https://github.com/JustinPerea/lab-registry --bases base,radix,aria --styles` (all eight) `--no-examples`.
- `homepage` is registry.justinperea.com, where the site and `public/r` are served. It is also the site's
  `metadataBase`.
- The kit wants Node 24.2+ and pnpm 12. This Mac's default Node is 22, so commands run with
  `~/.nvm/versions/node/v24.22.1/bin` first on PATH and pnpm through corepack.

## The melt switch item

- Files per base: `ui/melt-switch.tsx` (the base's own Switch), `lib/melt-surface.tsx` (canvas, theme,
  engine registration, fallback), `lib/melt.ts` (the three motion models), `lib/liquid-glass-engine.ts`.
- `melt.ts` is personal-profile's `melt.ts` cut to pour, stretch and drip. Hold and the code readout's
  `probe()` stay in the lab. The spring constants are the same.
- Each base wraps its own Switch, so focus, keyboard, labels, form value and controlled state come from the
  base. Radix and Base UI take `checked`/`defaultChecked`/`onCheckedChange`. React Aria takes
  `isSelected`/`defaultSelected`/`onChange`, and its `isPressed` render prop drives the press swell, so
  Space swells the glass too.
- `view.ts` from the lab is not shipped: it patched `CanvasRenderingContext2D.prototype.drawImage` and
  `HTMLCanvasElement.prototype.getContext` to count frames. `melt-surface.tsx` registers with the engine
  directly.
- **Theme.** The canvas takes its colors from hidden elements that carry shadcn/ui's switch classes:
  `bg-primary` (on), `bg-input dark:bg-input/80` (off, composited on `bg-background`),
  `bg-primary-foreground`, `bg-background`, `bg-foreground`. It reads each computed color through a 1×1
  canvas, so any CSS color format works. The first version read the CSS variables directly. `registry:test`
  failed it for projects with a Tailwind prefix or `cssVariables: false`, where there are no variables and
  the CLI rewrites classes instead. Classes go through the CLI's rewrite, so the probes get the right colors
  in both. The knob's resting color follows shadcn/ui's thumb: background off, or foreground on a dark page,
  and primary-foreground on. A MutationObserver on `<html>` and a `prefers-color-scheme` listener repaint
  on theme change.
- Every class in `melt-surface.tsx` is a literal string. Class strings built with template literals got
  past the CLI's prefix rewrite (`registry:test`, "classes without the Tailwind prefix").
- **Frost.** At rest the knob is frosted in that thumb color, so it reads against a black `--primary`. It
  clears to glass while held and for 0.6 s after each flip, so the pour, stretch or drip shows. The first
  version cleared while any spring moved, which left pour and drip clear for over a second of tiny wobble.
- **RTL.** The CLI flips classes, not canvas coordinates, so the surface reads `direction` and mirrors the
  models' x. The no-WebGL thumb sits in a container with `rtl:-scale-x-100`.
- **No WebGL2.** The engine returns null; the switch shows a plain thumb that moves on a CSS `linear()`
  curve sampled from the stretch front spring (ω 17, ζ 0.78), not a stock ease.
- **Sizes.** `sm` 28 px, `default` 36 px, `lg` 48 px tall. shadcn's own switch is 18.4 px, too small for
  the lens to read.
- **Styles.** shadcn/ui's switch is a pill in every style except Sera's (`rounded-none`). The glass needs a
  pill, so the melt switch stays one everywhere. Per style it takes the focus ring of that style's own
  switch (`cn-melt-switch`, `cn-melt-switch-aria`).
- Once the glass has drawn, `data-glass` makes the root's background transparent (`bg-transparent!`, so it
  wins whatever order Tailwind emits the variants in). Before that, and without JS, the root shows the
  plain on/off colors.

## The melt segmented control item

Justin picked it as the second item on 2026-11-24. It is the lab's glass segment selector made into a
component.

- **Shared files.** The kit's build gives every file one owner item, and other items list that owner in
  `registryDependencies`. So the engine moved into a new `melt-glass` item (`lib/melt-glass.tsx` and the
  engine), and both the switch and the segmented control depend on it. The switch's own files are unchanged,
  so projects that installed it before keep working. Adding the segmented control to such a project skips
  the engine as identical (checked on a real install).
- `lib/melt-glass.tsx` starts with `"use client"` and carries the kit's license below it, as
  `melt-surface.tsx` does. The switch's file keeps its own copy of the plumbing rather than importing the new
  one, so its published files didn't change.
- **Base.** Each base wraps its own radio group: Radix `RadioGroup`, Base UI `RadioGroup` and `Radio`,
  React Aria `RadioGroup` with `RadioField` and `RadioButton` (`Radio` is deprecated in 1.22).
  Value props follow the base: `value`, `defaultValue`, `onValueChange` (Radix, Base UI) or `onChange`
  (React Aria).
- **Layout comes from the DOM.** The glass reads each segment's `offsetLeft` and width and its text's box, so
  segments can be any width, RTL needs no mirroring, and it lays out again on resize, text change and font
  load.
- **Text.** The segments keep their own text in the DOM, between the track canvas and the lens canvas.
  Outside the pill you see the page's text; inside it the lens shows the same text painted on canvas,
  bent and magnified. Only text is painted, so an icon in a segment is hidden while the pill is over it.
- **The lens magnifies around `cx`.** With `cx` at the control's centre and the pill offset by `bodyX`,
  the label under a pill at either end came out about 12 px off centre. `cx` follows the pill and `bodyX`
  is 0.
- **Frost.** 0.2 at rest, lower than the switch's 0.72, so the label under the pill reads in dark themes.
  Refraction 14 and dispersion 0.03: with the switch's 30 and 0.1 the rim showed coloured fragments of the
  neighbouring labels.
- **Arrow keys follow the CSS direction.** shadcn's `--rtl` init doesn't add a direction provider, and Radix
  and Base UI read direction from one, so in an RTL page ArrowRight went to the next segment in DOM order,
  which is drawn to the left. The glass reports the control's computed direction: Radix gets it as `dir`
  (unless the app passes `dir`), Base UI through `DirectionProvider`. React Aria takes direction from its
  locale (`I18nProvider`), so an RTL app sets that, as React Aria's docs say.
- **No WebGL2.** The selected segment shows shadcn's tabs look (background fill and shadow). It doesn't
  animate.
- **Stale builds.** The dev server doesn't rebuild `public/r`, and twice an install tested old code. The
  item test now fails when a source file is newer than its built JSON.

## The shadcn CLI drops a file's leading comment

Found on the first install: `shadcn add` writes each file without its leading comment block. That took the
kit's license off `melt-surface.tsx` (where it sat above `"use client"`) and the 17-line header off the
engine. Other comments survive. So:

- The license block in `melt-surface.tsx` now sits after `"use client"`, and `melt-switch.test.ts` fails if
  the file doesn't start with `"use client"` or loses the copyright and permission lines.
- The engine in the registry source stays byte for byte. An installed copy is the same file minus its
  first 17 lines (checked with `diff` on a real install). The notice those lines carried is in
  `melt-surface.tsx`.
- `ui/melt-switch.tsx` has a short credit comment above the component, which also survives.

## Lint and format

- `.oxlintrc.json` and `.oxfmtrc.json` ignore `bases/*/lib/liquid-glass-engine.ts`, so neither reformats
  the vendored file.
- The three bases' `melt.ts` and `melt-surface.tsx` are generated from Radix's by replacing
  `bases/radix/`. The test fails if they drift in anything else.

## Checked (2026-11-24)

Melt segmented control: `registry:build`, `pnpm check`, `node --test scripts/melt-switch.test.ts` (5 pass)
and `registry:test` (all 469 dry-run installs pass). Two fresh apps (shadcn 4.23.0): React Aria + Nova
with the switch installed first from the live registry and the segmented control added from the local
build without `--overwrite`; Base UI + Lyra in RTL with both items from the local build. Both ran
`next build` and `next start`. In installed Chrome: glass drawn, clicks, a controlled control following a
button outside it, arrow keys (RTL included), a narrower window, dark mode, no console errors.


- `registry:build` (3 bases × 8 styles), `pnpm lint` (no warnings in the new files beyond the kit's own
  test-file style), `pnpm typecheck`, `node --test scripts/melt-switch.test.ts` (4 pass).
- Preview site in installed Chrome, every base, LTR and RTL: three switches draw glass, clicks and Space
  toggle, no console errors.
- Installs: three fresh apps made with `shadcn init -t next` (shadcn 4.23.0, the current release):
  `radix-nova`, `base-lyra` with `--rtl` and `<html dir="rtl">`, and `aria-nova`. Each ran
  `shadcn registry add` and `shadcn add @justinperea/melt-switch` against the local server, then
  `next build` (types included) and `next start`. In installed Chrome: glass drawn, label clicks toggle
  (Radix, Base UI), a controlled switch follows a button outside it, Space toggles, the knob sits at the
  start edge in RTL, the theme flips live, no console or hydration errors.

- `registry:test`: all 268 dry-run installs pass (every base and style, each icon library and each
  `components.json` option, including prefix, `cssVariables: false`, `tsx: false` and custom aliases).

## Deploying

- Vercel project `lab-registry` on the "Justin's projects" team, connected to this GitHub repo. A push to
  `main` deploys production at registry.justinperea.com (DNS on Vercel, same team); other branches get
  previews. Root directory `apps/web`, Node 24, pnpm 12 through `ENABLE_EXPERIMENTAL_COREPACK=1`.
- Deployment Protection is Standard (`all_except_custom_domains`): previews ask for Vercel sign-in, the
  custom domain doesn't.
- `scripts/deploy-preview.sh` makes a preview from a local tree without pushing. It fails if Vercel made
  anything other than a preview, or if any of the deployment's addresses answers without sign-in.
- Why the script exists: before the registry was public, the first plain `vercel deploy` on the new project
  became a production deployment, and Vercel gave it `lab-registry-psi.vercel.app`, which Standard Protection
  leaves public. It answered 200 from about 16:40 to 16:42 UTC on 2026-11-24, until the alias was removed.
- The `.env.local` that `vercel link` writes is ignored by the kit's own `.env*.local` rule. Link also adds
  `.env*` to `.gitignore`; that edit was reverted, since it would ignore `apps/web/.env.schema`.
- Before the repo went public its commits were rewritten from a personal email to the GitHub noreply
  address, and the repo-local `user.email` is set to that address.

## Site branding

- The icons are the JP mark from justinperea.com's `favicon.svg`. The header shows the same mark in place of
  the kit's blocks icon.
- `opengraph-image.png` (1200 × 630) shows the melt switch mid-pour, captured from justinperea.com/lab/melt-switch
  rather than from this site. The glass canvas caps its resolution at 2×, and the lab page's switch is larger
  than the 36 px one here, so it stays sharp at that size. The lab page uses its own teal-to-violet track; an
  installed switch takes the project's theme colors.

## Not verified

- No real phone.
