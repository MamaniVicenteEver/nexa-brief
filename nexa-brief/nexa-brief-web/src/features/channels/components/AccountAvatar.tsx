"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChannelAccount } from "../types";
import { PlatformIcon } from "./PlatformIcon";

const SIZES = {
  md: { box: "size-11", text: "text-[16px]", badge: "size-5 -right-0.5 -bottom-0.5" },
  lg: { box: "size-16", text: "text-[22px]", badge: "size-6.5 -right-1 -bottom-1" },
} as const;

export function AccountAvatar({
  account,
  size = "md",
}: {
  account: Pick<ChannelAccount, "avatar" | "name" | "alias" | "platform">;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
  const initial = (account.name || account.alias).trim().charAt(0).toUpperCase() || "?";

  return (
    <span className={cn("relative inline-block shrink-0", s.box)}>
      {account.avatar && !failed ? (
        <img
          src={account.avatar}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn("rounded-full object-cover ring-1 ring-nb-line", s.box)}
        />
      ) : (
        <span
          className={cn(
            "grid place-items-center rounded-full bg-nb-bg-2 font-extrabold text-nb-ink-soft ring-1 ring-nb-line",
            s.box,
            s.text,
          )}
        >
          {initial}
        </span>
      )}
      <PlatformIcon
        platform={account.platform}
        rounded="rounded-full"
        className={cn("absolute ring-2 ring-nb-surface", s.badge)}
      />
    </span>
  );
}
