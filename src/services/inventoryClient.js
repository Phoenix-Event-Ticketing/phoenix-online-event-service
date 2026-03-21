const DEFAULT_TIMEOUT_MS = 8000;
export const LIST_FETCH_TIMEOUT_MS = 5000;

function trimBase(url) {
  return typeof url === "string" ? url.replace(/\/+$/, "") : "";
}

async function getJson(root, path, options = {}) {
  const base = trimBase(root);
  if (!base) return { ok: false };

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = {
    Accept: "application/json",
    ...(options.requestId && { "X-Request-Id": String(options.requestId) }),
  };

  try {
    const res = await fetch(`${base}${path}`, { signal: ctrl.signal, headers });
    if (!res.ok) return { ok: false };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export function fetchEventInventory(baseUrl, eventId, options) {
  return getJson(
    baseUrl,
    `/inventory/event/${encodeURIComponent(eventId)}`,
    options,
  );
}

export function fetchEventAvailability(baseUrl, eventId, options) {
  return getJson(
    baseUrl,
    `/inventory/event/${encodeURIComponent(eventId)}/availability`,
    options,
  );
}

function itemRows(payload) {
  const rows = payload?.items;
  return Array.isArray(rows) ? rows : null;
}

export function ticketsFromInventoryListResponse(data) {
  const rows = itemRows(data);
  if (!rows) return [];
  return rows
    .filter((it) => it?.ticketType)
    .map((it) => ({
      ticketType: it.ticketType,
      price: Number(it.price) || 0,
    }));
}

export function ticketsFromDetailSidecars(
  ticketInventory,
  availabilitySummary,
) {
  const rows = itemRows(availabilitySummary) ?? itemRows(ticketInventory);
  if (!rows) return [];
  return rows
    .filter((it) => it?.ticketType)
    .map((it) => ({
      ticketType: it.ticketType,
      price: Number(it.price) || 0,
      availableQuantity: Number(it.availableQuantity) || 0,
    }));
}
