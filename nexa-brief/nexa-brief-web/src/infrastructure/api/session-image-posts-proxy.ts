import { forwardSessionApiRequest } from "./session-api-proxy";

type Resource = "image-posts" | "publications";

function rewritePreviewUrls(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/^\/api\/v1\/image-posts\//, "/api/image-posts/");
  }
  if (Array.isArray(value)) return value.map(rewritePreviewUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewritePreviewUrls(item)]),
    );
  }
  return value;
}

export async function forwardImagePostsRequest(request: Request, resource: Resource) {
  return forwardSessionApiRequest(request, resource, rewritePreviewUrls);
}
