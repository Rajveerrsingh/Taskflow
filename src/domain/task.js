export const STATUSES = Object.freeze(["todo", "in_progress", "done"]);
export const PRIORITIES = Object.freeze(["low", "medium", "high"]);
export const SORT_FIELDS = Object.freeze(["dueDate", "createdAt", "priority", "title"]);

const PRIORITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

export function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? 0;
}

export function presentTask(task) {
  return {
    id: String(task.id ?? task._id),
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}
