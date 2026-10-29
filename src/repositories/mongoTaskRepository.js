import mongoose from "mongoose";
import { presentTask } from "../domain/task.js";
import { Task } from "../models/Task.js";

function isId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export class MongoTaskRepository {
  async findAll() {
    const docs = await Task.find().lean();
    return docs.map((doc) => presentTask(doc));
  }

  async findById(id) {
    if (!isId(id)) return null;
    const doc = await Task.findById(id).lean();
    return doc ? presentTask(doc) : null;
  }

  async create(input) {
    const doc = await Task.create({
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ?? null,
    });
    return presentTask(doc.toObject());
  }

  async update(id, patch) {
    if (!isId(id)) return null;
    const doc = await Task.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    }).lean();
    return doc ? presentTask(doc) : null;
  }

  async delete(id) {
    if (!isId(id)) return false;
    const result = await Task.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async insertMany(tasks) {
    const docs = await Task.insertMany(
      tasks.map((task) => ({
        title: task.title,
        description: task.description ?? "",
        status: task.status ?? "todo",
        priority: task.priority ?? "medium",
        dueDate: task.dueDate ?? null,
      })),
    );
    return docs.map((doc) => presentTask(doc.toObject()));
  }

  async clear() {
    await Task.deleteMany({});
  }

  async count() {
    return Task.countDocuments();
  }
}
