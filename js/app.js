import { apiRequest } from "./core/api.js";

const $ = (id) => document.getElementById(id);

let CONFIG = null;

const CAR_PHOTOS = {
  COBALT: "./assets/cars/cobalt.png",
  HRV: "./assets/cars/hrv.png",
  ZAFIRA: "./assets/cars/zafira.png",
  CELTA: "./assets/cars/celta.png",
};

// Corrige chave "COBALT" (evita typo no objeto)
delete CAR_PHOTOS["CO BALT"];
CAR_PHOTOS["COBALT"] = "./assets/cars/cobalt.png";

function setStatus(msg) {
  $("status").textContent = msg || "";
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function brDate(iso) {
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function mondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 dom
  const diff = (day === 0 ? -6 : 1 - day); // seg
  const monday = new Date(now);
  monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function weekMonToFriDates() {
  const mon = mondayOfCurrentWeek();
  const out = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    out.push(d);
  }
  return out;
}

function weekdayShort(i) {
  return ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][i] || "";
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function peopleMap() {
  const m = new Map();
  (CONFIG.people || []).forEach(p => m.set(p.personId, p));
  return m;
}

function carsMap() {
  const m = new Map();
  (CONFIG.cars || []).forEach(c => m.set(c.carId, c));
  return m;
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
const weekWrapEl   = document.getElementById("weekWrap");
const statusEl     = document.getElementById("status");
const brandSubEl   = document.getElementById("brandSub");

const weekSelectEl = document.getElementById("weekSelect");
const btnRefresh   = document.getElementById("btnRefresh");
const btnLaunchDay = document.getElementById("btnLaunchDay");
const btnExportWpp = document.getElementById("btnExportWpp");

// Modal já existe no seu HTML
const modalBackdrop = document.getElementById("modalBackdrop");
const modalEl       = document.getElementById("modal");
const modalTitleEl  = document.getElementById("modalTitle");
const modalBodyEl   = document.getElementById("modalBody");
const modalCloseBtn = document.getElementById("modalClose");

let weeks = [];
let currentWeek = null;     // { startISO, endISO, label }
let currentWeekData = null; // { days: [...] }

function toISODateLocal(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBR(iso){
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function getMonday(d){
  const x = new Date(d);
  const dow = x.getDay(); // 0=Dom
  const diff = (dow === 0 ? -6 : 1 - dow);
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}

function buildLastWeeks(count = 12){
  const now = new Date();
  const monday = getMonday(now);

  const out = [];
  for (let i = 0; i < count; i++){
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);

    const end = new Date(start);
    end.setDate(end.getDate() + 4); // Seg–Sex

    const startISO = toISODateLocal(start);
    const endISO   = toISODateLocal(end);

    out.push({
      startISO,
      endISO,
      label: `${formatBR(startISO)} a ${formatBR(endISO)}`
    });
  }
  return out;
}

function weekdayShortBR(i){
  // 0..4
  return ["SEG", "TER", "QUA", "QUI", "SEX"][i] ?? "";
}

function buildWeekDaysSkeleton(week){
  const start = new Date(`${week.startISO}T00:00:00`);
  const days = [];
  for (let i = 0; i < 5; i++){
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = toISODateLocal(d);
    days.push({
      dateISO: iso,
      weekDay: weekdayShortBR(i),
      launched: false,
      // campos opcionais (quando ligar no backend):
      // km: 0, cost: 0, obs: "", etc.
    });
  }
  return days;
}

function renderWeek(days){
  const html = days.map(d => {
    const dateShort = formatBR(d.dateISO).slice(0,5); // dd/mm
    const statusText = d.launched ? "Lançado" : "Dia não lançado";

    return `
      <div class="dayCard card">
        <div class="dayTop">
          <div class="dayName">${d.weekDay}</div>
          <div class="dayDate muted">${dateShort}</div>
        </div>

        <div class="dayStatus ${d.launched ? "" : "muted"}">${statusText}</div>

        <div class="dayActions">
          ${d.launched
            ? `<button class="btn btnGhost jsDetails" data-date="${d.dateISO}">Ver</button>`
            : `<button class="btn btnPrimary jsLaunch" data-date="${d.dateISO}">Lançar dia</button>`
          }
        </div>
      </div>
    `;
  }).join("");

  weekWrapEl.innerHTML = html;

  weekWrapEl.querySelectorAll(".jsLaunch").forEach(btn => {
    btn.addEventListener("click", () => openLaunchModal(btn.dataset.date));
  });

  weekWrapEl.querySelectorAll(".jsDetails").forEach(btn => {
    btn.addEventListener("click", () => openDetailsModal(btn.dataset.date));
  });
}

function setHeaderWeek(week){
  brandSubEl.textContent = `Semana: ${week.label}`;
  statusEl.textContent = "";
}

function fillWeekSelect(){
  weekSelectEl.innerHTML = weeks.map((w, idx) => {
    return `<option value="${w.startISO}" ${idx === 0 ? "selected" : ""}>${w.label}</option>`;
  }).join("");
}

async function fetchWeekFromApi(startISO){
  // Ajuste ESTE endpoint para o seu backend real.
  // Exemplo esperado: GET /week?start=YYYY-MM-DD -> { days:[{date:"YYYY-MM-DD", launched:true, ...}] }
  // return await fetch(`${base}/week?start=${startISO}`).then(r => r.json());

  // Por enquanto: sem backend (só skeleton)
  return { days: [] };
}

function mergeApiIntoSkeleton(week, apiData){
  const skeleton = buildWeekDaysSkeleton(week);
  const map = new Map((apiData?.days ?? []).map(x => [x.date, x]));

  return skeleton.map(d => {
    const item = map.get(d.dateISO);
    if (!item) return d;
    return {
      ...d,
      launched: true,
      ...item,
      dateISO: d.dateISO,
      weekDay: d.weekDay,
    };
  });
}

async function loadWeek(startISO){
  const week = weeks.find(w => w.startISO === startISO) ?? weeks[0];
  currentWeek = week;
  setHeaderWeek(week);

  weekWrapEl.innerHTML = `<div class="muted">Carregando...</div>`;

  try{
    const apiData = await fetchWeekFromApi(week.startISO);
    currentWeekData = apiData;

    const days = mergeApiIntoSkeleton(week, apiData);
    renderWeek(days);
  }catch(err){
    statusEl.textContent = String(err);
    const days = buildWeekDaysSkeleton(week);
    renderWeek(days);
  }
}

/* Modal helpers */
function openModal(title, bodyHtml){
  modalTitleEl.textContent = title;
  modalBodyEl.innerHTML = bodyHtml;
  modalBackdrop.classList.remove("hidden");
  modalEl.classList.remove("hidden");
}

function closeModal(){
  modalBackdrop.classList.add("hidden");
  modalEl.classList.add("hidden");
  modalBodyEl.innerHTML = "";
}

modalCloseBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

function openLaunchModal(dateISO){
  openModal(`Lançar dia (${formatBR(dateISO)})`, `
    <div class="muted" style="margin-bottom:10px;">Preencha e confirme.</div>

    <label>KM do dia</label>
    <input id="inKm" type="number" step="0.1" />

    <label style="margin-top:10px;">Observação</label>
    <input id="inObs" type="text" />

    <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
      <button id="btnConfirmLaunch" class="btn btnPrimary">Confirmar</button>
      <button class="btn btnGhost" id="btnCancelLaunch">Cancelar</button>
    </div>
  `);

  document.getElementById("btnCancelLaunch").addEventListener("click", closeModal);
  document.getElementById("btnConfirmLaunch").addEventListener("click", async () => {
    const km = Number(document.getElementById("inKm").value || 0);
    const obs = (document.getElementById("inObs").value || "").trim();

    // Ajuste ESTE POST para o seu backend real:
    // await fetch(`${base}/day`, { method:"POST", headers:{...}, body: JSON.stringify({ date: dateISO, km, obs }) })

    closeModal();
    await loadWeek(currentWeek.startISO);
  });
}

function openDetailsModal(dateISO){
  openModal(`Detalhes (${formatBR(dateISO)})`, `
    <div class="muted">Aqui você exibe os dados do dia vindos da API.</div>
  `);
}

/* Extrato WhatsApp */
function buildWhatsAppText(week, apiData){
  const days = mergeApiIntoSkeleton(week, apiData ?? {days:[]});
  const lines = [];
  lines.push(`*MEUFInanças — Semana ${week.label}*`);
  lines.push("");

  for (const d of days){
    const ddmm = formatBR(d.dateISO).slice(0,5);
    if (!d.launched){
      lines.push(`${d.weekDay} (${ddmm}): não lançado`);
    }else{
      // Ajuste campos conforme seu retorno real (ex.: d.km, d.cost)
      const kmTxt = (d.km != null) ? ` — ${d.km} km` : "";
      lines.push(`${d.weekDay} (${ddmm}): lançado${kmTxt}`);
    }
  }

  return lines.join("\n");
}

btnExportWpp.addEventListener("click", async () => {
  try{
    const text = buildWhatsAppText(currentWeek, currentWeekData);
    await navigator.clipboard.writeText(text);
    statusEl.textContent = "Extrato copiado para a área de transferência.";
  }catch(err){
    statusEl.textContent = "Não consegui copiar automaticamente. Abra no modal e copie manualmente.";
    openModal("Extrato WhatsApp", `<textarea style="width:100%; height:240px;">${buildWhatsAppText(currentWeek, currentWeekData)}</textarea>`);
  }
});

btnLaunchDay.addEventListener("click", () => {
  // por padrão lança o primeiro dia da semana selecionada
  const firstDayISO = currentWeek?.startISO ?? weeks[0].startISO;
  openLaunchModal(firstDayISO);
});

btnRefresh.addEventListener("click", () => loadWeek(weekSelectEl.value));

weekSelectEl.addEventListener("change", () => loadWeek(weekSelectEl.value));

/* init */
weeks = buildLastWeeks(12);
fillWeekSelect();
loadWeek(weeks[0].startISO);


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
}

async function loadConfig() {
  CONFIG = await apiRequest("/config");
}

async function loadTrip(carId, dateISO) {
  try {
    return await apiRequest(`/trip/${encodeURIComponent(carId)}/${encodeURIComponent(dateISO)}`);
  } catch (e) {
    // se não existe, ignorar
    if (String(e.message).includes("trip_not_found") || String(e.message).includes("404")) return null;
    throw e;
  }
}

async function renderWeek() {
  const wrap = $("weekWrap");
  wrap.innerHTML = `<div class="muted">Carregando semana...</div>`;

  if (!CONFIG) await loadConfig();

  const cars = (CONFIG.cars || []).map(c => c.carId);
  const dates = weekMonToFriDates().map(d => ({ d, iso: toISODate(d) }));

  // puxa (carros x dias) = 4 x 5 = 20 requests (ok para MVP)
  const tasks = [];
  for (const { iso } of dates) {
    for (const carId of cars) {
      tasks.push(loadTrip(carId, iso).then(trip => ({ iso, carId, trip })));
    }
  }
  const results = await Promise.all(tasks);

  // agrupar por dia
  const byDay = new Map();
  results.forEach(r => {
    if (!byDay.has(r.iso)) byDay.set(r.iso, []);
    if (r.trip) byDay.get(r.iso).push(r);
  });

  wrap.innerHTML = "";

  dates.forEach(({ d, iso }) => {
    const dayTrips = byDay.get(iso) || [];

    const dayCard = document.createElement("div");
    dayCard.className = "dayCard";

    const header = document.createElement("div");
    header.className = "dayHeader";
    header.innerHTML = `
      <div class="dayTitle">${weekdayShort(d.getDay() === 0 ? 6 : d.getDay()-1)} ${brDate(iso)}</div>
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
      return;
    }

    const cm = carsMap();
    const pm = peopleMap();

    dayTrips.forEach(({ carId, trip }) => {
      const car = cm.get(carId);
      const driverId = car?.driverPersonId;
      const driverName = pm.get(driverId)?.name || driverId;

      const row = document.createElement("div");
      row.className = "tripRow";

      // meta (car + driver)
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

      // col FOI
      const colWent = document.createElement("div");
      colWent.className = "col";
      colWent.innerHTML = `<div class="colLabel">FOI</div>`;
      const avWent = document.createElement("div");
      avWent.className = "avatars";
      (trip.went || []).forEach(pid => avWent.appendChild(makeAvatar(pid)));
      colWent.appendChild(avWent);

      // col VOLTOU
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

      // popup ao clicar
      row.style.cursor = "pointer";
      row.onclick = () => {
        openModal(
          `${car?.label || carId} - ${brDate(iso)}`,
          `<pre class="pre">${JSON.stringify(trip, null, 2)}</pre>`
        );
      };

      dayCard.appendChild(row);
    });

    wrap.appendChild(dayCard);
  });

  setStatus("Semana renderizada.");
}

function init() {
  $("btnRefresh").onclick = () => renderWeek().catch(e => setStatus(`Erro: ${e.message}`));
  $("modalClose").onclick = closeModal;
  $("modalBackdrop").onclick = closeModal;

  renderWeek().catch(e => setStatus(`Erro: ${e.message}`));
}

init();
