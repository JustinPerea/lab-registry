# lab-registry

A [shadcn registry](https://ui.shadcn.com/docs/registry) of components from [justinperea.com/lab](https://justinperea.com/lab). Each item installs in a project's base (Base UI, Radix UI or React Aria) and style (all eight of shadcn/ui's), with RTL.

Private for now. Nothing here is deployed to a public address yet.

## Items

| Item          | What it is |
| ------------- | ---------- |
| `melt-switch` | A switch whose knob is a drop of glass. `preset` picks how it crosses the track: `pour`, `stretch` or `drip`. It wraps each base's own Switch and takes the project's theme colors. [Lab page](https://justinperea.com/lab/melt-switch) |

## Installing

A project adds the registry once, then installs items by name:

```bash
pnpm dlx shadcn@latest registry add "@justinperea=https://registry.justinperea.com/r/{style}/{name}.json"
pnpm dlx shadcn@latest add @justinperea/melt-switch
```

`registry.justinperea.com` is the planned address and isn't live. To try an item now, run `pnpm dev` and use `http://localhost:3000/r/{style}/{name}.json` in place of it.

```tsx
import { MeltSwitch } from "@/components/ui/melt-switch";

<MeltSwitch preset="drip" defaultChecked />;
```

## Developing

Requires Node 24.2 or later and pnpm 12 (`corepack pnpm`).

```bash
pnpm install
pnpm dev               # the preview site
pnpm registry:build    # public/r for every base and style
pnpm registry:test     # shadcn add --dry-run for every base, style and option
pnpm -F web test       # includes scripts/melt-switch.test.ts
pnpm check             # lint, format and types
```

[Adding items](./docs/adding-items.md), [how it works](./docs/how-it-works.md) and [setup](./docs/setup.md) are the kit's own docs. Notes on decisions in this repo are in [implementation-notes.md](./implementation-notes.md).

## Credits

- Built on [registry-kit](https://github.com/sadmann7/registry-kit) by Sadman Sakib (MIT, see [LICENSE](./LICENSE)), from commit `aae92e0`.
- The melt switch's glass is drawn by `liquid-glass-engine.ts`, copied unedited from [Liquid Glass](https://github.com/bilalgursen/liquid-glass) by Bilal Gürşen (MIT, commit `d4ef632`). Its license is in each base's `lib/melt-surface.tsx`.
