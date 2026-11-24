"use client";

import { cn } from "cn";
import * as React from "react";
import {
  Switch as SwitchPrimitive,
  type SwitchProps,
} from "react-aria-components";

import type { MeltPreset } from "@/registry/bases/aria/lib/melt";

import {
  MeltGlass,
  meltSize,
  type MeltSize,
} from "@/registry/bases/aria/lib/melt-surface";

function MeltSwitch({
  preset = "pour",
  size = "default",
  className,
  style,
  ...props
}: Omit<SwitchProps, "children" | "className" | "style"> & {
  preset?: MeltPreset;
  size?: MeltSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [ready, setReady] = React.useState(false);

  return (
    <SwitchPrimitive
      data-slot="melt-switch"
      data-size={size}
      data-preset={preset}
      data-glass={ready ? "" : undefined}
      className={cn(
        "cn-melt-switch-aria relative inline-flex shrink-0 rounded-full bg-input outline-none data-glass:bg-transparent! dark:not-data-selected:bg-input/80 data-selected:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      style={{ ...meltSize(size), ...style }}
      {...props}
    >
      {({ isSelected, isPressed }) => (
        <MeltGlass
          key={`${preset}-${size}`}
          preset={preset}
          size={size}
          on={isSelected}
          pressed={isPressed}
          onReady={setReady}
        />
      )}
    </SwitchPrimitive>
  );
}

export { MeltSwitch };
