import { httpClient } from "@/infrastructure/api/http-client";
import type {
  CategoryAccountIdentity,
  CategoryMembership,
  ManagedChannelCategory,
} from "../lib/category-groups";

interface CategorySettingsDto {
  category_id: string;
  display_name: string;
  members: { platform: CategoryAccountIdentity["platform"]; target_id: string }[];
}

function mapSettings(dto: CategorySettingsDto): ManagedChannelCategory {
  return {
    id: dto.category_id,
    displayName: dto.display_name,
    members: dto.members.map((member) => ({
      platform: member.platform,
      targetId: member.target_id,
    })),
  };
}

export async function getChannelCategorySettings(
  signal?: AbortSignal,
): Promise<ManagedChannelCategory[]> {
  const rows = await httpClient<CategorySettingsDto[]>("/api/v1/publish/account-categories", {
    signal,
  });
  return rows.map(mapSettings);
}

export async function saveChannelCategory({
  id,
  displayName,
  members,
}: {
  id?: string;
  displayName: string;
  members: CategoryAccountIdentity[];
}): Promise<ManagedChannelCategory> {
  const dto = await httpClient<CategorySettingsDto>(
    id
      ? `/api/v1/publish/account-categories/${encodeURIComponent(id)}/members`
      : "/api/v1/publish/account-categories",
    {
      method: id ? "PUT" : "POST",
      body: {
        ...(id ? {} : { display_name: displayName }),
        members: members.map((member) => ({
          platform: member.platform,
          target_id: member.targetId,
        })),
      },
    },
  );
  return mapSettings(dto);
}

export async function getChannelCategoryMemberships(
  categoryId: string,
  signal?: AbortSignal,
): Promise<CategoryMembership[]> {
  const response = await httpClient<{
    accounts: { platform: CategoryMembership["platform"]; alias: string }[];
  }>(`/api/image-posts/capabilities?category_id=${encodeURIComponent(categoryId)}`, {
    sameOrigin: true,
    signal,
  });
  return response.accounts.map((account) => ({
    categoryId,
    platform: account.platform,
    alias: account.alias,
  }));
}
