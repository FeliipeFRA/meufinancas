import { API_BASE_URL, ACCESS_KEY } from "../config.js";

export async function apiRequest(path, { method = "GET", body = null } = {}) {
  const base = String(API_BASE_URL || "").trim().replace(/\/$/, "");
  const key = String(ACCESS_KEY || "").trim();

  if (!base) throw new Error("API_BASE_URL não configurada.");
  if (!key) throw new Error("ACCESS_KEY não configurada.");

  const res = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-access-key": key,
    },
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.message) ? data.message : (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
