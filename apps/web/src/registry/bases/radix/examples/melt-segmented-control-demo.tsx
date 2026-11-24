"use client";

import {
  MeltSegment,
  MeltSegmentedControl,
} from "@/registry/bases/radix/ui/melt-segmented-control";

export default function MeltSegmentedControlDemo() {
  return (
    <div className="flex flex-col items-center gap-8">
      <MeltSegmentedControl defaultValue="week" aria-label="Range">
        <MeltSegment value="day">Day</MeltSegment>
        <MeltSegment value="week">Week</MeltSegment>
        <MeltSegment value="month">Month</MeltSegment>
        <MeltSegment value="year">Year</MeltSegment>
      </MeltSegmentedControl>
      <MeltSegmentedControl size="sm" defaultValue="list" aria-label="View">
        <MeltSegment value="list">List</MeltSegment>
        <MeltSegment value="board">Board</MeltSegment>
        <MeltSegment value="calendar">Calendar</MeltSegment>
      </MeltSegmentedControl>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
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
