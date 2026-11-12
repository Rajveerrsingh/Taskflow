/**
 * Demo mode for the static build (GitHub Pages).
 *
 * There is no server on Pages, so the page calls this module instead of fetch.
 * It runs the same Zod schemas and TaskService the Express API uses, on top of
 * the in-memory repository, and saves the list to localStorage in this browser.
 * Nothing leaves the browser.
 */
import { buildSeedTasks } from "../data/seedTasks.js";
import { AppError } from "../errors/AppError.js";
import { MemoryTaskRepository } from "../repositories/memoryTaskRepository.js";
import { TaskService } from "../services/taskService.js";
import { parse } from "../utils/validate.js";
import { createTaskSchema, taskQuerySchema, updateTaskSchema } from "../validators/taskSchemas.js";

const STORAGE_KEY = "taskflow-demo-tasks";
const STORAGE_NAME = "demo";

class LocalTaskRepository extends MemoryTaskRepository {
  constructor() {
    super(load() ?? []);
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // Private mode can block storage. The demo still works for this tab.
    }
  }

  async create(input) {
    const task = await super.create(input);
    this.save();
    return task;
  }

  async update(id, patch) {
    const task = await super.update(id, patch);
    this.save();
    return task;
  }

  async delete(id) {
    const removed = await super.delete(id);
    this.save();
    return removed;
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(saved)) return saved;
  } catch {
    // Fall through to fresh seed data.
  }
  return null;
}

let ready;

async function setup() {
  const repo = new LocalTaskRepository();
  if ((await repo.count()) === 0 && load() === null) {
    await repo.insertMany(buildSeedTasks());
  }
  return { repo, service: new TaskService(repo) };
}

export async function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  ready = setup();
  await ready;
}

/** Same request/response contract as the Express routes. */
export async function handle(method, url, bodyText) {
  ready ??= setup();
  const { service } = await ready;
  const { pathname, searchParams } = new URL(url, "http://demo.local");
  const path = pathname.replace(/^.*\/api/, "/api");
  const match = path.match(/^\/api\/tasks\/([^/]+)$/);

  try {
    const body = bodyText ? JSON.parse(bodyText) : undefined;

    if (path === "/api/health" && method === "GET") {
      return ok(200, { status: "ok", service: "taskflow", storage: STORAGE_NAME, time: new Date().toISOString() });
    }
    if (path === "/api/tasks" && method === "GET") {
      const query = parse(taskQuerySchema, Object.fromEntries(searchParams));
      const result = await service.list(query);
      return ok(200, { data: result.data, meta: { ...result.meta, storage: STORAGE_NAME } });
    }
    if (path === "/api/tasks" && method === "POST") {
      const task = await service.create(parse(createTaskSchema, body));
      return ok(201, { data: task });
    }
    if (match && method === "GET") return ok(200, { data: await service.getById(match[1]) });
    if (match && method === "PATCH") {
      const task = await service.update(match[1], parse(updateTaskSchema, body));
      return ok(200, { data: task });
    }
    if (match && method === "DELETE") {
      await service.remove(match[1]);
      return { status: 204, body: null };
    }
    return ok(404, { error: { code: "NOT_FOUND", message: "Route not found." } });
  } catch (err) {
    if (err instanceof AppError) {
      return ok(err.status, {
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    if (err instanceof SyntaxError) {
      return ok(400, { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
    }
    console.error(err);
    return ok(500, { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
  }
}

function ok(status, body) {
  return { status, body };
}
