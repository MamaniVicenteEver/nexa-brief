import { forwardSessionApiRequest } from "@/infrastructure/api/session-api-proxy";

export const PUT = (request: Request) => forwardSessionApiRequest(request, "showcase");
