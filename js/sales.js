/* ============================================================
   Colmena Unidos - sales.js
   Responsabilidad:
   - Preparar la "venta" (sin pasarela de pago aún)
   - Construir catálogo vendible desde el layout
   - Precio final, zona, estado, filtros y resumen
   - Carrito/orden básico (selección + total)
   ============================================================ */

import { TOOLS, SELL_STATES } from "./state.js";
import { indexToRC } from "./grid.js";
import { getEffectivePrice } from "./state.js";

/* =========================
   1) Tipos internos
========================= */
/**
 * Item vendible (unit):
 * {
 *   id: string,              // único (ej: "seat-23" o "table-57")
 *   index: number,           // índice en el grid
 *   type: "seat"|"table",
 *   seatNumber: number|null, // si es seat
 *   row: number,
 *   col: number,
 *   zone: string,
 *   sellState: string,       // available/reserved/sold/blocked
 *   price: number,           // precio final efectivo
 * }
 */

/* =========================
   2) Helpers
========================= */
function normalizeSellState(ss) {
  const s = String(ss ?? SELL_STATES.AVAILABLE);
  return Object.values(SELL_STATES).includes(s) ? s : SELL_STATES.AVAILABLE;
}

function isSellableType(type) {
  return type === TOOLS.SEAT || type === TOOLS.TABLE;
}

function makeId(type, index, seatNumber) {
  if (type === TOOLS.SEAT) {
    // Preferimos seatNumber si existe para UX
    return `seat-${seatNumber ?? index}`;
  }
  return `table-${index}`;
}

/* =========================
   3) Construir catálogo
========================= */
export function buildCatalog(state) {
  const { rows, cols, cells } = state;

  const items = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell || !cell.type) continue;
    if (!isSellableType(cell.type)) continue;

    const { r, c } = indexToRC(i, cols);
    const price = getEffectivePrice(state, cell) ?? 0;

    items.push({
      id: makeId(cell.type, i, cell.seatNumber),
      index: i,
      type: cell.type,
      seatNumber: cell.type === TOOLS.SEAT ? (cell.seatNumber ?? null) : null,
      row: r,
      col: c,
      zone: cell.zone ?? "none",
      sellState: normalizeSellState(cell.sellState),
      price: Math.max(0, Number(price))
    });
  }

  // Orden recomendado:
  // - asientos por seatNumber si existe
  // - mesas por index
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "seat" ? -1 : 1;

    if (a.type === "seat") {
      const an = a.seatNumber ?? 1e9;
      const bn = b.seatNumber ?? 1e9;
      if (an !== bn) return an - bn;
    }
    return a.index - b.index;
  });

  return items;
}

/* =========================
   4) Filtros
========================= */
export function filterCatalog(items, filter = {}) {
  const zone = filter.zone ?? null;           // "vip"/"general"/...
  const type = filter.type ?? null;           // "seat"|"table"
  const sellState = filter.sellState ?? null; // "available" etc.

  const minPrice = Number.isFinite(Number(filter.minPrice)) ? Number(filter.minPrice) : null;
  const maxPrice = Number.isFinite(Number(filter.maxPrice)) ? Number(filter.maxPrice) : null;

  return items.filter(it => {
    if (zone && it.zone !== zone) return false;
    if (type && it.type !== type) return false;
    if (sellState && it.sellState !== sellState) return false;
    if (minPrice != null && it.price < minPrice) return false;
    if (maxPrice != null && it.price > maxPrice) return false;
    return true;
  });
}

