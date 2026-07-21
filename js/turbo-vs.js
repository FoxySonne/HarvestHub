const moduleVersion = new URL(import.meta.url).searchParams.get("v") || "dev";
const { database } = await import(`../data/database.js?v=${encodeURIComponent(moduleVersion)}`);

const TURBO_WEEK_STATE_PREFIX = "harvesthub_turbo_vs_week_state:";
const TROOP_LEVEL_DEFAULTS = [8, 9, 10];
let isSyncingControls = false;
let currentDayId = "";
let selectedManually = false;
let timerId = null;
let currentTotals = { turtle: 0, vs: 0 };

function getWeekStateKey() {
  return `${TURBO_WEEK_STATE_PREFIX}local`;
}

function readWeekState() {
  try {
    return JSON.parse(localStorage.getItem(getWeekStateKey()) || "{}");
  } catch {
    return {};
  }
}

function writeWeekState(state) {
  localStorage.setItem(getWeekStateKey(), JSON.stringify(state));
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString("ru-RU");
}

function parseTargetPoints(value) {
  const text = String(value || "").trim().replace(/\s+/g, "").replace(/,/g, ".");
  const match = text.match(/^(\d+(?:\.\d+)?)([kкmмbб])?$/i);

  if (!match) {
    const fallback = Number(text);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }

  const base = Number(match[1]);
  const suffix = (match[2] || "").toLowerCase();
  const multiplier = suffix === "k" || suffix === "к"
    ? 1000
    : suffix === "m" || suffix === "м"
      ? 1000000
      : suffix === "b" || suffix === "б"
        ? 1000000000
        : 1;

  const result = base * multiplier;
  return Number.isFinite(result) && result > 0 ? result : 0;
}

function getActionById(actionId) {
  return database.action.find(action => action.id === actionId);
}

function resolveDayList(list = []) {
  return list.flatMap(item => {
    if (typeof item === "string") return item;
    if (item.type === "action") return item.id;
    if (item.type === "category") {
      return database.action
        .filter(action => action.categoryId === item.id)
        .map(action => action.id);
    }
    if (item.type === "text") return item;
    return [];
  });
}

function sortDayItems(items) {
  return [...items].sort((a, b) => {
    if (typeof a !== "string" && typeof b !== "string") return 0;
    if (typeof a !== "string") return 1;
    if (typeof b !== "string") return -1;

    const aa = getActionById(a);
    const bb = getActionById(b);
    if (!aa || !bb) return 0;

    const ca = database.category.findIndex(category => category.id === aa.categoryId);
    const cb = database.category.findIndex(category => category.id === bb.categoryId);
    if (ca !== cb) return ca - cb;

    return database.action.findIndex(action => action.id === a) - database.action.findIndex(action => action.id === b);
  });
}

function getCurrentUtcDayId() {
  const utcDayId = typeof window.getHarvestHubUtcDayId === "function" ? window.getHarvestHubUtcDayId() : null;
  return utcDayId && database.days[utcDayId] ? utcDayId : database.dayOrder[0];
}

function getPoints(actionId, eventType, level = null) {
  const points = getActionById(actionId)?.points?.[eventType];
  if (points == null) return 0;
  if (typeof points === "object") return Number(points[level]) || 0;
  return Number(points) || 0;
}

function getQuantityControl(row) {
  return row.querySelector("input[data-action-id], select[data-action-id]");
}

function getRowActionId(row) {
  return row.dataset.actionId || getQuantityControl(row)?.dataset.actionId || row.querySelector(".action-level-select")?.dataset.levelActionId || "";
}

function getRowEventType(row) {
  return row.dataset.eventType || row.querySelector("[data-event-type]")?.dataset.eventType || "";
}

function getLineState(line) {
  return {
    level: line.querySelector("select")?.value || line.dataset.level || "",
    value: line.querySelector("input")?.value || "0"
  };
}

function getTroopRowsFromState(state = {}) {
  const sourceRows = Array.isArray(state.rows)
    ? state.rows
    : Array.isArray(state.stages)
      ? state.stages.map(stage => ({ level: stage.level, value: stage.troops ?? stage.value }))
      : [];

  if (sourceRows.length > 0) {
    return sourceRows.map((row, index) => ({
      level: String(row.level ?? TROOP_LEVEL_DEFAULTS[index] ?? 10),
      value: String(row.value ?? row.troops ?? "0")
    }));
  }

  if (state.value != null || state.level != null) return [{ level: String(state.level ?? 10), value: String(state.value ?? "0") }];
  return [];
}

