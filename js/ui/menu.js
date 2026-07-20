const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openButton = document.getElementById("openMenu");

function syncOverlay() {
  const menuOpen = sidebar?.classList.contains("active") || false;
  overlay?.classList.toggle("active", menuOpen);
}

function openMenu() {
  sidebar?.classList.add("active");
  syncOverlay();
  window.dispatchEvent(new CustomEvent("harvesthub:left-menu-open"));
}

function closeMenu() {
  sidebar?.classList.remove("active");
  syncOverlay();
}

if (openButton) openButton.addEventListener("click", openMenu);
if (overlay) overlay.addEventListener("click", closeMenu);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
});

window.openMenu = openMenu;
window.closeMenu = closeMenu;
window.harvestHubMenu = {
  open: openMenu,
  close: closeMenu,
  syncOverlay,
  isOpen: () => sidebar?.classList.contains("active") || false
};
