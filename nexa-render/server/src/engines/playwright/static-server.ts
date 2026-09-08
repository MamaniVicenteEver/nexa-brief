import { createServer, type Server } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

/**
 * Sirve `rootDir` por HTTP en un puerto efímero de loopback.
 *
 * Necesario porque un navegador headless con `fetch()`/CSS `url()` rechaza
 * `file://` en muchos contextos (mismo motivo documentado en
 * `playwright_ffmpeg_adapter.py` de nexa-brief-server) — servir por HTTP
 * evita ese problema sin tener que relajar políticas de seguridad del browser.
 */
export class EphemeralStaticServer {
  private server: Server | null = null;
  private port = 0;

  constructor(private readonly rootDir: string) {}

  async start(): Promise<{ origin: string; port: number }> {
    this.server = createServer((req, res) => {
      void this.handle(req.url ?? "/", res);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, "127.0.0.1", resolve);
    });

    const address = this.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("No se pudo obtener el puerto del servidor estático efímero.");
    }
    this.port = address.port;
    return { origin: `http://127.0.0.1:${this.port}`, port: this.port };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  private async handle(url: string, res: import("node:http").ServerResponse): Promise<void> {
    const pathname = decodeURIComponent(url.split("?")[0] ?? "/");
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(this.rootDir, safePath === "/" ? "index.html" : safePath);

    if (!filePath.startsWith(this.rootDir)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) throw new Error("not a file");
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
}
