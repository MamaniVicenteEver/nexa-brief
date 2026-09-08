import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import path from "node:path";
import type { RenderInput } from "../engines/port.js";

// Delimitadores de HTML, JSX y CSS url(...). Para URLs con paréntesis reales,
// el autor puede envolver la URL en comillas, que es la forma portable en CSS.
const URL_PATTERN = /https?:\/\/[^\s"'`<>{}\\)]+/g;
const MIME_EXTENSION: Record<string, string> = {
  "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/ogg": ".ogg",
  "video/mp4": ".mp4", "video/webm": ".webm", "image/jpeg": ".jpg", "image/png": ".png",
  "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg", "application/json": ".json",
  "text/css": ".css", "text/javascript": ".js", "application/javascript": ".js",
};

export interface RemoteAssetOptions {
  workDir: string;
  allowlist: string[];
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
}

export interface ResolvedRemoteAssets {
  input: RenderInput;
  /** Ruta local para el mux de Playwright; undefined si no hay audio separado. */
  audioPath?: string;
  /** URL local equivalente para un motor que consume la pista dentro del navegador. */
  audioUrl?: string;
  origin: string;
  /** Recursos inmutables materializados para este job. No contiene secretos. */
  assetDir: string;
  assets: DownloadedAsset[];
  count: number;
  stop(): Promise<void>;
}

interface DownloadedAsset {
  source: string;
  localPath: string;
  fileName: string;
}

/**
 * Convierte referencias http(s) declaradas de forma estática en HTML/CSS/JS/JSX
 * en archivos locales por job. El navegador de cada motor los consume desde un
 * servidor loopback temporal: se evita depender de un CDN a mitad del render y
 * no se abre la red sin límites.
 */
export async function resolveRemoteAssets(
  input: RenderInput,
  audioUrl: string | undefined,
  options: RemoteAssetOptions,
): Promise<ResolvedRemoteAssets> {
  const sources = input.kind === "html"
    ? [input.html, input.css ?? "", input.js ?? ""]
    : [input.componentSource, JSON.stringify(input.props ?? {})];
  const remoteUrls = new Set(sources.flatMap(extractUrls));
  if (audioUrl && isRemoteUrl(audioUrl)) remoteUrls.add(audioUrl);

  const assetDir = path.join(options.workDir, "remote-assets");
  await mkdir(assetDir, { recursive: true });
  const assets = new Map<string, DownloadedAsset>();
  for (const url of remoteUrls) {
    const asset = await downloadAsset(url, assetDir, options);
    assets.set(url, asset);
  }

  const server = new LoopbackAssetServer(assetDir);
  const { origin } = await server.start();
  const rewrite = (value: string): string => {
    let rewritten = value;
    for (const [source, asset] of assets) rewritten = rewritten.replaceAll(source, `${origin}/${asset.fileName}`);
    return rewritten;
  };

  const resolvedInput: RenderInput = input.kind === "html"
    ? { kind: "html", html: rewrite(input.html), css: input.css ? rewrite(input.css) : undefined, js: input.js ? rewrite(input.js) : undefined }
    : { kind: "react", componentSource: rewrite(input.componentSource), props: rewriteProps(input.props, rewrite) };
  const remoteAudio = audioUrl ? assets.get(audioUrl) : undefined;

  return {
    input: resolvedInput,
    audioPath: remoteAudio?.localPath ?? (audioUrl?.startsWith("file://") ? audioUrl.slice("file://".length) : undefined),
    audioUrl: remoteAudio ? `${origin}/${remoteAudio.fileName}` : undefined,
    origin,
    assetDir,
    assets: [...assets.values()],
    count: assets.size,
    stop: () => server.stop(),
  };
}

function extractUrls(value: string): string[] {
  return (value.match(URL_PATTERN) ?? [])
    .map(trimUrlPunctuation)
    .filter(isRemoteUrl)
    // Un SVG embebido suele declarar xmlns="http://www.w3.org/2000/svg".
    // Es un identificador de namespace, no una petición de red.
    .filter((url) => !isXmlNamespace(url));
}

function trimUrlPunctuation(value: string): string {
  return value.replace(/[),.;]+$/, "");
}

function isRemoteUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function isXmlNamespace(value: string): boolean {
  return value === "http://www.w3.org/2000/svg"
    || value === "https://www.w3.org/2000/svg"
    || value === "http://www.w3.org/1999/xlink"
    || value === "https://www.w3.org/1999/xlink";
}

function rewriteProps(props: Record<string, unknown> | undefined, rewrite: (value: string) => string): Record<string, unknown> | undefined {
  if (!props) return undefined;
  return JSON.parse(JSON.stringify(props), (_key, value: unknown) => typeof value === "string" ? rewrite(value) : value) as Record<string, unknown>;
}

async function downloadAsset(source: string, assetDir: string, options: RemoteAssetOptions): Promise<DownloadedAsset> {
  let current = new URL(source);
  for (let redirects = 0; redirects <= options.maxRedirects; redirects += 1) {
    await assertSafeRemoteUrl(current, options.allowlist);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(current, { redirect: "manual", signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Redirección sin Location desde '${current}'.`);
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new Error(`No se pudo descargar '${current}' (HTTP ${response.status}).`);
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > options.maxBytes) {
        throw new Error(`'${current}' supera REMOTE_ASSET_MAX_BYTES (${length} bytes).`);
      }
      if (!response.body) throw new Error(`'${current}' no devolvió contenido.`);
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
        total += chunk.byteLength;
        if (total > options.maxBytes) throw new Error(`'${current}' supera REMOTE_ASSET_MAX_BYTES (${options.maxBytes} bytes).`);
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      const extension = extensionFor(current, response.headers.get("content-type"));
      const fileName = `${createHash("sha256").update(source).digest("hex")}${extension}`;
      const localPath = path.join(assetDir, fileName);
      await writeFile(localPath, body);
      return { source, localPath, fileName };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`'${source}' excede REMOTE_ASSET_MAX_REDIRECTS (${options.maxRedirects}).`);
}

async function assertSafeRemoteUrl(url: URL, allowlist: string[]): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`Protocolo no permitido: '${url.protocol}'.`);
  if (!allowlist.includes(url.hostname)) throw new Error(`El dominio '${url.hostname}' no está en NETWORK_ALLOWLIST.`);
  if (isIpAddress(url.hostname)) throw new Error("No se permiten direcciones IP directas como recursos remotos.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error(`El dominio '${url.hostname}' no resuelve a una IP pública permitida.`);
  }
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) return address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd");
  const [a, b = -1] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function extensionFor(url: URL, contentType: string | null): string {
  const fromUrl = path.extname(url.pathname);
  if (/^\.[a-z0-9]{1,10}$/i.test(fromUrl)) return fromUrl.toLowerCase();
  return MIME_EXTENSION[contentType?.split(";")[0]?.toLowerCase() ?? ""] ?? ".bin";
}

class LoopbackAssetServer {
  private server: Server | null = null;

  constructor(private readonly rootDir: string) {}

  async start(): Promise<{ origin: string }> {
    this.server = createServer((req, res) => { void this.handle(req.url ?? "/", res); });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    const address = this.server.address();
    if (address === null || typeof address === "string") throw new Error("No se pudo iniciar el servidor local de recursos.");
    return { origin: `http://127.0.0.1:${address.port}` };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  private async handle(rawUrl: string, res: import("node:http").ServerResponse): Promise<void> {
    const pathname = decodeURIComponent(rawUrl.split("?")[0] ?? "/");
    const target = path.resolve(this.rootDir, `.${pathname}`);
    if (!target.startsWith(`${this.rootDir}${path.sep}`)) return void res.writeHead(403).end("Forbidden");
    try {
      const info = await stat(target);
      if (!info.isFile()) throw new Error("not a file");
      res.writeHead(200, { "Content-Length": info.size, "Content-Type": MIME_EXTENSION_TO_TYPE[path.extname(target).toLowerCase()] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*" });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
}

const MIME_EXTENSION_TO_TYPE: Record<string, string> = Object.fromEntries(Object.entries(MIME_EXTENSION).map(([type, extension]) => [extension, type]));
