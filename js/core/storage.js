const KEY = "carpool_conn_v1";

export function loadConn() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function saveConn(conn) {
  localStorage.setItem(KEY, JSON.stringify(conn));
}
