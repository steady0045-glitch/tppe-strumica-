// ТВ режим: голем приказ без админ-алатки, панелите се менуваат автоматски,
// на аларм се прикажува целоекранско црвено известување. Екранот не се гаси (Wake Lock).
(function () {
  const UI = window.TPPE_UI, SND = window.TPPE_SOUND;
  const $ = UI.$;
  const PANES = ["cardNotices", "cardChat", "cardCalendar", "cardPhones"];
  const ROTATE_MS = 20000;
  let idx = 0, timer = null, wakeLock = null;

  function show(i) {
    idx = (i + PANES.length) % PANES.length;
    PANES.forEach((id, k) => $(id).classList.toggle("rot-active", k === idx));
    document.querySelectorAll("#rotDots i").forEach((d, k) => d.classList.toggle("on", k === idx));
  }
  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.body.classList.contains("alarm-on")) return; // за време на аларм не се менува
      show(idx + 1);
    }, ROTATE_MS);
  }

  async function lockScreen() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* не е достапно */ }
  }
  function releaseScreen() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }

  function enter(fullscreen) {
    document.body.classList.add("tv");
    const dots = $("rotDots");
    dots.replaceChildren(...PANES.map((_, k) => UI.h("i", { onclick: () => { show(k); restartTimer(); } })));
    show(0); restartTimer();
    UI.renderAll();
    SND.prime(); updateHint();
    lockScreen();
    if (fullscreen && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    $("btnTv").textContent = "↩ Излез од ТВ";
  }
  function exit() {
    document.body.classList.remove("tv");
    clearInterval(timer);
    PANES.forEach(id => $(id).classList.remove("rot-active"));
    releaseScreen();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    UI.renderAll();
    $("btnTv").textContent = "📺 ТВ режим";
  }
  const toggle = () => document.body.classList.contains("tv") ? exit() : enter(true);

  // Прелистувачите бараат клик пред да пуштат звук — покажи упатство додека не се отклучи.
  function updateHint() {
    const need = SND.isLocked() && (document.body.classList.contains("tv") || document.body.classList.contains("alarm-on"));
    $("audioHint").hidden = !need;
  }

  function init() {
    $("btnTv").addEventListener("click", toggle);
    $("tvExit").addEventListener("click", exit);
    SND.onLockChange(updateHint);
    new MutationObserver(updateHint).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("keydown", e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "t" || e.key === "T") toggle();
      if (document.body.classList.contains("tv")) {
        if (e.key === "ArrowRight") { show(idx + 1); restartTimer(); }
        if (e.key === "ArrowLeft") { show(idx - 1); restartTimer(); }
        if (e.key === "Escape") exit();
      }
    });
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && document.body.classList.contains("tv")) exit();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && document.body.classList.contains("tv")) lockScreen();
    });
    // Покажи копче за излез само кога глушецот се движи
    let hideT;
    document.addEventListener("mousemove", () => {
      document.body.classList.add("mouse-active");
      clearTimeout(hideT); hideT = setTimeout(() => document.body.classList.remove("mouse-active"), 2500);
    });
    // ?tv=1 директно во ТВ режим (целоекранско бара клик, па се нуди копче)
    if (new URLSearchParams(location.search).get("tv") === "1") enter(false);
  }

  window.TPPE_TV = { init };
})();
