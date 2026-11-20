import { forwardImagePostsRequest } from "@/infrastructure/api/session-image-posts-proxy";

const forward = (request: Request) => forwardImagePostsRequest(request, "image-posts");

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
