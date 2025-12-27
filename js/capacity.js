/* ============================================================
   Colmena Unidos - capacity.js
   Responsabilidad:
   - Calcular capacidad y métricas del recinto
   - Por tipo (seat/table)
   - Por zona (vip/general/etc)
   - Por estado de venta (available/sold/etc)
   - Sin DOM, sin storage, sin export
   ============================================================ */

import { ZONES, SELL_STATES } from "./state.js";

/**
 * Config de capacidad:
 * - seats: 1 persona por silla
 * - tables: N personas por mesa (por defecto 4)
 */
export const CAPACITY_DEFAULTS = Object.freeze({
  personsPerSeat: 1,
  personsPerTable: 4
});

/**
 * Normaliza estado de venta
 */
function normSellState(ss) {
  const s = String(ss ?? SELL_STATES.AVAILABLE);
  return Object.values(SELL_STATES).includes(s) ? s : SELL_STATES.AVAILABLE;
}

/**
 * Normaliza zona
 */
function normZone(z) {
  const zz = String(z ?? ZONES.NONE);
  return Object.values(ZONES).includes(zz) ? zz : ZONES.NONE;
}

/**
 * Crea estructura de contador por zona
 */
function makeZoneCounters() {
  const out = {};
  for (const z of Object.values(ZONES)) {
    out[z] = {
      seats: 0,
      tables: 0,
      capacity: 0,

      // Por estado
      available: 0,
      reserved: 0,
      sold: 0,
      blocked: 0,

      // Para referencia
      seatCapacity: 0,
      tableCapacity: 0
    };
  }
  return out;
}

/**
 * Retorna resumen completo:
 * {
 *   totals: { seats, tables, capacity, seatCapacity, tableCapacity },
 *   byZone: { vip: {...}, general: {...}, ... },
 *   bySellState: { available: n, reserved: n, sold: n, blocked: n },
 *   breakdown: { seats: {available..}, tables:{available..} }
 * }
 */
export function computeCapacity(cells, cfg = {}) {
  const personsPerSeat = Number.isFinite(Number(cfg.personsPerSeat))
    ? Number(cfg.personsPerSeat)
    : CAPACITY_DEFAULTS.personsPerSeat;

  const personsPerTable = Number.isFinite(Number(cfg.personsPerTable))
    ? Number(cfg.personsPerTable)
    : CAPACITY_DEFAULTS.personsPerTable;

  const totals = {
    seats: 0,
    tables: 0,
    seatCapacity: 0,
    tableCapacity: 0,
    capacity: 0
  };

  const byZone = makeZoneCounters();

  const bySellState = {
    available: 0,
    reserved: 0,
    sold: 0,
    blocked: 0
  };

  const breakdown = {
    seats: { available: 0, reserved: 0, sold: 0, blocked: 0 },
    tables: { available: 0, reserved: 0, sold: 0, blocked: 0 }
  };

  for (const cell of cells) {
    if (!cell || !cell.type) continue;

    const zone = normZone(cell.zone);
    const sellState = normSellState(cell.sellState);

    if (cell.type === "seat") {
      totals.seats += 1;
      totals.seatCapacity += personsPerSeat;

      byZone[zone].seats += 1;
      byZone[zone].seatCapacity += personsPerSeat;

      // Conteo por estados
      bySellState[sellState] += 1;
      breakdown.seats[sellState] += 1;

      byZone[zone][sellState] += 1;
    }

    if (cell.type === "table") {
      totals.tables += 1;
      totals.tableCapacity += personsPerTable;

      byZone[zone].tables += 1;
      byZone[zone].tableCapacity += personsPerTable;

      // Una mesa representa un “cup” de 1 unidad en estado (si quisieras por persona, se ajusta)
      bySellState[sellState] += 1;
      breakdown.tables[sellState] += 1;

      byZone[zone][sellState] += 1;
    }
  }

  // Totales finales
  totals.capacity = totals.seatCapacity + totals.tableCapacity;

  // Por zona: capacity = seatCapacity + tableCapacity
  for (const z of Object.values(ZONES)) {
    byZone[z].capacity = byZone[z].seatCapacity + byZone[z].tableCapacity;
  }

  return {
    totals,
    byZone,
    bySellState,
    breakdown,
    configUsed: { personsPerSeat, personsPerTable }
  };
}

