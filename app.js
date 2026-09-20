const STORAGE_KEY = "daily-habits:v1";
const MAX_HABIT_LENGTH = 30;
const SUGGESTIONS = ["喝水", "运动", "读书"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const elements = {
  todayLabel: document.querySelector("#todayLabel"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  completionCount: document.querySelector("#completionCount"),
  progressBar: document.querySelector("#progressBar"),
  progressValue: document.querySelector("#progressValue"),
  progressLabel: document.querySelector("#progressLabel"),
  currentStreak: document.querySelector("#currentStreak"),
  weekRate: document.querySelector("#weekRate"),
  totalCheckins: document.querySelector("#totalCheckins"),
  habitForm: document.querySelector("#habitForm"),
  habitInput: document.querySelector("#habitInput"),
  formMessage: document.querySelector("#formMessage"),
  characterCount: document.querySelector("#characterCount"),
  suggestionList: document.querySelector("#suggestionList"),
  habitTotal: document.querySelector("#habitTotal"),
  appMessage: document.querySelector("#appMessage"),
  emptyState: document.querySelector("#emptyState"),
  habitList: document.querySelector("#habitList"),
  previousMonth: document.querySelector("#previousMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  monthLabel: document.querySelector("#monthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  dayDetailLabel: document.querySelector("#dayDetailLabel"),
  dayDetailTitle: document.querySelector("#dayDetailTitle"),
  dayDetailCount: document.querySelector("#dayDetailCount"),
  dayDetailList: document.querySelector("#dayDetailList"),
  dayDetailEmpty: document.querySelector("#dayDetailEmpty"),
};

let editingId = null;
let editDraft = "";
let editError = "";
let appMessage = null;
let dateCheckTimer = null;
let state = loadState();
let selectedDate = state.today;
let visibleMonth = monthStartFromKey(state.today);

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthStartFromKey(dateKey) {
  const date = dateFromKey(dateKey);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatFullDate(date = new Date()) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`;
}

function formatDayHeading(dateKey) {
  const date = dateFromKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`;
}

function formatMonth(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function createEmptyState() {
  return {
    version: 2,
    today: getLocalDateKey(),
    habits: [],
    completedIds: [],
    history: {},
  };
}

function isHabit(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.createdAt === "number"
  );
}

function isHistoryHabit(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.completed === "boolean"
  );
}

function makeDayRecord(habits, completedIds) {
  const completedSet = new Set(completedIds);
  return {
    habits: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      completed: completedSet.has(habit.id),
    })),
  };
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const habits = [];
  const seenIds = new Set();
  const sourceHabits = Array.isArray(value.habits) ? value.habits : [];

  sourceHabits.forEach((habit) => {
    if (!isHistoryHabit(habit) || seenIds.has(habit.id)) {
      return;
    }
    seenIds.add(habit.id);
    habits.push({
      id: habit.id,
      name: habit.name.trim().slice(0, MAX_HABIT_LENGTH),
      completed: habit.completed,
    });
  });

  return habits.length > 0 ? { habits } : null;
}

function normalizeHistory(value) {
  const history = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return history;
  }

  Object.entries(value).forEach(([dateKey, recordValue]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return;
    }
    const record = normalizeRecord(recordValue);
    if (record) {
      history[dateKey] = record;
    }
  });

  return history;
}

function normalizeState(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid state");
  }

  const habits = Array.isArray(value.habits) ? value.habits.filter(isHabit) : [];
  const habitIds = new Set(habits.map((habit) => habit.id));
  const completedIds = Array.isArray(value.completedIds)
    ? [...new Set(value.completedIds)].filter(
        (id) => typeof id === "string" && habitIds.has(id),
      )
    : [];

  return {
    version: 2,
    today:
      typeof value.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.today)
        ? value.today
        : getLocalDateKey(),
    habits,
    completedIds,
    history: normalizeHistory(value.history),
  };
}

function applyDateRollover(targetState) {
  const today = getLocalDateKey();
  if (targetState.today === today) {
    return targetState;
  }

  if (targetState.today < today && targetState.habits.length > 0) {
    targetState.history[targetState.today] = makeDayRecord(
      targetState.habits,
      targetState.completedIds,
    );
  }

  targetState.today = today;
  targetState.completedIds = [];
  return targetState;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createEmptyState();
    }
    return applyDateRollover(normalizeState(JSON.parse(saved)));
  } catch (error) {
    appMessage = {
      type: "error",
      text: "本地数据暂时无法读取，本次修改可能无法保存。",
    };
    return createEmptyState();
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (appMessage?.type === "error") {
      appMessage = null;
    }
    return true;
  } catch (error) {
    appMessage = {
      type: "error",
      text: "浏览器阻止了本地保存，刷新页面后数据可能会丢失。",
    };
    return false;
  }
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function namesMatch(left, right) {
  return left.localeCompare(right, "zh-CN", { sensitivity: "accent" }) === 0;
}

