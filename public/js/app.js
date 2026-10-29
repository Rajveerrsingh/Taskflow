/**
 * TaskFlow page.
 * The browser only talks to /api. After a write, the list is reloaded
 * so the screen matches the store instead of a local guess.
 */

const STATUS_LABEL = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const PRIORITY_LABEL = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const COLUMNS = ["todo", "in_progress", "done"];

const state = {
  tasks: [],
  meta: null,
  storage: null,
  queue: "all",
  priority: "",
  q: "",
  sort: "dueDate",
  order: "asc",
  view: "board",
  loading: true,
  ready: false,
  error: null,
  editingId: null,
  deletingId: null,
  pendingId: null,
  freshId: null,
};

const tasksRoot = document.getElementById("tasks");
const form = document.getElementById("task-form");
const taskDialog = document.getElementById("task-dialog");
const deleteDialog = document.getElementById("delete-dialog");
const aboutDialog = document.getElementById("about-dialog");
const fields = {
  title: document.getElementById("task-title"),
  description: document.getElementById("task-description"),
  status: document.getElementById("task-status"),
  priority: document.getElementById("task-priority"),
  due: document.getElementById("task-due"),
};
const submitButton = document.getElementById("dialog-submit");
const deleteButton = document.getElementById("delete-confirm");
const toasts = document.getElementById("toasts");
let loadSeq = 0;

function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value != null) node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(dueDate) {
  const [year, month, day] = dueDate.split("-").map(Number);
  const due = Date.UTC(year, month - 1, day);
  const [todayYear, todayMonth, todayDay] = utcToday().split("-").map(Number);
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((due - today) / 86400000);
}

function dueLabel(task) {
  if (!task.dueDate) return "No due date";
  const days = daysFromToday(task.dueDate);
  if (task.status !== "done" && days < 0) {
    return days === -1 ? "Overdue · yesterday" : `Overdue · ${formatDay(task.dueDate)}`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "Yesterday";
  return formatDay(task.dueDate);
}

function formatDay(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const sameYear = year === Number(utcToday().slice(0, 4));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}

function isOverdue(task) {
  return Boolean(task.dueDate) && task.status !== "done" && task.dueDate < utcToday();
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    const error = new Error("Could not reach the server. Is it still running?");
    error.details = [];
    throw error;
  }

  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = body?.error?.code;
    error.details = body?.error?.details || [];
    throw error;
  }
  return body;
}

function queryParams() {
  const params = new URLSearchParams();
  if (state.queue === "overdue") params.set("overdue", "true");
  else if (state.queue !== "all") params.set("status", state.queue);
  if (state.priority) params.set("priority", state.priority);
  if (state.q) params.set("q", state.q);
  params.set("sort", state.sort);
  params.set("order", state.order);
  return params;
}

async function loadTasks({ quiet = false } = {}) {
  const seq = ++loadSeq;
  if (!quiet) {
    state.loading = true;
    state.error = null;
    render();
  }

  try {
    const result = await api(`/api/tasks?${queryParams()}`);
    if (seq !== loadSeq) return;
    state.tasks = result.data;
    state.meta = result.meta;
    state.storage = result.meta.storage;
    state.loading = false;
    state.ready = true;
    state.error = null;
  } catch (error) {
    if (seq !== loadSeq) return;
    state.loading = false;
    if (!quiet || !state.ready) state.error = error.message;
    else toast(error.message);
  }

  if (seq !== loadSeq) return;
  render();
}

function countFor(key) {
  if (!state.meta) return "–";
  if (key === "total") return String(state.meta.total);
  return String(state.meta.counts[key] ?? 0);
}

function renderFilters() {
  const statusHost = document.getElementById("status-filters");
  const priorityHost = document.getElementById("priority-filters");

  const statuses = [
    ["all", "All tasks", "total"],
    ["todo", "To do", "todo"],
    ["in_progress", "In progress", "in_progress"],
    ["done", "Done", "done"],
    ["overdue", "Overdue", "overdue"],
  ];

  statusHost.replaceChildren(
    ...statuses.map(([id, label, countKey]) =>
      filterButton(label, countFor(countKey), state.queue === id, () => {
        state.queue = id;
        loadTasks({ quiet: true });
      }),
    ),
  );

  const priorities = [
    ["", "Any"],
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
  ];

  priorityHost.replaceChildren(
    ...priorities.map(([id, label]) =>
      filterButton(label, null, state.priority === id, () => {
        state.priority = id;
        loadTasks({ quiet: true });
      }),
    ),
  );
}

