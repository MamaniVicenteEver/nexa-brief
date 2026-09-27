import type { AccessRequestRepository } from "./access-request-repository";
import { JsonAccessRequestRepository } from "./json-access-request-repository";
import { JsonUserRepository } from "./json-user-repository";
import type { UserRepository } from "./user-repository";

/**
 * Único punto de instanciación de los repositorios de auth. El día que se
 * migre de JSON a una base de datos real, solo estas dos funciones cambian.
 */
export function getUserRepository(): UserRepository {
  return new JsonUserRepository();
}

export function getAccessRequestRepository(): AccessRequestRepository {
  return new JsonAccessRequestRepository();
}
