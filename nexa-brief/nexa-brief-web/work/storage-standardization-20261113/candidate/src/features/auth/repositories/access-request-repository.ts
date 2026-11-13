import type { AccessRequestRecord } from "../types";

export interface CreateAccessRequestInput {
  name: string;
  email: string;
  message: string;
  approveToken: string;
  approveTokenExpiresAt: string;
}

export interface AccessRequestRepository {
  create(input: CreateAccessRequestInput): Promise<AccessRequestRecord>;
  findById(id: string): Promise<AccessRequestRecord | null>;
  markApproved(id: string): Promise<AccessRequestRecord>;
}