function filterButton(label, count, pressed, onClick) {
  const children = [el("span", { text: label })];
  if (count != null) children.push(el("span", { className: "filter-count", text: count }));
  const button = el(
    "button",
    { className: "filter-button", attrs: { type: "button", "aria-pressed": String(pressed) } },
    children,
  );
  button.addEventListener("click", onClick);
  return button;
}

function renderHeading() {
  const titles = {
    all: "All tasks",
    todo: "To do",
    in_progress: "In progress",
    done: "Done",
    overdue: "Overdue",
  };
  document.getElementById("view-title").textContent = titles[state.queue];
  document.getElementById("view-lede").textContent = ledeText();
  document.getElementById("sort").value = `${state.sort}:${state.order}`;
  document.getElementById("view-board").setAttribute("aria-pressed", String(state.view === "board"));
  document.getElementById("view-list").setAttribute("aria-pressed", String(state.view === "list"));
  tasksRoot.setAttribute("aria-busy", String(state.loading && !state.ready));
}

function ledeText() {
  if (state.loading && !state.ready) return "Loading the queue…";
  if (state.error && !state.ready) return "The API did not return a queue.";
  if (!state.meta) return "Sample queue for a bookstore inventory service.";
  const { count, total } = state.meta;
  if (total === 0) return "Nothing is stored yet. Add a task and it will go through the API.";
  if (count === 0) return `Nothing matches these filters. ${total} tasks are still in the store.`;
  if (count === total) return `${total} sample tasks. Search, filter, or edit them through the API.`;
  return `Showing ${count} of ${total} tasks.`;
}

function renderStorage() {
  const label = document.getElementById("storage-label");
  const about = document.getElementById("about-storage");
  const footnote = document.getElementById("footnote");

  if (state.storage === "mongodb") {
    label.dataset.mode = "mongodb";
    label.textContent = "MongoDB";
    about.textContent = "This server is using MongoDB. Tasks remain after a restart.";
    footnote.textContent = "Saved in MongoDB. Restarting the server keeps these tasks.";
  } else if (state.storage === "memory") {
    label.dataset.mode = "memory";
    label.textContent = "In memory";
    about.textContent = "This server is using the in-memory store. Tasks last until the process stops.";
    footnote.textContent = "Saved in memory for this server process. Set MONGODB_URI when you want them to persist.";
  } else {
    label.dataset.mode = "unknown";
    label.textContent = "Starting";
    about.textContent = "";
    footnote.textContent = "";
  }
}

function render() {
  renderFilters();
  renderHeading();
  renderStorage();
  renderTasks();
}

function renderTasks() {
  if (state.loading && !state.ready) {
    tasksRoot.replaceChildren(renderSkeleton());
    return;
  }
  if (state.error && !state.ready) {
    tasksRoot.replaceChildren(renderError());
    return;
  }
  if (!state.meta || state.meta.total === 0) {
    tasksRoot.replaceChildren(renderEmpty({ filtered: false }));
    return;
  }
  if (state.tasks.length === 0) {
    tasksRoot.replaceChildren(renderEmpty({ filtered: true }));
    return;
  }
  tasksRoot.replaceChildren(state.view === "list" ? renderList() : renderBoard());
}

function renderSkeleton() {
  const board = el("div", { className: "board" });
  for (let column = 0; column < 3; column += 1) {
    board.append(
      el("div", { className: "column" }, [
        el("div", { className: "skeleton title" }),
        el("div", { className: "skeleton card" }),
        el("div", { className: "skeleton card" }),
      ]),
    );
  }
  return board;
}

function renderError() {
  const retry = el("button", { className: "button primary", text: "Retry", attrs: { type: "button", "data-action": "retry" } });
  return el("div", { className: "empty" }, [
    el("h2", { text: "The board did not load" }),
    el("p", { text: state.error }),
    retry,
  ]);
}

function renderEmpty({ filtered }) {
  if (!filtered) {
    return el("div", { className: "empty" }, [
      el("h2", { text: "The queue is empty" }),
      el("p", { text: "Create a task to send a POST to /api/tasks. The card will show up only after the server accepts it." }),
      el("button", { className: "button primary", text: "New task", attrs: { type: "button", "data-action": "create" } }),
    ]);
  }

  return el("div", { className: "empty" }, [
    el("h2", { text: "Nothing matches" }),
    el("p", { text: "No task fits the current search or filters. Clear them to see the full queue again." }),
    el("button", { className: "button ghost", text: "Clear filters", attrs: { type: "button", "data-action": "clear" } }),
    el("button", { className: "button primary", text: "New task", attrs: { type: "button", "data-action": "create" } }),
  ]);
}

