import { NextResponse } from "next/server";
import { auth } from "../../../auth";

type Resource = "image-posts" | "publications";

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const name of ["content-type", "etag", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function rewritePreviewUrls(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/^\/api\/v1\/image-posts\//, "/api/image-posts/");
  }
  if (Array.isArray(value)) return value.map(rewritePreviewUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewritePreviewUrls(item)]),
    );
  }
  return value;
}

export async function forwardImagePostsRequest(request: Request, resource: Resource) {
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
  const role = user.role;
  headers.set("X-Nexa-Session-Role", role === "admin" ? "admin" : "editor");

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });
  const outgoingHeaders = responseHeaders(upstream);
  if (upstream.headers.get("content-type")?.includes("application/json")) {
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(rewritePreviewUrls(payload), {
      status: upstream.status,
      headers: outgoingHeaders,
    });
  }
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: outgoingHeaders,
  });
}
