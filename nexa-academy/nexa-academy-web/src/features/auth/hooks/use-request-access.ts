import { useMutation } from "@tanstack/react-query";
import type { AccessRequestInput } from "../schema";

async function postAccessRequest(input: AccessRequestInput): Promise<void> {
  const res = await fetch("/api/access-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("No se pudo enviar la solicitud");
  }
}

export function useRequestAccess() {
  return useMutation({ mutationFn: postAccessRequest });
}
