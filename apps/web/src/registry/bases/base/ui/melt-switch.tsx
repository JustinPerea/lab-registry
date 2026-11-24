"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";
import * as React from "react";

import type { MeltPreset } from "@/registry/bases/base/lib/melt";

import {
  MeltGlass,
  meltSize,
  type MeltSize,
} from "@/registry/bases/base/lib/melt-surface";

// A switch whose knob is a drop of glass, from justinperea.com/lab/melt-switch.
// The glass is drawn by Bilal Gürşen's Liquid Glass kit (MIT, license in
// lib/melt-surface.tsx); `preset` picks how the knob crosses the track.
function MeltSwitch({
  preset = "pour",
  size = "default",
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
  style,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  ...props
}: Omit<SwitchPrimitive.Root.Props, "children" | "className" | "style"> & {
  preset?: MeltPreset;
  size?: MeltSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultChecked);
  const on = checked ?? uncontrolled;
  const [pressed, setPressed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const release =
    (handler?: React.PointerEventHandler<HTMLSpanElement>) =>
    (event: React.PointerEvent<HTMLSpanElement>) => {
      handler?.(event);
      setPressed(false);
    };

  return (
    <SwitchPrimitive.Root
      data-slot="melt-switch"
      data-size={size}
      data-preset={preset}
      data-glass={ready ? "" : undefined}
      checked={on}
      onCheckedChange={(next, details) => {
        if (checked === undefined) setUncontrolled(next);
        onCheckedChange?.(next, details);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.button === 0) setPressed(true);
      }}
      onPointerUp={release(onPointerUp)}
      onPointerCancel={release(onPointerCancel)}
      onPointerLeave={release(onPointerLeave)}
      className={cn(
        "cn-melt-switch relative inline-flex shrink-0 rounded-full outline-none data-glass:bg-transparent! data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      style={{ ...meltSize(size), ...style }}
      {...props}
    >
      <MeltGlass
        key={`${preset}-${size}`}
        preset={preset}
        size={size}
        on={on}
        pressed={pressed}
        onReady={setReady}
      />
    </SwitchPrimitive.Root>
  );
}

export { MeltSwitch };
