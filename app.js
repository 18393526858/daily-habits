const STORAGE_KEY = "daily-habits:v1";
const MAX_HABIT_LENGTH = 30;
const MAX_NOTE_LENGTH = 300;
const SUGGESTIONS = ["喝水", "运动", "读书", "背单词", "练枪", "打瓦"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const PALETTE = [
  "#2563d9",
  "#14805a",
  "#d04f65",
  "#b67800",
  "#7c5bd6",
  "#168a9c",
];
const VIEWS = ["today", "history", "insights", "settings"];

const elements = {
  todayLabel: document.querySelector("#todayLabel"),
  installButton: document.querySelector("#installButton"),
  appNav: document.querySelector("#appNav"),
  todayView: document.querySelector("#todayView"),
  historyView: document.querySelector("#historyView"),
  insightsView: document.querySelector("#insightsView"),
  settingsView: document.querySelector("#settingsView"),
  todayTitle: document.querySelector("#todayTitle"),
  heroSubtitle: document.querySelector("#heroSubtitle"),
  progressRing: document.querySelector("#progressRing"),
  progressPercent: document.querySelector("#progressPercent"),
  currentStreak: document.querySelector("#currentStreak"),
  weekRate: document.querySelector("#weekRate"),
  totalCheckins: document.querySelector("#totalCheckins"),
  habitForm: document.querySelector("#habitForm"),
  habitInput: document.querySelector("#habitInput"),
  formMessage: document.querySelector("#formMessage"),
  characterCount: document.querySelector("#characterCount"),
  colorOptions: document.querySelector("#colorOptions"),
  suggestionList: document.querySelector("#suggestionList"),
  habitTotal: document.querySelector("#habitTotal"),
  habitSearch: document.querySelector("#habitSearch"),
  habitFilters: document.querySelector("#habitFilters"),
  appMessage: document.querySelector("#appMessage"),
  emptyState: document.querySelector("#emptyState"),
  filteredEmptyState: document.querySelector("#filteredEmptyState"),
  habitList: document.querySelector("#habitList"),
  todayNote: document.querySelector("#todayNote"),
  todayNoteStatus: document.querySelector("#todayNoteStatus"),
  previousMonth: document.querySelector("#previousMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  monthLabel: document.querySelector("#monthLabel"),
  monthSummary: document.querySelector("#monthSummary"),
  calendarGrid: document.querySelector("#calendarGrid"),
  dayDetailLabel: document.querySelector("#dayDetailLabel"),
  dayDetailTitle: document.querySelector("#dayDetailTitle"),
  dayDetailCount: document.querySelector("#dayDetailCount"),
  dayDetailList: document.querySelector("#dayDetailList"),
  dayDetailEmpty: document.querySelector("#dayDetailEmpty"),
  dayNote: document.querySelector("#dayNote"),
  dayNoteStatus: document.querySelector("#dayNoteStatus"),
  bestStreak: document.querySelector("#bestStreak"),
  monthRate: document.querySelector("#monthRate"),
  perfectDays: document.querySelector("#perfectDays"),
  recordedDays: document.querySelector("#recordedDays"),
  trendTotal: document.querySelector("#trendTotal"),
  trendChart: document.querySelector("#trendChart"),
  habitInsightsList: document.querySelector("#habitInsightsList"),
  themeOptions: document.querySelector("#themeOptions"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  installSettingsButton: document.querySelector("#installSettingsButton"),
  installHint: document.querySelector("#installHint"),
  dataSummary: document.querySelector("#dataSummary"),
  resetButton: document.querySelector("#resetButton"),
};

let editingId = null;
let editDraft = "";
let editError = "";
let appMessage = null;
let dateCheckTimer = null;
let noteSaveTimer = null;
let deferredInstallPrompt = null;
let selectedColor = PALETTE[0];
let habitFilter = "all";
let habitSearch = "";
let activeView = "today";
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

function shiftDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
    version: 3,
    today: getLocalDateKey(),
    habits: [],
    completedIds: [],
    history: {},
    notes: {},
    settings: {
      theme: "system",
    },
  };
}

function isValidDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeColor(value, index = 0) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : PALETTE[index % PALETTE.length];
}

