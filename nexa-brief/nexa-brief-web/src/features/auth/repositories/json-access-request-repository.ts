import { randomUUID } from "node:crypto";
import type { AccessRequestRecord } from "../types";
import type {
  AccessRequestRepository,
  CreateAccessRequestInput,
} from "./access-request-repository";
import { readJsonFile, writeJsonFile } from "./json-store";

const FILE_NAME = "access-requests.json";

export class JsonAccessRequestRepository implements AccessRequestRepository {
  async create(input: CreateAccessRequestInput): Promise<AccessRequestRecord> {
    const requests = await readJsonFile<AccessRequestRecord>(FILE_NAME);
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
    await writeJsonFile(FILE_NAME, requests);
    return request;
  }

  async findById(id: string): Promise<AccessRequestRecord | null> {
    const requests = await readJsonFile<AccessRequestRecord>(FILE_NAME);
    return requests.find((request) => request.id === id) ?? null;
  }

  async markApproved(id: string): Promise<AccessRequestRecord> {
    const requests = await readJsonFile<AccessRequestRecord>(FILE_NAME);
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
    await writeJsonFile(FILE_NAME, requests);
    return updated;
  }
}
