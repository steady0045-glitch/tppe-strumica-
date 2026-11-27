// Приказ (картички) на Dashboard-от. Целата содржина се вметнува преку textContent / DOM,
// никогаш како сирово HTML, па внесен текст не може да изврши код.
(function () {
  const S = window.TPPE_STORE, SCH = window.TPPE_SCHEDULE, st = S.state;
  const $ = id => document.getElementById(id);
  const isTv = () => document.body.classList.contains("tv");

  function h(tag, props, children) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v === false || v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    (children || []).forEach(c => { if (c != null) e.append(c); });
    return e;
  }

  let toastTimer;
  function toast(msg, isErr) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ""; }, 3000);
  }
  const fail = e => toast("Грешка: " + (e && e.message ? e.message : e), true);

  const present = n => {
    const gone = new Set(st.absences[n] || []);
    return (st.teams[n] || []).filter(x => !gone.has(x));
  };
  const pad = n => String(n).padStart(2, "0");

  // ---------- Часовник, датум, време ----------
  const WEATHER = {
    0: ["☀️", "Ведро"], 1: ["🌤️", "Претежно ведро"], 2: ["⛅", "Променливо облачно"], 3: ["☁️", "Облачно"],
    45: ["🌫️", "Магла"], 48: ["🌫️", "Магла"], 51: ["🌦️", "Слабо росење"], 53: ["🌦️", "Росење"], 55: ["🌧️", "Силно росење"],
    61: ["🌧️", "Слаб дожд"], 63: ["🌧️", "Дожд"], 65: ["🌧️", "Силен дожд"], 71: ["🌨️", "Слаб снег"], 73: ["🌨️", "Снег"],
    75: ["❄️", "Силен снег"], 80: ["🌦️", "Пљускови"], 81: ["🌧️", "Пљускови"], 82: ["⛈️", "Силни пљускови"],
    95: ["⛈️", "Грмотевици"], 96: ["⛈️", "Грмотевици со град"], 99: ["⛈️", "Грмотевици со град"]
  };
  async function loadWeather() {
    const el = $("weather");
    try {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=41.4378&longitude=22.6427&current=temperature_2m,weather_code&timezone=Europe%2FSkopje", { cache: "no-store" });
      if (!r.ok) throw new Error("weather");
      const c = (await r.json()).current;
      const info = WEATHER[c.weather_code] || ["🌡️", "Временска состојба"];
      el.replaceChildren(h("span", { class: "w-ico", text: info[0] }),
        h("span", {}, [h("b", { text: Math.round(c.temperature_2m) + "°C" }), h("small", { text: "Струмица · " + info[1] })]));
    } catch (e) {
      el.replaceChildren(h("span", { class: "w-ico", text: "🌡️" }), h("small", { text: "Струмица · времето не е достапно" }));
    }
  }

  function tickClock() {
    const now = new Date();
    $("clock").textContent = SCH.MK.time(now);
    $("date").textContent = SCH.MK.long(now);
    const cd = $("countdown");
    if (cd) {
      const p = SCH.currentPeriod(now);
      const s = Math.max(0, Math.round((p.nextChange - now) / 1000));
      cd.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60);
    }
    // Промена на смена / нов ден → повторно исцртај
    const key = slotKey(now);
    if (key !== lastSlotKey) { renderDuty(); renderCalendar(); }
  }

  // ---------- Дежурни смени ----------
  const ROLES = [["duty", "Дежурна"], ["standby", "Приправна"], ["next", "Наредна"], ["free", "Слободна"]];
  let lastSlotKey = "";
  function slotKey(now) {
    const p = SCH.currentPeriod(now);
    return p.slot.duty + "-" + p.slot.standby + "-" + p.slot.next + "-" + p.slot.free + "-" + now.toDateString() + p.isDay;
  }

  function chip(name, team, isAbsent) {
    const tel = st.phones[name];
    const onField = !!st.fieldStatuses[name];
    const nameNode = h("span", {
      class: "chip-name" + (onField ? " on-field" : ""),
      text: name,
      title: onField ? "На терен — двоен клик за враќање" : "Двоен клик за означување: На терен",
      ondblclick: event => {
        event.preventDefault();
        const next = !st.fieldStatuses[name];
        S.setFieldStatus(name, next)
          .then(() => toast(next ? "✓ " + name + " е означен/а: НА ТЕРЕН" : "✓ " + name + " е вратен/а во редовен статус"))
          .catch(fail);
      }
    });
    const c = h("span", { class: "chip" + (isAbsent ? " absent" : ""), title: tel || "" }, [nameNode]);
    if (!isTv()) {
      c.append(h("button", {
        type: "button", class: "chip-btn", text: isAbsent ? "Врати" : "Отсутен",
        onclick: () => S.setAbsent(name, team, !isAbsent).then(() => toast(isAbsent ? "✓ Вратен" : "✓ Означен како отсутен")).catch(fail)
      }));
    }
    return c;
  }

  function renderDuty() {
    const now = new Date();
    lastSlotKey = slotKey(now);
    const p = SCH.currentPeriod(now);
    const body = $("dutyBody");
    body.replaceChildren();

    body.append(h("div", { class: "period" }, [
      h("span", { class: "period-label", text: p.isDay ? "☀️ Дневна смена (07:00–19:00)" : "🌙 Ноќна смена (19:00–07:00)" }),
      h("span", { class: "period-count" }, [document.createTextNode("до промена: "), h("b", { id: "countdown", text: "--:--:--" })])
    ]));
    body.append(h("div", { class: "field-status-hint", text: "Двоен клик на име: бело = НА ТЕРЕН · повторен двоен клик = редовен статус" }));

    ROLES.forEach(([key, label], i) => {
      const n = p.slot[key];
      const gone = st.absences[n] || [];
      const here = present(n);
      const card = h("div", { class: "shift t" + n + (i === 0 ? " primary" : "") }, [
        h("div", { class: "shift-head" }, [
          h("span", { class: "badge", text: n }),
          h("span", { class: "shift-role", text: label }),
          h("span", { class: "shift-num", text: "Смена " + n })
        ]),
        h("div", { class: "chips" }, here.length ? here.map(x => chip(x, n, false)) : [h("span", { class: "muted", text: "Нема присутни членови" })])
      ]);
      if (gone.length) {
        card.append(h("div", { class: "absent-row" }, [h("span", { class: "absent-title", text: "⛔ Отсутни (" + gone.length + ")" })]
          .concat(gone.filter(x => (st.teams[n] || []).includes(x)).map(x => chip(x, n, true)))));
      }
      body.append(card);
    });
    tickClock();
  }

  // ---------- Огласна табла ----------
  function renderNotices() {
    const box = $("noticeBody");
    const list = [...st.notices].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    $("noticeCount").textContent = list.length ? String(list.length) : "";
    box.replaceChildren();
    if (!list.length) { box.append(h("div", { class: "empty", text: "Нема активни соопштенија." })); return; }
    list.forEach(n => {
      const item = h("div", { class: "notice" }, [
        h("div", { class: "notice-meta", text: n.date || "" }),
        h("div", { class: "notice-text", text: n.text || "" })
      ]);
      if (document.body.classList.contains("admin") && !isTv()) {
        item.append(h("button", {
          type: "button", class: "danger sm", text: "Избриши",
          onclick: () => { if (confirm("Избриши соопштение?")) S.deleteNotice(n.id).then(() => toast("✓ Избришано")).catch(fail); }
        }));
      }
      box.append(item);
    });
  }

  // ---------- Чат ----------
  function chatTime(m) {
    try {
      const v = m.createdAt;
      const d = v && typeof v.toDate === "function" ? v.toDate() : new Date(m.clientTs || Date.now());
      return SCH.MK.chat(d);
    } catch (e) { return ""; }
  }
  function renderChat() {
    const box = $("chatBody");
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const s = $("chatStatus");
    s.textContent = st.chatStatus.text;
    s.className = "status " + st.chatStatus.level;
    box.replaceChildren();
    if (!st.chat.length) { box.append(h("div", { class: "empty", text: "Сè уште нема пораки. Започни разговор." })); return; }
    st.chat.forEach(m => box.append(h("div", { class: "msg" }, [
      h("div", { class: "msg-meta" }, [h("b", { text: m.name || "Пожарникар" }), h("span", { text: chatTime(m) })]),
      h("div", { class: "msg-text", text: m.text || "" })
    ])));
    if (nearBottom || !box.dataset.init) { box.scrollTop = box.scrollHeight; box.dataset.init = "1"; }
  }

  // ---------- Календар ----------
  let monthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selected = new Date();
  const DOW = ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"];
  const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

  function renderCalendar() {
    const y = monthDate.getFullYear(), m = monthDate.getMonth();
    $("monthLabel").textContent = SCH.MK.month(monthDate);
    const grid = $("calGrid");
    grid.replaceChildren();
    DOW.forEach(d => grid.append(h("div", { class: "cal-dow", text: d })));
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    for (let i = 0; i < first; i++) grid.append(h("div", { class: "cal-cell empty-cell" }));
    const days = new Date(y, m + 1, 0).getDate();
    const todayKey = keyOf(new Date()), selKey = keyOf(selected);
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d), a = SCH.getSlot(date, 7), b = SCH.getSlot(date, 19);
      const k = keyOf(date), hol = SCH.holidayName(y, m, d);
      grid.append(h("button", {
        type: "button", title: hol || "",
        class: "cal-cell" + (k === todayKey ? " today" : "") + (k === selKey ? " sel" : "") + (hol ? " holiday" : ""),
        onclick: () => { selected = date; renderCalendar(); }
      }, [
        h("span", { class: "cal-d", text: d + (hol ? " 🎉" : "") }),
        h("span", { class: "cal-shifts" }, [
          h("i", { class: "t" + a.duty, text: "Д" + a.duty }),
          h("i", { class: "t" + b.duty, text: "Н" + b.duty })
        ])
      ]));
    }
    // Детали за избраниот ден
    const a = SCH.getSlot(selected, 7), b = SCH.getSlot(selected, 19);
    const hol = SCH.holidayName(selected.getFullYear(), selected.getMonth(), selected.getDate());
    const line = (label, n) => h("div", { class: "sel-line t" + n }, [
      h("span", { class: "badge", text: n }),
      h("span", {}, [h("b", { text: label + " — Смена " + n }), h("small", { text: present(n).join(" • ") || "—" })])
    ]);
    $("calSelected").replaceChildren(
      h("div", { class: "sel-title", text: SCH.MK.dayMonth(selected) + (hol ? " · 🎉 " + hol : "") }),
      line("Дневна 07–19", a.duty), line("Ноќна 19–07", b.duty));
  }

  // ---------- Телефони ----------
  function renderPhones() {
    const q = ($("phoneSearch").value || "").trim().toLowerCase();
    const mk = (obj, cls) => Object.entries(obj || {})
      .filter(([n, v]) => n.trim() && (!q || n.toLowerCase().includes(q) || (v || "").includes(q)))
      .sort((a, b) => a[0].localeCompare(b[0], "mk"))
      .map(([name, num]) => {
        const clean = (num || "").replace(/\s+/g, "");
        return h("li", { class: "ph " + cls }, [
          h("span", { class: "ph-name", text: name }),
          clean && !isTv() ? h("a", { class: "ph-num", href: "tel:" + clean, text: num }) : h("span", { class: "ph-num", text: num || "—" })
        ]);
      });
    const svc = mk(st.servicePhones, "svc"), emp = mk(st.phones, "emp");
    $("serviceList").replaceChildren(...(svc.length ? svc : [h("li", { class: "empty", text: "Нема службени броеви." })]));
    $("phoneList").replaceChildren(...(emp.length ? emp : [h("li", { class: "empty", text: "Нема внесени броеви." })]));
  }

  // ---------- Аларм ----------
  let lastAlarmActive = null;
  function renderAlarm() {
    const a = st.alarm || {};
    const active = !!a.active;
    document.body.classList.toggle("alarm-on", active);
    const loc = (a.location || "").trim() || "Не е наведено";
    const det = (a.details || "").trim() || "Не е наведен опис";
    ["alarmLoc", "ovLoc"].forEach(id => { $(id).textContent = loc; });
    ["alarmDet", "ovDet"].forEach(id => { $(id).textContent = det; });
    const btn = $("alarmBtn");
    btn.classList.toggle("active", active);
    btn.textContent = active ? "🛑 ИСКЛУЧИ АЛАРМ — интервенција активна" : "🚨 АЛАРМ — вклучи интервенција";
    if (active && lastAlarmActive !== true) window.TPPE_SOUND.startAlarm();
    if (!active) window.TPPE_SOUND.stopAlarm();
    lastAlarmActive = active;
  }

  // ---------- Известување за ново соопштение ----------
  let lastNoticeTs = null;
  function checkNewNotice() {
    const newest = Math.max(0, ...st.notices.map(n => n.ts || 0));
    if (lastNoticeTs === null) { if (st.loaded) lastNoticeTs = newest; return; }
    if (newest > lastNoticeTs) { lastNoticeTs = newest; window.TPPE_SOUND.tone("notice"); }
  }

  // ---------- Статус ----------
  function renderSync() {
    const s = $("sync");
    s.textContent = st.sync.text;
    s.className = "sync " + st.sync.level;
  }

  function renderAll() {
    renderDuty(); renderNotices(); renderCalendar(); renderPhones(); renderAlarm(); renderSync(); renderChat();
  }

  window.TPPE_UI = {
    $, h, toast, fail, isTv, renderAll, renderNotices, renderDuty, renderPhones, renderCalendar,
    init() {
      S.on(what => {
        if (what === "data" || what === "fieldStatuses") { renderDuty(); if (what === "data") { renderNotices(); renderCalendar(); renderPhones(); renderAlarm(); checkNewNotice(); } }
        else if (what === "chat") renderChat();
        else if (what === "sync") renderSync();
      });
      $("phoneSearch").addEventListener("input", renderPhones);
      $("monthPrev").onclick = () => { monthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1); renderCalendar(); };
      $("monthNext").onclick = () => { monthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1); renderCalendar(); };
      $("monthToday").onclick = () => { const n = new Date(); monthDate = new Date(n.getFullYear(), n.getMonth(), 1); selected = n; renderCalendar(); };
      renderAll();
      setInterval(tickClock, 1000);
      loadWeather(); setInterval(loadWeather, 15 * 60 * 1000);
    }
  };
})();
