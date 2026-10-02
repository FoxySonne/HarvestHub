// Раннее применение темы предотвращает вспышку другой палитры.
(() => {
  let theme = "dark";
  try {
    if (localStorage.getItem("harvesthub_theme") === "light") theme = "light";
  } catch { /* При запрете хранилища тема работает в пределах вкладки. */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
