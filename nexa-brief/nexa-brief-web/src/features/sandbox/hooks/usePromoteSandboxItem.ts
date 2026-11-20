import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EXPLAINER_VIDEOS_QUERY_KEY } from "@/features/explainer/hooks/useExplainer";
import { promoteSandboxItem } from "../api/sandbox-service";
import { SANDBOX_QUERY_KEY } from "./useSandbox";

export function usePromoteSandboxItem() {
  const queryClient = useQueryClient();
  const t = useTranslations("sandbox");

  return useMutation({
    mutationFn: ({ folder, id, category, sharedCategories }: { folder: string; id: string; category: string; sharedCategories: string[] }) => promoteSandboxItem(folder, id, category, sharedCategories),
    onSuccess: async (result) => {
      toast.success(t("promoteSuccess", { path: result.toPath }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SANDBOX_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: EXPLAINER_VIDEOS_QUERY_KEY }),
      ]);
    },
  });
}
