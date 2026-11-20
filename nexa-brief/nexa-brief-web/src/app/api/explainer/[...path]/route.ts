import { forwardSessionApiRequest } from "@/infrastructure/api/session-api-proxy";

export const GET = (request: Request) =>
	forwardSessionApiRequest(request, "explainer");
export const POST = (request: Request) =>
	forwardSessionApiRequest(request, "explainer");
export const PUT = (request: Request) =>
	forwardSessionApiRequest(request, "explainer");
export const DELETE = (request: Request) =>
	forwardSessionApiRequest(request, "explainer");
