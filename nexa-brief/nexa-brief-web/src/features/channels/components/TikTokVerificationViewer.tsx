"use client";

import { useEffect, useRef, useState } from "react";

/** The URL must address an authenticated same-origin bridge, never contain a service key. */
export function TikTokVerificationViewer({
  url,
  onResolved,
}: {
  url: string;
  onResolved: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const socket = useRef<WebSocket | null>(null);
  const onResolvedRef = useRef(onResolved);
  const [status, setStatus] = useState("Conectando con el navegador...");
  onResolvedRef.current = onResolved;

  useEffect(() => {
    const ws = new WebSocket(url);
    socket.current = ws;
    ws.onopen = () => setStatus("Conectado. Hacé clic en la pantalla para usar el teclado.");
    ws.onclose = () => setStatus("El visor se cerró o venció el tiempo disponible.");
    ws.onerror = () => setStatus("No se pudo conectar el visor.");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "resolved") {
        onResolvedRef.current();
        return;
      }
      if (message.type !== "frame" || typeof message.data !== "string") return;
      const image = new Image();
      image.onload = () => {
        const element = canvas.current;
        if (!element) return;
        element.width = message.metadata.deviceWidth || image.width;
        element.height = message.metadata.deviceHeight || image.height;
        element.getContext("2d")?.drawImage(image, 0, 0, element.width, element.height);
      };
      image.src = `data:image/jpeg;base64,${message.data}`;
    };
    return () => {
      socket.current = null;
      ws.close();
    };
  }, [url]);

  const send = (event: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(event));
  };
  const mouse = (event: React.PointerEvent<HTMLCanvasElement>, type: string) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    send({
      type: "mouse",
      event: type,
      x: ((event.clientX - rect.left) * event.currentTarget.width) / rect.width,
      y: ((event.clientY - rect.top) * event.currentTarget.height) / rect.height,
      button: type === "mouseMoved" ? "none" : "left",
      buttons: event.buttons,
    });
  };
  const key = (event: React.KeyboardEvent<HTMLCanvasElement>, type: string) => {
    event.preventDefault();
    send({
      type: "key",
      event: type,
      key: event.key,
      code: event.code,
      modifiers:
        Number(event.altKey) +
        2 * Number(event.ctrlKey) +
        4 * Number(event.metaKey) +
        8 * Number(event.shiftKey),
      keyCode: event.keyCode,
    });
  };
  return (
    <div className="space-y-3">
      <p>
        Esta ventana muestra la sesión real de la cuenta y todos los datos visibles en pantalla.
      </p>
      <p role="status">{status}</p>
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Pantalla del navegador de TikTok; hacé clic para enviar teclado"
        className="h-auto w-full border border-nb-line focus:outline-2"
        onPointerDown={(event) => {
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          mouse(event, "mousePressed");
        }}
        onPointerMove={(event) => mouse(event, "mouseMoved")}
        onPointerUp={(event) => mouse(event, "mouseReleased")}
        onKeyDown={(event) => key(event, "keyDown")}
        onKeyUp={(event) => key(event, "keyUp")}
      />
      <button type="button" onClick={() => send({ type: "resolved" })}>
        Ya resolví la verificación
      </button>
      <p>
        El trabajo original no se reiniciará. Enviá una publicación nueva con otra clave de
        idempotencia.
      </p>
    </div>
  );
}