/* =========================
   5) Resúmenes
========================= */
export function summarizeCatalog(items) {
  const summary = {
    total: items.length,
    available: 0,
    reserved: 0,
    sold: 0,
    blocked: 0,

    seats: 0,
    tables: 0,

    byZone: {}
  };

  for (const it of items) {
    // Estado
    if (it.sellState === SELL_STATES.AVAILABLE) summary.available++;
    else if (it.sellState === SELL_STATES.RESERVED) summary.reserved++;
    else if (it.sellState === SELL_STATES.SOLD) summary.sold++;
    else if (it.sellState === SELL_STATES.BLOCKED) summary.blocked++;

    // Tipo
    if (it.type === TOOLS.SEAT) summary.seats++;
    if (it.type === TOOLS.TABLE) summary.tables++;

    // Zona
    const z = it.zone ?? "none";
    if (!summary.byZone[z]) {
      summary.byZone[z] = {
        total: 0,
        available: 0,
        reserved: 0,
        sold: 0,
        blocked: 0,
        minPrice: null,
        maxPrice: null
      };
    }
    const bz = summary.byZone[z];
    bz.total++;

    if (it.sellState === SELL_STATES.AVAILABLE) bz.available++;
    else if (it.sellState === SELL_STATES.RESERVED) bz.reserved++;
    else if (it.sellState === SELL_STATES.SOLD) bz.sold++;
    else if (it.sellState === SELL_STATES.BLOCKED) bz.blocked++;

    bz.minPrice = (bz.minPrice == null) ? it.price : Math.min(bz.minPrice, it.price);
    bz.maxPrice = (bz.maxPrice == null) ? it.price : Math.max(bz.maxPrice, it.price);
  }

  return summary;
}

/* =========================
   6) Selección / "carrito" (orden)
   - Esto NO cobra; solo prepara la lógica
========================= */
export function createOrder() {
  return {
    createdAt: new Date().toISOString(),
    items: [],  // array de item IDs
    total: 0
  };
}

/**
 * Verifica si un item está disponible para compra
 */
export function isPurchasable(item) {
  return item.sellState === SELL_STATES.AVAILABLE;
}

/**
 * Añade un item al pedido si es comprable
 */
export function addToOrder(order, item) {
  if (!order || !item) return { ok: false, error: "INVALID" };
  if (!isPurchasable(item)) return { ok: false, error: "NOT_AVAILABLE" };

  if (!order.items.includes(item.id)) {
    order.items.push(item.id);
    order.total += item.price;
  }
  return { ok: true };
}

/**
 * Quita un item del pedido
 */
export function removeFromOrder(order, item, catalogIndex) {
  if (!order || !item) return { ok: false, error: "INVALID" };

  const idx = order.items.indexOf(item.id);
  if (idx >= 0) {
    order.items.splice(idx, 1);
    order.total = Math.max(0, order.total - item.price);
    return { ok: true };
  }
  return { ok: false, error: "NOT_IN_ORDER" };
}

/**
 * Recalcula total del pedido en base al catálogo actual
 * Útil si cambian precios
 */
export function recalcOrderTotal(order, items) {
  const map = new Map(items.map(it => [it.id, it.price]));
  let total = 0;
  for (const id of order.items) {
    total += map.get(id) ?? 0;
  }
  order.total = total;
  return total;
}

/* =========================
   7) Utilidades para futura UI de venta
========================= */

/**
 * Retorna items disponibles por zona, ordenados por precio asc
 */
export function getAvailableByZone(items, zone) {
  const filtered = items.filter(it =>
    it.zone === zone &&
    it.sellState === SELL_STATES.AVAILABLE
  );
  filtered.sort((a, b) => a.price - b.price);
  return filtered;
}

/**
 * Retorna un item por id
 */
export function findItemById(items, id) {
  return items.find(it => it.id === id) ?? null;
}

/**
 * Genera "resumen de checkout" (sin pago)
 */
export function buildCheckoutSummary(order, catalogItems) {
  const selectedItems = [];
  for (const id of order.items) {
    const it = findItemById(catalogItems, id);
    if (it) selectedItems.push(it);
  }

  const total = selectedItems.reduce((sum, it) => sum + it.price, 0);

  return {
    items: selectedItems,
    total,
    currency: "COP",
    note: "Esto es preparación de venta. Aún no hay pasarela de pago."
  };
}
