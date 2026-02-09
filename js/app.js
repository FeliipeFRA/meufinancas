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

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
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

function getMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
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

function buildLastWeeks(count = 12) {
  const monday = getMonday(new Date());
  const weeks = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);

    const end = new Date(start);
    end.setDate(start.getDate() + 4);

    const startISO = toISODate(start);
    const endISO = toISODate(end);

    weeks.push({ startISO, endISO, label: `${brDate(startISO)} a ${brDate(endISO)}` });
  }
  return weeks;
}

function setHeaderWeekLabel(startISO, endISO) {
  const brandSub = $("brandSub");
  if (brandSub) brandSub.textContent = `Semana: ${brDate(startISO)} a ${brDate(endISO)}`;
}

function peopleMap() {
  const m = new Map();
  (CONFIG?.people || []).forEach(p => m.set(p.personId, p));
  return m;
}

function carsMap() {
  const m = new Map();
  (CONFIG?.cars || []).forEach(c => m.set(c.carId, c));
  return m;
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function slugGuest(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeAvatar(personId) {
  const pm = peopleMap();
  const isGuest = String(personId).startsWith("guest#");
  const displayName = isGuest ? personId.replace("guest#", "") : (pm.get(personId)?.name || personId);
  const photoUrl = isGuest ? "" : (pm.get(personId)?.photoUrl || "");

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

/* Modal */
function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modalBackdrop").classList.remove("hidden");
  $("modal").classList.remove("hidden");
}
function closeModal() {
  $("modalBackdrop").classList.add("hidden");
  $("modal").classList.add("hidden");
  $("modalBody").innerHTML = "";
}

/* API */
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

/* Render semana selecionada */
async function renderWeek(startISO) {
  const wrap = $("weekWrap");
  if (!wrap) return;

  wrap.innerHTML = `<div class="muted">Carregando semana...</div>`;
  setStatus("");

  if (!CONFIG) await loadConfig();

  const weeks = buildLastWeeks(12);
  const week = weeks.find(w => w.startISO === startISO) || weeks[0];
  selectedWeekStartISO = week.startISO;
  setHeaderWeekLabel(week.startISO, week.endISO);

  const dates = weekDatesFromStartISO(week.startISO).map(x => x.iso);
  const cars = (CONFIG.cars || []).map(c => c.carId);

  const tasks = [];
  for (const iso of dates) {
    for (const carId of cars) {
      tasks.push(loadTrip(carId, iso).then(trip => ({ dateISO: iso, carId, trip })));
    }
  }

  const results = await Promise.all(tasks);
  currentWeekCache = results.filter(r => r.trip);

  const byDay = new Map();
  results.forEach(r => {
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
      <div class="dayTitle">${brDate(iso)}</div>
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
      (trip.went || []).forEach(pid => avWent.appendChild(makeAvatar(pid)));
      colWent.appendChild(avWent);

      const colRet = document.createElement("div");
      colRet.className = "col";
      colRet.innerHTML = `<div class="colLabel">VOLTOU</div>`;
      const avRet = document.createElement("div");
      avRet.className = "avatars";
      (trip.returned || []).forEach(pid => avRet.appendChild(makeAvatar(pid)));
      colRet.appendChild(avRet);

      row.appendChild(meta);
      row.appendChild(colWent);
      row.appendChild(colRet);

      row.onclick = () => {
        openModal(
          `${car?.label || carId} - ${brDate(iso)}`,
          `
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
              <button class="btn btnPrimary" id="btnEditTrip">Editar</button>
            </div>
            <pre class="pre">${JSON.stringify(trip, null, 2)}</pre>
          `
        );

        document.getElementById("btnEditTrip")?.addEventListener("click", () => {
          openLaunchModal({ dateISO: iso, carId, trip, overwrite: true });
        });
      };

      dayCard.appendChild(row);
    });

    wrap.appendChild(dayCard);
  }

  setStatus("OK.");
}

/* Modal lançar dia */
function openLaunchModal(preset = null) {
  const weeks = buildLastWeeks(12);
  const week = weeks.find(w => w.startISO === selectedWeekStartISO) || weeks[0];
  const dates = weekDatesFromStartISO(week.startISO).map(x => x.iso);

  const pm = peopleMap();

  const presetDate = preset?.dateISO || dates[0];
  const presetCar = preset?.carId || (CONFIG.cars?.[0]?.carId || "COBALT");
  const presetWent = new Set(preset?.trip?.went || (CONFIG.people || []).map(p => p.personId));
  const presetRet = new Set(preset?.trip?.returned || (CONFIG.people || []).map(p => p.personId));
  const presetOverwrite = !!preset?.overwrite;

  const carsOptions = (CONFIG.cars || []).map(c => {
    const driverName = pm.get(c.driverPersonId)?.name || c.driverPersonId;
    return `<option value="${c.carId}" ${c.carId === presetCar ? "selected" : ""}>${c.label} (${driverName})</option>`;
  }).join("");

  const dateOptions = dates.map(d => `<option value="${d}" ${d === presetDate ? "selected" : ""}>${brDate(d)}</option>`).join("");

  const peopleRows = (CONFIG.people || []).map(p => {
    const wentChecked = presetWent.has(p.personId) ? "checked" : "";
    const retChecked = presetRet.has(p.personId) ? "checked" : "";
    return `
      <div class="pickRow" data-pid="${p.personId}">
        <div class="pickLeft">
          <div class="avatar">${initials(p.name)}</div>
          <div>
            <div style="font-weight:800;">${p.name}</div>
            <div style="font-size:12px; color:var(--muted);">${p.personId}</div>
          </div>
        </div>

        <label><input type="checkbox" class="cbWent" ${wentChecked} /> FOI</label>
        <label class="chkReturn"><input type="checkbox" class="cbRet" ${retChecked} /> VOLTOU</label>
      </div>
    `;
  }).join("");

  openModal(preset ? "Editar lançamento" : "Lançar dia", `
    <div class="formGrid">
      <div>
        <div class="fieldLabel">Data</div>
        <select id="inDate" class="input">${dateOptions}</select>
      </div>

      <div>
        <div class="fieldLabel">Carro</div>
        <select id="inCar" class="input">${carsOptions}</select>
      </div>

      <div>
        <div class="fieldLabel">Pessoas</div>
        <div id="pickList" class="pickList">${peopleRows}</div>
      </div>

      <div style="display:flex; gap:10px;">
        <input id="inGuestName" class="input" placeholder="Convidado (ex: Pedro)" />
        <button id="btnAddGuest" class="btn">Adicionar</button>
      </div>

      <label style="display:flex; gap:8px; align-items:center;">
        <input id="inOverwrite" type="checkbox" ${presetOverwrite ? "checked" : ""} />
        Sobrescrever se já existir
      </label>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnSaveTrip" class="btn btnPrimary">Salvar</button>
        <button id="btnCancelTrip" class="btn">Cancelar</button>
      </div>

      <div id="modalStatus" class="smallStatus"></div>
    </div>
  `);

  const pickListEl = document.getElementById("pickList");
  const modalStatusEl = document.getElementById("modalStatus");
  const setModalStatus = (m) => { if (modalStatusEl) modalStatusEl.textContent = m || ""; };

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
        <div class="avatar">${initials(name)}</div>
        <div>
          <div style="font-weight:800;">${name}</div>
          <div style="font-size:12px; color:var(--muted);">${pid}</div>
        </div>
      </div>

      <label><input type="checkbox" class="cbWent" checked /> FOI</label>
      <label class="chkReturn"><input type="checkbox" class="cbRet" checked /> VOLTOU</label>
    `;
    pickListEl.appendChild(row);
  }

  document.getElementById("btnAddGuest")?.addEventListener("click", () => {
    const name = document.getElementById("inGuestName").value.trim();
    if (!name) return;
    addGuestToList(name);
    document.getElementById("inGuestName").value = "";
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

      rows.forEach(r => {
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
        body: { went, returned }
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

/* Extrato WhatsApp */
function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}
function displayName(pid) {
  const pm = peopleMap();
  if (String(pid).startsWith("guest#")) return pid.replace("guest#", "Convidado: ");
  return pm.get(pid)?.name || pid;
}

async function openStatementModal() {
  if (!CONFIG) await loadConfig();

  const weeks = buildLastWeeks(12);
  const week = weeks.find(w => w.startISO === selectedWeekStartISO) || weeks[0];

  if (!currentWeekCache.length) {
    await renderWeek(week.startISO);
  }

  const cm = carsMap();
  const pm = peopleMap();

  const ledger = {};
  const drivers = new Set();

  function add(personId, driverId, amount) {
    if (!ledger[personId]) ledger[personId] = {};
    ledger[personId][driverId] = round2((ledger[personId][driverId] || 0) + amount);
    drivers.add(driverId);
  }

  currentWeekCache.forEach(({ carId, trip }) => {
    const car = cm.get(carId);
    if (!car) return;

    const driverId = car.driverPersonId;
    const fareGo = Number(car.fareGo || 0);
    const fareRet = Number(car.fareReturn || 0);

    const went = Array.isArray(trip.went) ? trip.went : [];
    const ret = Array.isArray(trip.returned) ? trip.returned : [];

    // motorisa entra no divisor, mas não gera PIX para ele mesmo
    if (fareGo > 0 && went.length > 0) {
      const share = fareGo / went.length; // inclui motorista no rateio
      went.forEach(pid => {
        if (pid !== driverId) add(pid, driverId, share); // só gera PIX se não for o motorista
      });
    }

    if (fareRet > 0 && ret.length > 0) {
      const share = fareRet / ret.length; // inclui motorista no rateio
      ret.forEach(pid => {
        if (pid !== driverId) add(pid, driverId, share); // só gera PIX se não for o motorista
      });
    }

  });

  const driverLabel = (id) => pm.get(id)?.name || id;

  const lines = [];
  lines.push(`PAGAMENTO SEMANA ${brDate(week.startISO)} a ${brDate(week.endISO)}.`);
  lines.push("");

  Object.keys(ledger)
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "pt-BR"))
    .forEach(pid => {
      const byDriver = ledger[pid];
      const parts = [];
      Array.from(drivers).forEach(did => {
        const v = round2(byDriver[did] || 0);
        if (v > 0) parts.push(`PIX de R$ ${v.toFixed(2)} para ${driverLabel(did)}`);
      });
      if (parts.length) lines.push(`${displayName(pid)}: ${parts.join(" | ")}`);
    });

  const text = lines.join("\n");

  openModal("Extrato WhatsApp", `
    <div class="formGrid">
      <textarea class="input" rows="12" readonly>${text}</textarea>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnCopyStatement" class="btn btnPrimary">Copiar</button>
        <button id="btnCloseStatement" class="btn">Fechar</button>
      </div>
      <div id="stStatus" class="smallStatus"></div>
    </div>
  `);

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

/* Init */
function init() {
  $("modalClose")?.addEventListener("click", closeModal);
  $("modalBackdrop")?.addEventListener("click", closeModal);

  const weekSelect = $("weekSelect");
  const weeks = buildLastWeeks(12);

  weekSelect.innerHTML = weeks.map((w, idx) =>
    `<option value="${w.startISO}" ${idx === 0 ? "selected" : ""}>${w.label}</option>`
  ).join("");

  selectedWeekStartISO = weeks[0].startISO;

  weekSelect.addEventListener("change", () => {
    selectedWeekStartISO = weekSelect.value;
    renderWeek(selectedWeekStartISO).catch(e => setStatus(`Erro: ${e.message}`));
  });

  $("btnRefresh")?.addEventListener("click", () => {
    renderWeek(selectedWeekStartISO).catch(e => setStatus(`Erro: ${e.message}`));
  });

  $("btnLaunchDay")?.addEventListener("click", () => openLaunchModal(null));
  $("btnExportWpp")?.addEventListener("click", () => openStatementModal().catch(e => setStatus(`Erro: ${e.message}`)));

  renderWeek(selectedWeekStartISO).catch(e => setStatus(`Erro: ${e.message}`));
}

init();
