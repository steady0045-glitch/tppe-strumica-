// Админ-алатки: ново соопштение и аларм. Лозинката е иста како кај мобилната и се чита од
// облакот (appdata/main.adminPin); не е запишана во кодот на десктопот.
// ЗАБЕЛЕШКА: ова е удобност, не вистинска безбедност — тоа го решаваат Firestore Rules / Authentication.
(function () {
  const S = window.TPPE_STORE, UI = window.TPPE_UI, st = S.state;
  const $ = UI.$;
  const OK_KEY = "tppeDesktopAdminOk";
  const IDLE_MS = 10 * 60 * 1000;
  let idleTimer;

  function isUnlocked() { return document.body.classList.contains("admin"); }

  function setUnlocked(on) {
    document.body.classList.toggle("admin", on);
    try { on ? sessionStorage.setItem(OK_KEY, "1") : sessionStorage.removeItem(OK_KEY); } catch (e) {}
    $("btnAdmin").textContent = on ? "🔓 Заклучи" : "🔐 Админ";
    clearTimeout(idleTimer);
    if (!on && UI.closeDutyReport) UI.closeDutyReport();
    if (on) idleTimer = setTimeout(() => setUnlocked(false), IDLE_MS);
    UI.renderNotices();
  }
  const touch = () => { if (isUnlocked()) { clearTimeout(idleTimer); idleTimer = setTimeout(() => setUnlocked(false), IDLE_MS); } };

  // Бара админ пристап; ако е веќе отклучено веднаш ја извршува акцијата, инаку прво го отвора прозорецот за лозинка.
  let afterUnlock = null;
  function requireAdmin(cb) {
    if (isUnlocked()) { cb(); return; }
    afterUnlock = cb;
    $("pinError").hidden = true; $("pinInput").value = "";
    $("pinDialog").showModal(); $("pinInput").focus();
  }

  function init() {
    try { if (sessionStorage.getItem(OK_KEY) === "1") setUnlocked(true); } catch (e) {}
    const dlg = $("pinDialog");

    $("btnAdmin").addEventListener("click", () => {
      if (isUnlocked()) { setUnlocked(false); return; }
      requireAdmin(null);
    });
    $("pinCancel").addEventListener("click", () => dlg.close());
    // клик на позадината надвор од прозорецот = назад; затворањето (и Esc) ја чисти акцијата
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { $("pinInput").value = ""; afterUnlock = null; });
    $("pinForm").addEventListener("submit", e => {
      e.preventDefault();
      if (st.adminPin == null) {
        $("pinError").textContent = "Нема врска со базата — лозинката не може да се провери.";
        $("pinError").hidden = false; return;
      }
      if ($("pinInput").value === st.adminPin) {
        const cb = afterUnlock; afterUnlock = null;
        dlg.close(); setUnlocked(true);
        if (typeof cb === "function") cb();
      }
      else { $("pinError").textContent = "Погрешна лозинка"; $("pinError").hidden = false; }
    });

    $("noticeBtn").addEventListener("click", () => {
      const ta = $("noticeText"), text = ta.value.trim();
      if (!text) { UI.toast("Напиши соопштение.", true); return; }
      S.addNotice(text).then(() => { ta.value = ""; UI.toast("✓ Објавено на огласна табла"); }).catch(UI.fail);
    });

    $("alarmBtn").addEventListener("click", () => {
      if (st.alarm && st.alarm.active) {
        if (!confirm("Исклучи го алармот кај сите корисници?")) return;
        S.setAlarm(false).then(() => { $("alarmLocIn").value = ""; $("alarmDetIn").value = ""; UI.toast("✓ Алармот е исклучен"); }).catch(UI.fail);
        return;
      }
      const loc = $("alarmLocIn").value.trim(), det = $("alarmDetIn").value.trim();
      if (!loc) { UI.toast("Внеси место на интервенцијата.", true); $("alarmLocIn").focus(); return; }
      if (!det) { UI.toast("Внеси краток опис на интервенцијата.", true); $("alarmDetIn").focus(); return; }
      if (!confirm("Вклучи аларм кај СИТЕ корисници?\n\nМесто: " + loc + "\nОпис: " + det)) return;
      S.setAlarm(true, loc, det).then(() => UI.toast("🚨 Алармот е вклучен")).catch(UI.fail);
    });

    $("adminCard").addEventListener("pointerdown", touch);
    $("adminCard").addEventListener("keydown", touch);
  }

  window.TPPE_ADMIN = { init, requireAdmin };
})();
