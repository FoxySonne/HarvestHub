// One switch for temporarily disabled headquarters sections and their shortcuts.
(() => {
  const suspended = new Set([
    "alliance/power.html",
    "alliance/vs.html",
    "alliance/vs-statistics.html",
    "alliance/reservoir-activity.html"
  ]);
  window.harvestHubHeadquarters = Object.freeze({
    isSuspended: path => suspended.has(path)
  });
})();
