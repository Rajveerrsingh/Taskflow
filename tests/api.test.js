import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { buildSeedTasks } from "../src/data/seedTasks.js";
import { MemoryTaskRepository } from "../src/repositories/memoryTaskRepository.js";

function buildApp(tasks = new MemoryTaskRepository()) {
  return createApp({ tasks, storage: "memory", nodeEnv: "test" });
}

describe("health and shell", () => {
  it("reports the active storage", async () => {
    const response = await request(buildApp()).get("/api/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.service, "taskflow");
    assert.equal(response.body.storage, "memory");
    assert.equal(typeof response.body.time, "string");
  });

  it("lists the routes a client can call", async () => {
    const response = await request(buildApp()).get("/api");

    assert.equal(response.status, 200);
    assert.ok(response.body.endpoints.includes("PATCH /api/tasks/:id"));
  });

  it("serves the frontend", async () => {
    const response = await request(buildApp()).get("/");

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /html/);
    assert.match(response.text, /TaskFlow/);
    assert.match(response.text, /Rajveer Singh/);
  });

  it("returns JSON for an unknown API route", async () => {
    const response = await request(buildApp()).get("/api/does-not-exist");

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "NOT_FOUND");
  });
});

describe("sample tasks", () => {
  it("builds a nine-task queue with overdue work still open", () => {
    const tasks = buildSeedTasks("2026-10-29");
    const byTitle = Object.fromEntries(tasks.map((task) => [task.title, task]));

    assert.equal(tasks.length, 9);
    assert.equal(byTitle["Reject a blank title on create"].dueDate, "2026-10-30");
    assert.equal(byTitle["Fix double-submit on the receiving form"].dueDate, "2026-10-27");

    const overdue = tasks.filter((task) => task.status !== "done" && task.dueDate < "2026-10-29");
    assert.equal(overdue.length, 2);
  });
});

