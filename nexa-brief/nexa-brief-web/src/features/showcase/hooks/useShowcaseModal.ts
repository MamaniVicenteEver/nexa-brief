import { useCallback, useState } from "react";
import type { FormatId, Item } from "../types";

export function useShowcaseModal() {
  const [active, setActive] = useState<Item | null>(null);
  const [format, setFormat] = useState<FormatId>("16x9");
  const open = useCallback((item: Item) => {
    setFormat("16x9");
    setActive(item);
  }, []);
  const close = useCallback(() => setActive(null), []);
  return { active, open, close, format, setFormat };
}
