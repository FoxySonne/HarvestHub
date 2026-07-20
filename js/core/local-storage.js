const PAGE_FORM_STATE_PREFIX = "harvesthub_page_form_state:local:";

function readJsonStorage(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    console.warn(`Не удалось прочитать данные из localStorage: ${key}`, error);
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Не удалось сохранить данные в localStorage: ${key}`, error);
  }
}

function getPageFormStateKey(pageName) {
  return `${PAGE_FORM_STATE_PREFIX}${pageName}`;
}

function getPersistableFields(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll("input, select, textarea")).filter(field => {
    const type = (field.type || "").toLowerCase();
    if (field.dataset.noPersist === "true") return false;
    if (field.closest?.("[data-no-form-persistence]")) return false;
    return !["button", "submit", "reset", "hidden", "file"].includes(type);
  });
}

function getFieldKey(field, index) {
  const buildingRow = field.closest?.(".season-building-row");

  if (buildingRow?.dataset?.buildingId) {
    if (field.classList.contains("season-building-enabled")) return `building:${buildingRow.dataset.buildingId}:enabled`;
    if (field.classList.contains("season-building-current")) return `building:${buildingRow.dataset.buildingId}:current`;
    if (field.classList.contains("season-building-target")) return `building:${buildingRow.dataset.buildingId}:target`;
  }

  if (field.id) return `id:${field.id}`;
  if (field.name) return `name:${field.name}`;
  return `field:${field.tagName.toLowerCase()}:${field.type || "value"}:${index}`;
}

function getFieldValue(field) {
  const type = (field.type || "").toLowerCase();
  return type === "checkbox" || type === "radio" ? field.checked : field.value;
}

function setFieldValue(field, value) {
  const type = (field.type || "").toLowerCase();
  if (type === "checkbox" || type === "radio") {
    field.checked = Boolean(value);
    return;
  }
  field.value = String(value ?? "");
}

function savePageFormState(pageName = window.harvestHubNavigation?.getCurrentPage?.() || localStorage.getItem("currentPage") || "") {
  if (!pageName) return;
  const container = document.getElementById("page-content");
  const fields = getPersistableFields(container);
  if (fields.length === 0) return;

  const state = {};
  fields.forEach((field, index) => {
    state[getFieldKey(field, index)] = getFieldValue(field);
  });
  writeJsonStorage(getPageFormStateKey(pageName), state);
}

function restorePageFormState(pageName) {
  const container = document.getElementById("page-content");
  const fields = getPersistableFields(container);
  const state = readJsonStorage(getPageFormStateKey(pageName), null);
  if (!state || typeof state !== "object") return;

  fields.forEach((field, index) => {
    const key = getFieldKey(field, index);
    if (!Object.prototype.hasOwnProperty.call(state, key)) return;
    setFieldValue(field, state[key]);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function bindPageFormPersistence(pageName) {
  const container = document.getElementById("page-content");
  getPersistableFields(container).forEach(field => {
    if (field.dataset.formPersistenceBound === pageName) return;
    field.dataset.formPersistenceBound = pageName;
    field.addEventListener("input", () => savePageFormState(pageName));
    field.addEventListener("change", () => savePageFormState(pageName));
  });
}

function clearPageFormState(pageName) {
  localStorage.removeItem(getPageFormStateKey(pageName));
}

window.harvestHubStorage = {
  readJsonStorage,
  writeJsonStorage,
  savePageFormState,
  restorePageFormState,
  bindPageFormPersistence,
  clearPageFormState
};

window.savePageFormState = savePageFormState;
window.addEventListener("beforeunload", () => savePageFormState());
