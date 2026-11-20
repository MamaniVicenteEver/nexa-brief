import { randomUUID } from "node:crypto";
import type { AccessRequestRecord } from "../types";
import type {
  AccessRequestRepository,
  CreateAccessRequestInput,
} from "./access-request-repository";
import { mutateJsonFile, readJsonFile } from "./json-store";

const FILE_NAME = "access-requests.json";

export class JsonAccessRequestRepository implements AccessRequestRepository {
  async create(input: CreateAccessRequestInput): Promise<AccessRequestRecord> {
    return mutateJsonFile<AccessRequestRecord, AccessRequestRecord>(FILE_NAME, (requests) => {
      const request: AccessRequestRecord = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        message: input.message,
        status: "pending",
        approveToken: input.approveToken,
        approveTokenExpiresAt: input.approveTokenExpiresAt,
        createdAt: new Date().toISOString(),
      };
      requests.push(request);
      return { records: requests, result: request };
    });
  }

  async findById(id: string): Promise<AccessRequestRecord | null> {
    const requests = await readJsonFile<AccessRequestRecord>(FILE_NAME);
    return requests.find((request) => request.id === id) ?? null;
  }

  async markApproved(id: string): Promise<AccessRequestRecord> {
    return mutateJsonFile<AccessRequestRecord, AccessRequestRecord>(FILE_NAME, (requests) => {
      const index = requests.findIndex((request) => request.id === id);
      if (index === -1) {
        throw new Error(`Access request ${id} not found`);
      }
      const updated: AccessRequestRecord = {
        ...requests[index],
        status: "approved",
        resolvedAt: new Date().toISOString(),
      };
      requests[index] = updated;
      return { records: requests, result: updated };
    });
  }
}
