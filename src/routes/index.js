import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";
import { createTaskController } from "../controllers/taskController.js";
import { notFoundHandler } from "../middleware/notFound.js";

export function createApiRouter({ tasks, storage }) {
  const router = Router();
  const health = createHealthController({ storage });
  const tasksController = createTaskController({ tasks, storage });

  router.get("/", health.root);
  router.get("/health", health.health);
  router.get("/tasks", tasksController.list);
  router.post("/tasks", tasksController.create);
  router.get("/tasks/:id", tasksController.get);
  router.patch("/tasks/:id", tasksController.update);
  router.delete("/tasks/:id", tasksController.remove);
  router.use(notFoundHandler);

  return router;
}
