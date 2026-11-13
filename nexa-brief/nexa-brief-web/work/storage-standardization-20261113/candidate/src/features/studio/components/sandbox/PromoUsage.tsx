import type { PromoUsageData } from "../../api/promo-service";

function number(value: number | null | undefined): string {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value.toLocaleString("es")
		: "Desconocido";
}

/** El uso declarado es informativo y puede estar incompleto. */
export function PromoUsage({
	usage,
}: {
	usage: PromoUsageData | null | undefined;
}) {
	const steps = usage?.steps ?? [];
	const totals = usage?.totals;
	const known = totals?.known_total_tokens ?? totals?.total_tokens;
	return (
		<details className="my-2 text-xs">
			<summary className="cursor-pointer font-semibold">Uso de agentes</summary>
			<p className="mt-1">
				Tokens de modelos conocidos: {number(known)}
				{totals?.total_tokens == null ? " (total completo desconocido)" : ""}.
				Intentos de modelo con uso incompleto:{" "}
				{number(totals?.unknown_model_attempts)}.
			</p>
			<p>
				El coste indicado es una estimación informada por el proveedor, no una
				factura; cuando la base es «list» corresponde a tarifas de lista.
			</p>
			{steps.length === 0 ? (
				<p>No hay uso informado.</p>
			) : (
				<div className="max-w-full overflow-x-auto">
					<table className="mt-2 min-w-max text-left">
						<caption className="sr-only">Uso por etapa y proveedor</caption>
						<thead>
							<tr>
								{[
									"Etapa",
									"Proveedor",
									"Modelo",
									"Esfuerzo",
									"Entrada",
									"Caché",
									"Salida",
									"Total",
									"Segundos",
									"Coste USD",
									"Base",
								].map((label) => (
									<th key={label} scope="col" className="pr-3">
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{steps.map((step, i) => (
								<tr key={i} className="border-t border-nb-line">
									{[
										step.stage || "Desconocida",
										step.provider || "Desconocido",
										step.model || "Desconocido",
										step.reasoning_effort || "Desconocido",
										number(step.input_tokens),
										number(step.cached_input_tokens),
										number(step.output_tokens),
										number(step.total_tokens),
										number(step.seconds),
										number(step.cost_usd),
										step.cost_basis === "list"
											? "Tarifa de lista"
											: step.cost_basis || "Desconocida",
									].map((value, j) => (
										<td key={j} className="pr-3 py-1">
											{value}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</details>
	);
}
