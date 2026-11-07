import { describe, it, expect } from "vitest";
import { parseErrorBody } from "@/infrastructure/api/api-error";
describe("errores del contrato HTTP de publicaciones", () => {
	it("conserva el mensaje y el código de un rechazo de permisos", () => {
		const error = parseErrorBody(422, {
			detail: {
				code: "ATTRIBUTION_COMMENT_REQUIRED",
				message: "Falta autorizar comentarios",
			},
		});
		expect(error.status).toBe(422);
		expect(error.code).toBe("ATTRIBUTION_COMMENT_REQUIRED");
		expect(error.message).toBe("Falta autorizar comentarios");
	});
	it("mantiene errores de campos y diferencia un rechazo de una desconexión", () => {
		expect(
			parseErrorBody(422, {
				detail: [{ loc: ["body", "revision"], msg: "Revisión requerida" }],
			}).fieldErrors,
		).toEqual([{ path: "revision", message: "Revisión requerida" }]);
		expect(parseErrorBody(500, null).message).toContain("HTTP 500");
		expect(
			parseErrorBody(401, { detail: "Autenticación requerida" }).message,
		).toBe("Autenticación requerida");
	});
});
