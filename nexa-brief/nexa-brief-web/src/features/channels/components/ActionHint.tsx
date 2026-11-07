"use client";

import { Tooltip } from "radix-ui";
import type { ReactElement } from "react";

export function ActionHint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            collisionPadding={12}
            className="z-[60] max-w-64 rounded-lg bg-nb-ink px-3 py-2 text-xs text-white shadow-md"
          >
            {label}
            <Tooltip.Arrow className="fill-nb-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
