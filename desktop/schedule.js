// Распоред на смените — иста формула како во мобилната апликација.
// Смените НЕ се чуваат во базата, туку се пресметуваат: циклус од 8 периоди по 12 часа.
(function () {
  const CYCLE = [1, 3, 4, 1, 2, 4, 3, 2];
  const ANCHOR = new Date(2026, 9, 30, 7); // 30.10.2026 во 07:00
  const mod = (n, m) => ((n % m) + m) % m;

  function getSlot(date, hour) {
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
    const i = mod(Math.floor((target - ANCHOR) / 43200000), 8);
    const duty = CYCLE[i], standby = CYCLE[mod(i + 1, 8)], next = CYCLE[mod(i + 2, 8)];
    const free = [1, 2, 3, 4].find(x => x !== duty && x !== standby && x !== next);
    return { duty, standby, next, free };
  }

  // Празници во РС Македонија (исти како во мобилната)
  const HOLIDAYS = {
    "01-01": "Нова година", "01-07": "Божик", "05-01": "Ден на трудот",
    "05-24": "Св. Кирил и Методиј", "08-02": "Илинден", "09-08": "Независимост",
    "10-11": "Ден на востанието", "10-23": "Денот на МРО", "12-08": "Св. Климент Охридски",
    "2025-04-18": "Велики петок", "2025-04-20": "Велигден", "2025-04-21": "Велигден",
    "2026-04-10": "Велики петок", "2026-04-12": "Велигден", "2026-04-13": "Велигден",
    "2027-04-30": "Велики петок", "2027-05-02": "Велигден", "2027-05-03": "Велигден"
  };
  function holidayName(y, m, d) {
    const md = String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    return HOLIDAYS[y + "-" + md] || HOLIDAYS[md] || null;
  }

  // Тековен период: дневна 07–19, ноќна 19–07. Враќа и кога е следната промена.
  function currentPeriod(now) {
    const hour = now.getHours();
    const isDay = hour >= 7 && hour < 19;
    let slotDate = now, slotHour = 7;
    if (!isDay) {
      slotHour = 19;
      if (hour < 7) slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    }
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const nextChange = isDay ? new Date(y, m, d, 19)
      : (hour >= 19 ? new Date(y, m, d + 1, 7) : new Date(y, m, d, 7));
    return { isDay, slot: getSlot(slotDate, slotHour), nextChange };
  }

  // Почетни податоци (иста листа како во мобилната) — само додека не стигнат од облакот.
  const DEFAULT_TEAMS = {
    1: ["ТОMОВ", "СТОИЛОВ", "КОЗАРОВ", "ЕФТИМОВ", "СТОЈКОВ", "КУЗМАНОВ", "КАМБЕРОВ", "ДИМИТРУШЕВ", "ШИРИЌ"],
    2: ["ГОНЕВ", "МИТЕВ", "БАЛТАКОВ", "РИСТОВСКИ", "МАРЈАН", "МАЛЧЕВ", "ДЕЈАН", "НАКОВ", "ПАНЧЕ"],
    3: ["ЈАНАКИЕВ", "АПОСТОЛОВ", "КАРКАЛАШЕВ", "ШИЛИНОВ", "МЕНТИНОВ", "СПАСОВ", "МИЛУШЕВ", "ВУЧКОВ", "СТОИЛОВ Б."],
    4: ["ДИКОВ", "СТАНКОВ", "ВЕЛКОВ", "ТАКОВСКИ", "ЈАНКУЛОВ", "КАРАКАШЕВ", "КИКИРЕКОВ", "ИЛЕ", "МИЛКОВСКИ"]
  };
  const DEFAULT_SERVICE = { "Дежурен центар": "", "Директор": "", "Полиција 192": "192", "Итна помош 194": "194", "Противпожарна 193": "193" };

  // Македонски називи на датуми — не зависат од локализацијата на прелистувачот/ТВ-то.
  const DAYS = ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"];
  const DAYS_SHORT = ["нед", "пон", "вто", "сре", "чет", "пет", "саб"];
  const MONTHS = ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"];
  const MONTHS_SHORT = ["јан", "фев", "мар", "апр", "мај", "јун", "јул", "авг", "сеп", "окт", "ное", "дек"];
  const p2 = n => String(n).padStart(2, "0");
  const MK = {
    long: d => DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(),
    dayMonth: d => DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()],
    month: d => MONTHS[d.getMonth()] + " " + d.getFullYear(),
    short: d => DAYS_SHORT[d.getDay()] + ", " + p2(d.getDate()) + " " + MONTHS_SHORT[d.getMonth()] + ", " + p2(d.getHours()) + ":" + p2(d.getMinutes()),
    chat: d => p2(d.getDate()) + "." + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()),
    time: d => p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds())
  };

  window.TPPE_SCHEDULE = { getSlot, holidayName, currentPeriod, DEFAULT_TEAMS, DEFAULT_SERVICE, MK };
})();
