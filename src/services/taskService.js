import { priorityRank, STATUSES } from "../domain/task.js";
import { AppError } from "../errors/AppError.js";
import { isOverdue, utcToday } from "../utils/dates.js";

const WRITABLE = ["title", "description", "status", "priority", "dueDate"];

export class TaskService {
  constructor(tasks) {
    this.tasks = tasks;
  }

  async list({ status, priority, q, sort = "dueDate", order = "asc", overdue }) {
    // One filter path for both stores. Search uses includes(), not a regex,
    // so characters like "." stay literal. Move this into the repository
    // query if the collection grows past a personal queue.
    const all = await this.tasks.findAll();
    const today = utcToday();
    const needle = q?.toLowerCase();

    const data = all
      .filter((task) => {
        if (status && task.status !== status) return false;
        if (priority && task.priority !== priority) return false;
        if (overdue && !isOverdue(task, today)) return false;
        if (needle && !`${task.title}\n${task.description}`.toLowerCase().includes(needle)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => compareTasks(a, b, sort, order));

    return {
      data,
      meta: {
        count: data.length,
        total: all.length,
        counts: countTasks(all, today),
      },
    };
  }

  async getById(id) {
    const task = await this.tasks.findById(id);
    if (!task) throw notFound();
    return task;
  }

  async create(input) {
    return this.tasks.create(pick(input));
  }

  async update(id, patch) {
    const updated = await this.tasks.update(id, pick(patch));
    if (!updated) throw notFound();
    return updated;
  }

  async remove(id) {
    const removed = await this.tasks.delete(id);
    if (!removed) throw notFound();
  }
}

function pick(input) {
  const patch = {};
  for (const key of WRITABLE) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  return patch;
}

function notFound() {
  return new AppError("Task not found.", {
    status: 404,
    code: "NOT_FOUND",
  });
}

function countTasks(tasks, today) {
  const counts = { todo: 0, in_progress: 0, done: 0, overdue: 0 };
  for (const task of tasks) {
    if (STATUSES.includes(task.status)) counts[task.status] += 1;
    if (isOverdue(task, today)) counts.overdue += 1;
  }
  return counts;
}

function compareTasks(a, b, sort, order) {
  if (sort === "dueDate") {
    const byDue = compareDueDate(a.dueDate, b.dueDate, order);
    if (byDue !== 0) return byDue;
    return a.createdAt.localeCompare(b.createdAt);
  }

  let result = 0;
  if (sort === "priority") result = priorityRank(a.priority) - priorityRank(b.priority);
  else if (sort === "title") result = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  else result = a.createdAt.localeCompare(b.createdAt);

  if (result === 0 && sort !== "createdAt") {
    result = a.createdAt.localeCompare(b.createdAt);
  }

  return order === "desc" ? -result : result;
}

function compareDueDate(left, right, order) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const result = left.localeCompare(right);
  return order === "desc" ? -result : result;
}