function getRowState(row) {
  if (row.classList.contains("action-row-multi-level")) {
    const rows = Array.from(row.querySelectorAll(".action-multi-line")).map(getLineState);
    const filled = rows.filter(item => Number(item.value) > 0);
    const last = filled[filled.length - 1] || rows[rows.length - 1] || { level: "", value: "0" };
    return {
      value: String(Math.max(0, ...rows.map(item => Number(item.value) || 0))),
      level: last.level || null,
      rows
    };
  }

  const quantityControl = getQuantityControl(row);
  const levelSelect = row.querySelector(".action-level-select");
  return { value: quantityControl?.value || "0", level: levelSelect?.value || null };
}

function setRowState(row, state = {}) {
  if (row.classList.contains("action-row-multi-level")) {
    const savedRows = getTroopRowsFromState(state);
    Array.from(row.querySelectorAll(".action-multi-line")).forEach((line, index) => {
      const levelSelect = line.querySelector("select");
      const lineLevel = String(levelSelect?.value || line.dataset.level || "");
      const quantityInput = line.querySelector("input");
      const saved = savedRows.find(item => String(item.level) === lineLevel) || savedRows[index];
      if (levelSelect && saved?.level != null) levelSelect.value = String(saved.level);
      if (quantityInput) quantityInput.value = String(saved?.value ?? "0");
    });
    return;
  }

  const quantityControl = getQuantityControl(row);
  const levelSelect = row.querySelector(".action-level-select");
  if (quantityControl) quantityControl.value = String(state?.value ?? "0");
  if (levelSelect && state?.level != null) levelSelect.value = String(state.level);
}

function saveCurrentDayState() {
  if (!currentDayId) return;

  const state = readWeekState();
  state[currentDayId] = { turtle: {}, vs: {} };

  document.querySelectorAll(".action-row").forEach(row => {
    const actionId = getRowActionId(row);
    const eventType = getRowEventType(row);
    if (!actionId || !eventType) return;
    state[currentDayId][eventType][actionId] = getRowState(row);
  });

  writeWeekState(state);
}

function restoreDayState(dayId) {
  const dayState = readWeekState()[dayId];
  if (!dayState) return;

  document.querySelectorAll(".action-row").forEach(row => {
    const actionId = getRowActionId(row);
    const eventType = getRowEventType(row);
    if (!actionId || !eventType) return;
    setRowState(row, dayState[eventType]?.[actionId]);
  });
}

function getGoalTarget(eventType) {
  const input = document.getElementById(eventType === "turtle" ? "turtleGoalPoints" : "vsGoalPoints");
  return parseTargetPoints(input?.value);
}

function getGoalMissing(eventType) {
  return Math.max(getGoalTarget(eventType) - (currentTotals[eventType] || 0), 0);
}

function createNeedOutput(actionId, eventType) {
  const output = document.createElement("div");
  output.className = "action-need-output";
  output.dataset.actionId = actionId;
  output.dataset.eventType = eventType;
  output.dataset.noPersist = "true";
  output.innerHTML = `<span>нужно</span><strong>0</strong>`;
  return output;
}

function updateNeedOutputs() {
  ["turtle", "vs"].forEach(eventType => {
    const missing = getGoalMissing(eventType);
    const missingElement = document.getElementById(eventType === "turtle" ? "turtleGoalMissing" : "vsGoalMissing");
    if (missingElement) missingElement.textContent = formatNumber(missing);
  });

  document.querySelectorAll(".action-need-output").forEach(output => {
    const eventType = output.dataset.eventType;
    const actionId = output.dataset.actionId;
    const line = output.closest(".action-multi-line");
    const row = output.closest(".action-row");
    const level = line?.querySelector("select")?.value || row?.querySelector(".action-level-select")?.value || line?.dataset.level || null;
    const points = getPoints(actionId, eventType, level);
    const target = getGoalTarget(eventType);
    const missing = getGoalMissing(eventType);
    const value = target > 0 && missing > 0 && points > 0 ? Math.ceil(missing / points) : 0;
    const strong = output.querySelector("strong");
    if (strong) strong.textContent = formatNumber(value);
  });
}

