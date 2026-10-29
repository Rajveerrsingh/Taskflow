import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectStorage, disconnectStorage } from "./config/storage.js";
import { seedIfEmpty } from "./data/seedTasks.js";

async function main() {
  const { storage, tasks } = await connectStorage();
  const seeded = await seedIfEmpty(tasks);
  const app = createApp({ tasks, storage, nodeEnv: env.nodeEnv });

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`TaskFlow  http://localhost:${env.port}`);
    console.log(`Storage   ${storage}`);
    if (seeded > 0) console.log(`Seeded    ${seeded} sample tasks`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received, closing server`);
    server.close(async () => {
      try {
        await disconnectStorage();
      } finally {
        process.exit(0);
      }
    });
  }

  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
