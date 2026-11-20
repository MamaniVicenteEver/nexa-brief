import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandAccountPicker } from "@/shared/components/publish/BrandAccountPicker";
import { usePublishCategoryGroups } from "../hooks/usePublishCategoryGroups";

const data = vi.hoisted(() => ({
  categories: [
    { id: "node_motion", path: "node_motion", displayName: "NodeMotion" },
    { id: "node_tech", path: "node_tech", displayName: "NodeTech" },
  ],
  channels: [
    {
      platform: "youtube",
      alias: "motion-yt",
      name: "NODEMOTION",
      status: "requires_reauth",
      targetId: "yt",
    },
    { platform: "facebook", alias: "motion-fb", name: "NodeMotion", status: "ok", targetId: "fb" },
    {
      platform: "instagram",
      alias: "motion-ig",
      name: "Node Motion",
      status: "ok",
      targetId: "ig",
    },
    { platform: "facebook", alias: "tech-fb", name: "NodeTech", status: "ok", targetId: "tech" },
    {
      platform: "tiktok",
      alias: "custom-tt",
      name: "My custom account",
      status: "ok",
      targetId: "tt",
    },
  ],
  settings: [
    {
      id: "custom_music",
      displayName: "Música",
      members: [{ platform: "tiktok", targetId: "tt" }],
    },
  ],
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/categories", () => ({ useCategories: () => ({ data: data.categories }) }));
vi.mock("@/features/channels/hooks/useChannels", () => ({
  useChannels: () => ({ data: data.channels }),
}));
vi.mock("@/features/channels/hooks/useChannelCategorySettings", () => ({
  useChannelCategorySettings: () => ({ data: data.settings }),
}));
vi.mock("@/features/channels/api/channel-categories-service", () => ({
  getChannelCategoryMemberships: vi.fn().mockResolvedValue([]),
}));
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function Picker() {
  const { groups, unavailable, isLoading } = usePublishCategoryGroups();
  const [selected, onChange] = useState<string[]>([]);
  return (
    <>
      {isLoading ? (
        "Loading"
      ) : (
        <BrandAccountPicker
          groups={groups}
          selected={selected}
          onChange={onChange}
          isDisabled={(account) => unavailable.has(account.selector)}
        />
      )}
      <output aria-label="Selected accounts">{selected.join(",")}</output>
    </>
  );
}
afterEach(() => {
  cleanup();
  client?.clear();
});
describe("publication categories", () => {
  it("shows the same categories as Canales, even without an available YouTube account", async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<Picker />, { wrapper: Wrapper });
    const motion = await screen.findByRole("checkbox", { name: "NodeMotion" });
    expect(screen.getByRole("checkbox", { name: "NodeTech" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Música" })).toBeTruthy();
    expect(screen.queryByText("Otros")).toBeNull();
    fireEvent.click(motion);
    await waitFor(() =>
      expect(screen.getByLabelText("Selected accounts").textContent).toBe(
        "facebook:motion-fb,instagram:motion-ig",
      ),
    );
    expect((screen.getByRole("checkbox", { name: /youtube/ }) as HTMLInputElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /instagram/ }));
    expect((motion as HTMLInputElement).indeterminate).toBe(true);
    fireEvent.click(motion);
    expect((motion as HTMLInputElement).checked).toBe(true);
    fireEvent.click(motion);
    expect(screen.getByLabelText("Selected accounts").textContent).toBe("");
    fireEvent.click(screen.getByRole("checkbox", { name: "Música" }));
    expect(screen.getByLabelText("Selected accounts").textContent).toBe("tiktok:custom-tt");
  });
});
