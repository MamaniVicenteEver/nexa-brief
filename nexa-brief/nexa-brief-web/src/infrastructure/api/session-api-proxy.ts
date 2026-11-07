import { NextResponse } from "next/server";
import { auth } from "../../../auth";

type Resource = "image-posts" | "publications" | "showcase";

export async function forwardSessionApiRequest(
  request: Request,
  resource: Resource,
  transformJson: (value: unknown) => unknown = (value) => value,
) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!session?.user || !email) {
    return NextResponse.json({ detail: "Autenticación requerida." }, { status: 401 });
  }
  const internalToken = process.env.NEXA_INTERNAL_TOKEN;
  if (!internalToken) {
    return NextResponse.json(
      { detail: "La integración interna con la API no está configurada." },
      { status: 503 },
    );
  }
  const incoming = new URL(request.url);
  const prefix = `/api/${resource}`;
  if (incoming.pathname !== prefix && !incoming.pathname.startsWith(`${prefix}/`)) {
    return NextResponse.json({ detail: "Ruta inválida." }, { status: 404 });
  }
  const suffix = incoming.pathname.slice(prefix.length);
  const apiBase = new URL(process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8000");
  const target = new URL(`/api/v1/${resource}${suffix}${incoming.search}`, apiBase.origin);
  const headers = new Headers({ Accept: request.headers.get("accept") ?? "application/json" });
  for (const name of ["content-type", "idempotency-key", "if-match"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Nexa-Internal", internalToken);
  headers.set("X-Nexa-Session-User", email);
  const user = session.user as typeof session.user & { role?: string };
  headers.set("X-Nexa-Session-Role", user.role === "admin" ? "admin" : "editor");
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });
  const outgoing = new Headers();
  for (const name of ["content-type", "etag", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  if (upstream.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(transformJson(await upstream.json().catch(() => null)), {
      status: upstream.status,
      headers: outgoing,
    });
  }
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: outgoing });
}
