import { afterEach, expect, it, vi } from "vitest";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DesignProductionDialog } from "../components/DesignProductionActions";
import {
	productionWorkflow,
	type ProductionStatus,
} from "../api/production-workflow";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/categories/hooks/useCategories", () => ({
	useCategories: () => ({
		data: [
			{
				id: "node_atlas",
				path: "node_atlas",
				displayName: "NodeAtlas",
				engine: "explainer_kit",
				status: "active",
			},
			{
				id: "new",
				path: "new",
				displayName: "Empty category",
				engine: "explainer_kit",
				status: "empty",
			},
		],
	}),
}));
vi.mock("@/features/categories/components/CategoryManager", () => ({
	CategoryManager: () => null,
}));
vi.mock("../components/PreparationButton", () => ({
	PreparationButton: () => null,
}));
vi.mock("../api/production-workflow", () => ({
	productionWorkflow: {
		get: vi.fn(),
		save: vi.fn(),
		validate: vi.fn(),
		pass: vi.fn(),
		discard: vi.fn(),
	},
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const initial: ProductionStatus = {
	folder: "nodepolitics",
	project_id: "demo",
	design_id: "sandbox-demo",
	state: "draft",
	draft: {
		category: "node_atlas",
		shared_categories: [],
		title: "Demo",
		description: "Demo description",
		demo: true,
		publication: {},
	},
	can_pass: false,
	issues: [],
	warnings: [],
	error: null,
	component_count: 1,
	destination: "bundled/nodeatlas/demo",
};
function mount(status = initial) {
	vi.mocked(productionWorkflow.get).mockResolvedValue(status);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<DesignProductionDialog
				item={{ folder: "nodepolitics", id: "demo" }}
				open
				onOpenChange={() => {}}
			/>
		</QueryClientProvider>,
	);
}

it("requires validation before passing the complete design and offers empty categories", async () => {
	mount();
	await screen.findByText("states.draft");
	expect(
		(screen.getByRole("button", { name: "pass" }) as HTMLButtonElement)
			.disabled,
	).toBe(true);
	expect(screen.getByRole("option", { name: "Empty category" })).toBeDefined();
	expect(productionWorkflow.pass).not.toHaveBeenCalled();
});

it("saves the reviewed draft, validates it, then passes once with its selected categories", async () => {
	mount();
	await screen.findByText("states.draft");
	const ready: ProductionStatus = {
		...initial,
		state: "ready",
		can_pass: true,
	};
	vi.mocked(productionWorkflow.save).mockResolvedValue(initial);
	vi.mocked(productionWorkflow.validate).mockResolvedValue(ready);
	vi.mocked(productionWorkflow.pass).mockResolvedValue({
		...ready,
		state: "production",
		can_pass: false,
	});
	fireEvent.click(screen.getByRole("button", { name: "validate" }));
	await screen.findByText("states.ready");
	expect(productionWorkflow.save).toHaveBeenCalledWith(
		"nodepolitics",
		"demo",
		initial.draft,
	);
	fireEvent.click(screen.getByRole("button", { name: "pass" }));
	await waitFor(() => expect(productionWorkflow.pass).toHaveBeenCalledTimes(1));
	expect(productionWorkflow.pass).toHaveBeenCalledWith(
		"nodepolitics",
		"demo",
		initial.draft,
	);
});

it("disables passing when the reviewed selection has unsaved edits", async () => {
	mount({ ...initial, state: "ready", can_pass: true });
	await screen.findByText("states.ready");
	fireEvent.change(screen.getByLabelText("mainCategory"), {
		target: { value: "new" },
	});
	expect(
		(screen.getByRole("button", { name: "pass" }) as HTMLButtonElement)
			.disabled,
	).toBe(true);
	expect(productionWorkflow.pass).not.toHaveBeenCalled();
});

it("keeps Original selected and only includes Dynamic News when the user selects it", async () => {
  const status = { ...initial, styles: [{ id: "original", name: "Original" }, { id: "dynamic-news", name: "Dynamic News" }], draft: { ...initial.draft, poster_styles: ["original"] } };
  mount(status);
  await screen.findByText("states.draft");
  expect((screen.getByRole("checkbox", { name: "Original" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Dynamic News" }) as HTMLInputElement).checked).toBe(false);
  vi.mocked(productionWorkflow.save).mockResolvedValue(status);
  fireEvent.click(screen.getByRole("button", { name: "validate" }));
  await waitFor(() => expect(productionWorkflow.save).toHaveBeenCalledWith("nodepolitics", "demo", status.draft));
});