function normalizeHabit(value, index = 0) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    !value.name.trim()
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name.trim().slice(0, MAX_HABIT_LENGTH),
    createdAt:
      typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    color: normalizeColor(value.color, index),
  };
}

function normalizeHistoryHabit(value, index = 0) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    typeof value.completed !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name.trim().slice(0, MAX_HABIT_LENGTH),
    completed: value.completed,
    color: normalizeColor(value.color, index),
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
    const normalized = normalizeHistoryHabit(habit, habits.length);
    if (!normalized || seenIds.has(normalized.id)) {
      return;
    }
    seenIds.add(normalized.id);
    habits.push(normalized);
  });

  return habits.length > 0 ? { habits } : null;
}

function normalizeHistory(value) {
  const history = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return history;
  }

  Object.entries(value).forEach(([dateKey, recordValue]) => {
    if (!isValidDateKey(dateKey)) {
      return;
    }
    const record = normalizeRecord(recordValue);
    if (record) {
      history[dateKey] = record;
    }
  });

  return history;
}

function normalizeNotes(value) {
  const notes = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return notes;
  }

  Object.entries(value).forEach(([dateKey, note]) => {
    if (!isValidDateKey(dateKey) || typeof note !== "string") {
      return;
    }
    const normalized = note.slice(0, MAX_NOTE_LENGTH);
    if (normalized.trim()) {
      notes[dateKey] = normalized;
    }
  });

  return notes;
}

function normalizeState(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid state");
  }

  const habits = [];
  const seenIds = new Set();
  const sourceHabits = Array.isArray(value.habits) ? value.habits : [];
  sourceHabits.forEach((habit) => {
    const normalized = normalizeHabit(habit, habits.length);
    if (!normalized || seenIds.has(normalized.id)) {
      return;
    }
    seenIds.add(normalized.id);
    habits.push(normalized);
  });

  const habitIds = new Set(habits.map((habit) => habit.id));
  const completedIds = Array.isArray(value.completedIds)
    ? [...new Set(value.completedIds)].filter(
        (id) => typeof id === "string" && habitIds.has(id),
      )
    : [];
  const theme = ["system", "light", "dark"].includes(value.settings?.theme)
    ? value.settings.theme
    : "system";

  return {
    version: 3,
    today: isValidDateKey(value.today) ? value.today : getLocalDateKey(),
    habits,
    completedIds,
    history: normalizeHistory(value.history),
    notes: normalizeNotes(value.notes),
    settings: { theme },
  };
}

function makeDayRecord(habits, completedIds) {
  const completedSet = new Set(completedIds);
  return {
    habits: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      completed: completedSet.has(habit.id),
      color: normalizeColor(habit.color),
    })),
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
  return record?.habits.filter((habit) => habit.completed).length || 0;
}

function getRecordPercent(record) {
  const total = record?.habits.length || 0;
  return total === 0 ? 0 : Math.round((getCompletedCount(record) / total) * 100);
}

function getDateRange(days) {
  const dates = [];
  const cursor = dateFromKey(state.today);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    dates.push(getLocalDateKey(shiftDate(cursor, -offset)));
  }
  return dates;
}

