import type { AccessRequestRepository } from "./access-request-repository";
import { JsonAccessRequestRepository } from "./json-access-request-repository";
import { JsonUserRepository } from "./json-user-repository";
import { authStorageBackend } from "./storage-profile";
import type { UserRepository } from "./user-repository";

type AuthProvider = { users(): UserRepository; requests(): AccessRequestRepository };
const providers = new Map<string, AuthProvider>();
export function registerAuthProvider(name: string, provider: AuthProvider) {
  providers.set(name, provider);
}
function selectedProvider() {
  const name = authStorageBackend();
  if (name === "json")
    return {
      users: () => new JsonUserRepository(),
      requests: () => new JsonAccessRequestRepository(),
    };
  const provider = providers.get(name);
  if (!provider) throw new Error(`User storage provider ${name} is not installed`);
  return provider;
}

/**
 * Único punto de instanciación de los repositorios de auth. El día que se
 * migre de JSON a una base de datos real, solo estas dos funciones cambian.
 */
export function getUserRepository(): UserRepository {
  return selectedProvider().users();
}

export function getAccessRequestRepository(): AccessRequestRepository {
  return selectedProvider().requests();
}
