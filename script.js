// Навигация остаётся доступной, даже если JavaScript не загрузился.
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
const desktopLayout = window.matchMedia("(min-width: 56rem)");

function closeMenu(returnFocus = false) {
  navigation.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.querySelector(".menu-icon").textContent = "☰";
  if (returnFocus) menuToggle.focus();
}

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  navigation.classList.toggle("is-open", !isOpen);
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.querySelector(".menu-icon").textContent = isOpen ? "☰" : "×";
});

navigation.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link || desktopLayout.matches) return;
  // После скрытия меню переводим фокус к выбранному разделу.
  const section = document.querySelector(link.hash);
  closeMenu();
  if (section) {
    section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
desktopLayout.addEventListener("change", () => {
  const focusWasInNavigation = navigation.contains(document.activeElement);
  closeMenu();
  if (!desktopLayout.matches && focusWasInNavigation) menuToggle.focus();
});

menuToggle.hidden = false;
document.documentElement.classList.add("js");
