import { forwardSessionApiRequest } from "@/infrastructure/api/session-api-proxy";

export const GET = (request: Request) =>
	forwardSessionApiRequest(request, "categories");
export const POST = (request: Request) =>
	forwardSessionApiRequest(request, "categories");
