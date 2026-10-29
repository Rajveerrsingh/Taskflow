import { randomUUID } from "node:crypto";
import { presentTask } from "../domain/task.js";

/**
 * Same contract as MongoTaskRepository:
 * findAll, findById, create, update, delete, insertMany, clear, count.
 * Returned tasks are copies, so callers cannot mutate the store.
 */
export class MemoryTaskRepository {
  constructor(initial = []) {
    this.items = initial.map((task) => ({ ...task }));
  }

  async findAll() {
    return this.items.map((task) => presentTask(task));
  }

  async findById(id) {
    const found = this.items.find((task) => task.id === id);
    return found ? presentTask(found) : null;
  }

  async create(input) {
    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(task);
    return presentTask(task);
  }

  async update(id, patch) {
    const index = this.items.findIndex((task) => task.id === id);
    if (index === -1) return null;

    const current = this.items[index];
    const updated = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.items[index] = updated;
    return presentTask(updated);
  }

  async delete(id) {
    const index = this.items.findIndex((task) => task.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  async insertMany(tasks) {
    const created = [];
    for (const task of tasks) {
      created.push(await this.create(task));
    }
    return created;
  }

  async clear() {
    this.items = [];
  }

  async count() {
    return this.items.length;
  }
}
