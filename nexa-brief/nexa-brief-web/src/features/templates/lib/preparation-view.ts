import { createContext, useContext } from "react";

export type PreparationView = "preparation" | "rendered";

export const PreparationViewContext = createContext<PreparationView | null>(null);

export function usePreparationView() {
  return useContext(PreparationViewContext);
}