function hasDuplicateName(name, ignoredId = null) {
  return state.habits.some(
    (habit) => habit.id !== ignoredId && namesMatch(habit.name, name),
  );
}

function getRecord(dateKey) {
  if (dateKey === state.today) {
    return makeDayRecord(state.habits, state.completedIds);
  }
  return state.history[dateKey] || null;
}

function getCompletedCount(record) {
  if (!record) {
    return 0;
  }
  return record.habits.filter((habit) => habit.completed).length;
}

function getTotalCheckins() {
  const historical = Object.values(state.history).reduce(
    (total, record) => total + getCompletedCount(record),
    0,
  );
  return historical + state.completedIds.length;
}

function getWeekRate() {
  const cursor = dateFromKey(state.today);
  let completed = 0;
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const record = getRecord(getLocalDateKey(cursor));
    if (record) {
      completed += getCompletedCount(record);
      total += record.habits.length;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function getCurrentStreak() {
  const cursor = dateFromKey(state.today);
  let streak = 0;

  for (let offset = 0; offset < 3660; offset += 1) {
    const record = getRecord(getLocalDateKey(cursor));
    const completed = getCompletedCount(record);

    if (completed > 0) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getHabitStreak(habitId) {
  const cursor = dateFromKey(state.today);
  let streak = 0;

  for (let offset = 0; offset < 3660; offset += 1) {
    const record = getRecord(getLocalDateKey(cursor));
    const habit = record?.habits.find((item) => item.id === habitId);

    if (habit?.completed) {
      streak += 1;
    } else if (offset > 0 || !habit) {
      break;
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function makeIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const paths = {
    plus: ["M12 5v14", "M5 12h14"],
    check: ["m5 12 4 4L19 6"],
    edit: [
      "M12 20h9",
      "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
    ],
    trash: [
      "M3 6h18",
      "M8 6V4h8v2",
      "M19 6l-1 14H6L5 6",
      "M10 11v5",
      "M14 11v5",
    ],
    save: ["m5 12 4 4L19 6"],
    cancel: ["M18 6 6 18", "m6 6 12 12"],
  };

  paths[name].forEach((definition) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", definition);
    svg.append(path);
  });

  return svg;
}

function createButton(className, label, iconName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(makeIcon(iconName));
  return button;
}

function renderAppMessage() {
  elements.appMessage.hidden = !appMessage;
  elements.appMessage.textContent = appMessage?.text || "";
  elements.appMessage.className = `app-message${appMessage ? ` is-${appMessage.type}` : ""}`;
}

function renderSuggestions() {
  elements.suggestionList.replaceChildren();

  SUGGESTIONS.forEach((name) => {
    if (hasDuplicateName(name)) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.dataset.name = name;
    button.append(makeIcon("plus"));

    const label = document.createElement("span");
    label.textContent = name;
    button.append(label);
    elements.suggestionList.append(button);
  });
}

function renderSummary() {
  const total = state.habits.length;
  const completed = state.completedIds.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  elements.completionCount.replaceChildren(document.createTextNode("完成 "));
  const completedCount = document.createElement("strong");
  completedCount.textContent = completed;
  elements.completionCount.append(
    completedCount,
    document.createTextNode(" / "),
    document.createTextNode(String(total)),
    document.createTextNode(" 项"),
  );

  elements.progressBar.setAttribute("aria-valuemax", String(total));
  elements.progressBar.setAttribute("aria-valuenow", String(completed));
  elements.progressValue.style.width = `${percent}%`;
  elements.progressLabel.textContent = `${percent}%`;
}

function renderStats() {
  elements.currentStreak.textContent = getCurrentStreak();
  elements.weekRate.textContent = `${getWeekRate()}%`;
  elements.totalCheckins.textContent = getTotalCheckins();
}

function renderHabitItem(habit, completed) {
  const item = document.createElement("li");
  item.className = `habit-item${completed ? " is-complete" : ""}`;
  item.dataset.id = habit.id;

  const checkButton = createButton(
    "check-button",
    completed ? `取消完成：${habit.name}` : `标记完成：${habit.name}`,
    "check",
  );
  checkButton.dataset.action = "toggle";
  checkButton.setAttribute("aria-pressed", String(completed));
  item.append(checkButton);

  if (editingId === habit.id) {
    const form = document.createElement("form");
    form.className = "edit-form";
    form.dataset.action = "edit-form";

    const editRow = document.createElement("div");
    editRow.className = "edit-row";

    const input = document.createElement("input");
    input.className = "edit-input";
    input.type = "text";
    input.maxLength = MAX_HABIT_LENGTH;
    input.value = editDraft;
    input.setAttribute("aria-label", "编辑习惯名称");
    editRow.append(input);

    const saveButton = createButton(
      "icon-button save-button",
      "保存修改",
      "save",
    );
    saveButton.type = "submit";
    editRow.append(saveButton);

    const cancelButton = createButton(
      "icon-button cancel-button",
      "取消修改",
      "cancel",
    );
    cancelButton.dataset.action = "cancel";
    editRow.append(cancelButton);
    form.append(editRow);

    if (editError) {
      const message = document.createElement("p");
      message.className = "edit-message";
      message.textContent = editError;
      form.append(message);
    }

    item.append(form);
    item.append(document.createElement("span"));
    return item;
  }

  const copy = document.createElement("div");
  copy.className = "habit-copy";

  const name = document.createElement("p");
  name.className = "habit-name";
  name.textContent = habit.name;
  copy.append(name);

  const streak = getHabitStreak(habit.id);
  const streakLabel = document.createElement("p");
  streakLabel.className = "habit-streak";
  streakLabel.textContent = streak > 0 ? `连续 ${streak} 天` : "今天开始";
  copy.append(streakLabel);
  item.append(copy);

  const actions = document.createElement("div");
  actions.className = "habit-actions";

  const editButton = createButton("icon-button", `编辑：${habit.name}`, "edit");
  editButton.dataset.action = "edit";
  actions.append(editButton);

  const deleteButton = createButton(
    "icon-button delete-button",
    `删除：${habit.name}`,
    "trash",
  );
  deleteButton.dataset.action = "delete";
  actions.append(deleteButton);
  item.append(actions);

  return item;
}

function renderHabits() {
  elements.habitList.replaceChildren();
  elements.habitTotal.textContent = `${state.habits.length} 项`;
  elements.emptyState.hidden = state.habits.length > 0;

  state.habits.forEach((habit) => {
    elements.habitList.append(
      renderHabitItem(habit, state.completedIds.includes(habit.id)),
    );
  });
}

function isFutureDate(dateKey) {
  return dateKey > state.today;
}

function isSameMonth(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function renderCalendar() {
  elements.monthLabel.textContent = formatMonth(visibleMonth);

  const currentMonth = monthStartFromKey(state.today);
  elements.nextMonth.disabled =
    visibleMonth.getFullYear() > currentMonth.getFullYear() ||
    (visibleMonth.getFullYear() === currentMonth.getFullYear() &&
      visibleMonth.getMonth() >= currentMonth.getMonth());

  elements.calendarGrid.replaceChildren();

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let cell = 0; cell < 42; cell += 1) {
    const day = cell - firstDayOffset + 1;

    if (day < 1 || day > daysInMonth) {
      const blank = document.createElement("span");
      blank.className = "calendar-day is-blank";
      blank.setAttribute("aria-hidden", "true");
      elements.calendarGrid.append(blank);
      continue;
    }

    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const record = getRecord(dateKey);
    const completed = getCompletedCount(record);
    const total = record?.habits.length || 0;
    const future = isFutureDate(dateKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.dataset.date = dateKey;
    button.disabled = future;

    if (dateKey === state.today) {
      button.classList.add("is-today");
    }
    if (dateKey === selectedDate) {
      button.classList.add("is-selected");
    }
    if (record && total > 0 && completed === total) {
      button.classList.add("is-complete");
    } else if (record && completed > 0) {
      button.classList.add("is-partial");
    } else if (record && total > 0) {
      button.classList.add("is-missed");
    }

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = day;
    button.append(number);

    const status = document.createElement("span");
    status.className = "calendar-day-status";
    status.textContent = record && total > 0 ? `${completed}/${total}` : "";
    button.append(status);

    const statusLabel =
      record && total > 0 ? `，完成 ${completed} / ${total} 项` : "，没有记录";
    button.setAttribute(
      "aria-label",
      `${date.getMonth() + 1}月${day}日${statusLabel}`,
    );
    elements.calendarGrid.append(button);
  }
}

function renderDayDetail() {
  const record = getRecord(selectedDate);
  const completed = getCompletedCount(record);
  const total = record?.habits.length || 0;

  elements.dayDetailLabel.textContent =
    selectedDate === state.today ? "今天" : dateFromKey(selectedDate).getFullYear();
  elements.dayDetailTitle.textContent =
    selectedDate === state.today ? "今天" : formatDayHeading(selectedDate);
  elements.dayDetailCount.textContent = `${completed} / ${total}`;
  elements.dayDetailList.replaceChildren();

  const hasRecord = Boolean(record && total > 0);
  elements.dayDetailEmpty.hidden = hasRecord;

  if (!hasRecord) {
    return;
  }

  record.habits.forEach((habit) => {
    const item = document.createElement("li");
    item.className = `day-detail-item${habit.completed ? " is-complete" : ""}`;

    const mark = document.createElement("span");
    mark.className = "day-detail-mark";
    if (habit.completed) {
      mark.append(makeIcon("check"));
    }
    item.append(mark);

    const name = document.createElement("span");
    name.textContent = habit.name;
    item.append(name);

    const stateLabel = document.createElement("span");
    stateLabel.className = "day-detail-state";
    stateLabel.textContent = habit.completed ? "完成" : "未完成";
    item.append(stateLabel);
    elements.dayDetailList.append(item);
  });
}

function render({ focusEdit = false } = {}) {
  elements.todayLabel.textContent = formatFullDate();
  renderSummary();
  renderStats();
  renderHabits();
  renderSuggestions();
  renderAppMessage();
  renderCalendar();
  renderDayDetail();

  if (focusEdit && editingId) {
    const input = elements.habitList.querySelector(
      `[data-id="${editingId}"] .edit-input`,
    );
    if (input) {
      input.focus();
      input.select();
    }
  }
}

function setFormMessage(message) {
  elements.formMessage.textContent = message;
  elements.habitInput.setAttribute("aria-invalid", String(Boolean(message)));
}

function addHabit(rawName) {
  const name = normalizeName(rawName);

  if (!name) {
    setFormMessage("请输入习惯名称。");
    return false;
  }

  if (name.length > MAX_HABIT_LENGTH) {
    setFormMessage(`习惯名称不能超过 ${MAX_HABIT_LENGTH} 个字符。`);
    return false;
  }

  if (hasDuplicateName(name)) {
    setFormMessage("这个习惯已经在列表中了。");
    return false;
  }

  state.habits.push({
    id: createId(),
    name,
    createdAt: Date.now(),
  });
  setFormMessage("");
  persistState();
  render();
  return true;
}

function updateCharacterCount() {
  elements.characterCount.textContent =
    `${elements.habitInput.value.length} / ${MAX_HABIT_LENGTH}`;
}

function findHabit(id) {
  return state.habits.find((habit) => habit.id === id);
}

function selectMonth(offset) {
  const nextMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + offset,
    1,
  );
  const currentMonth = monthStartFromKey(state.today);

  if (nextMonth > currentMonth) {
    return;
  }

  visibleMonth = nextMonth;
  if (isSameMonth(visibleMonth, currentMonth)) {
    selectedDate = state.today;
  } else {
    const monthPrefix =
      `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
    const records = Object.keys(state.history)
      .filter((dateKey) => dateKey.startsWith(monthPrefix))
      .sort();
    selectedDate =
      records.at(-1) || getLocalDateKey(
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1),
      );
  }

  renderCalendar();
  renderDayDetail();
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `习惯打卡备份-${state.today}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  appMessage = { type: "success", text: "数据备份已导出。" };
  renderAppMessage();
}

async function importData(file) {
  if (!file) {
    return;
  }

  const shouldImport = window.confirm("导入备份会覆盖当前全部数据，确定继续吗？");
  if (!shouldImport) {
    elements.importInput.value = "";
    return;
  }

  try {
    const imported = applyDateRollover(
      normalizeState(JSON.parse(await file.text())),
    );
    state = imported;
    selectedDate = state.today;
    visibleMonth = monthStartFromKey(state.today);
    editingId = null;
    editDraft = "";
    editError = "";
    persistState();
    appMessage = { type: "success", text: "数据备份已导入。" };
    render();
  } catch (error) {
    appMessage = {
      type: "error",
      text: "导入失败，请选择由本页面导出的 JSON 备份文件。",
    };
    renderAppMessage();
  }

  elements.importInput.value = "";
}

function syncDate({ forceRender = false } = {}) {
  const today = getLocalDateKey();
  if (state.today !== today) {
    applyDateRollover(state);
    selectedDate = state.today;
    visibleMonth = monthStartFromKey(state.today);
    editingId = null;
    editDraft = "";
    editError = "";
    persistState();
    render();
  } else if (forceRender) {
    render();
  }
  scheduleDateCheck();
}

function scheduleDateCheck() {
  window.clearTimeout(dateCheckTimer);
  const now = new Date();
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1,
  );
  dateCheckTimer = window.setTimeout(
    () => syncDate({ forceRender: true }),
    Math.max(1000, nextDay.getTime() - now.getTime()),
  );
}

elements.habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addHabit(elements.habitInput.value)) {
    elements.habitInput.value = "";
    updateCharacterCount();
    elements.habitInput.focus();
  }
});

elements.habitInput.addEventListener("input", () => {
  updateCharacterCount();
  setFormMessage("");
});

elements.suggestionList.addEventListener("click", (event) => {
  const button = event.target.closest(".suggestion-chip");
  if (!button) {
    return;
  }

  if (addHabit(button.dataset.name)) {
    elements.habitInput.focus();
  }
});

elements.habitList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const item = event.target.closest(".habit-item");
  if (!button || !item) {
    return;
  }

  const habit = findHabit(item.dataset.id);
  if (!habit) {
    return;
  }

  const action = button.dataset.action;
  if (action === "toggle") {
    if (state.completedIds.includes(habit.id)) {
      state.completedIds = state.completedIds.filter((id) => id !== habit.id);
    } else {
      state.completedIds.push(habit.id);
    }
    persistState();
    render();
    const nextButton = elements.habitList.querySelector(
      `[data-id="${habit.id}"] .check-button`,
    );
    nextButton?.focus();
    return;
  }

  if (action === "edit") {
    editingId = habit.id;
    editDraft = habit.name;
    editError = "";
    render({ focusEdit: true });
    return;
  }

  if (action === "cancel") {
    editingId = null;
    editDraft = "";
    editError = "";
    render();
    return;
  }

  if (action === "delete") {
    const shouldDelete = window.confirm(`确定删除“${habit.name}”吗？`);
    if (!shouldDelete) {
      return;
    }

    state.habits = state.habits.filter((candidate) => candidate.id !== habit.id);
    state.completedIds = state.completedIds.filter((id) => id !== habit.id);
    if (editingId === habit.id) {
      editingId = null;
      editDraft = "";
    }
    persistState();
    render();
  }
});