describe("tasks API", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it("creates a task with defaults", async () => {
    const response = await request(app).post("/api/tasks").send({
      title: "  Write the repository tests  ",
      priority: "high",
      dueDate: "2026-11-02",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.title, "Write the repository tests");
    assert.equal(response.body.data.description, "");
    assert.equal(response.body.data.status, "todo");
    assert.equal(response.body.data.priority, "high");
    assert.equal(response.body.data.dueDate, "2026-11-02");
    assert.match(response.body.data.id, /\S+/);
    assert.match(response.body.data.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects a blank title with a field error", async () => {
    const response = await request(app).post("/api/tasks").send({ title: "   " });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.ok(response.body.error.details.some((detail) => detail.field === "title"));
  });

  it("rejects an impossible due date", async () => {
    const response = await request(app).post("/api/tasks").send({
      title: "Bad date",
      dueDate: "2026-02-31",
    });

    assert.equal(response.status, 400);
    assert.ok(response.body.error.details.some((detail) => detail.field === "dueDate"));
  });

  it("rejects unexpected fields", async () => {
    const response = await request(app).post("/api/tasks").send({
      title: "Clean",
      owner: "not-a-column",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  it("rejects malformed JSON", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Content-Type", "application/json")
      .send("{");

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "INVALID_JSON");
  });

  it("filters, updates, fetches, and deletes a task", async () => {
    await request(app).post("/api/tasks").send({
      title: "Alpha",
      status: "todo",
      priority: "low",
      description: "Still on the shelf",
    });
    const created = await request(app).post("/api/tasks").send({
      title: "Beta",
      status: "done",
      priority: "high",
    });

    const listed = await request(app).get("/api/tasks?status=done");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].title, "Beta");
    assert.equal(listed.body.meta.total, 2);
    assert.equal(listed.body.meta.counts.todo, 1);
    assert.equal(listed.body.meta.storage, "memory");

    const id = created.body.data.id;
    const fetched = await request(app).get(`/api/tasks/${id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data.id, id);

    const updated = await request(app).patch(`/api/tasks/${id}`).send({ title: "Beta revised" });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.title, "Beta revised");
    assert.equal(updated.body.data.status, "done");

    const removed = await request(app).delete(`/api/tasks/${id}`);
    assert.equal(removed.status, 204);
    assert.equal(removed.text, "");

    const missing = await request(app).get(`/api/tasks/${id}`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "NOT_FOUND");
  });

  it("rejects an empty update and an unknown status filter", async () => {
    const created = await request(app).post("/api/tasks").send({ title: "Keep" });
    const empty = await request(app).patch(`/api/tasks/${created.body.data.id}`).send({});
    assert.equal(empty.status, 400);

    const filtered = await request(app).get("/api/tasks?status=later");
    assert.equal(filtered.status, 400);
    assert.equal(filtered.body.error.code, "VALIDATION_ERROR");
  });

  it("searches title and description without treating punctuation as a pattern", async () => {
    await request(app).post("/api/tasks").send({
      title: "Index plan",
      description: "Compound index on status and due date.",
    });
    await request(app).post("/api/tasks").send({ title: "Unrelated" });

    const match = await request(app).get("/api/tasks?q=compound");
    assert.equal(match.body.data.length, 1);
    assert.equal(match.body.data[0].title, "Index plan");

    const literal = await request(app).get("/api/tasks?q=.");
    assert.equal(literal.status, 200);
    assert.equal(literal.body.data.length, 1);
  });

  it("sorts due dates soonest first and leaves undated tasks last", async () => {
    await request(app).post("/api/tasks").send({ title: "No date" });
    await request(app).post("/api/tasks").send({ title: "Later", dueDate: "2026-12-01" });
    await request(app).post("/api/tasks").send({ title: "Soon", dueDate: "2026-11-01" });

    const response = await request(app).get("/api/tasks?sort=dueDate&order=asc");
    assert.deepEqual(
      response.body.data.map((task) => task.title),
      ["Soon", "Later", "No date"],
    );
  });

  it("sorts highest priority first", async () => {
    await request(app).post("/api/tasks").send({ title: "Low one", priority: "low" });
    await request(app).post("/api/tasks").send({ title: "High one", priority: "high" });
    await request(app).post("/api/tasks").send({ title: "Mid one", priority: "medium" });

    const response = await request(app).get("/api/tasks?sort=priority&order=desc");
    assert.deepEqual(
      response.body.data.map((task) => task.priority),
      ["high", "medium", "low"],
    );
  });

  it("counts and filters overdue open tasks", async () => {
    await request(app).post("/api/tasks").send({ title: "Late", dueDate: "2020-01-01", status: "todo" });
    await request(app).post("/api/tasks").send({ title: "Finished late", dueDate: "2020-01-01", status: "done" });
    await request(app).post("/api/tasks").send({ title: "Future", dueDate: "2099-01-01", status: "todo" });

    const all = await request(app).get("/api/tasks");
    assert.equal(all.body.meta.counts.overdue, 1);

    const overdue = await request(app).get("/api/tasks?overdue=true");
    assert.deepEqual(
      overdue.body.data.map((task) => task.title),
      ["Late"],
    );
  });

  it("can clear a due date", async () => {
    const created = await request(app).post("/api/tasks").send({
      title: "Dated",
      dueDate: "2026-12-12",
    });
    const updated = await request(app)
      .patch(`/api/tasks/${created.body.data.id}`)
      .send({ dueDate: null });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.dueDate, null);
  });

  it("does not leak internal error text", async () => {
    const tasks = new MemoryTaskRepository();
    tasks.findAll = async () => {
      throw new Error("database password=secret");
    };
    const response = await request(buildApp(tasks)).get("/api/tasks");

    assert.equal(response.status, 500);
    assert.equal(response.body.error.code, "INTERNAL_ERROR");
    assert.equal(response.body.error.message, "Something went wrong.");
    assert.equal(JSON.stringify(response.body).includes("secret"), false);
  });
});
