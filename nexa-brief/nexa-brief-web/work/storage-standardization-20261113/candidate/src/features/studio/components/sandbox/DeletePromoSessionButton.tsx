"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { deletePromoSession, promoSessionKey, promoSessionsKey, type PromoSession } from "../../api/promo-service";
import { draftsKey } from "../../hooks/useDraft";

export function DeletePromoSessionButton({ session, name }: { session: PromoSession; name: string }) {
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deletePromoSession(session.session_id),
    onSuccess: () => {
      client.removeQueries({ queryKey: promoSessionKey(session.session_id) });
      void client.invalidateQueries({ queryKey: promoSessionsKey(session.template_id) });
      void client.invalidateQueries({ queryKey: draftsKey(session.template_id) });
    },
  });
  return <span className="shrink-0">
    <button type="button" aria-label={`Borrar prototipo: ${name}`} title="Borrar prototipo"
      disabled={remove.isPending || session.state === "queued" || session.state === "running"}
      onClick={() => { if (window.confirm(`¿Eliminar «${name}» de la lista de prototipos? Se conservarán sus archivos y revisiones.`)) remove.mutate(); }}
      className="rounded-full p-2 text-nb-mute hover:bg-nb-bg-2 hover:text-nb-accent-coral disabled:opacity-40">
      <Trash2 className="size-3.5" />
    </button>
    {remove.error && <span role="alert" className="block text-xs text-nb-accent-coral">{remove.error.message}</span>}
  </span>;
}
