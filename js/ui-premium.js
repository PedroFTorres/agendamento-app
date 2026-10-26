(() => {
  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }
  }
  function activateMenu(button) {
    document.querySelectorAll("#sidebar .menu-item").forEach(item => item.classList.remove("is-active"));
    if (button) button.classList.add("is-active");
  }
  function initPremiumUI() {
    const first = document.querySelector('#sidebar .menu-item[data-page="dashboard"]');
    if (first) activateMenu(first);
    document.querySelectorAll("#sidebar .menu-item").forEach(button => {
      button.addEventListener("click", () => activateMenu(button));
    });
    const content = document.getElementById("page-content");
    if (content) {
      new MutationObserver(() => renderIcons()).observe(content, { childList: true, subtree: true });
    }
    renderIcons();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPremiumUI);
  else initPremiumUI();
})();
