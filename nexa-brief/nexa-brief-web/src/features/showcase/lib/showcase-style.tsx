"use client";

import { createContext, useContext } from "react";

/** Estilo visual elegido en la biblioteca; las vistas previas lo envían al motor como ?estilo=. */
export const ShowcaseStyleContext = createContext<string>("");
export const useShowcaseStyle = () => useContext(ShowcaseStyleContext);

export type ShowcaseStyle = { id: string; name: string; idea: string; formats: string[] };
export type ShowcaseStyles = { default: string | null; styles: ShowcaseStyle[] };
