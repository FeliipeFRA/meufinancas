import { apiRequest } from "./core/api.js";

const $ = (id) => document.getElementById(id);

let CONFIG = null;

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
  const day = x.getDay(); // 0=Dom
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekMonToFriDates() {
  const mon = getMonday(new Date());
  const out = [];
  for (let i = 0; i < 5; i++) {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    out.push(dt);
  }
  return out;
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

function setHeaderWeekLabel(startISO, endISO) {
  const brandSub = $("brandSub");
  if (!brandSub) return;
  brandSub.textContent = `Semana: ${brDate(startISO)} a ${brDate(endISO)}`;
}

async function renderCurrentWeek() {
  const wrap = $("weekWrap");
  if (!wrap) {
    setStatus("ERRO: #weekWrap não existe no HTML.");
    return;
  }

  wrap.innerHTML = `<div class="muted">Carregando semana...</div>`;
  setStatus("");

  if (!CONFIG) await loadConfig();

  const dates = weekMonToFriDates().map(d => ({ d, iso: toISODate(d) }));
  const startISO = dates[0].iso;
  const endISO = dates[dates.length - 1].iso;
  setHeaderWeekLabel(startISO, endISO);

  const cars = (CONFIG.cars || []).map(c => c.carId);

  const tasks = [];
  for (const { iso } of dates) {
    for (const carId of cars) {
      tasks.push(loadTrip(carId, iso).then(trip => ({ iso, carId, trip })));
    }
  }

  const results = await Promise.all(tasks);

  const byDay = new Map();
  results.forEach(r => {
    if (!byDay.has(r.iso)) byDay.set(r.iso, []);
    if (r.trip) byDay.get(r.iso).push(r);
  });

  wrap.innerHTML = "";

  const cm = carsMap();
  const pm = peopleMap();

  for (const { d, iso } of dates) {
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
          `<pre class="pre">${JSON.stringify(trip, null, 2)}</pre>`
        );
      };

      dayCard.appendChild(row);
    });

    wrap.appendChild(dayCard);
  }

  setStatus("OK.");
}

function init() {
  $("modalClose")?.addEventListener("click", closeModal);
  $("modalBackdrop")?.addEventListener("click", closeModal);

  $("btnRefresh")?.addEventListener("click", () => {
    renderCurrentWeek().catch(e => setStatus(`Erro: ${e.message}`));
  });

  $("btnLaunchDay")?.addEventListener("click", () => {
    openModal("Lançar dia", `<div class="muted">Próxima etapa: modal de lançamento com carro + FOI/VOLTOU.</div>`);
  });

  $("btnExportWpp")?.addEventListener("click", () => {
    openModal("Extrato WhatsApp", `<div class="muted">Próxima etapa: gerar texto da semana e botão copiar.</div>`);
  });

  renderCurrentWeek().catch(e => setStatus(`Erro: ${e.message}`));
}

init();
