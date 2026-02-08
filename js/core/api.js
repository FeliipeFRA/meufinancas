export async function apiRequest(conn, path, { method = "GET", body = null } = {}) {
  const base = (conn?.apiUrl || "").trim().replace(/\/$/, "");
  const key = (conn?.accessKey || "").trim();

  if (!base) throw new Error("API URL não informado.");
  if (!key) throw new Error("Access Key não informado.");

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
