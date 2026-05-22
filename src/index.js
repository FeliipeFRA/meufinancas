/**
 * MEUFInanças API (Cloudflare Workers + D1)
 * Endpoints:
 *   GET    /config
 *   GET    /trip/:carId/:date
 *   PUT    /trip/:carId/:date   (body: {went:[], returned:[], parkingAvulso?:boolean})
 *   DELETE /trip/:carId/:date
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Ajuste seus origins aqui (GitHub Pages + localhost)
const ALLOWED_ORIGINS = new Set([
  "https://feliipefra.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://feliipefra.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-access-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResp(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(req),
    },
  });
}

function okAuth(req, env) {
  const expected = (env.ACCESS_KEY || "").trim();
  if (!expected) return false;
  const provided = (req.headers.get("x-access-key") || "").trim();
  return !!provided && provided === expected;
}

async function readJson(req) {
  const txt = await req.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return {}; }
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function loadConfig(env) {
  const row = await env.DB.prepare("SELECT data FROM config WHERE pk = ?").bind("CONFIG").first();
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

function normalizeCarId(s) {
  return String(s || "").toUpperCase();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // Preflight
    if (method === "OPTIONS") {
      return new Response("", { status: 200, headers: corsHeaders(req) });
    }

    // Auth
    if (!okAuth(req, env)) {
      return jsonResp(req, 401, { error: "unauthorized" });
    }

    // GET /config
    if (method === "GET" && path === "/config") {
      const cfg = await loadConfig(env);
      if (!cfg) return jsonResp(req, 500, { error: "config_not_found" });
      return jsonResp(req, 200, cfg);
    }

    // /trip/:carId/:date
    const m = path.match(/^\/trip\/([^\/]+)\/(\d{4}-\d{2}-\d{2})$/);
    if (m) {
      const carId = normalizeCarId(m[1]);
      const date = m[2];

      if (!DATE_RE.test(date)) return jsonResp(req, 400, { error: "invalid_date" });

      if (method === "GET") {
        const row = await env.DB
          .prepare("SELECT carId, date, went, returned, parkingAvulso, createdAt, updatedAt FROM trips WHERE carId=? AND date=?")
          .bind(carId, date)
          .first();

        if (!row) return jsonResp(req, 404, { error: "trip_not_found" });

        return jsonResp(req, 200, {
          carId: row.carId,
          date: row.date,
          went: JSON.parse(row.went || "[]"),
          returned: JSON.parse(row.returned || "[]"),
          parkingAvulso: !!row.parkingAvulso,
          createdAt: row.createdAt || null,
          updatedAt: row.updatedAt || null,
        });
      }

      if (method === "DELETE") {
        const res = await env.DB
          .prepare("DELETE FROM trips WHERE carId=? AND date=?")
          .bind(carId, date)
          .run();

        if (!res.success) return jsonResp(req, 500, { error: "delete_failed" });
        if ((res.meta?.changes || 0) === 0) return jsonResp(req, 404, { error: "trip_not_found" });

        return jsonResp(req, 200, { ok: true, deleted: true });
      }

      if (method === "PUT") {
        const cfg = await loadConfig(env);
        if (!cfg) return jsonResp(req, 500, { error: "config_not_found" });

        const knownCars = new Set((cfg.cars || []).map(c => normalizeCarId(c.carId)));
        if (!knownCars.has(carId)) return jsonResp(req, 400, { error: "invalid_car", carId });

        const payload = await readJson(req);
        const went = Array.isArray(payload.went) ? payload.went.filter(x => typeof x === "string") : [];
        const returned = Array.isArray(payload.returned) ? payload.returned.filter(x => typeof x === "string") : [];
        const parkingAvulso = !!payload.parkingAvulso;

        if (went.length === 0 && returned.length === 0) {
          return jsonResp(req, 400, { error: "invalid_payload", message: "Pelo menos um trecho precisa ter alguém (went ou returned)." });
        }

        // overwrite?
        const overwrite = url.searchParams.get("overwrite") === "1";

        const existing = await env.DB
          .prepare("SELECT createdAt FROM trips WHERE carId=? AND date=?")
          .bind(carId, date)
          .first();

        if (existing && !overwrite) {
          return jsonResp(req, 409, { error: "trip_already_exists" });
        }

        const createdAt = (existing && existing.createdAt) ? existing.createdAt : nowIso();
        const updatedAt = nowIso();

        await env.DB.prepare(
          "INSERT OR REPLACE INTO trips (carId,date,went,returned,parkingAvulso,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)"
        ).bind(
          carId,
          date,
          JSON.stringify([...new Set(went)]),
          JSON.stringify([...new Set(returned)]),
          parkingAvulso ? 1 : 0,
          createdAt,
          updatedAt
        ).run();

        return jsonResp(req, 200, { carId, date, went: [...new Set(went)], returned: [...new Set(returned)], parkingAvulso, createdAt, updatedAt });
      }

      return jsonResp(req, 405, { error: "method_not_allowed" });
    }

    return jsonResp(req, 404, { error: "not_found", path, method });
  },
};
