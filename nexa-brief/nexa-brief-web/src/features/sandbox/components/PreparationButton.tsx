"use client";
// Compatibility component: Sandbox preparation is always technical, without AI.
import { DesignProductionActions } from "./DesignProductionActions";
import type { SandboxItem } from "../types";
export function PreparationButton({ item }: { item: SandboxItem }) {
  return <DesignProductionActions item={item} />;
}
