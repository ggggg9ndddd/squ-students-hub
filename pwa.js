(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });

  let installPrompt;
  const installButton = document.createElement("button");
  installButton.type = "button";
  installButton.id = "installApp";
  installButton.className = "install-btn";
  installButton.innerHTML = '<span aria-hidden="true">↓</span><span>تثبيت التطبيق</span>';
  installButton.hidden = true;

  const addInstallButton = () => {
    const actions = document.querySelector(".top-actions");
    if (actions && !document.getElementById("installApp")) actions.prepend(installButton);
  };

  document.addEventListener("DOMContentLoaded", addInstallButton);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    addInstallButton();
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });
})();
