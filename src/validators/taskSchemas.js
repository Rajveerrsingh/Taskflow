import { z } from "zod";
import { PRIORITIES, SORT_FIELDS, STATUSES } from "../domain/task.js";
import { isIsoDate } from "../utils/dates.js";

const DATE_MESSAGE = "Due date must be a real date in YYYY-MM-DD form";

const statusSchema = z.enum(STATUSES, {
  error: "Status must be todo, in_progress, or done",
});

const prioritySchema = z.enum(PRIORITIES, {
  error: "Priority must be low, medium, or high",
});

const dueDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z
    .union([z.string().refine(isIsoDate, { error: DATE_MESSAGE }), z.null()], {
      error: DATE_MESSAGE,
    })
    .optional(),
);

const titleSchema = z
  .string({
    error: (issue) => (issue.input === undefined ? "Title is required" : "Title must be text"),
  })
  .trim()
  .min(1, { error: "Title is required" })
  .max(120, { error: "Title must be 120 characters or fewer" });

const descriptionSchema = z
  .string({ error: "Description must be text" })
  .trim()
  .max(2000, { error: "Description must be 2000 characters or fewer" });

function blankToUndefined(value) {
  if (value === undefined || value === "") return undefined;
  return value;
}

export const createTaskSchema = z.strictObject({
  title: titleSchema,
  description: descriptionSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: dueDateSchema,
});

export const updateTaskSchema = z
  .strictObject({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: dueDateSchema,
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    error: "Provide at least one field to update",
  });

export const taskQuerySchema = z.object({
  status: z.preprocess(blankToUndefined, statusSchema.optional()),
  priority: z.preprocess(blankToUndefined, prioritySchema.optional()),
  q: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().max(120, { error: "Search must be 120 characters or fewer" }).optional()),
  sort: z.preprocess(
    (value) => blankToUndefined(value) ?? "dueDate",
    z.enum(SORT_FIELDS, {
      error: "Sort must be dueDate, createdAt, priority, or title",
    }),
  ),
  order: z.preprocess(
    (value) => blankToUndefined(value) ?? "asc",
    z.enum(["asc", "desc"], { error: "Order must be asc or desc" }),
  ),
  overdue: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean({ error: "overdue must be true or false" }).optional()),
});
