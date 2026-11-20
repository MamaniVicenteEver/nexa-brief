import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { VideoUsageModelDetails } from "../components/VideoUsageModelDetails";

afterEach(cleanup);
it("shows normalized Claude metrics, reasoning subset and reported list cost", () => {
  render(
    <VideoUsageModelDetails
      locale="es"
      row={{
        provider: "claude",
        model: "claude-haiku-5-5",
        fresh_input_tokens: 39905,
        cache_creation_input_tokens: 39887,
        cached_input_tokens: 240686,
        output_tokens: 28150,
        reasoning_tokens: 19185,
        reasoning_included_in_output: true,
        usage_known: true,
        calls: 1,
        failed_calls: 0,
        seconds: 117.77,
        reported_cost_usd: 0.02446106,
        cost_basis: "list",
      }}
    />,
  );
  expect(screen.getByText(/Entrada \(incluye creación de caché\):/).textContent).toContain(
    "39.905",
  );
  expect(screen.getByText(/Entrada \(incluye creación de caché\):/).textContent).toContain(
    "240.686",
  );
  expect(screen.getByText(/Razonamiento \(incluido en salida\)/).textContent).toContain("19.185");
  expect(screen.getByText(/Costo informado:/).textContent).toContain("0,024461");
  expect(screen.getByText("Referencia de precio de lista del proveedor")).toBeTruthy();
});
it("keeps unknown costs distinct from reported zero and does not invent tokens", () => {
  const view = render(
    <VideoUsageModelDetails
      locale="es"
      row={{
        provider: "whisper",
        model: "large-v3",
        usage_known: false,
        reported_cost_usd: null,
      }}
    />,
  );
  expect(screen.getByText("Tokens no informados")).toBeTruthy();
  expect(screen.getByText("Costo no informado")).toBeTruthy();
  view.rerender(
    <VideoUsageModelDetails
      locale="en"
      row={{
        provider: "claude",
        model: "test",
        reported_cost_usd: 0,
        unknown_cost_calls: 2,
      }}
    />,
  );
  expect(screen.getByText("Reported cost: $0.00")).toBeTruthy();
  expect(screen.getByText("Calls with unreported cost: 2")).toBeTruthy();
});
