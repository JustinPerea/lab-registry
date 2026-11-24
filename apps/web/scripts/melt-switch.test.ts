//   node --test scripts/melt-switch.test.ts

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { ROOT } from "./registry.ts";

const BASES = ["base", "radix", "aria"] as const;
const LIB = (base: string, file: string) =>
  path.join(ROOT, "src/registry/bases", base, "lib", file);

// sha256 of engine.ts at bilalgursen/liquid-glass commit d4ef632, as vendored
// in personal-profile. It is copied without edits, so a change here is a bug.
const ENGINE_SHA256 =
  "c2c8f6c0da4151f8fd20411d26910d3999f4d5b6830045df11d7c1dfffebc74f";
const COPYRIGHT = "Copyright (c) 2026 Bilal Abdullah Gürşen";
const PERMISSION =
  "The above copyright notice and this permission notice shall be included in all";

// The files that carry the kit's license: the switch's own (published before
// melt-glass existed) and the shared melt-glass item's.
const LICENSED = ["melt-surface.tsx", "melt-glass.tsx"];
// Files every base has, identical apart from their own import paths.
const SHARED = [
  "melt.ts",
  "melt-surface.tsx",
  "melt-glass.tsx",
  "melt-segments.tsx",
];

test("every base carries the Liquid Glass engine unedited", () => {
  for (const base of BASES) {
    const bytes = readFileSync(LIB(base, "liquid-glass-engine.ts"));
    const sha = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha, ENGINE_SHA256, base);
  }
});

test("the bases' melt files differ only in their own import paths", () => {
  for (const file of SHARED) {
    const radix = readFileSync(LIB("radix", file), "utf8");
    for (const base of BASES) {
      const own = readFileSync(LIB(base, file), "utf8").replaceAll(
        `bases/${base}/`,
        "bases/radix/",
      );
      assert.equal(own, radix, `${base}/lib/${file}`);
    }
  }
});

// The shadcn CLI drops a file's leading comment on install, which would take
// the kit's license with it, so the license must come after "use client".
test("the kit's license is past the first line of each licensed file", () => {
  for (const base of BASES) {
    for (const file of LICENSED) {
      const source = readFileSync(LIB(base, file), "utf8");
      assert.ok(source.startsWith('"use client";\n'), `${base}/${file}`);
      assert.ok(source.includes(COPYRIGHT), `${base}/${file}`);
      assert.ok(source.includes(PERMISSION), `${base}/${file}`);
    }
  }
});

type Built = {
  description: string;
  registryDependencies?: string[];
  files: { path: string; content: string }[];
};
const built = (base: string, name: string) => {
  const file = path.join(ROOT, "public/r", `${base}-nova/${name}.json`);
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Built)
    : null;
};

// Whatever ships the engine ships the license, and whatever draws glass either
// ships the engine or depends on the item that does.
test("each base's build publishes the license and the credit", () => {
  for (const base of BASES) {
    const glass = built(base, "melt-glass");
    if (!glass) continue;
    const engine = glass.files.find((f) =>
      f.path.endsWith("liquid-glass-engine.ts"),
    );
    const license = glass.files.find((f) => f.path.endsWith("melt-glass.tsx"));
    assert.ok(engine, `${base}: melt-glass ships the engine`);
    assert.ok(license?.content.includes(COPYRIGHT), base);
    assert.ok(license?.content.includes(PERMISSION), base);
    for (const name of ["melt-switch", "melt-segmented-control"]) {
      const item = built(base, name);
      assert.ok(item, `${base}: ${name} is built`);
      assert.match(item.description, /Bilal Gürşen's Liquid Glass kit \(MIT\)/);
      assert.ok(
        item.registryDependencies?.some((d) =>
          d.endsWith(`/${base}-nova/melt-glass.json`),
        ),
        `${base}: ${name} depends on melt-glass`,
      );
    }
    const surface = built(base, "melt-switch")?.files.find((f) =>
      f.path.endsWith("melt-surface.tsx"),
    );
    assert.ok(surface?.content.includes(COPYRIGHT), base);
  }
});

// The dev server doesn't rebuild public/r, and installs from a stale build
// twice tested old code. Skipped where there is no local build, as in CI.
test("the local build is newer than every melt source file", () => {
  for (const base of BASES) {
    const registry = path.join(
      ROOT,
      "src/registry/bases",
      base,
      "registry.json",
    );
    const items = (
      JSON.parse(readFileSync(registry, "utf8")) as {
        items: { name: string; files: { path: string }[] }[];
      }
    ).items;
    for (const item of items) {
      const out = path.join(ROOT, "public/r", `${base}-nova/${item.name}.json`);
      if (!existsSync(out)) continue;
      const builtAt = statSync(out).mtimeMs;
      for (const file of [
        registry,
        ...item.files.map((f) =>
          path.join(ROOT, "src/registry/bases", base, f.path),
        ),
      ]) {
        assert.ok(
          statSync(file).mtimeMs <= builtAt,
          `${path.relative(ROOT, file)} changed after public/r was built: run pnpm registry:build`,
        );
      }
    }
  }
});
