export interface FieldError {
  path: string;
  message: string;
}

/**
 * Normaliza los dos shapes de error que devuelve el backend FastAPI:
 * `{"detail": "<string>"}` (400/401/500) y `{"detail": [{"loc","msg",...}]}` (422).
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

interface PydanticValidationIssue {
  loc: (string | number)[];
  msg: string;
}

function isPydanticValidationIssues(value: unknown): value is PydanticValidationIssue[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item && typeof item === "object" && "loc" in item && "msg" in item)
  );
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  const detail =
    body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;

  if (status === 422 && isPydanticValidationIssues(detail)) {
    const fieldErrors: FieldError[] = detail.map((issue) => ({
      path: issue.loc.slice(1).join("."),
      message: issue.msg,
    }));
    return new ApiError(
      status,
      fieldErrors[0]?.message ?? "Revisa los campos marcados",
      fieldErrors,
    );
  }

  if (typeof detail === "string") {
    return new ApiError(status, detail);
  }

  return new ApiError(status, "Error de conexión con el servidor");
}
