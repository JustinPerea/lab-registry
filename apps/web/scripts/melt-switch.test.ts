//   node --test scripts/melt-switch.test.ts

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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

test("every base carries the Liquid Glass engine unedited", () => {
  for (const base of BASES) {
    const bytes = readFileSync(LIB(base, "liquid-glass-engine.ts"));
    const sha = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha, ENGINE_SHA256, base);
  }
});

test("the bases' melt files differ only in their own import paths", () => {
  for (const file of ["melt.ts", "melt-surface.tsx"]) {
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
test("the kit's license is in melt-surface.tsx, past its first line", () => {
  for (const base of BASES) {
    const source = readFileSync(LIB(base, "melt-surface.tsx"), "utf8");
    assert.ok(source.startsWith('"use client";\n'), base);
    assert.ok(source.includes(COPYRIGHT), base);
    assert.ok(source.includes(PERMISSION), base);
  }
});

test("each base's build publishes the license and the credit", () => {
  for (const base of BASES) {
    const built = path.join(ROOT, "public/r", `${base}-nova/melt-switch.json`);
    if (!existsSync(built)) continue;
    const item = JSON.parse(readFileSync(built, "utf8")) as {
      description: string;
      files: { path: string; content: string }[];
    };
    const surface = item.files.find((file) =>
      file.path.endsWith("melt-surface.tsx"),
    );
    assert.ok(surface?.content.includes(COPYRIGHT), base);
    assert.match(item.description, /Bilal Gürşen's Liquid Glass kit \(MIT\)/);
  }
});