function createTextRow(text) {
  const row = document.createElement("div");
  row.className = "action-row action-row-text";
  row.textContent = text;
  return row;
}

function createQuantitySelect(action, eventType) {
  const select = document.createElement("select");
  select.className = "action-quantity-select";
  select.dataset.actionId = action.id;
  select.dataset.eventType = eventType;
  select.dataset.noPersist = "true";

  const zero = document.createElement("option");
  zero.value = "0";
  zero.textContent = "0";
  select.appendChild(zero);

  for (let value = action.quantityOptions.min; value <= action.quantityOptions.max; value++) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  return select;
}

function createNumberInput(action, eventType) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.value = "0";
  input.dataset.actionId = action.id;
  input.dataset.eventType = eventType;
  input.dataset.noPersist = "true";
  return input;
}

function createStaticLevel(value, label) {
  const level = document.createElement("div");
  level.className = "action-level-static";
  level.textContent = label;
  level.dataset.level = value;
  return level;
}

function createLevelSelect(action, eventType, defaultLevel) {
  const select = document.createElement("select");
  select.className = "action-level-select";
  select.dataset.levelActionId = action.id;
  select.dataset.eventType = eventType;
  select.dataset.noPersist = "true";

  action.options.forEach(optionData => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.appendChild(option);
  });

  select.value = String(defaultLevel);
  return select;
}

function createTroopLevelSelect(action, eventType, defaultLevel) {
  const select = document.createElement("select");
  select.className = "action-level-select";
  select.dataset.levelActionId = action.id;
  select.dataset.eventType = eventType;
  select.dataset.noPersist = "true";

  action.options
    .filter(option => TROOP_LEVEL_DEFAULTS.includes(Number(option.value)))
    .forEach(optionData => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      select.appendChild(option);
    });

  select.value = String(defaultLevel);
  return select;
}

function createMultiLine(action, eventType, defaultLevel) {
  const line = document.createElement("div");
  line.className = "action-multi-line";

  const levelSelect = createTroopLevelSelect(action, eventType, defaultLevel);
  const quantityInput = createNumberInput(action, eventType);
  const needOutput = createNeedOutput(action.id, eventType);
  quantityInput.className = "action-quantity-input";
  quantityInput.dataset.hasLevel = "true";

  line.append(levelSelect, quantityInput, needOutput);
  return line;
}

function createTroopUpgradeControls(action, eventType) {
  const controls = document.createElement("div");
  controls.className = "action-controls action-multi-controls";
  TROOP_LEVEL_DEFAULTS.forEach(defaultLevel => controls.appendChild(createMultiLine(action, eventType, defaultLevel)));
  return controls;
}

function createActionRow(action, eventType) {
  const row = document.createElement("div");
  row.className = "action-row action-row-with-need";
  row.dataset.actionId = action.id;
  row.dataset.eventType = eventType;

  const label = document.createElement("label");
  label.textContent = action.name;

  let controls;

  if (action.id === "troop_upgrade" && action.options) {
    row.classList.add("action-row-multi-level");
    controls = createTroopUpgradeControls(action, eventType);
  } else {
    controls = document.createElement("div");
    controls.className = "action-controls";

    if (action.options) {
      row.classList.add("action-row-with-level");
      const levelSelect = createLevelSelect(action, eventType, action.options[0]?.value ?? 1);
      const quantityInput = createNumberInput(action, eventType);
      quantityInput.className = "action-quantity-input";
      quantityInput.dataset.hasLevel = "true";
      controls.append(levelSelect, quantityInput, createNeedOutput(action.id, eventType));
    } else {
      const spacer = document.createElement("div");
      spacer.className = "action-level-spacer";
      controls.append(spacer, action.quantityOptions ? createQuantitySelect(action, eventType) : createNumberInput(action, eventType), createNeedOutput(action.id, eventType));
    }
  }

  row.append(label, controls);
  row.querySelectorAll("input, select").forEach(control => {
    control.addEventListener(control.tagName === "SELECT" ? "change" : "input", () => handleControlChange(action.id, control));
  });

  return row;
}

