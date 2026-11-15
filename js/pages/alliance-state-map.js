import { loadAlliancePageContext, canEditAlliance } from "../alliance/page-context.js?v=20261115-alliance-delete";

const base = new URL("../../data/state-maps/", import.meta.url);
const svgNS = "http://www.w3.org/2000/svg";
const keyPattern = /^[a-z0-9_-]{1,64}$/;
const pathPattern = /^[Mm][MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]*$/;

async function json(url, signal) {
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error("Не удалось загрузить файлы карты.");
  return response.json();
}

function validGeometry(data) {
  if (!Array.isArray(data?.viewBox) || data.viewBox.length !== 4 ||
      !data.viewBox.every(Number.isFinite) || data.viewBox[2] <= 0 || data.viewBox[3] <= 0 ||
      !Array.isArray(data.territories) || !data.territories.length) return false;
  const ids = new Set();
  return data.territories.every(({ id, name, path, fields } = {}) => {
    if (typeof id !== "string" || !keyPattern.test(id) || ids.has(id) ||
        typeof name !== "string" || !name.trim() ||
        typeof path !== "string" || !pathPattern.test(path) || !/[0-9]/.test(path) ||
        (fields != null && (!Array.isArray(fields) || !fields.every(field =>
          typeof field?.label === "string" && ["string", "number"].includes(typeof field.value))))) return false;
    ids.add(id);
    return true;
  });
}

const option = (label, value) => new Option(label, value);
const element = (tag, value) => {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  return node;
};

