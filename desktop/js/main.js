// Стартување на десктоп Dashboard-от.
(function () {
  const UI = window.TPPE_UI, S = window.TPPE_STORE;
  const $ = UI.$;

  UI.init();
  window.TPPE_ADMIN.init();
  window.TPPE_TV.init();

  // Чат: името е заедничко со мобилната (истиот клуч во истиот домен)
  const nameIn = $("chatName"), textIn = $("chatText");
  try { nameIn.value = localStorage.getItem("tppeDesktopChatDisplayName") || ""; } catch (e) {}
  async function send() {
    const name = nameIn.value.trim(), text = textIn.value.trim();
    if (!name) { UI.toast("Внеси го твоето име и презиме.", true); nameIn.focus(); return; }
    if (!text) { textIn.focus(); return; }
    try { localStorage.setItem("tppeDesktopChatDisplayName", name); } catch (e) {}
    try { await S.sendChat(name, text); textIn.value = ""; } catch (e) { UI.fail(e); }
  }
  $("chatSend").addEventListener("click", send);
  textIn.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

  S.start();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}));
  }
})();