function syncActionControls(actionId, sourceControl) {
  if (isSyncingControls) return;
  isSyncingControls = true;

  const sourceRow = sourceControl.closest(".action-row");
  const sourceState = getRowState(sourceRow);

  document.querySelectorAll(".action-row").forEach(row => {
    if (row === sourceRow) return;
    if (getRowActionId(row) !== actionId) return;
    setRowState(row, sourceState);
  });

  isSyncingControls = false;
}

function calculateRowTotal(row) {
  const eventType = getRowEventType(row);
  const actionId = getRowActionId(row);

  if (row.classList.contains("action-row-multi-level")) {
    return Array.from(row.querySelectorAll(".action-multi-line")).reduce((sum, line) => {
      const quantity = Number(line.querySelector("input")?.value) || 0;
      const level = line.querySelector("select")?.value || null;
      return sum + quantity * getPoints(actionId, eventType, level);
    }, 0);
  }

  const quantityControl = getQuantityControl(row);
  const level = row.querySelector(".action-level-select")?.value || null;
  return (Number(quantityControl?.value) || 0) * getPoints(actionId, eventType, level);
}

function updateTotals() {
  let turtleTotal = 0;
  let vsTotal = 0;

  document.querySelectorAll(".action-row").forEach(row => {
    const total = calculateRowTotal(row);
    const eventType = getRowEventType(row);
    if (eventType === "turtle") turtleTotal += total;
    if (eventType === "vs") vsTotal += total;
  });

  currentTotals = { turtle: turtleTotal, vs: vsTotal };

  if (document.getElementById("turtleTotal")) document.getElementById("turtleTotal").textContent = formatNumber(turtleTotal);
  if (document.getElementById("vsTotal")) document.getElementById("vsTotal").textContent = formatNumber(vsTotal);
  updateNeedOutputs();
}

function handleControlChange(actionId, sourceControl) {
  syncActionControls(actionId, sourceControl);
  updateTotals();
  saveCurrentDayState();
}

function renderEventList(container, list, eventType) {
  container.innerHTML = "";

  sortDayItems(resolveDayList(list)).forEach(item => {
    if (typeof item !== "string") {
      container.appendChild(createTextRow(item.text));
      return;
    }

    const action = getActionById(item);
    if (action) container.appendChild(createActionRow(action, eventType));
  });
}

function bindGoalInputs() {
  ["turtleGoalPoints", "vsGoalPoints"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    if (!input.value) input.value = "5M";
    if (input.dataset.goalBound === "true") return;
    input.dataset.goalBound = "true";
    input.addEventListener("input", updateNeedOutputs);
    input.addEventListener("change", updateNeedOutputs);
  });
}

function renderDay(dayId) {
  const day = database.days[dayId];
  const turtleList = document.getElementById("turtleList");
  const vsList = document.getElementById("vsList");
  if (!day || !turtleList || !vsList) return;

  saveCurrentDayState();
  currentDayId = dayId;
  renderEventList(turtleList, day.turtle, "turtle");
  renderEventList(vsList, day.vs, "vs");
  restoreDayState(dayId);
  bindGoalInputs();
  updateTotals();
}

function fillDaySelector() {
  const selector = document.getElementById("daySelector");
  if (!selector) return;

  selector.innerHTML = "";
  database.dayOrder.forEach(dayId => {
    const option = document.createElement("option");
    option.value = dayId;
    option.textContent = database.days[dayId].name;
    selector.appendChild(option);
  });

  selector.addEventListener("change", () => {
    selectedManually = true;
    renderDay(selector.value);
  });
}

function selectCurrentUtcDay() {
  const selector = document.getElementById("daySelector");
  if (!selector) return;

  const dayId = getCurrentUtcDayId();
  selector.value = dayId;
  renderDay(dayId);
}

export function init() {
  fillDaySelector();
  selectCurrentUtcDay();
  bindGoalInputs();
  updateNeedOutputs();

  window.addEventListener("harvesthub:utc-day-change", () => {
    if (selectedManually) return;
    selectCurrentUtcDay();
  });

  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    if (!selectedManually) selectCurrentUtcDay();
  }, 60000);
}
