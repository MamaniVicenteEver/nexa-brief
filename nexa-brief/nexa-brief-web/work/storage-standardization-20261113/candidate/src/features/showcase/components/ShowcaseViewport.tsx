"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The video keeps the same landscape stage while its mobile screen becomes 9:16. */
export function ShowcaseViewport({ format, children }: { format: string; children: ReactNode }) {
  const mobile = format === "9x16";
  return (
    <div
      data-preview-frame
      className={cn(
        "relative mx-auto w-full max-w-full max-h-[74vh] overflow-hidden rounded-[18px] transition-colors duration-500 motion-reduce:transition-none",
        mobile ? "bg-[#4b515c]" : "bg-black",
      )}
      style={{ aspectRatio: "16 / 9", containerType: "size" }}
    >
      <div
        data-phone-frame={mobile ? "true" : undefined}
        className={cn(
          "absolute top-1/2 left-1/2 box-border -translate-x-1/2 -translate-y-1/2 bg-black transition-[width,height,padding,border-radius,box-shadow] duration-500 ease-in-out motion-reduce:transition-none",
          mobile && "rounded-[24px] p-[6px] shadow-[0_5px_22px_rgba(0,0,0,0.48),0_0_0_1px_#808691]",
        )}
        style={{
          width: mobile ? "min(calc(100% - 12px), calc(56.25cqh + 1.875px))" : "100%",
          height: mobile ? "calc(100% - 6px)" : "100%",
        }}
      >
        <div
          className={cn("relative size-full overflow-hidden bg-black", mobile && "rounded-[18px]")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
