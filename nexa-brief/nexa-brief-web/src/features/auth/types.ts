export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "editor";
  createdAt: string;
}

export type AccessRequestStatus = "pending" | "approved";

export interface AccessRequestRecord {
  id: string;
  name: string;
  email: string;
  message: string;
  status: AccessRequestStatus;
  approveToken: string;
  approveTokenExpiresAt: string;
  createdAt: string;
  resolvedAt?: string;
}
