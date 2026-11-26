// Звучни сигнали (исти тонови како мобилната) + повторување на алармот.
(function () {
  let ctx = null;
  let alarmTimer = null;
  const listeners = [];

  function getCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = ctx || new AC();
    return ctx;
  }
  function locked() { return !!ctx && ctx.state === "suspended"; }
  function notifyLock() { listeners.forEach(fn => fn(locked())); }

  function tone(kind) {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") { c.resume().catch(() => {}); }
    if (c.state === "suspended") { notifyLock(); return; } // чека прв клик/допир
    const pattern = kind === "alarm" ? [520, 760, 520, 760, 520, 760] : [880, 660];
    const start = c.currentTime;
    pattern.forEach((freq, i) => {
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = kind === "alarm" ? "sawtooth" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(kind === "alarm" ? 0.16 : 0.08, start + i * 0.22 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.22 + 0.17);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(start + i * 0.22); osc.stop(start + i * 0.22 + 0.18);
    });
  }

  function startAlarm() {
    if (alarmTimer) return;
    tone("alarm");
    alarmTimer = setInterval(() => tone("alarm"), 6000);
  }
  function stopAlarm() { clearInterval(alarmTimer); alarmTimer = null; }

  function unlock() {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().then(notifyLock).catch(() => {});
    notifyLock();
  }
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, unlock));

  window.TPPE_SOUND = { tone, startAlarm, stopAlarm, isLocked: locked, onLockChange: fn => listeners.push(fn), prime: getCtx };
})();