function getRangeStats(days) {
  let completed = 0;
  let total = 0;

  getDateRange(days).forEach((dateKey) => {
    const record = getRecord(dateKey);
    if (!record) {
      return;
    }
    completed += getCompletedCount(record);
    total += record.habits.length;
  });

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function getTotalCheckins() {
  const historical = Object.values(state.history).reduce(
    (total, record) => total + getCompletedCount(record),
    0,
  );
  return historical + state.completedIds.length;
}

function getCurrentStreak() {
  const cursor = dateFromKey(state.today);
  let streak = 0;

  for (let offset = 0; offset < 3660; offset += 1) {
    const completed = getCompletedCount(getRecord(getLocalDateKey(cursor)));

    if (completed > 0) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getBestStreak() {
  const dates = [
    ...Object.keys(state.history),
    ...(state.habits.length > 0 ? [state.today] : []),
  ].sort();
  let best = 0;
  let current = 0;
  let previous = null;

  dates.forEach((dateKey) => {
    const record = getRecord(dateKey);
    const completed = getCompletedCount(record);
    const previousDate = previous ? dateFromKey(previous) : null;
    const isConsecutive =
      previousDate &&
      getLocalDateKey(shiftDate(previousDate, 1)) === dateKey;

    if (completed > 0) {
      current = isConsecutive ? current + 1 : 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }

    previous = dateKey;
  });

  return best;
}

function getRecordedDays() {
  const dates = new Set(Object.keys(state.history));
  if (state.habits.length > 0) {
    dates.add(state.today);
  }
  return dates.size;
}

function getPerfectDays() {
  const dates = new Set(Object.keys(state.history));
  if (state.habits.length > 0) {
    dates.add(state.today);
  }

  return [...dates].filter((dateKey) => {
    const record = getRecord(dateKey);
    return (
      record &&
      record.habits.length > 0 &&
      getCompletedCount(record) === record.habits.length
    );
  }).length;
}

function getHabitRangeStats(habitId, days = 30) {
  let completed = 0;
  let total = 0;

  getDateRange(days).forEach((dateKey) => {
    const habit = getRecord(dateKey)?.habits.find((item) => item.id === habitId);
    if (!habit) {
      return;
    }
    total += 1;
    if (habit.completed) {
      completed += 1;
    }
  });

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function getHabitStreak(habitId) {
  const cursor = dateFromKey(state.today);
  let streak = 0;

  for (let offset = 0; offset < 3660; offset += 1) {
    const habit = getRecord(getLocalDateKey(cursor))?.habits.find(
      (item) => item.id === habitId,
    );

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

function applyTheme() {
  const preference = state.settings.theme;
  const resolved =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#101720" : "#f2f5f6");

  elements.themeOptions.querySelectorAll("button").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.themeValue === preference,
    );
  });
}

function renderAppMessage() {
  elements.appMessage.hidden = !appMessage;
  elements.appMessage.textContent = appMessage?.text || "";
  elements.appMessage.className = `app-message${appMessage ? ` is-${appMessage.type}` : ""}`;
}

function renderColorOptions() {
  elements.colorOptions.replaceChildren();

  PALETTE.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-swatch${color === selectedColor ? " is-selected" : ""}`;
    button.dataset.color = color;
    button.style.setProperty("--swatch", color);
    button.setAttribute("aria-label", `选择颜色 ${index + 1}`);
    button.setAttribute("aria-pressed", String(color === selectedColor));
    elements.colorOptions.append(button);
  });
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
  const remaining = Math.max(0, total - completed);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  elements.todayTitle.replaceChildren(document.createTextNode("完成 "));
  const completedCount = document.createElement("strong");
  completedCount.textContent = completed;
  elements.todayTitle.append(
    completedCount,
    document.createTextNode(" / "),
    document.createTextNode(String(total)),
    document.createTextNode(" 项"),
  );

  elements.progressRing.style.setProperty("--progress", percent);
  elements.progressRing.setAttribute("aria-valuemax", String(total));
  elements.progressRing.setAttribute("aria-valuenow", String(completed));
  elements.progressPercent.textContent = `${percent}%`;

  if (total === 0) {
    elements.heroSubtitle.textContent = "从一个简单的目标开始，今天就走一步。";
  } else if (remaining === 0) {
    elements.heroSubtitle.textContent = "今天的习惯全部完成，保持这个节奏。";
  } else {
    elements.heroSubtitle.textContent = `还有 ${remaining} 项待完成，慢慢来。`;
  }
}

function renderStats() {
  elements.currentStreak.textContent = getCurrentStreak();
  elements.weekRate.textContent = `${getRangeStats(7).percent}%`;
  elements.totalCheckins.textContent = getTotalCheckins();
}

function renderHabitItem(habit, completed) {
  const item = document.createElement("li");
  item.className = `habit-item${completed ? " is-complete" : ""}`;
  item.dataset.id = habit.id;
  item.style.setProperty("--habit-color", habit.color);

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
  const habitStats = getHabitRangeStats(habit.id, 30);
  const meta = document.createElement("p");
  meta.className = "habit-meta";
  meta.textContent =
    streak > 0
      ? `连续 ${streak} 天 · 近 30 天 ${habitStats.percent}%`
      : `今天开始 · 近 30 天 ${habitStats.percent}%`;
  copy.append(meta);
  item.append(copy);

  const actions = document.createElement("div");
  actions.className = "habit-actions";

  const colorButton = document.createElement("button");
  colorButton.type = "button";
  colorButton.className = "color-button";
  colorButton.dataset.action = "color";
  colorButton.title = "更换颜色";
  colorButton.setAttribute("aria-label", `更换颜色：${habit.name}`);
  actions.append(colorButton);

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

function getFilteredHabits() {
  const query = habitSearch.trim().toLocaleLowerCase("zh-CN");

  return state.habits.filter((habit) => {
    const completed = state.completedIds.includes(habit.id);
    const matchesQuery =
      !query || habit.name.toLocaleLowerCase("zh-CN").includes(query);
    const matchesFilter =
      habitFilter === "all" ||
      (habitFilter === "done" && completed) ||
      (habitFilter === "pending" && !completed);
    return matchesQuery && matchesFilter;
  });
}

function renderHabits() {
  const filtered = getFilteredHabits();
  const hasHabits = state.habits.length > 0;

  elements.habitList.replaceChildren();
  elements.habitTotal.textContent = `${state.habits.length} 项`;
  elements.emptyState.hidden = hasHabits;
  elements.filteredEmptyState.hidden =
    !hasHabits || filtered.length > 0;

  filtered.forEach((habit) => {
    elements.habitList.append(
      renderHabitItem(habit, state.completedIds.includes(habit.id)),
    );
  });
}

function renderNotes() {
  if (document.activeElement !== elements.todayNote) {
    elements.todayNote.value = state.notes[state.today] || "";
  }

  if (document.activeElement !== elements.dayNote) {
    elements.dayNote.value = state.notes[selectedDate] || "";
  }
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

function renderMonthSummary() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let completed = 0;
  let total = 0;
  let recorded = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = getLocalDateKey(new Date(year, month, day));
    if (isFutureDate(dateKey)) {
      continue;
    }
    const record = getRecord(dateKey);
    if (!record) {
      continue;
    }
    recorded += 1;
    completed += getCompletedCount(record);
    total += record.habits.length;
  }

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  elements.monthSummary.replaceChildren();

  const rate = document.createElement("strong");
  rate.textContent = `${percent}%`;
  elements.monthSummary.append(
    rate,
    document.createTextNode(
      `完成率 · ${recorded} 天有记录 · ${completed} / ${total} 项`,
    ),
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
    if (state.notes[dateKey]?.trim()) {
      button.classList.add("has-note");
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

  renderMonthSummary();
}

function renderDayDetail() {
  const record = getRecord(selectedDate);
  const completed = getCompletedCount(record);
  const total = record?.habits.length || 0;

  elements.dayDetailLabel.textContent =
    selectedDate === state.today
      ? "今天"
      : String(dateFromKey(selectedDate).getFullYear());
  elements.dayDetailTitle.textContent =
    selectedDate === state.today ? "今天" : formatDayHeading(selectedDate);
  elements.dayDetailCount.textContent = `${completed} / ${total}`;
  elements.dayDetailList.replaceChildren();

  const hasRecord = Boolean(record && total > 0);
  elements.dayDetailEmpty.hidden = hasRecord;

  if (hasRecord) {
    record.habits.forEach((habit) => {
      const item = document.createElement("li");
      item.className = `day-detail-item${habit.completed ? " is-complete" : ""}`;
      item.style.setProperty("--day-color", habit.color);

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
}

function renderInsights() {
  elements.bestStreak.textContent = getBestStreak();
  elements.monthRate.textContent = `${getRangeStats(30).percent}%`;
  elements.perfectDays.textContent = getPerfectDays();
  elements.recordedDays.textContent = getRecordedDays();

  const dates = getDateRange(7);
  let completed = 0;
  let total = 0;
  elements.trendChart.replaceChildren();

  dates.forEach((dateKey) => {
    const date = dateFromKey(dateKey);
    const record = getRecord(dateKey);
    const dayCompleted = getCompletedCount(record);
    const dayTotal = record?.habits.length || 0;
    const percent = dayTotal === 0 ? 0 : Math.round((dayCompleted / dayTotal) * 100);
    completed += dayCompleted;
    total += dayTotal;

    const column = document.createElement("div");
    column.className = "trend-column";
    if (dayTotal > 0 && dayCompleted === dayTotal) {
      column.classList.add("is-full");
    } else if (dayTotal === 0 || dayCompleted === 0) {
      column.classList.add("is-empty");
    }

    const barWrap = document.createElement("div");
    barWrap.className = "trend-bar-wrap";
    const bar = document.createElement("span");
    bar.className = "trend-bar";
    bar.style.height = `${Math.max(4, percent)}%`;
    barWrap.append(bar);

    const value = document.createElement("span");
    value.className = "trend-value";
    value.textContent = `${percent}%`;

    const dayLabel = document.createElement("span");
    dayLabel.className = "trend-day";
    dayLabel.textContent =
      dateKey === state.today ? "今天" : `周${WEEKDAYS[date.getDay()]}`;

    column.append(barWrap, value, dayLabel);
    elements.trendChart.append(column);
  });

  elements.trendTotal.textContent = `${completed} / ${total}`;

  elements.habitInsightsList.replaceChildren();
  if (state.habits.length === 0) {
    const empty = document.createElement("li");
    empty.className = "habit-insight-value";
    empty.textContent = "添加习惯后，这里会显示逐项分析。";
    elements.habitInsightsList.append(empty);
  } else {
    state.habits.forEach((habit) => {
      const stats = getHabitRangeStats(habit.id, 30);
      const streak = getHabitStreak(habit.id);
      const item = document.createElement("li");
      item.className = "habit-insight-item";
      item.style.setProperty("--habit-color", habit.color);

      const name = document.createElement("span");
      name.className = "habit-insight-name";
      name.textContent = habit.name;

      const progress = document.createElement("span");
      progress.className = "habit-progress";
      const progressValue = document.createElement("span");
      progressValue.style.width = `${stats.percent}%`;
      progress.append(progressValue);

      const value = document.createElement("span");
      value.className = "habit-insight-value";
      value.textContent = `连续 ${streak} 天 · 完成率 ${stats.percent}%`;

      item.append(name, progress, value);
      elements.habitInsightsList.append(item);
    });
  }
}

function renderSettings() {
  const recordCount = Object.keys(state.history).length;
  elements.dataSummary.textContent =
    state.habits.length === 0
      ? "当前没有保存的习惯。"
      : `已保存 ${state.habits.length} 个习惯、${recordCount} 天历史记录。`;

  elements.installButton.hidden = !deferredInstallPrompt;
  elements.installSettingsButton.disabled = !deferredInstallPrompt;
  elements.installHint.textContent = deferredInstallPrompt
    ? "点击按钮即可安装到当前设备。"
    : window.matchMedia("(display-mode: standalone)").matches
      ? "当前已经以应用模式运行。"
      : "如果你的浏览器支持安装，按钮会自动启用。";
}

function render({ focusEdit = false } = {}) {
  elements.todayLabel.textContent = formatFullDate();
  applyTheme();
  renderSummary();
  renderStats();
  renderColorOptions();
  renderHabits();
  renderSuggestions();
  renderAppMessage();
  renderNotes();
  renderCalendar();
  renderDayDetail();
  renderInsights();
  renderSettings();

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

function addHabit(rawName, color = selectedColor) {
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
    color: normalizeColor(color),
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

function cycleHabitColor(habit) {
  const currentIndex = PALETTE.indexOf(habit.color);
  habit.color = PALETTE[(currentIndex + 1) % PALETTE.length];
  persistState();
  render();
}

function setActiveView(view, { updateHash = true } = {}) {
  const nextView = VIEWS.includes(view) ? view : "today";
  activeView = nextView;

  const viewElements = {
    today: elements.todayView,
    history: elements.historyView,
    insights: elements.insightsView,
    settings: elements.settingsView,
  };

  Object.entries(viewElements).forEach(([name, element]) => {
    element.hidden = name !== nextView;
  });

  elements.appNav.querySelectorAll(".nav-button").forEach((button) => {
    const active = button.dataset.view === nextView;
    button.classList.toggle("is-active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (updateHash && window.location.hash !== `#${nextView}`) {
    history.replaceState(null, "", `#${nextView}`);
  }
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
      records.at(-1) ||
      getLocalDateKey(
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1),
      );
  }

  renderCalendar();
  renderDayDetail();
  renderNotes();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
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
    state = applyDateRollover(normalizeState(JSON.parse(await file.text())));
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

function resetData() {
  const confirmed = window.confirm(
    "这会删除全部习惯、打卡历史和备注，且无法恢复。确定继续吗？",
  );
  if (!confirmed) {
    return;
  }

  state = createEmptyState();
  selectedDate = state.today;
  visibleMonth = monthStartFromKey(state.today);
  editingId = null;
  editDraft = "";
  editError = "";
  habitFilter = "all";
  habitSearch = "";
  elements.habitSearch.value = "";
  persistState();
  appMessage = { type: "success", text: "全部本地数据已清除。" };
  render();
}

function queueNoteSave(dateKey, value, statusElement) {
  state.notes[dateKey] = value.slice(0, MAX_NOTE_LENGTH);
  if (!state.notes[dateKey].trim()) {
    delete state.notes[dateKey];
  }

  statusElement.textContent = "正在保存…";
  window.clearTimeout(noteSaveTimer);
  noteSaveTimer = window.setTimeout(() => {
    persistState();
    statusElement.textContent = "已保存";
    renderCalendar();
    window.setTimeout(() => {
      if (statusElement.textContent === "已保存") {
        statusElement.textContent = "";
      }
    }, 1200);
  }, 280);
}

async function triggerInstall() {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderSettings();
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

elements.colorOptions.addEventListener("click", (event) => {
  const button = event.target.closest(".color-swatch");
  if (!button) {
    return;
  }
  selectedColor = button.dataset.color;
  renderColorOptions();
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

elements.habitSearch.addEventListener("input", () => {
  habitSearch = elements.habitSearch.value;
  renderHabits();
});

elements.habitFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");
  if (!button) {
    return;
  }
  habitFilter = button.dataset.filter;
  elements.habitFilters.querySelectorAll(".filter-button").forEach((item) => {
    item.classList.toggle("is-active", item === button);
  });
  renderHabits();
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
    elements.habitList
      .querySelector(`[data-id="${habit.id}"] .check-button`)
      ?.focus();
    return;
  }

  if (action === "color") {
    cycleHabitColor(habit);
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

elements.todayNote.addEventListener("input", () => {
  queueNoteSave(state.today, elements.todayNote.value, elements.todayNoteStatus);
});

elements.dayNote.addEventListener("input", () => {
  queueNoteSave(selectedDate, elements.dayNote.value, elements.dayNoteStatus);
});

elements.calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".calendar-day[data-date]");
  if (!button || button.disabled) {
    return;
  }
  selectedDate = button.dataset.date;
  renderCalendar();
  renderDayDetail();
  renderNotes();
});

elements.previousMonth.addEventListener("click", () => selectMonth(-1));
elements.nextMonth.addEventListener("click", () => selectMonth(1));

elements.appNav.addEventListener("click", (event) => {
  const button = event.target.closest(".nav-button");
  if (!button) {
    return;
  }
  setActiveView(button.dataset.view);
});

window.addEventListener("hashchange", () => {
  setActiveView(window.location.hash.slice(1), { updateHash: false });
});

elements.themeOptions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-theme-value]");
  if (!button) {
    return;
  }
  state.settings.theme = button.dataset.themeValue;
  persistState();
  applyTheme();
});

elements.exportButton.addEventListener("click", exportData);
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", () => {
  importData(elements.importInput.files?.[0]);
});
elements.installButton.addEventListener("click", triggerInstall);
elements.installSettingsButton.addEventListener("click", triggerInstall);
elements.resetButton.addEventListener("click", resetData);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  renderSettings();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  appMessage = { type: "success", text: "应用已安装到设备。" };
  render();
});

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (state.settings.theme === "system") {
      applyTheme();
    }
  });

window.addEventListener("focus", () => syncDate());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    syncDate();
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

updateCharacterCount();
setActiveView(window.location.hash.slice(1) || "today", { updateHash: false });
render();
scheduleDateCheck();
