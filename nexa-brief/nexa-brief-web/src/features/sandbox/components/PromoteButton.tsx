"use client";
import { DesignProductionActions } from "./DesignProductionActions";
import type { SandboxItem } from "../types";
export function PromoteButton({ item }: { item: SandboxItem; folderLabel: string }) {
  return item.hasIndex ? <DesignProductionActions item={item} /> : null;
}
