import { apiRequest } from "./core/api.js";

const $ = (id) => document.getElementById(id);

let CONFIG = null;
let selectedWeekStartISO = null;
let currentWeekCache = []; // [{dateISO, carId, trip}]

const CAR_PHOTOS = {
  COBALT: "./assets/cars/cobalt.png",
  HRV: "./assets/cars/hrv.png",
  ZAFIRA: "./assets/cars/zafira.png",
  CELTA: "./assets/cars/celta.png",
};

const MIN_START_ISO = "2026-02-02";

/* =========================
   Utils
========================= */
function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

const PARKING_FEE_PER_PERSON = 20;

function getFirstDayOfMonthInWeek(startISO) {
  const start = new Date(`${startISO}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDate() === 1) return d; // achou dia 1 dentro dessa semana
  }
  return null;
}

function monthLabelFromDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${mm}/${yy}`;
}



function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function brDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function weekdayLongPt(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const names = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  return names[d.getDay()] || "";
}

function getMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildWeeksFromMin(minStartISO) {
  const minMon = getMonday(new Date(`${minStartISO}T00:00:00`));
  const curMon = getMonday(new Date());

  const out = [];
  for (let d = new Date(curMon); d >= minMon; d.setDate(d.getDate() - 7)) {
    const start = new Date(d);
    const end = new Date(d);
    end.setDate(end.getDate() + 4);

    const startISO = toISODate(start);
    const endISO = toISODate(end);

    out.push({
      startISO,
      endISO,
      label: `${brDate(startISO)} a ${brDate(endISO)}`,
    });
  }
  return out;
}

function weekDatesFromStartISO(startISO) {
  const start = new Date(`${startISO}T00:00:00`);
  const out = [];
  for (let i = 0; i < 5; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    out.push({ iso: toISODate(dt) });
  }
  return out;
}

function setHeaderWeekLabel(startISO, endISO) {
  const brandSub = $("brandSub");
  if (brandSub) brandSub.textContent = `Semana: ${brDate(startISO)} a ${brDate(endISO)}`;
}

function peopleMap() {
  const m = new Map();
  (CONFIG?.people || []).forEach((p) => m.set(p.personId, p));
  return m;
}

function carsMap() {
  const m = new Map();
  (CONFIG?.cars || []).forEach((c) => m.set(c.carId, c));
  return m;
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function avatarMarkup(displayName, photoUrl) {
  if (photoUrl) {
    return `<img class="avatar" src="${escHtml(photoUrl)}" alt="${escHtml(displayName)}">`;
  }
  return `<div class="avatar" title="${escHtml(displayName)}">${initials(displayName)}</div>`;
}

function driverMiniMarkup(personId) {
  const pm = peopleMap();
  const p = pm.get(personId);
  const name = p?.name || personId;
  const photoUrl = p?.photoUrl || "";

  if (photoUrl) {
    return `<img class="driverMini" src="${escHtml(photoUrl)}" alt="${escHtml(name)}">`;
  }
  return `<div class="driverMini" title="${escHtml(name)}">${initials(name)}</div>`;
}

function slugGuest(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeAvatar(personId) {
  const pm = peopleMap();
  const isGuest = String(personId).startsWith("guest#");
  const displayName = isGuest ? personId.replace("guest#", "") : pm.get(personId)?.name || personId;
  const photoUrl = isGuest ? "" : pm.get(personId)?.photoUrl || "";

  if (photoUrl) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = photoUrl;
    img.alt = displayName;
    return img;
  }

  const div = document.createElement("div");
  div.className = "avatar";
  div.title = displayName;
  div.textContent = initials(displayName);
  return div;
}

function makeDriverMini(driverPersonId) {
  const pm = peopleMap();
  const p = pm.get(driverPersonId);
  const name = p?.name || driverPersonId;
  const photoUrl = p?.photoUrl || "";

  if (photoUrl) {
    const img = document.createElement("img");
    img.className = "driverMini";
    img.src = photoUrl;
    img.alt = name;
    return img;
  }

  const div = document.createElement("div");
  div.className = "driverMini";
  div.title = name;
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";
  div.style.fontWeight = "800";
  div.style.fontSize = "12px";
  div.textContent = initials(name);
  return div;
}

/* =========================
   Modal
========================= */
function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;

  $("modalBackdrop").classList.remove("hidden");
  $("modal").classList.remove("hidden");

  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("modalBackdrop").classList.add("hidden");
  $("modal").classList.add("hidden");
  $("modalBody").innerHTML = "";

  document.body.style.overflow = "";
}

/* =========================
   API
========================= */
async function loadConfig() {
  CONFIG = await apiRequest("/config");
}

async function loadTrip(carId, dateISO) {
  try {
    return await apiRequest(`/trip/${encodeURIComponent(carId)}/${encodeURIComponent(dateISO)}`);
  } catch (e) {
    if (String(e.message).includes("trip_not_found") || String(e.message).includes("404")) return null;
    throw e;
  }
}

/* =========================
   Render Semana
========================= */
async function renderWeek(startISO) {
  const wrap = $("weekWrap");
  if (!wrap) return;

  wrap.innerHTML = `<div class="muted">Carregando semana...</div>`;
  setStatus("");

  if (!CONFIG) await loadConfig();

  const weeks = buildWeeksFromMin(MIN_START_ISO);
  const week = weeks.find((w) => w.startISO === startISO) || weeks[0];

  selectedWeekStartISO = week.startISO;
  setHeaderWeekLabel(week.startISO, week.endISO);

  const dates = weekDatesFromStartISO(week.startISO).map((x) => x.iso);
  const cars = (CONFIG.cars || []).map((c) => c.carId);

  const tasks = [];
  for (const iso of dates) {
    for (const carId of cars) {
      tasks.push(loadTrip(carId, iso).then((trip) => ({ dateISO: iso, carId, trip })));
    }
  }

  const results = await Promise.all(tasks);
  currentWeekCache = results.filter((r) => r.trip);

  const byDay = new Map();
  results.forEach((r) => {
    if (!byDay.has(r.dateISO)) byDay.set(r.dateISO, []);
    if (r.trip) byDay.get(r.dateISO).push(r);
  });

  wrap.innerHTML = "";

  const cm = carsMap();
  const pm = peopleMap();

  for (const iso of dates) {
    const dayTrips = byDay.get(iso) || [];

    const dayCard = document.createElement("div");
    dayCard.className = "dayCard";

    const header = document.createElement("div");
    header.className = "dayHeader";
    header.innerHTML = `
      <div class="dayTitle">${weekdayLongPt(iso)} • ${brDate(iso)}</div>
      <div class="dayMeta">${dayTrips.length ? `${dayTrips.length} lançamento(s)` : "sem lançamentos"}</div>
    `;
    dayCard.appendChild(header);

    if (!dayTrips.length) {
      const empty = document.createElement("div");
      empty.style.padding = "12px";
      empty.className = "muted";
      empty.textContent = "Nenhum carro lançado neste dia.";
      dayCard.appendChild(empty);
      wrap.appendChild(dayCard);
      continue;
    }

    dayTrips.forEach(({ carId, trip }) => {
      const car = cm.get(carId);
      const driverId = car?.driverPersonId;
      const driverName = pm.get(driverId)?.name || driverId;

      const row = document.createElement("div");
      row.className = "tripRow";
      row.style.cursor = "pointer";

      const meta = document.createElement("div");
      meta.className = "tripMeta";

      const carImg = document.createElement("img");
      carImg.className = "carPhoto";
      carImg.src = CAR_PHOTOS[carId] || "./assets/cars/placeholder.png";
      carImg.alt = car?.label || carId;

      const driverMini = makeDriverMini(driverId);

      const metaText = document.createElement("div");
      metaText.className = "metaText";
      metaText.innerHTML = `
        <div class="carName">${car?.label || carId}</div>
        <div class="driverName">${driverName}</div>
      `;

      meta.appendChild(carImg);
      meta.appendChild(driverMini);
      meta.appendChild(metaText);

      const colWent = document.createElement("div");
      colWent.className = "col";
      colWent.innerHTML = `<div class="colLabel">FOI</div>`;
      const avWent = document.createElement("div");
      avWent.className = "avatars";
      (trip.went || []).forEach((pid) => avWent.appendChild(makeAvatar(pid)));
      colWent.appendChild(avWent);

      const colRet = document.createElement("div");
      colRet.className = "col";
      colRet.innerHTML = `<div class="colLabel">VOLTOU</div>`;
      const avRet = document.createElement("div");
      avRet.className = "avatars";
      (trip.returned || []).forEach((pid) => avRet.appendChild(makeAvatar(pid)));
      colRet.appendChild(avRet);

      row.appendChild(meta);
      row.appendChild(colWent);
      row.appendChild(colRet);

      row.onclick = () => {
        const wentHtml = (trip.went || []).map((pid) => makeAvatar(pid).outerHTML).join("");
        const retHtml = (trip.returned || []).map((pid) => makeAvatar(pid).outerHTML).join("");

        openModal(
          `${car?.label || carId} • ${weekdayLongPt(iso)} • ${brDate(iso)}`,
          `
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
              <img class="carPhoto" src="${CAR_PHOTOS[carId] || "./assets/cars/placeholder.png"}" alt="">
              ${makeDriverMini(driverId).outerHTML}
              <div>
                <div style="font-weight:900;">${car?.label || carId}</div>
                <div class="muted" style="font-size:12px;">Motorista: ${driverName}</div>
              </div>
            </div>

            <div class="fieldLabel">FOI</div>
            <div class="avatars" style="margin-bottom:12px;">${wentHtml || `<span class="muted">ninguém</span>`}</div>

            <div class="fieldLabel">VOLTOU</div>
            <div class="avatars" style="margin-bottom:14px;">${retHtml || `<span class="muted">ninguém</span>`}</div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btnPrimary" id="btnEditTrip" type="button">
                <i class="bi bi-pencil-square"></i> Editar
              </button>
              <button class="btn" id="btnCloseDetails" type="button">
                <i class="bi bi-x-circle"></i> Fechar
              </button>
            </div>
          `
        );

        document.getElementById("btnEditTrip")?.addEventListener("click", () => {
          openLaunchModal({ dateISO: iso, carId, trip, overwrite: true }).catch((e) =>
            setStatus(`Erro: ${e.message}`)
          );
        });

        document.getElementById("btnCloseDetails")?.addEventListener("click", closeModal);
      };

      dayCard.appendChild(row);
    });

    wrap.appendChild(dayCard);
  }

  setStatus("");
}

/* =========================
   Modal Lançar Dia
========================= */
function wireToggleRow(row) {
  const cbWent = row.querySelector(".cbWent");
  const cbRet = row.querySelector(".cbRet");
  const btWent = row.querySelector(".tglWent");
  const btRet = row.querySelector(".tglRet");

  btWent?.addEventListener("click", () => {
    cbWent.checked = !cbWent.checked;
    btWent.classList.toggle("on", cbWent.checked);
  });

  btRet?.addEventListener("click", () => {
    cbRet.checked = !cbRet.checked;
    btRet.classList.toggle("on", cbRet.checked);
  });
}

async function openLaunchModal(preset = null) {
  if (!CONFIG) await loadConfig();

  const weeks = buildWeeksFromMin(MIN_START_ISO);
  const fallbackWeek = weeks[0];

  if (!selectedWeekStartISO) selectedWeekStartISO = fallbackWeek.startISO;

  const week = weeks.find((w) => w.startISO === selectedWeekStartISO) || fallbackWeek;
  const dates = weekDatesFromStartISO(week.startISO).map((x) => x.iso);

  const pm = peopleMap();

  const presetDate = preset?.dateISO || dates[0];
  const presetCar = preset?.carId || (CONFIG.cars?.[0]?.carId || "COBALT");
  const presetWent = new Set(preset?.trip?.went || (CONFIG.people || []).map((p) => p.personId));
  const presetRet = new Set(preset?.trip?.returned || (CONFIG.people || []).map((p) => p.personId));
  const presetOverwrite = !!preset?.overwrite;

  const cars = CONFIG.cars || [];
  const carCards = cars
    .map((c) => {
      const driverName = pm.get(c.driverPersonId)?.name || c.driverPersonId;
      const on = c.carId === presetCar ? "on" : "";
      const img = CAR_PHOTOS[c.carId] || "./assets/cars/placeholder.png";
      return `
        <button type="button" class="carOpt ${on}" data-car="${escHtml(c.carId)}">
          <img class="carOptImg" src="${escHtml(img)}" alt="${escHtml(c.label)}">
          <div class="carOptMeta">
            <div class="carOptTitle">${escHtml(c.label)}</div>
            <div class="carOptSub">
              ${driverMiniMarkup(c.driverPersonId)}
              <span>${escHtml(driverName)}</span>
            </div>
          </div>
        </button>
      `;
    })
    .join("");

  const dateOptions = dates
    .map((d) => `<option value="${d}" ${d === presetDate ? "selected" : ""}>${brDate(d)}</option>`)
    .join("");

  const peopleRows = (CONFIG.people || [])
    .map((p) => {
      const wentChecked = presetWent.has(p.personId);
      const retChecked = presetRet.has(p.personId);
      return `
        <div class="pickRow" data-pid="${escHtml(p.personId)}">
          <div class="pickLeft">
            ${avatarMarkup(p.name, p.photoUrl)}
            <div class="pickNames">
              <div class="pickName">${escHtml(p.name)}</div>
              <div class="pickId">${escHtml(p.personId)}</div>
            </div>
          </div>

          <div class="toggles">
            <input class="cbWent srOnly" type="checkbox" ${wentChecked ? "checked" : ""}>
            <button type="button" class="tglBtn tglWent ${wentChecked ? "on" : ""}">FOI</button>

            <input class="cbRet srOnly" type="checkbox" ${retChecked ? "checked" : ""}>
            <button type="button" class="tglBtn tglRet ${retChecked ? "on" : ""}">VOLTOU</button>
          </div>
        </div>
      `;
    })
    .join("");

  openModal(preset ? "Editar lançamento" : "Lançar dia", `
    <div class="formGrid">

      <div>
        <div class="fieldLabel">Data</div>
        <select id="inDate" class="input">${dateOptions}</select>
      </div>

      <div>
        <div class="fieldLabel">Carro</div>
        <input type="hidden" id="inCar" value="${escHtml(presetCar)}">
        <div id="carPicker" class="carPicker">${carCards}</div>
      </div>

      <div>
        <div class="fieldLabel">Pessoas</div>
        <div id="pickList" class="pickList">${peopleRows}</div>
      </div>

      <div style="display:flex; gap:10px;">
        <input id="inGuestName" class="input" placeholder="Convidado (ex: Pedro)" />
        <button id="btnAddGuest" class="btn btnIcon" type="button" aria-label="Adicionar">
          <i class="bi bi-person-plus"></i>
        </button>
      </div>

      <label style="display:flex; gap:8px; align-items:center; font-weight:700;">
        <input id="inOverwrite" type="checkbox" ${presetOverwrite ? "checked" : ""} />
        Sobrescrever se já existir
      </label>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnSaveTrip" class="btn btnPrimary" type="button">
          <i class="bi bi-check2-circle"></i> Salvar
        </button>
        <button id="btnCancelTrip" class="btn" type="button">
          <i class="bi bi-x-circle"></i> Cancelar
        </button>
      </div>

      <div id="modalStatus" class="smallStatus"></div>
    </div>
  `);

  const pickListEl = document.getElementById("pickList");
  const carPickerEl = document.getElementById("carPicker");
  const inCarEl = document.getElementById("inCar");
  const modalStatusEl = document.getElementById("modalStatus");

  const setModalStatus = (m) => {
    if (modalStatusEl) modalStatusEl.textContent = m || "";
  };

  // bind toggles existentes
  pickListEl?.querySelectorAll(".pickRow").forEach(wireToggleRow);

  // bind seleção de carro
  carPickerEl?.querySelectorAll(".carOpt").forEach((btn) => {
    btn.addEventListener("click", () => {
      carPickerEl.querySelectorAll(".carOpt").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      inCarEl.value = btn.dataset.car;
    });
  });

  function addGuestToList(name) {
    const slug = slugGuest(name);
    if (!slug) return;

    const pid = `guest#${slug}`;
    if (pickListEl.querySelector(`[data-pid="${pid}"]`)) return;

    const row = document.createElement("div");
    row.className = "pickRow";
    row.dataset.pid = pid;

    row.innerHTML = `
      <div class="pickLeft">
        ${avatarMarkup(name, "")}
        <div class="pickNames">
          <div class="pickName">${escHtml(name)}</div>
          <div class="pickId">${escHtml(pid)}</div>
        </div>
      </div>

      <div class="toggles">
        <input class="cbWent srOnly" type="checkbox" checked>
        <button type="button" class="tglBtn tglWent on">FOI</button>

        <input class="cbRet srOnly" type="checkbox" checked>
        <button type="button" class="tglBtn tglRet on">VOLTOU</button>
      </div>
    `;

    pickListEl.appendChild(row);
    wireToggleRow(row);
  }

  document.getElementById("btnAddGuest")?.addEventListener("click", () => {
    const input = document.getElementById("inGuestName");
    const name = input.value.trim();
    if (!name) return;
    addGuestToList(name);
    input.value = "";
  });

  document.getElementById("btnCancelTrip")?.addEventListener("click", closeModal);

  document.getElementById("btnSaveTrip")?.addEventListener("click", async () => {
    try {
      setModalStatus("Salvando...");

      const dateISO = document.getElementById("inDate").value;
      const carId = document.getElementById("inCar").value;
      const overwrite = document.getElementById("inOverwrite").checked;

      const rows = Array.from(pickListEl.querySelectorAll(".pickRow"));
      const went = [];
      const returned = [];

      rows.forEach((r) => {
        const pid = r.dataset.pid;
        if (r.querySelector(".cbWent")?.checked) went.push(pid);
        if (r.querySelector(".cbRet")?.checked) returned.push(pid);
      });

      if (went.length === 0 && returned.length === 0) {
        setModalStatus("Marque pelo menos 1 pessoa em FOI ou VOLTOU.");
        return;
      }

      const qs = overwrite ? "?overwrite=1" : "";
      await apiRequest(`/trip/${encodeURIComponent(carId)}/${encodeURIComponent(dateISO)}${qs}`, {
        method: "PUT",
        body: { went, returned },
      });

      closeModal();
      await renderWeek(selectedWeekStartISO);
    } catch (e) {
      if (String(e.message).includes("trip_already_exists")) {
        setModalStatus("Já existe lançamento. Marque 'Sobrescrever' e salve novamente.");
        return;
      }
      setModalStatus(`Erro: ${e.message}`);
    }
  });
}

/* =========================
   Extrato WhatsApp
========================= */
function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

function netLedger(ledger) {
  const ids = new Set();

  for (const payer of Object.keys(ledger)) {
    ids.add(payer);
    for (const payee of Object.keys(ledger[payer] || {})) ids.add(payee);
  }

  const arr = Array.from(ids);

  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i];
      const b = arr[j];

      const ab = Number(ledger[a]?.[b] || 0);
      const ba = Number(ledger[b]?.[a] || 0);

      if (!ab && !ba) continue;

      if (ab > ba) {
        ledger[a] = ledger[a] || {};
        ledger[a][b] = round2(ab - ba);
        if (ledger[b]) delete ledger[b][a];
      } else if (ba > ab) {
        ledger[b] = ledger[b] || {};
        ledger[b][a] = round2(ba - ab);
        if (ledger[a]) delete ledger[a][b];
      } else {
        if (ledger[a]) delete ledger[a][b];
        if (ledger[b]) delete ledger[b][a];
      }
    }
  }

  for (const payer of Object.keys(ledger)) {
    for (const payee of Object.keys(ledger[payer])) {
      const v = round2(ledger[payer][payee]);
      if (!v) delete ledger[payer][payee];
      else ledger[payer][payee] = v;
    }
    if (Object.keys(ledger[payer]).length === 0) delete ledger[payer];
  }
}


