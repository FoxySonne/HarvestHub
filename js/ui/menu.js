(() => {
  const COLLAPSED_SHELL_QUERY = "(max-width: 1099px)";
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const openButton = document.getElementById("openMenu");
  const collapsedShell = window.matchMedia(COLLAPSED_SHELL_QUERY);
  let previousFocus = null;

  function syncAccessibility() {
    const hidden = collapsedShell.matches && !isOpen();
    if (sidebar) {
      sidebar.inert = hidden;
      sidebar.setAttribute("aria-hidden", String(hidden));
    }
    openButton?.setAttribute("aria-expanded", String(isOpen()));
  }

  function isProfileSwitcherOpen() {
    return document.getElementById("mobileProfileSwitcher")?.classList.contains("active") || false;
  }

  function isOpen() {
    return sidebar?.classList.contains("active") || false;
  }

  function syncOverlay() {
    const anyPanelOpen = isOpen() || isProfileSwitcherOpen();
    overlay?.classList.toggle("active", anyPanelOpen);
    document.body?.classList.toggle("mobile-panel-open", anyPanelOpen);
  }

  function openMenu() {
    if (!sidebar || !window.matchMedia(COLLAPSED_SHELL_QUERY).matches) return;
    window.dispatchEvent(new CustomEvent("harvesthub:left-menu-open"));
    previousFocus = document.activeElement;
    sidebar.classList.add("active");
    syncAccessibility();
    syncOverlay();
    sidebar.querySelector("a, button, input")?.focus({ preventScroll: true });
  }

  function closeMenu() {
    const wasOpen = isOpen();
    sidebar?.classList.remove("active");
    syncAccessibility();
    syncOverlay();
    if (wasOpen && collapsedShell.matches && previousFocus instanceof HTMLElement) {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
  }

  openButton?.addEventListener("click", openMenu);
  overlay?.addEventListener("click", closeMenu);

  document.addEventListener("click", event => {
    if (event.target.closest("#sidebar [data-page-path]")) closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
    if (event.key !== "Tab" || !isOpen() || !collapsedShell.matches) return;
    const controls = [...sidebar.querySelectorAll("a[href], button, input, select, textarea, [tabindex='0']")]
      .filter(element => !element.disabled && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (!collapsedShell.matches) closeMenu();
    syncAccessibility();
  });

  syncAccessibility();

  window.harvestHubMenu = {
    open: openMenu,
    close: closeMenu,
    isOpen,
    syncOverlay
  };
})();