function renderBoard() {
  const board = el("div", { className: "board" });
  for (const status of COLUMNS) {
    const tasks = state.tasks.filter((task) => task.status === status);
    const stack = el("div", { className: "stack" });
    if (tasks.length === 0) {
      stack.append(el("p", { className: "empty-hint", text: "Nothing in this column." }));
    } else {
      for (const task of tasks) stack.append(renderCard(task));
    }
    board.append(
      el("section", { className: "column", attrs: { "aria-label": STATUS_LABEL[status] } }, [
        el("div", { className: "column-head" }, [
          el("h2", { text: STATUS_LABEL[status] }),
          el("span", { className: "column-count", text: String(tasks.length) }),
        ]),
        stack,
      ]),
    );
  }
  return board;
}

function renderList() {
  return el(
    "div",
    { className: "list" },
    state.tasks.map((task) => renderCard(task)),
  );
}

function renderCard(task) {
  const fresh = state.freshId === task.id ? " is-fresh" : "";
  const due = el("span", {
    className: isOverdue(task) ? "due overdue" : "due",
    text: dueLabel(task),
  });

  return el(
    "article",
    {
      className: `card${fresh}`,
      attrs: {
        "data-task-id": task.id,
        "data-priority": task.priority,
        "data-status": task.status,
      },
    },
    [
      el("div", { className: "card-top" }, [priorityPill(task.priority), due]),
      el("h3", { className: "card-title", text: task.title }),
      task.description ? el("p", { className: "card-desc", text: task.description }) : null,
      el("div", { className: "card-actions" }, [statusSelect(task), actionButtons(task)]),
    ],
  );
}

function priorityPill(priority) {
  return el("span", { className: `pill ${priority}` }, [
    el("span", { className: "dot", attrs: { "aria-hidden": "true" } }),
    el("span", { text: PRIORITY_LABEL[priority] }),
  ]);
}

function statusSelect(task) {
  const select = el("select", {
    className: "status-select",
    attrs: {
      "aria-label": `Status for ${task.title}`,
      "data-action": "status",
      "data-id": task.id,
    },
  });
  for (const status of COLUMNS) {
    const option = el("option", { text: STATUS_LABEL[status], attrs: { value: status } });
    if (status === task.status) option.selected = true;
    select.append(option);
  }
  if (state.pendingId === task.id) select.disabled = true;
  return select;
}

