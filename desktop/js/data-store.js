// Единствен извор на состојбата на десктопот.
// Ги користи ИСТИТЕ Firestore патеки како мобилната: appdata/main и chatMessages.
// Шемата на податоците НЕ се менува: сите записи се во постојните полиња и формат.
(function () {
  const db = window.tppeDb;
  const SCH = window.TPPE_SCHEDULE;
  const MAIN = db.collection("appdata").doc("main");
  const FIELD = db.collection("appdata").doc("fieldStatuses");
  const CACHE_KEY = "tppeDesktopCache"; // посебен клуч, не го допира "tppeCache" на мобилната

  const state = {
    teams: JSON.parse(JSON.stringify(SCH.DEFAULT_TEAMS)),
    absences: { 1: [], 2: [], 3: [], 4: [] },
    phones: {},
    servicePhones: JSON.parse(JSON.stringify(SCH.DEFAULT_SERVICE)),
    notices: [],
    alarm: { active: false, location: "", details: "" },
    fieldStatuses: {},
    adminPin: null,      // само во меморија, никогаш во localStorage
    chat: [],
    loaded: false,       // стигнале ли се податоци од облак
    sync: { text: "Се поврзува...", level: "warn" },
    chatStatus: { text: "Се поврзува со разговорот...", level: "warn" }
  };

  const listeners = [];
  const on = fn => listeners.push(fn);
  const emit = what => listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });

  function setSync(text, level) { state.sync = { text, level }; emit("sync"); }

  function apply(data) {
    if (!data) return;
    if (data.teams) state.teams = data.teams;
    if (data.absences) state.absences = Object.assign({ 1: [], 2: [], 3: [], 4: [] }, data.absences);
    if (data.phones) state.phones = data.phones;
    if (data.servicePhones) state.servicePhones = data.servicePhones;
    if (Array.isArray(data.notices)) state.notices = data.notices;
    state.alarm = data.alarm || { active: false, location: "", details: "" };
    if (typeof data.adminPin === "string") state.adminPin = data.adminPin;
  }

  function saveCache() {
    try {
      const { teams, absences, phones, servicePhones, notices, alarm } = state;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ teams, absences, phones, servicePhones, notices, alarm }));
    } catch (e) { /* приватен прозорец / блокирано складирање */ }
  }
  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c) { apply(c); emit("data"); }
    } catch (e) { /* ignore */ }
  }

  function start() {
    loadCache();

    FIELD.onSnapshot(snap => {
      state.fieldStatuses = snap.exists ? (snap.data().statuses || {}) : {};
      emit("fieldStatuses");
    }, err => {
      console.error("Field-status sync error:", err);
      emit("fieldStatusError");
    });

    MAIN.onSnapshot(snap => {
      if (snap.exists) {
        apply(snap.data());
        state.loaded = true;
        saveCache();
        emit("data");
        setSync("● Синхронизирано", "ok");
      } else {
        setSync("Нема податоци од админ уште", "warn");
      }
    }, () => setSync("Офлајн / грешка — се прикажуваат последните податоци", "warn"));

    db.collection("chatMessages").orderBy("createdAt", "asc").limitToLast(60).onSnapshot(snap => {
      state.chat = (snap.docs || []).map(d => Object.assign({ _id: d.id }, d.data() || {}));
      state.chatStatus = { text: "● Поврзано — пораките се ажурираат во живо", level: "ok" };
      emit("chat");
    }, err => {
      state.chatStatus = { text: "Чатот не е достапен: " + (err.message || "проверете ги Firebase правилата."), level: "err" };
      emit("chat");
    });

    window.addEventListener("offline", () => setSync("Нема интернет — последните зачувани податоци", "warn"));
    window.addEventListener("online", () => setSync("Се поврзува...", "warn"));
  }

  // ---- Записи (безбедни: транзакции / merge, не го препишуваат целиот документ) ----

  // Отсутен / Врати. Транзакција за да не се пребришат промени од други уреди.
  function setAbsent(name, team, absent) {
    return db.runTransaction(async t => {
      const snap = await t.get(MAIN);
      const cur = Object.assign({ 1: [], 2: [], 3: [], 4: [] }, (snap.exists && snap.data().absences) || {});
      for (let n = 1; n <= 4; n++) cur[n] = (cur[n] || []).filter(x => x !== name);
      if (absent) cur[team].push(name);
      t.set(MAIN, { absences: cur }, { merge: true });
    });
  }

  function addNotice(text) {
    const now = new Date();
    const notice = {
      id: "n" + now.getTime(), text, ts: now.getTime(),
      date: SCH.MK.short(now)
    };
    return db.runTransaction(async t => {
      const snap = await t.get(MAIN);
      const list = (snap.exists && snap.data().notices) || [];
      t.set(MAIN, { notices: [notice].concat(list) }, { merge: true });
    });
  }

  function deleteNotice(id) {
    return db.runTransaction(async t => {
      const snap = await t.get(MAIN);
      const list = (snap.exists && snap.data().notices) || [];
      t.set(MAIN, { notices: list.filter(n => n.id !== id) }, { merge: true });
    });
  }

  // Истиот формат како мобилната: {active, location, details, startedAt}
  function setAlarm(active, location, details) {
    const alarm = active
      ? { active: true, location, details, startedAt: Date.now() }
      : { active: false, location: "", details: "", startedAt: Date.now() };
    return MAIN.set({ alarm }, { merge: true });
  }

  // Статусите се чуваат во посебниот заеднички документ appdata/fieldStatuses,
  // истата патека и формат што ги користи мобилната апликација.
  function setFieldStatus(name, active) {
    return db.runTransaction(async t => {
      const snap = await t.get(FIELD);
      const statuses = Object.assign({}, (snap.exists && snap.data().statuses) || {});
      if (active) statuses[name] = true;
      else delete statuses[name];
      t.set(FIELD, { statuses, updatedAt: Date.now() }, { merge: true });
    });
  }

  function sendChat(name, text) {
    return db.collection("chatMessages").add({
      name, text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      clientTs: Date.now()
    });
  }

  window.TPPE_STORE = { state, on, start, setAbsent, setFieldStatus, addNotice, deleteNotice, setAlarm, sendChat };
})();
