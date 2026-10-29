const ENDPOINTS = [
  "GET /api/health",
  "GET /api/tasks",
  "POST /api/tasks",
  "GET /api/tasks/:id",
  "PATCH /api/tasks/:id",
  "DELETE /api/tasks/:id",
];

export function createHealthController({ storage }) {
  return {
    root(_req, res) {
      res.json({
        service: "taskflow",
        storage,
        endpoints: ENDPOINTS,
      });
    },
    health(_req, res) {
      res.json({
        status: "ok",
        service: "taskflow",
        storage,
        time: new Date().toISOString(),
      });
    },
  };
}
