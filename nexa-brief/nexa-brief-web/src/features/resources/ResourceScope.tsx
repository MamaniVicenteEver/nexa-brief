"use client";

import { createContext, type ReactNode, useContext } from "react";

export interface ResourceScope {
  categoryId?: string;
  templateId?: string;
}
const Context = createContext<ResourceScope>({});

/** Scoped editors inherit their resource ownership. Global Resources stays unfiltered. */
export function ResourceScopeProvider({
  scope,
  children,
}: {
  scope: ResourceScope;
  children: ReactNode;
}) {
  return <Context.Provider value={scope}>{children}</Context.Provider>;
}
export function useResourceScope() {
  return useContext(Context);
}