/**
 * Capacidad “vendible” (disponible) por defecto:
 * - Asientos disponibles cuentan
 * - Mesas disponibles cuentan
 * Retorna { availableCapacity, availableSeats, availableTables }
 */
export function computeAvailableCapacity(cells, cfg = {}) {
  const personsPerSeat = Number.isFinite(Number(cfg.personsPerSeat))
    ? Number(cfg.personsPerSeat)
    : CAPACITY_DEFAULTS.personsPerSeat;

  const personsPerTable = Number.isFinite(Number(cfg.personsPerTable))
    ? Number(cfg.personsPerTable)
    : CAPACITY_DEFAULTS.personsPerTable;

  let availableSeats = 0;
  let availableTables = 0;

  for (const cell of cells) {
    if (!cell || !cell.type) continue;
    const ss = normSellState(cell.sellState);
    if (ss !== SELL_STATES.AVAILABLE) continue;

    if (cell.type === "seat") availableSeats++;
    if (cell.type === "table") availableTables++;
  }

  const availableCapacity =
    (availableSeats * personsPerSeat) + (availableTables * personsPerTable);

  return { availableCapacity, availableSeats, availableTables };
}

/**
 * Resumen rápido para barra de stats:
 * { seats, tables, capacity }
 */
export function quickStats(cells, cfg = {}) {
  const res = computeCapacity(cells, cfg);
  return {
    seats: res.totals.seats,
    tables: res.totals.tables,
    capacity: res.totals.capacity
  };
}

/**
 * Devuelve ranking de zonas por capacidad (desc)
 * [{ zone, capacity, seats, tables }]
 */
export function rankZonesByCapacity(cells, cfg = {}) {
  const res = computeCapacity(cells, cfg);
  const out = [];

  for (const [zone, data] of Object.entries(res.byZone)) {
    // ignorar zona none si quieres, pero aquí la incluimos
    out.push({
      zone,
      capacity: data.capacity,
      seats: data.seats,
      tables: data.tables
    });
  }

  out.sort((a, b) => b.capacity - a.capacity);
  return out;
}

/**
 * Calcula ocupación (sold/reserved) vs total
 * Retorna:
 * {
 *   totalUnits,
 *   soldUnits,
 *   reservedUnits,
 *   blockedUnits,
 *   availableUnits,
 *   soldPct,
 *   reservedPct
 * }
 *
 * Nota: “units” son sillas+mesas como unidad.
 */
export function computeOccupancy(cells) {
  let totalUnits = 0;
  let soldUnits = 0;
  let reservedUnits = 0;
  let blockedUnits = 0;
  let availableUnits = 0;

  for (const cell of cells) {
    if (!cell || !cell.type) continue;
    if (cell.type !== "seat" && cell.type !== "table") continue;

    totalUnits++;
    const ss = normSellState(cell.sellState);

    if (ss === SELL_STATES.SOLD) soldUnits++;
    else if (ss === SELL_STATES.RESERVED) reservedUnits++;
    else if (ss === SELL_STATES.BLOCKED) blockedUnits++;
    else availableUnits++;
  }

  const soldPct = totalUnits ? Math.round((soldUnits / totalUnits) * 100) : 0;
  const reservedPct = totalUnits ? Math.round((reservedUnits / totalUnits) * 100) : 0;

  return {
    totalUnits,
    soldUnits,
    reservedUnits,
    blockedUnits,
    availableUnits,
    soldPct,
    reservedPct
  };
}
