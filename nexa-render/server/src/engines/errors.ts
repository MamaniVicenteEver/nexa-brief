/** Base class for all engine-layer failures — carries an HTTP-shaped status
 * so the API layer can map it to `{ detail: string }` without re-deriving
 * what kind of error it was (mirrors src/config/exceptions.py's
 * NexaBriefError-subclass pattern in nexa-brief-server). */
export class EngineError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class EngineNotImplementedError extends EngineError {
  constructor(engine: string) {
    super(`El motor '${engine}' todavía no está implementado (ver el README de server/ para el estado por fase).`, 501);
  }
}

export class RenderError extends EngineError {
  constructor(message: string) {
    super(message, 500);
  }
}

export class RenderTimeoutError extends EngineError {
  constructor(timeoutMs: number) {
    super(`El render superó el límite de tiempo (${timeoutMs}ms).`, 504);
  }
}
