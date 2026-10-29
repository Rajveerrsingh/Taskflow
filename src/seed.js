import { env } from "./config/env.js";
import { connectStorage, disconnectStorage } from "./config/storage.js";
import { reseed } from "./data/seedTasks.js";

async function main() {
  if (!env.mongoUri) {
    console.log("No MONGODB_URI set. The running app seeds the in-memory store itself on startup.");
    console.log("Start MongoDB, set MONGODB_URI in .env, then run npm run seed again.");
    return;
  }

  const { storage, tasks } = await connectStorage();
  try {
    const count = await reseed(tasks);
    console.log(`Replaced ${storage} tasks with ${count} sample tasks.`);
  } finally {
    await disconnectStorage();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
