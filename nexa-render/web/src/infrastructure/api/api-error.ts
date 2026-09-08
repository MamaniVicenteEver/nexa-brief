export interface FieldError {
  path: string;
  message: string;
}

/**
 * Mismo contrato que ya documenta nexa-brief-server/docs/api-videos-frontend.md
 * y que replica server/src/api/error-mapper.ts de este proyecto — string en
 * `detail` para errores de negocio, array de {loc,msg} en 422 de validación.
 * Portado casi literal de nexa-brief-web/src/infrastructure/api/api-error.ts.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

function isValidationIssues(value: unknown): value is ValidationIssue[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item && typeof item === "object" && "loc" in item && "msg" in item)
  );
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  const detail =
    body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;

  if (isValidationIssues(detail)) {
    const fieldErrors = detail.map((issue) => ({ path: issue.loc.join("."), message: issue.msg }));
    return new ApiError(
      status,
      fieldErrors[0]?.message ?? "Revisá los campos marcados",
      fieldErrors,
    );
  }

  if (typeof detail === "string") {
    return new ApiError(status, detail);
  }

  return new ApiError(status, "Error de conexión con el servidor");
}