function displayName(pid) {
  const pm = peopleMap();
  if (String(pid).startsWith("guest#")) return pid.replace("guest#", "Convidado: ");
  return pm.get(pid)?.name || pid;
}

async function openStatementModal() {
  if (!CONFIG) await loadConfig();

  const weeks = buildWeeksFromMin(MIN_START_ISO);
  const week = weeks.find(w => w.startISO === selectedWeekStartISO) || weeks[0];

  if (!currentWeekCache.length) {
    await renderWeek(week.startISO);
  }

  const cm = carsMap();
  const pm = peopleMap();

  const driverLabel = (id) => pm.get(id)?.name || id;

  // "primeira semana do mês" = semana que contém o dia 1
  const firstDay = getFirstDayOfMonthInWeek(week.startISO);
  let includeMonthlyParking = !!firstDay;

  // mês-alvo do estacionamento:
  // - automático: mês do "dia 1" encontrado na semana
  // - manual: mês da data inicial da semana (pra não ficar indefinido)
  const defaultMonthDate = firstDay || new Date(`${week.startISO}T00:00:00`);
  const parkingMonthLabel = monthLabelFromDate(defaultMonthDate);

  // "5 padrão": pega até 5 pessoas do CONFIG (não inclui guests, porque guest# não está no CONFIG)
  const defaultPayers = (CONFIG.people || [])
    .map(p => p.personId)
    .filter(pid => !String(pid).startsWith("guest#"))
    .slice(0, 5);

  // Quem recebe o estacionamento (precisa existir pra virar PIX)
  // padrão: primeiro motorista (se existir), senão primeira pessoa
  const defaultPayee =
    (CONFIG.cars?.[0]?.driverPersonId)
    || defaultPayers[0]
    || (CONFIG.people?.[0]?.personId)
    || "";

  let parkingPayeeId = defaultPayee;

  function buildStatementText() {
    const ledger = {};

    function add(payerId, payeeId, amount) {
      const v = round2(Number(amount) || 0);
      if (v <= 0) return;
      if (!payerId || !payeeId) return;
      if (payerId === payeeId) return;

      if (!ledger[payerId]) ledger[payerId] = {};
      ledger[payerId][payeeId] = round2((ledger[payerId][payeeId] || 0) + v);
    }

    // ---- calcula corridas ----
    currentWeekCache.forEach(({ carId, trip }) => {
      const car = cm.get(carId);
      if (!car) return;

      const driverId = car.driverPersonId;

      const fareGo = Number(car.fareGo || 0);
      const fareRet = Number(car.fareReturn || 0);

      const went = Array.isArray(trip.went) ? trip.went : [];
      const ret = Array.isArray(trip.returned) ? trip.returned : [];

      // GO
      if (fareGo > 0 && went.length > 0) {
        const share = fareGo / went.length; // inclui motorista no divisor
        went.forEach(pid => {
          if (pid !== driverId) add(pid, driverId, share);
        });
      }

      // RETURN
      if (fareRet > 0 && ret.length > 0) {
        const share = fareRet / ret.length; // inclui motorista no divisor
        ret.forEach(pid => {
          if (pid !== driverId) add(pid, driverId, share);
        });
      }
    });

    // ---- estacionamento mensal (uma vez no mês): 5 padrão x R$20 ----
    if (includeMonthlyParking) {
      defaultPayers.forEach(pid => add(pid, parkingPayeeId, PARKING_FEE_PER_PERSON));
    }

    // Compensa A<->B (líquido)
    netLedger(ledger);

    // ---- monta texto ----
    const lines = [];
    lines.push(`PAGAMENTO SEMANA ${brDate(week.startISO)} a ${brDate(week.endISO)}.`);
    if (includeMonthlyParking) {
      lines.push(`Estacionamento ${parkingMonthLabel}: R$ ${PARKING_FEE_PER_PERSON.toFixed(2)} por pessoa (5 padrão).`);
      lines.push(`Recebedor estacionamento: ${driverLabel(parkingPayeeId)}.`);
    }
    lines.push("");

    Object.keys(ledger)
      .sort((a, b) => displayName(a).localeCompare(displayName(b), "pt-BR"))
      .forEach(payerId => {
        const byPayee = ledger[payerId] || {};
        const payees = Object.keys(byPayee)
          .sort((a, b) => driverLabel(a).localeCompare(driverLabel(b), "pt-BR"));

        const parts = payees.map(payeeId => {
          const v = round2(byPayee[payeeId] || 0);
          return `PIX de R$ ${v.toFixed(2)} para ${driverLabel(payeeId)}`;
        });

        if (parts.length) lines.push(`${displayName(payerId)}: ${parts.join(" | ")}`);
      });

    return lines.join("\n");
  }

  const payeeOptions = (CONFIG.people || [])
    .map(p => `<option value="${escHtml(p.personId)}" ${p.personId === parkingPayeeId ? "selected" : ""}>${escHtml(p.name)}</option>`)
    .join("");

  let text = buildStatementText();

  openModal("Extrato WhatsApp", `
    <div class="formGrid">
      <textarea id="stText" class="input" rows="12" readonly></textarea>

      <label style="display:flex; gap:10px; align-items:center; font-weight:800;">
        <input id="chkMonthlyParking" type="checkbox" ${includeMonthlyParking ? "checked" : ""}>
        Incluir estacionamento mensal (${parkingMonthLabel}) - R$ ${PARKING_FEE_PER_PERSON.toFixed(2)} por pessoa
      </label>

      <div>
        <div class="fieldLabel">Quem recebe o estacionamento</div>
        <select id="selParkingPayee" class="input">${payeeOptions}</select>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnCopyStatement" class="btn btnPrimary" type="button">Copiar</button>
        <button id="btnCloseStatement" class="btn" type="button">Fechar</button>
      </div>

      <div id="stStatus" class="smallStatus"></div>
    </div>
  `);

  const ta = document.getElementById("stText");
  if (ta) ta.value = text;

  const chk = document.getElementById("chkMonthlyParking");
  chk?.addEventListener("change", () => {
    includeMonthlyParking = !!chk.checked;
    text = buildStatementText();
    if (ta) ta.value = text;
  });

  const sel = document.getElementById("selParkingPayee");
  sel?.addEventListener("change", () => {
    parkingPayeeId = sel.value;
    text = buildStatementText();
    if (ta) ta.value = text;
  });

  document.getElementById("btnCloseStatement")?.addEventListener("click", closeModal);

  document.getElementById("btnCopyStatement")?.addEventListener("click", async () => {
    const st = document.getElementById("stStatus");
    try {
      await navigator.clipboard.writeText(text);
      if (st) st.textContent = "Copiado para a área de transferência.";
    } catch {
      if (st) st.textContent = "Não consegui copiar automaticamente. Copie manualmente.";
    }
  });
}


