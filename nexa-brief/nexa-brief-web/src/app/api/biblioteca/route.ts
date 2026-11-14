import { forwardSessionApiRequest } from "@/infrastructure/api/session-api-proxy";

export const GET = (request: Request) => forwardSessionApiRequest(request, "biblioteca");