function actionButtons(task) {
  return el("div", { className: "actions" }, [
    el("button", {
      className: "text-action",
      text: "Edit",
      attrs: { type: "button", "data-action": "edit", "data-id": task.id },
    }),
    el("button", {
      className: "text-action danger",
      text: "Delete",
      attrs: { type: "button", "data-action": "delete", "data-id": task.id },
    }),
  ]);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function openCreate() {
  state.editingId = null;
  form.reset();
  clearErrors();
  document.getElementById("dialog-title").textContent = "New task";
  submitButton.textContent = "Create task";
  openDialog(taskDialog);
  fields.title.focus();
}

function openEdit(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.editingId = id;
  form.reset();
  clearErrors();
  fields.title.value = task.title;
  fields.description.value = task.description;
  fields.status.value = task.status;
  fields.priority.value = task.priority;
  fields.due.value = task.dueDate || "";
  document.getElementById("dialog-title").textContent = "Edit task";
  submitButton.textContent = "Save changes";
  openDialog(taskDialog);
  fields.title.focus();
}

function clearErrors() {
  form.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
  const summary = document.getElementById("form-error");
  summary.hidden = true;
  summary.textContent = "";
}

function applyErrors(error) {
  const unplaced = [];
  for (const detail of error.details || []) {
    const slot = form.querySelector(`[data-error-for="${detail.field}"]`);
    const control = form.elements.namedItem(detail.field);
    if (slot && !slot.textContent) slot.textContent = detail.message;
    else unplaced.push(detail.message);
    if (control && "setAttribute" in control) control.setAttribute("aria-invalid", "true");
  }
  if (unplaced.length > 0 || !(error.details || []).length) {
    const summary = document.getElementById("form-error");
    summary.hidden = false;
    summary.textContent = unplaced[0] || error.message;
  }
}

async function onSubmit(event) {
  event.preventDefault();
  clearErrors();
  const editingId = state.editingId;
  const payload = {
    title: fields.title.value,
    description: fields.description.value,
    status: fields.status.value,
    priority: fields.priority.value,
    dueDate: fields.due.value,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving…";

  try {
    const result = editingId
      ? await api(`/api/tasks/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });

    taskDialog.close();
    state.freshId = result.data.id;
    await loadTasks({ quiet: true });
    const visible = state.tasks.some((task) => task.id === result.data.id);
    toast(visible ? (editingId ? "Changes saved." : "Task created.") : "Saved. The current filters hide that task.");
    if (visible) {
      document.querySelector(`[data-task-id="${CSS.escape(result.data.id)}"]`)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
    window.setTimeout(() => {
      if (state.freshId === result.data.id) state.freshId = null;
    }, 1600);
  } catch (error) {
    applyErrors(error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = state.editingId ? "Save changes" : "Create task";
  }
}

function openDelete(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.deletingId = id;
  document.getElementById("delete-copy").textContent = task.title;
  openDialog(deleteDialog);
  document.getElementById("delete-cancel").focus();
}

async function onConfirmDelete() {
  const id = state.deletingId;
  if (!id) return;
  deleteButton.disabled = true;
  try {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    deleteDialog.close();
    state.deletingId = null;
    await loadTasks({ quiet: true });
    toast("Task deleted.");
  } catch (error) {
    toast(error.message);
  } finally {
    deleteButton.disabled = false;
  }
}

async function updateStatus(id, status) {
  const current = state.tasks.find((task) => task.id === id);
  if (!current || current.status === status) return;
  state.pendingId = id;
  renderTasks();
  try {
    await api(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    state.pendingId = null;
    state.freshId = id;
    await loadTasks({ quiet: true });
  } catch (error) {
    state.pendingId = null;
    toast(error.message);
    await loadTasks({ quiet: true });
  }
}

function clearFilters() {
  state.queue = "all";
  state.priority = "";
  state.q = "";
  document.getElementById("search").value = "";
  loadTasks({ quiet: true });
}

function setView(view) {
  state.view = view;
  try {
    localStorage.setItem("taskflow-view", view);
  } catch {
    // Private mode can block storage. The choice still applies this session.
  }
  render();
}

function toast(message) {
  const node = el("div", { className: "toast", text: message });
  toasts.append(node);
  while (toasts.children.length > 3) toasts.firstElementChild.remove();
  window.setTimeout(() => node.remove(), 3400);
}

function debounce(fn, wait) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function onSearch() {
  state.q = document.getElementById("search").value.trim();
  loadTasks({ quiet: true });
}

function onTaskClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.dataset.action === "status") return;
  const { action, id } = button.dataset;
  if (action === "edit") openEdit(id);
  if (action === "delete") openDelete(id);
  if (action === "create") openCreate();
  if (action === "clear") clearFilters();
  if (action === "retry") loadTasks();
}

function onTaskChange(event) {
  const select = event.target.closest("[data-action='status']");
  if (!select) return;
  updateStatus(select.dataset.id, select.value);
}

function onKeydown(event) {
  if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  const dialogOpen = [taskDialog, deleteDialog, aboutDialog].some((dialog) => dialog.open);
  if (typing || dialogOpen) return;
  event.preventDefault();
  openCreate();
}

function init() {
  try {
    const saved = localStorage.getItem("taskflow-view");
    if (saved === "list" || saved === "board") state.view = saved;
  } catch {
    // Ignore storage failures and keep the default board.
  }

  document.getElementById("new-task").addEventListener("click", openCreate);
  document.getElementById("about-open").addEventListener("click", () => {
    openDialog(aboutDialog);
    document.getElementById("about-close").focus();
  });
  document.getElementById("dialog-close").addEventListener("click", () => taskDialog.close());
  document.getElementById("form-cancel").addEventListener("click", () => taskDialog.close());
  document.getElementById("about-close").addEventListener("click", () => aboutDialog.close());
  document.getElementById("delete-cancel").addEventListener("click", () => deleteDialog.close());
  form.addEventListener("submit", onSubmit);
  form.addEventListener("input", (event) => {
    const name = event.target?.name;
    if (!name) return;
    const slot = form.querySelector(`[data-error-for="${name}"]`);
    if (slot) slot.textContent = "";
    event.target.removeAttribute("aria-invalid");
  });
  deleteButton.addEventListener("click", onConfirmDelete);
  document.getElementById("search").addEventListener("input", debounce(onSearch, 200));
  document.getElementById("search").addEventListener("search", onSearch);
  document.getElementById("sort").addEventListener("change", () => {
    const [sort, order] = document.getElementById("sort").value.split(":");
    state.sort = sort;
    state.order = order;
    loadTasks({ quiet: true });
  });
  document.getElementById("view-board").addEventListener("click", () => setView("board"));
  document.getElementById("view-list").addEventListener("click", () => setView("list"));
  tasksRoot.addEventListener("click", onTaskClick);
  tasksRoot.addEventListener("change", onTaskChange);
  document.addEventListener("keydown", onKeydown);

  render();
  loadTasks();
}

init();
