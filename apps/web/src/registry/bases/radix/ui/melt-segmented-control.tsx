"use client";

import { cn } from "cn";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";

import {
  MELT_SEGMENT_SIZES,
  MeltSegmentsGlass,
  type MeltSegmentSize,
} from "@/registry/bases/radix/lib/melt-segments";

// A segmented control whose selection is a pill of glass that stretches from
// segment to segment, from justinperea.com/lab/melt-switch. It is a radio
// group: arrow keys move the selection, and a form gets the value. The glass
// is drawn by Bilal Gürşen's Liquid Glass kit (MIT, license in
// lib/melt-glass.tsx).
function MeltSegmentedControl({
  size = "default",
  value,
  defaultValue,
  onValueChange,
  className,
  style,
  children,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  dir,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root> & {
  size?: MeltSegmentSize;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const current = value ?? uncontrolled;
  const [pressed, setPressed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  // Arrow keys follow the direction the control is drawn in, unless set.
  const [cssDir, setCssDir] = React.useState<"ltr" | "rtl">();
  const release =
    (handler?: React.PointerEventHandler<HTMLDivElement>) =>
    (event: React.PointerEvent<HTMLDivElement>) => {
      handler?.(event);
      setPressed(false);
    };

  return (
    <RadioGroupPrimitive.Root
      data-slot="melt-segmented-control"
      data-melt-segments=""
      data-size={size}
      data-glass={ready ? "" : undefined}
      orientation="horizontal"
      dir={dir ?? cssDir}
      value={current}
      onValueChange={(next) => {
        if (value === undefined) setUncontrolled(next);
        onValueChange?.(next);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.button === 0) setPressed(true);
      }}
      onPointerUp={release(onPointerUp)}
      onPointerCancel={release(onPointerCancel)}
      onPointerLeave={release(onPointerLeave)}
      className={cn(
        "group/melt-segments relative isolate inline-grid w-fit auto-cols-fr grid-flow-col items-stretch rounded-full bg-muted p-[3px] text-sm text-muted-foreground data-glass:bg-transparent! data-[size=lg]:text-base data-[size=sm]:text-xs data-disabled:opacity-50",
        className,
      )}
      style={{ height: MELT_SEGMENT_SIZES[size], ...style }}
      {...props}
    >
      <MeltSegmentsGlass
        value={current}
        pressed={pressed}
        onReady={setReady}
        onDirection={setCssDir}
      />
      {children}
    </RadioGroupPrimitive.Root>
  );
}

function MeltSegment({
  className,
  value,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="melt-segment"
      data-melt-value={value}
      value={value}
      className={cn(
        "cn-melt-segment relative z-1 inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 font-medium whitespace-nowrap outline-none select-none group-data-glass/melt-segments:bg-transparent! group-data-glass/melt-segments:shadow-none! disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm dark:data-[state=checked]:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { MeltSegment, MeltSegmentedControl };
