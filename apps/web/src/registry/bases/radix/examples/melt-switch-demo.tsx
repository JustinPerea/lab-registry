"use client";

import * as React from "react";

import { MeltSwitch } from "@/registry/bases/radix/ui/melt-switch";

const PRESETS = [
  { preset: "pour", label: "Pour" },
  { preset: "stretch", label: "Stretch" },
  { preset: "drip", label: "Drip" },
] as const;

export default function MeltSwitchDemo() {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
        {PRESETS.map(({ preset, label }) => (
          <div key={preset} className="flex items-center gap-3">
            <MeltSwitch id={`${id}-${preset}`} preset={preset} />
            <label htmlFor={`${id}-${preset}`} className="text-sm">
              {label}
            </label>
          </div>
        ))}
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        Glass by Bilal Gürşen&apos;s{" "}
        <a
          href="https://github.com/bilalgursen/liquid-glass"
          className="underline underline-offset-2"
        >
          Liquid Glass
        </a>{" "}
        kit (MIT).
      </p>
    </div>
  );
}
