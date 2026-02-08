import { loadConn, saveConn } from "./core/storage.js";
import { apiRequest } from "./core/api.js";

const $ = (id) => document.getElementById(id);

let config = null;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function slugGuest(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function setConnStatus(msg) {
  $("connStatus").textContent = msg;
}

function setTripStatus(msg) {
  $("tripStatus").textContent = msg;
}

function getConnFromInputs() {
  return {
    apiUrl: $("apiUrl").value.trim(),
    accessKey: $("accessKey").value.trim(),
  };
}

function renderCars(cars) {
  const sel = $("carSelect");
  sel.innerHTML = "";
  cars.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.carId;
    opt.textContent = `${c.label} (${c.driverPersonId})`;
    sel.appendChild(opt);
  });
}

function renderPeople(people) {
  const wrap = $("peopleList");
  wrap.innerHTML = "";

  people.forEach(p => {
    const row = document.createElement("div");
    row.className = "person";
    row.dataset.personId = p.personId;

    row.innerHTML = `
      <div>
        <div><strong>${p.name}</strong></div>
        <div class="tag">${p.personId}</div>
      </div>

      <label class="check">
        <input type="checkbox" class="cbWent" checked />
        FOI
      </label>

      <label class="check">
        <input type="checkbox" class="cbReturned" checked />
        VOLTOU
      </label>
    `;

    wrap.appendChild(row);
  });
}

function collectTripPayload() {
  const rows = Array.from(document.querySelectorAll("#peopleList .person"));
  const went = [];
  const returned = [];

  rows.forEach(row => {
    const pid = row.dataset.personId;
    const cbWent = row.querySelector(".cbWent");
    const cbReturned = row.querySelector(".cbReturned");
    if (cbWent?.checked) went.push(pid);
    if (cbReturned?.checked) returned.push(pid);
  });

  return { went, returned };
}

function addGuestToUI(guestLabel) {
  const pid = `guest#${slugGuest(guestLabel)}`;
  if (pid === "guest#") return;

  // evita duplicado
  if (document.querySelector(`#peopleList .person[data-person-id="${pid}"]`)) return;

  const wrap = $("peopleList");
  const row = document.createElement("div");
  row.className = "person";
  row.dataset.personId = pid;

  row.innerHTML = `
    <div>
      <div><strong>${guestLabel}</strong></div>
      <div class="tag">${pid}</div>
    </div>

    <label class="check">
      <input type="checkbox" class="cbWent" checked />
      FOI
    </label>

    <label class="check">
      <input type="checkbox" class="cbReturned" checked />
      VOLTOU
    </label>
  `;

  wrap.appendChild(row);
}

async function onLoadConfig() {
  const conn = getConnFromInputs();
  const cfg = await apiRequest(conn, "/config");
  config = cfg;

  renderCars(cfg.cars || []);
  renderPeople(cfg.people || []);

  setConnStatus("Config carregada com sucesso.");
}

async function onSaveTrip() {
  if (!config) throw new Error("Carregue o config primeiro.");

  const conn = getConnFromInputs();
  const carId = $("carSelect").value;
  const date = $("dateInput").value;

  const payload = collectTripPayload();
  if (payload.went.length === 0 && payload.returned.length === 0) {
    throw new Error("Marque pelo menos 1 pessoa em FOI ou VOLTOU.");
  }

  const overwrite = $("overwrite").checked ? "?overwrite=1" : "";
  const out = await apiRequest(conn, `/trip/${encodeURIComponent(carId)}/${encodeURIComponent(date)}${overwrite}`, {
    method: "PUT",
    body: payload,
  });

  setTripStatus(JSON.stringify(out, null, 2));
}

async function onLoadTrip() {
  const conn = getConnFromInputs();
  const carId = $("carSelect").value;
  const date = $("dateInput").value;

  const out = await apiRequest(conn, `/trip/${encodeURIComponent(carId)}/${encodeURIComponent(date)}`, {
    method: "GET",
  });

  setTripStatus(JSON.stringify(out, null, 2));
}

function init() {
  const saved = loadConn();
  if (saved?.apiUrl) $("apiUrl").value = saved.apiUrl;
  if (saved?.accessKey) $("accessKey").value = saved.accessKey;

  $("dateInput").value = todayISO();

  $("btnSaveConn").onclick = () => {
    const conn = getConnFromInputs();
    saveConn(conn);
    setConnStatus("Conexão salva no navegador.");
  };

  $("btnLoadConfig").onclick = () => onLoadConfig().catch(e => setConnStatus(`Erro: ${e.message}`));

  $("btnAddGuest").onclick = () => {
    const name = $("guestName").value.trim();
    if (!name) return;
    addGuestToUI(name);
    $("guestName").value = "";
  };

  $("btnSaveTrip").onclick = () => onSaveTrip().catch(e => setTripStatus(`Erro: ${e.message}`));
  $("btnLoadTrip").onclick = () => onLoadTrip().catch(e => setTripStatus(`Erro: ${e.message}`));
}

init();
