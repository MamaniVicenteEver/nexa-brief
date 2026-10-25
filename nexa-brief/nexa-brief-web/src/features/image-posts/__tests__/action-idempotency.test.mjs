import assert from "node:assert/strict";
import { test } from "node:test";
import { withActionIdempotency } from "../api/action-idempotency.ts";

function localStorageStub() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    get size() {
      return values.size;
    },
  };
}

test("un reintento de red conserva la clave de la acción tras recargar", async () => {
  globalThis.window = { localStorage: localStorageStub() };
  let firstKey;
  await assert.rejects(
    withActionIdempotency("create-plan", { video: "v1" }, async (key) => {
      firstKey = key;
      throw { status: 0, message: "sin respuesta" };
    }),
  );

  let retryKey;
  const result = await withActionIdempotency("create-plan", { video: "v1" }, async (key) => {
    retryKey = key;
    return "aceptada";
  });

  assert.equal(retryKey, firstKey);
  assert.equal(result, "aceptada");
  assert.equal(window.localStorage.size, 0);
});

test("una respuesta HTTP cierra la clave pendiente", async () => {
  globalThis.window = { localStorage: localStorageStub() };
  await assert.rejects(
    withActionIdempotency("review", { post: "p1" }, async () => {
      throw { status: 409, message: "revisión obsoleta" };
    }),
  );
  assert.equal(window.localStorage.size, 0);
});
