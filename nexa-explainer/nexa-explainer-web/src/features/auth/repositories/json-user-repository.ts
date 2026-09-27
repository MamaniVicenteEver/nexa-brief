import { randomUUID } from "node:crypto";
import type { UserRecord } from "../types";
import { readJsonFile, writeJsonFile } from "./json-store";
import type { CreateUserInput, UserRepository } from "./user-repository";

const FILE_NAME = "users.json";

export class JsonUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const users = await readJsonFile<UserRecord>(FILE_NAME);
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const users = await readJsonFile<UserRecord>(FILE_NAME);
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeJsonFile(FILE_NAME, users);
    return user;
  }
}
