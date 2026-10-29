import { asyncHandler } from "../middleware/asyncHandler.js";
import { TaskService } from "../services/taskService.js";
import { parse } from "../utils/validate.js";
import { createTaskSchema, taskQuerySchema, updateTaskSchema } from "../validators/taskSchemas.js";

export function createTaskController({ tasks, storage }) {
  const service = new TaskService(tasks);

  return {
    list: asyncHandler(async (req, res) => {
      const query = parse(taskQuerySchema, req.query);
      const result = await service.list(query);
      res.json({
        data: result.data,
        meta: { ...result.meta, storage },
      });
    }),

    get: asyncHandler(async (req, res) => {
      const task = await service.getById(req.params.id);
      res.json({ data: task });
    }),

    create: asyncHandler(async (req, res) => {
      const input = parse(createTaskSchema, req.body);
      const task = await service.create(input);
      res.status(201).json({ data: task });
    }),

    update: asyncHandler(async (req, res) => {
      const patch = parse(updateTaskSchema, req.body);
      const task = await service.update(req.params.id, patch);
      res.json({ data: task });
    }),

    remove: asyncHandler(async (req, res) => {
      await service.remove(req.params.id);
      res.status(204).send();
    }),
  };
}
