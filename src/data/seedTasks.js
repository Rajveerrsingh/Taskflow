import { addDays, utcToday } from "../utils/dates.js";

export function buildSeedTasks(today = utcToday()) {
  const due = (offset) => addDays(today, offset);

  return [
    {
      title: "Reject a blank title on create",
      description:
        "The inventory form should highlight the title when the API returns a field error, instead of failing with a generic message.",
      status: "in_progress",
      priority: "high",
      dueDate: due(1),
    },
    {
      title: "Paginate the low-stock report",
      description:
        "Return twenty titles at a time, sorted by SKU, so the report does not shuffle between pages.",
      status: "todo",
      priority: "medium",
      dueDate: due(6),
    },
    {
      title: "Fix double-submit on the receiving form",
      description:
        "A second click while the request is in flight records two receipts for the same shipment.",
      status: "todo",
      priority: "high",
      dueDate: due(-2),
    },
    {
      title: "Cover status filters with an API test",
      description:
        "A request for backordered titles must not include anything already on the shelf.",
      status: "in_progress",
      priority: "medium",
      dueDate: due(3),
    },
    {
      title: "Write down the no-Docker start path",
      description:
        "A reviewer should be able to run the service with npm start and no database installed.",
      status: "done",
      priority: "low",
      dueDate: due(-6),
    },
    {
      title: "Design the empty filter state",
      description:
        "When a search matches nothing, say so in the board and offer a one-click reset.",
      status: "done",
      priority: "medium",
      dueDate: due(-10),
    },
    {
      title: "Keep ship dates from shifting a day",
      description:
        "Store the ship date as YYYY-MM-DD so it does not become yesterday after 7pm Eastern.",
      status: "todo",
      priority: "low",
      dueDate: due(11),
    },
    {
      title: "Hide stack traces from API clients",
      description:
        "Unexpected failures should return error.code and error.message, and log the detail on the server only.",
      status: "done",
      priority: "high",
      dueDate: due(-3),
    },
    {
      title: "Chase the missing supplier confirmation",
      description:
        "Monday's receiving batch still has no confirmation number, and the follow-up date has passed.",
      status: "in_progress",
      priority: "high",
      dueDate: due(-1),
    },
  ];
}

export async function seedIfEmpty(tasks) {
  if ((await tasks.count()) > 0) return 0;
  const created = await tasks.insertMany(buildSeedTasks());
  return created.length;
}

export async function reseed(tasks) {
  await tasks.clear();
  const created = await tasks.insertMany(buildSeedTasks());
  return created.length;
}
