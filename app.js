// Только оболочка: навигация, панели, тема и обычные часы.
(() => {
  const main = document.querySelector("#content");
  const sidebar = document.querySelector("#sidebar");
  const utilities = document.querySelector("#utilities");

  const backdrop = document.querySelector("#backdrop");
  const topbar = document.querySelector(".topbar");
  const menuButton = document.querySelector("#open-menu");
  const panelButton = document.querySelector("#open-panel");
  const profileButton = document.querySelector("#open-profiles");
  const desktopMenu = matchMedia("(min-width: 56rem)");
  const desktopPanel = matchMedia("(min-width: 80rem)");
  const pages = [...document.querySelectorAll(".page")];
  const pageTitles = new Map(pages.map(page => [page.id, page.querySelector("h1")?.textContent || "HarvestHub"]));
  const tools = new Map([
    ["ipk", "Игра по-крупному"],
    ["turbo-vs", "Турбочерепашка & VS"],
    ["season-resources", "Сезонные ресурсы"],
    ["territory", "Нефть/ДНК/Медь"],
    ["troops", "Обучение войск"]
  ]);
  let openDrawer = null;
  let drawerTrigger = null;

  // На промежуточных ширинах правая панель открывается отдельной кнопкой.
  const panelLauncher = panelButton.cloneNode(true);
  panelLauncher.id = "panel-launcher";
  panelLauncher.classList.add("panel-launcher");
  document.body.append(panelLauncher);

  function drawerFocusables() {
    if (!openDrawer) return [];
    return [...openDrawer.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),[tabindex='0']")]
      .filter(element => element.getClientRects().length > 0);
  }

  function closeDrawer(restoreFocus = true) {
    if (!openDrawer) return;
    const drawer = openDrawer;
    const trigger = drawerTrigger;
    openDrawer = null;
    drawerTrigger = null;
    drawer.hidden = true;
    drawer.inert = true;
    drawer.removeAttribute("role");
    drawer.removeAttribute("aria-modal");
    backdrop.hidden = true;
    document.body.classList.remove("drawer-open");
    main.inert = false;
    topbar.inert = false;
    sidebar.inert = !desktopMenu.matches;
    utilities.inert = !desktopPanel.matches;

    panelLauncher.inert = false;
    [menuButton, panelButton, panelLauncher, profileButton].forEach(button => button.setAttribute("aria-expanded", "false"));
    if (restoreFocus && trigger?.getClientRects().length) trigger.focus({preventScroll: true});
  }

  function showDrawer(drawer, trigger) {
    closeDrawer(false);
    openDrawer = drawer;
    drawerTrigger = trigger;
    drawer.hidden = false;
    drawer.inert = false;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    backdrop.hidden = false;
    document.body.classList.add("drawer-open");
    main.inert = true;
    topbar.inert = true;
    panelLauncher.inert = true;
    if (drawer !== sidebar) sidebar.inert = true;
    if (drawer !== utilities) utilities.inert = true;

    trigger.setAttribute("aria-expanded", "true");
    drawer.querySelector("[data-close-drawer]").focus({preventScroll: true});
  }

  function applyLayout() {
    const activeElement = document.activeElement;
    const focusInSidebar = sidebar.contains(activeElement);
    const focusInUtilities = utilities.contains(activeElement);
    const hadDrawer = Boolean(openDrawer);
    closeDrawer(false);
    sidebar.classList.toggle("is-drawer", !desktopMenu.matches);
    utilities.classList.toggle("is-drawer", !desktopPanel.matches);
    sidebar.hidden = !desktopMenu.matches;
    utilities.hidden = !desktopPanel.matches;
    sidebar.inert = !desktopMenu.matches;
    utilities.inert = !desktopPanel.matches;
    menuButton.hidden = desktopMenu.matches;
    panelButton.hidden = desktopPanel.matches;
    panelLauncher.hidden = !desktopMenu.matches || desktopPanel.matches;
    sidebar.querySelector("[data-close-drawer]").hidden = desktopMenu.matches;
    utilities.querySelector("[data-close-drawer]").hidden = desktopPanel.matches;
    if ((focusInSidebar && sidebar.hidden) || (focusInUtilities && utilities.hidden) || hadDrawer) main.focus({preventScroll:true});
  }

  function syncTheme() {
    const isLight = document.documentElement.dataset.theme === "light";
    document.querySelectorAll("[data-theme-toggle]").forEach(control => control.checked = isLight);
    document.querySelector('meta[name="theme-color"]').content = isLight ? "#f8ffff" : "#1a1f2a";
  }

  function setTheme(theme, persist = true) {
    const normalized = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = normalized;
    document.documentElement.style.colorScheme = normalized;
    if (persist) {
      try { localStorage.setItem("harvesthub_theme", normalized); } catch { /* Не мешаем работе при запрете хранения. */ }
    }
    syncTheme();
  }

  async function showPage(moveFocus = false) {
    const route=location.hash.slice(1)||"home";
    document.body.classList.toggle('resource-screen',route==='resource-map');
    document.body.classList.toggle('reservoir-screen',route==='reservoir');
    if(window.harvestHubFeatures?.has(route)){
      closeDrawer(false);
      const loaded=await window.harvestHubFeatures.show(route);
      if(loaded && moveFocus){main.focus({preventScroll:true}); window.scrollTo({top:0,behavior:"instant"});}
      return;
    }
    const requested = location.hash.slice(1) || "home";
    const isTool = tools.has(requested);
    const id = isTool ? "tool" : pageTitles.has(requested) && requested !== "tool" ? requested : "home";
    const title = isTool ? tools.get(requested) : pageTitles.get(id);
    if (isTool) document.querySelector("#tool-heading").textContent = title;
    pages.forEach(page => page.hidden = page.id !== id);
    document.querySelectorAll(".main-nav a").forEach(link => {
      const active = link.hash === "#" + (isTool ? "calculators" : ["reservoir","resource-map","roster","alliance-vs"].includes(id) ? "alliance" : id);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = title + " — HarvestHub";
    closeDrawer(false);
    window.dispatchEvent(new Event("harvesthub:pagechange"));
    if (moveFocus) {
      main.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:"instant"});
    }
  }

  const localTime = new Intl.DateTimeFormat("ru-RU", {hour:"2-digit", minute:"2-digit", hourCycle:"h23"});
  const utcTime = new Intl.DateTimeFormat("ru-RU", {hour:"2-digit", minute:"2-digit", hourCycle:"h23", timeZone:"UTC"});
  const localDay = new Intl.DateTimeFormat("ru-RU", {weekday:"long"});
  const utcDay = new Intl.DateTimeFormat("ru-RU", {weekday:"long", timeZone:"UTC"});
  function updateClocks() {
    const now = new Date();
    document.querySelectorAll("[data-clock]").forEach(clock => {
      clock.textContent = (clock.dataset.clock === "utc" ? utcTime : localTime).format(now);
      clock.dateTime = now.toISOString();
    });
    document.querySelectorAll("[data-weekday]").forEach(day => {
      const text = (day.dataset.weekday === "utc" ? utcDay : localDay).format(now);
      day.textContent = text[0].toUpperCase() + text.slice(1);
    });
  }

  profileButton.addEventListener("click", () => window.harvestHubAccountUI.open());
  menuButton.addEventListener("click", () => showDrawer(sidebar, menuButton));
  panelButton.addEventListener("click", () => showDrawer(utilities, panelButton));
  panelLauncher.addEventListener("click", () => showDrawer(utilities, panelLauncher));
  backdrop.addEventListener("click", () => closeDrawer());
  document.querySelector(".skip-link").addEventListener("click", event => {
    event.preventDefault();
    main.focus();
  });
  document.querySelectorAll("[data-close-drawer]").forEach(button => button.addEventListener("click", () => closeDrawer()));
  document.addEventListener("keydown", event => {
    if (!openDrawer) return;
    if (event.key === "Escape") { event.preventDefault(); closeDrawer(); }
    if (event.key === "Tab") {
      const controls = drawerFocusables();
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("click", event => {
    if (event.defaultPrevented) return;
    const link = event.target.closest("a[href^='#']");
    if (link && link.hash === location.hash) showPage(true);
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-theme-toggle]")) setTheme(event.target.checked ? "light" : "dark");
  });
  window.addEventListener("hashchange", () => showPage(true));
  window.addEventListener("storage", event => { if (event.key === "harvesthub_theme") setTheme(event.newValue, false); });
  desktopMenu.addEventListener("change", applyLayout);
  desktopPanel.addEventListener("change", applyLayout);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateClocks(); });


  // Горизонтальные жесты панелей не вмешиваются в поля, карты и прокрутку таблиц.
  let swipe = null;
  document.addEventListener("touchstart", event => {
    if (event.touches.length!==1 || desktopMenu.matches || !event.target.closest('[data-no-swipe]')) return;
    const x=event.touches[0].clientX;
    if ((x<24 || x>innerWidth-24) && event.cancelable) event.preventDefault();
  }, {passive:false});
  document.addEventListener("touchstart", event => {
    swipe = null;
    if (event.touches.length !== 1 || desktopMenu.matches || event.target.closest("input,textarea,select,[data-no-swipe],.detail-sheet,.screen-tabs") || (!openDrawer && event.target.closest("button"))) return;
    const touch = event.touches[0];
    swipe = {x:touch.clientX, y:touch.clientY, started:performance.now(), drawer:openDrawer};
    // Safari начинает навигацию от края уже на touchstart.
    if ((touch.clientX < 24 || touch.clientX > innerWidth-24) && event.cancelable) {
      event.preventDefault(); swipe.edge=true; swipe.target=event.target;
    }
  }, {passive:false});
  document.addEventListener("touchmove", event => {
    if (!swipe) return;
    if (event.touches.length !== 1) { swipe = null; return; }
    const dx = event.touches[0].clientX - swipe.x;
    const dy = event.touches[0].clientY - swipe.y;
    if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)*1.4 && event.cancelable) event.preventDefault();
  }, {passive:false});
  document.addEventListener("touchend", event => {
    if (!swipe) return;
    const gesture = swipe; swipe = null;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
    if (gesture.edge && Math.abs(dx)<8 && Math.abs(dy)<8) { gesture.target.closest('a,button')?.click(); return; }
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy)*1.4 || performance.now()-gesture.started > 1000) return;
    if (gesture.drawer) {
      if ((gesture.drawer===sidebar && dx<0)) closeDrawer();
    } else if (dx>0) showDrawer(sidebar,menuButton);
    else window.harvestHubAccountUI.open();
  }, {passive:true});
  document.addEventListener("touchcancel", () => {swipe=null;}, {passive:true});

  let utilitySwipe=null;
  utilities.addEventListener('touchstart',event=>{
    utilitySwipe=null;
    if(openDrawer!==utilities||event.touches.length!==1||!event.target.closest('.utilities-heading'))return;
    utilitySwipe={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  utilities.addEventListener('touchend',event=>{
    if(!utilitySwipe)return;const dx=event.changedTouches[0].clientX-utilitySwipe.x,dy=event.changedTouches[0].clientY-utilitySwipe.y;
    if(dy>64&&dy>Math.abs(dx)*1.4)closeDrawer();utilitySwipe=null;
  },{passive:true});
  utilities.addEventListener('touchcancel',()=>utilitySwipe=null,{passive:true});

  document.documentElement.classList.add("js");
  syncTheme();
  showPage();
  applyLayout();
  updateClocks();
  setInterval(updateClocks, 30000);
})();