/* =========================
   Init
========================= */
function init() {
  $("modalClose")?.addEventListener("click", closeModal);
  $("modalBackdrop")?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const weekSelect = $("weekSelect");
  const weeks = buildWeeksFromMin(MIN_START_ISO);

  weekSelect.innerHTML = weeks
    .map((w, idx) => `<option value="${w.startISO}" ${idx === 0 ? "selected" : ""}>${w.label}</option>`)
    .join("");

  selectedWeekStartISO = weeks[0].startISO;

  weekSelect.addEventListener("change", () => {
    selectedWeekStartISO = weekSelect.value;
    renderWeek(selectedWeekStartISO).catch((e) => setStatus(`Erro: ${e.message}`));
  });

  $("btnRefresh")?.addEventListener("click", () => {
    renderWeek(selectedWeekStartISO).catch((e) => setStatus(`Erro: ${e.message}`));
  });

  $("btnLaunchDay")?.addEventListener("click", () => {
    openLaunchModal(null).catch((e) => setStatus(`Erro: ${e.message}`));
  });

  $("btnExportWpp")?.addEventListener("click", () => {
    openStatementModal().catch((e) => setStatus(`Erro: ${e.message}`));
  });

  renderWeek(selectedWeekStartISO).catch((e) => setStatus(`Erro: ${e.message}`));
}

init();