elements.habitList.addEventListener("submit", (event) => {
  const form = event.target.closest('[data-action="edit-form"]');
  if (!form) {
    return;
  }
  event.preventDefault();

  const item = form.closest(".habit-item");
  const habit = findHabit(item.dataset.id);
  if (!habit) {
    return;
  }

  const name = normalizeName(editDraft);
  if (!name) {
    editError = "请输入习惯名称。";
    render({ focusEdit: true });
    return;
  }

  if (name.length > MAX_HABIT_LENGTH) {
    editError = `习惯名称不能超过 ${MAX_HABIT_LENGTH} 个字符。`;
    render({ focusEdit: true });
    return;
  }

  if (hasDuplicateName(name, habit.id)) {
    editError = "这个习惯已经在列表中了。";
    render({ focusEdit: true });
    return;
  }

  habit.name = name;
  editingId = null;
  editDraft = "";
  editError = "";
  persistState();
  render();
});

elements.habitList.addEventListener("input", (event) => {
  if (event.target.matches(".edit-input")) {
    editDraft = event.target.value;
  }
});

elements.habitList.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !event.target.matches(".edit-input")) {
    return;
  }
  editingId = null;
  editDraft = "";
  editError = "";
  render();
});

elements.calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".calendar-day[data-date]");
  if (!button || button.disabled) {
    return;
  }
  selectedDate = button.dataset.date;
  renderCalendar();
  renderDayDetail();
});

elements.previousMonth.addEventListener("click", () => selectMonth(-1));
elements.nextMonth.addEventListener("click", () => selectMonth(1));
elements.exportButton.addEventListener("click", exportData);
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", () => {
  importData(elements.importInput.files?.[0]);
});

window.addEventListener("focus", () => syncDate());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    syncDate();
  }
});

updateCharacterCount();
render();
scheduleDateCheck();
