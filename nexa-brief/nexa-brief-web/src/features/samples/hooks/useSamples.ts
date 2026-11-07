"use client";

import { useQuery } from "@tanstack/react-query";
import { getSamples } from "../api/samples-repository";

export function useSamples() {
  return useQuery({
    queryKey: ["content", "samples"],
    queryFn: ({ signal }) => getSamples(signal),
    staleTime: 60_000,
    retry: false,
  });
}
