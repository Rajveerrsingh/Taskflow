import mongoose from "mongoose";
import { PRIORITIES, STATUSES } from "../domain/task.js";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: "medium",
    },
    // Date-only string. A Date would shift "today" across timezones.
    dueDate: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// The service currently filters in process so memory and MongoDB stay identical.
// This index is the one to use once list() is pushed into the query.
taskSchema.index({ status: 1, dueDate: 1 });

export const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);
