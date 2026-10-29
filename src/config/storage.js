import { env } from "./env.js";

let mongoConnected = false;

export async function connectStorage() {
  if (!env.mongoUri) {
    const { MemoryTaskRepository } = await import("../repositories/memoryTaskRepository.js");
    return { storage: "memory", tasks: new MemoryTaskRepository() };
  }

  const mongoose = (await import("mongoose")).default;
  const { MongoTaskRepository } = await import("../repositories/mongoTaskRepository.js");

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
  } catch (error) {
    throw new Error(
      `Could not connect to MongoDB. ${error.message} Start it with \`docker compose up -d\`, or unset MONGODB_URI to use the in-memory store.`,
    );
  }

  mongoConnected = true;
  return { storage: "mongodb", tasks: new MongoTaskRepository() };
}

export async function disconnectStorage() {
  if (!mongoConnected) return;
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  mongoConnected = false;
}