export async function init() {
  const root = document.getElementById("allianceStateMap");
  if (!root) return;
  const signal = window.harvestHubPageAbortController?.signal;
  const byId = id => root.querySelector("#" + id);
  const status = byId("stateMapStatus"), content = byId("stateMapContent"), retry = byId("stateMapRetry");
  const select = byId("stateMapSelect"), svg = byId("stateMapSvg"), viewport = byId("stateMapViewport");
  const info = byId("stateMapInfo"), hint = byId("stateMapHint"), ownerForm = byId("stateMapOwnerForm");
  const sideForm = byId("stateMapSideForm"), colorForm = byId("stateMapColorForm");
  const ownerInput = byId("stateMapOwner"), colorSide = byId("stateMapColorSide");
  const client = window.harvestHubSupabase;
  let context, catalog, current, geometry, sequence = 0, busy = false, ready = false;
  let selected = null, hovered = null, sides = [], owners = new Map(), shapes = new Map();
  let zoom = 1, x = 0, y = 0, drag = null, ignoreClick = false;
  const editing = () => ready && !busy && canEditAlliance(context);
  const statusText = text => { status.textContent = text; };
  const alive = () => root.isConnected && !signal?.aborted;
  const listen = (node, event, fn) => node.addEventListener(event, fn, { signal });
  const alliance = () => context?.membership?.alliance_id;
  const sideById = id => sides.find(side => side.id === id);
  const getTerritory = node => node.closest?.("[data-state-territory]")?.dataset.stateTerritory;
  const fail = (message, allowRetry = true) => { statusText(message); retry.hidden = !allowRetry; };
  const storageKey = () => "harvesthub_state_map:" + alliance();

  function allowForms() {
    sideForm.hidden = !canEditAlliance(context) || !ready;
    colorForm.hidden = sideForm.hidden || !sides.length;
    ownerForm.hidden = sideForm.hidden || !selected;
    for (const form of [sideForm, colorForm, ownerForm]) {
      for (const field of form.elements) field.disabled = !editing();
    }
    select.disabled = busy;
  }

  function showInfo(id) {
    const territory = geometry?.territories.find(item => item.id === id);
    info.hidden = !territory;
    hint.hidden = Boolean(territory);
    info.replaceChildren();
    if (!territory) return;
    const rows = element("dl");
    const currentOwner = sideById(owners.get(id));
    for (const {label, value} of [{label:"Владелец",value:currentOwner?.name || "Не назначен"}, ...(territory.fields || [])]) {
      rows.append(element("dt", label), element("dd", value));
    }
    info.append(element("h2", territory.name), rows);
  }

  function renderOwners() {
    for (const territory of geometry?.territories || []) {
      const shape = shapes.get(territory.id), side = sideById(owners.get(territory.id));
      shape.style.setProperty("--territory-color", side?.color || "#7890a8");
      shape.classList.toggle("is-selected", territory.id === selected);
      shape.setAttribute("aria-label", territory.name + (side ? ", " + side.name : ""));
    }
    const options = sides.map(side => option(side.name, side.id));
    ownerInput.replaceChildren(option("Без владельца", ""), ...options);
    ownerInput.value = owners.get(selected) || "";
    const previous = colorSide.value;
    colorSide.replaceChildren(...sides.map(side => option(side.name, side.id)));
    if (sideById(previous)) colorSide.value = previous;
    byId("stateMapNewColor").value = sideById(colorSide.value)?.color || "#35a7a0";
    byId("stateMapSides").replaceChildren(...sides.map(side => {
      const item = element("li"), dot = element("span");
      dot.style.backgroundColor = side.color;
      dot.setAttribute("aria-hidden", "true");
      item.append(dot, document.createTextNode(side.name));
      return item;
    }));
    allowForms();
    showInfo(hovered || selected);
  }

  function move() {
    const maxX = viewport.clientWidth * (zoom - 1) / 2;
    const maxY = viewport.clientHeight * (zoom - 1) / 2;
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
    svg.style.transform = "translate(" + x + "px," + y + "px) scale(" + zoom + ")";
  }

  function changeZoom(next, anchor) {
    next = Math.max(1, Math.min(6, next));
    const ratio = next / zoom;
    x = anchor ? (x - anchor.x) * ratio + anchor.x : x * ratio;
    y = anchor ? (y - anchor.y) * ratio + anchor.y : y * ratio;
    zoom = next;
    if (zoom === 1) x = y = 0;
    move();
  }

  function draw(data) {
    geometry = data;
    selected = hovered = null;
    shapes = new Map();
    svg.replaceChildren();
    svg.setAttribute("viewBox", data.viewBox.join(" "));
    for (const territory of data.territories) {
      const shape = document.createElementNS(svgNS, "path");
      shape.dataset.stateTerritory = territory.id;
      shape.setAttribute("d", territory.path);
      shape.setAttribute("tabindex", "0");
      shape.setAttribute("role", "button");
      shapes.set(territory.id, shape);
      svg.append(shape);
    }
    zoom = 1;
    x = y = 0;
    move();
  }

  async function loadMap(key, reloadGeometry = true) {
    const ticket = ++sequence;
    ready = false;
    allowForms();
    retry.hidden = true;
    statusText("Загружаем карту и назначения…");
    try {
      const next = catalog.find(item => item.id === key);
      if (!next) throw new Error("Карта не найдена.");
      if (reloadGeometry) { content.hidden = true; svg.replaceChildren(); }
      // RLS may return zero rows after membership ends; check membership explicitly.
      const membership = await client.rpc("get_my_alliance_hubs_v2");
      if (membership.error) throw membership.error;
      const fresh = membership.data?.find(item => item.alliance_id === alliance());
      if (ticket !== sequence || !alive()) return;
      if (!fresh) {
        content.hidden = true;
        statusText("Доступ к штабу закрыт.");
        await window.loadPage("alliance/members.html");
        return;
      }
      context.membership = fresh;
      const results = await Promise.all([
        reloadGeometry ? json(new URL(next.id + ".json", base), signal) : geometry,
        client.from("alliance_state_map_sides").select("id,name,color").eq("alliance_id", alliance()).eq("map_key", next.id).order("name"),
        client.from("alliance_state_map_owners").select("territory_key,side_id").eq("alliance_id", alliance()).eq("map_key", next.id)
      ]);
      if (ticket !== sequence || !alive()) return;
      const [data, sideResult, ownerResult] = results;
      if (!validGeometry(data)) throw new Error("Файл карты содержит неверную разметку территорий.");
      if (sideResult.error || ownerResult.error) throw sideResult.error || ownerResult.error;
      current = next;
      sides = sideResult.data || [];
      owners = new Map((ownerResult.data || []).map(row => [row.territory_key, row.side_id]));
      if (reloadGeometry) draw(data);
      content.hidden = false;
      select.value = key;
      try { localStorage.setItem(storageKey(), key); } catch {}
      ready = true;
      renderOwners();
      move();
      statusText("");
    } catch (error) {
      if (ticket === sequence && alive()) fail(error.message || "Не удалось открыть карту.");
    }
  }

  async function start() {
    retry.hidden = true;
    statusText("Загружаем карты…");
    try {
      context = await loadAlliancePageContext(client, { requireAlliance: false, force: true });
      if (!alive()) return;
      if (context.isGuest || !alliance()) {
        fail("Карта штата доступна участникам штаба после входа в аккаунт.", false);
        return;
      }
      catalog = await json(new URL("catalog.json", base), signal);
      if (!alive()) return;
      if (!Array.isArray(catalog) || !catalog.every(item => typeof item?.id === "string" &&
          keyPattern.test(item.id) && typeof item.title === "string" && item.title.trim()) ||
          new Set(catalog.map(item => item.id)).size !== catalog.length) throw new Error("Не удалось прочитать список карт.");
      if (!catalog.length) {
        statusText("Карты штатов пока не добавлены.");
        return;
      }
      select.replaceChildren(...catalog.map(item => option(item.title, item.id)));
      let saved;
      try { saved = localStorage.getItem(storageKey()); } catch {}
      select.value = catalog.some(item => item.id === saved) ? saved : catalog[0].id;
      await loadMap(select.value);
    } catch (error) {
      if (alive()) fail(error.message || "Не удалось загрузить список карт.");
    }
  }

  async function save(operation, clear) {
    if (!editing() || !current) return;
    busy = true;
    allowForms();
    statusText("Сохраняем…");
    try {
      const result = await operation();
      if (result.error) throw result.error;
      if (!alive()) return;
      clear?.();
      await loadMap(current.id, false);
      if (ready) statusText("Изменения сохранены в штабе.");
    } catch (error) {
      if (alive()) statusText(error.code === "23505" ? "Союз с таким названием уже есть на этой карте." :
        error.code === "42501" ? "Право на изменение карты больше недоступно." :
        "Не удалось сохранить изменение. Обнови карту и попробуй ещё раз.");
    } finally {
      busy = false;
      if (alive()) allowForms();
    }
  }

  function choose(id) {
    if (!id || !ready) return;
    selected = id;
    hovered = null;
    renderOwners();
  }
  listen(retry, "click", () => select.value && catalog?.length ? loadMap(select.value) : start());
  listen(select, "change", () => loadMap(select.value));
  for (const button of root.querySelectorAll("[data-state-zoom]")) listen(button, "click", () =>
    changeZoom(button.dataset.stateZoom === "fit" ? 1 : zoom * (button.dataset.stateZoom === "in" ? 1.35 : 1 / 1.35)));
  listen(viewport, "wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    changeZoom(zoom * (event.deltaY > 0 ? 1 / 1.15 : 1.15), {
      x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2
    });
  });
  listen(viewport, "pointerdown", event => {
    if (event.button !== 0 || !event.isPrimary) return;
    ignoreClick = false;
    drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, moved: false };
  });
  listen(viewport, "pointermove", event => {
    if (drag?.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = ignoreClick = true;
      viewport.setPointerCapture(event.pointerId);
      hovered = null;
      showInfo(selected);
    }
    if (drag.moved) { x = drag.x + dx; y = drag.y + dy; move(); }
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"]) {
    listen(viewport, event, e => {
      if (drag?.pointer === e.pointerId && (event !== "pointerleave" || !drag.moved)) drag = null;
    });
  }
  listen(svg, "pointerover", event => {
    if (event.pointerType !== "mouse" || drag?.moved) return;
    hovered = getTerritory(event.target);
    showInfo(hovered || selected);
  });
  listen(svg, "pointerleave", () => { hovered = null; showInfo(selected); });
  listen(svg, "focusin", event => showInfo(getTerritory(event.target) || selected));
  listen(svg, "focusout", event => { if (!svg.contains(event.relatedTarget)) showInfo(hovered || selected); });
  listen(svg, "click", event => { if (!ignoreClick || event.detail === 0) choose(getTerritory(event.target)); });
  listen(viewport, "keydown", event => {
    const id = getTerritory(event.target);
    if (id && ["Enter", " "].includes(event.key)) { event.preventDefault(); choose(id); }
    if (event.target !== viewport) return;
    const delta = { ArrowLeft:[48,0], ArrowRight:[-48,0], ArrowUp:[0,48], ArrowDown:[0,-48] }[event.key];
    if (delta && zoom > 1) { event.preventDefault(); x += delta[0]; y += delta[1]; move(); }
  });
  listen(window, "resize", move);
  listen(colorSide, "change", () => { byId("stateMapNewColor").value = sideById(colorSide.value)?.color || "#35a7a0"; });
  listen(sideForm, "submit", event => {
    event.preventDefault();
    const input = byId("stateMapSideName"), name = input.value.trim(), color = byId("stateMapSideColor").value;
    if (!name) { input.focus(); statusText("Введи название союза."); return; }
    void save(() => client.from("alliance_state_map_sides").insert({ alliance_id: alliance(), map_key: current.id, name, color }), () => { input.value = ""; });
  });
  listen(colorForm, "submit", event => {
    event.preventDefault();
    const id = colorSide.value;
    if (!sideById(id)) return;
    void save(() => client.from("alliance_state_map_sides").update({color:byId("stateMapNewColor").value})
      .eq("alliance_id", alliance()).eq("map_key", current.id).eq("id", id).select("id").single());
  });
  listen(ownerForm, "submit", event => {
    event.preventDefault();
    if (!selected) return;
    void save(() => client.rpc("set_state_map_owner", {
      target_alliance_id: alliance(), target_map_key: current.id,
      target_territory_key: selected, target_side_id: ownerInput.value || null
    }));
  });

  await start();
}
