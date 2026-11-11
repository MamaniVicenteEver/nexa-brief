import { forwardSessionApiRequest } from "@/infrastructure/api/session-api-proxy";

export const GET = (request: Request) =>
	forwardSessionApiRequest(request, "categories");
export const PATCH = (request: Request) =>
	forwardSessionApiRequest(request, "categories");
export const DELETE = (request: Request) =>
	forwardSessionApiRequest(request, "categories");
