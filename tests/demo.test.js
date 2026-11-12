import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage so the browser demo module can run under node:test.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { handle, resetDemo } = await import("../src/demo/browserApi.js");

describe("static demo api", () => {
  beforeEach(async () => {
    await resetDemo();
  });

  it("starts with the seeded queue and reports demo storage", async () => {
    const res = await handle("GET", "/Taskflow/api/tasks?sort=dueDate&order=asc");
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.storage, "demo");
    assert.equal(res.body.meta.total, 9);
  });

  it("uses the same validation as the API", async () => {
    const res = await handle("POST", "/api/tasks", JSON.stringify({ title: "", priority: "urgent" }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.details.some((d) => d.field === "title"));
  });

  it("creates, updates, and deletes, and keeps changes in localStorage", async () => {
    const created = await handle("POST", "/api/tasks", JSON.stringify({ title: "Check demo save" }));
    assert.equal(created.status, 201);
    const id = created.body.data.id;

    const patched = await handle("PATCH", `/api/tasks/${id}`, JSON.stringify({ status: "done" }));
    assert.equal(patched.body.data.status, "done");
    assert.ok(store.get("taskflow-demo-tasks").includes("Check demo save"));

    assert.equal((await handle("DELETE", `/api/tasks/${id}`)).status, 204);
    assert.equal((await handle("GET", `/api/tasks/${id}`)).status, 404);
  });
});
