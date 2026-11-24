"use client";

import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";

import type { MeltPreset } from "@/registry/bases/radix/lib/melt";

import {
  MeltGlass,
  meltSize,
  type MeltSize,
} from "@/registry/bases/radix/lib/melt-surface";

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
}: Omit<React.ComponentProps<typeof SwitchPrimitive.Root>, "children"> & {
  preset?: MeltPreset;
  size?: MeltSize;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultChecked);
  const on = checked ?? uncontrolled;
  const [pressed, setPressed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const release =
    (handler?: React.PointerEventHandler<HTMLButtonElement>) =>
    (event: React.PointerEvent<HTMLButtonElement>) => {
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
      onCheckedChange={(next) => {
        if (checked === undefined) setUncontrolled(next);
        onCheckedChange?.(next);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.button === 0) setPressed(true);
      }}
      onPointerUp={release(onPointerUp)}
      onPointerCancel={release(onPointerCancel)}
      onPointerLeave={release(onPointerLeave)}
      className={cn(
        "cn-melt-switch relative inline-flex shrink-0 rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50 data-glass:bg-transparent! data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
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
