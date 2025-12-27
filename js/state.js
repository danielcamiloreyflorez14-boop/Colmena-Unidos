/* ============================================================
   Colmena Unidos - state.js
   Responsabilidad:
   - Fuente única del estado del editor (State)
   - Constantes / enums: tools, zones, sellStates
   - Helpers: sanitize, reset, snapshot/restore
   - No DOM, no eventos, no storage directo, no export directo
   ============================================================ */

import { createCells, sanitizeZone, sanitizeSellState, isPlaceableType } from "./grid.js";

/* =========================
   1) Constantes (Enums)
========================= */
export const TOOLS = Object.freeze({
  SEAT: "seat",
  TABLE: "table",
  STAGE: "stage",
  WALL: "wall",
  AISLE: "aisle",
  ERASE: "erase"
});

export const MODES = Object.freeze({
  PAINT: "paint",
  SELECT: "select"
});

export const ZONES = Object.freeze({
  NONE: "none",
  VIP: "vip",
  PREFERENCIAL: "preferencial",
  GENERAL: "general",
  BALCON: "balcon"
});

export const SELL_STATES = Object.freeze({
  AVAILABLE: "available",
  RESERVED: "reserved",
  SOLD: "sold",
  BLOCKED: "blocked"
});

/* =========================
   2) Defaults del sistema
========================= */
export const DEFAULTS = Object.freeze({
  rows: 25,
  cols: 25,
  zoom: 1.0,

  tool: TOOLS.SEAT,
  mode: MODES.PAINT,

  showNumbers: true,
  autoNumber: true,
  continuousPaint: true,

  legendVisible: true,
  gridLinesVisible: false,

  eventName: "",

  // Precios base (sin cobrar todavía; “preparar venta”)
  priceSeat: 20000,
  priceTable: 80000,

  // Historial
  historyLimit: 50
});

/* =========================
   3) Utilidades base
========================= */
export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function safeNumber(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function safeInt(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

export function sanitizeTool(tool) {
  const t = String(tool ?? "");
  if (Object.values(TOOLS).includes(t)) return t;
  return DEFAULTS.tool;
}

export function sanitizeMode(mode) {
  const m = String(mode ?? "");
  if (Object.values(MODES).includes(m)) return m;
  return DEFAULTS.mode;
}

export function sanitizePrices(priceSeat, priceTable) {
  const ps = safeInt(priceSeat, DEFAULTS.priceSeat);
  const pt = safeInt(priceTable, DEFAULTS.priceTable);
  return {
    priceSeat: Math.max(0, ps),
    priceTable: Math.max(0, pt)
  };
}

/* =========================
   4) Creador del estado inicial
========================= */
export function createInitialState(overrides = {}) {
  const rows = clamp(safeInt(overrides.rows, DEFAULTS.rows), 5, 80);
  const cols = clamp(safeInt(overrides.cols, DEFAULTS.cols), 5, 80);

  const prices = sanitizePrices(
    overrides.priceSeat ?? DEFAULTS.priceSeat,
    overrides.priceTable ?? DEFAULTS.priceTable
  );

  return {
    // Grid config
    rows,
    cols,
    zoom: clamp(safeNumber(overrides.zoom, DEFAULTS.zoom), 0.5, 2.0),

    // Tooling
    tool: sanitizeTool(overrides.tool),
    mode: sanitizeMode(overrides.mode),

    // UI toggles
    showNumbers: overrides.showNumbers ?? DEFAULTS.showNumbers,
    autoNumber: overrides.autoNumber ?? DEFAULTS.autoNumber,
    continuousPaint: overrides.continuousPaint ?? DEFAULTS.continuousPaint,
    legendVisible: overrides.legendVisible ?? DEFAULTS.legendVisible,
    gridLinesVisible: overrides.gridLinesVisible ?? DEFAULTS.gridLinesVisible,

    // Meta
    eventName: String(overrides.eventName ?? DEFAULTS.eventName),

    // Prices
    priceSeat: prices.priceSeat,
    priceTable: prices.priceTable,

    // Numeración
    nextSeatNumber: safeInt(overrides.nextSeatNumber, 1) || 1,

    // Selection
    selected: new Set(),

    // Data model
    cells: Array.isArray(overrides.cells) && overrides.cells.length === rows * cols
      ? overrides.cells
      : createCells(rows, cols),

    // History
    undoStack: [],
    redoStack: [],
    historyLimit: clamp(safeInt(overrides.historyLimit, DEFAULTS.historyLimit), 10, 200)
  };
}

/* =========================
   5) Singleton State (opcional)
   - Si tu app.js usa un objeto State global,
     puedes importarlo desde aquí y dejar de duplicar.
========================= */
export const State = createInitialState();

/* =========================
   6) Reset / Rebuild helpers
========================= */
export function resetGrid(state, newRows, newCols) {
  const r = clamp(safeInt(newRows, state.rows), 5, 80);
  const c = clamp(safeInt(newCols, state.cols), 5, 80);

  state.rows = r;
  state.cols = c;
  state.cells = createCells(r, c);

  state.selected.clear();
  state.nextSeatNumber = 1;

  return state;
}

export function clearSelection(state) {
  state.selected.clear();
  return state;
}

/* =========================
   7) Precios efectivos
   - Si una celda tiene price definido, se usa.
   - Si no, se usa el precio base por tipo.
========================= */
export function getDefaultPriceForType(state, type) {
  if (type === TOOLS.SEAT) return state.priceSeat;
  if (type === TOOLS.TABLE) return state.priceTable;
  return 0;
}

export function getEffectivePrice(state, cellModel) {
  if (!cellModel || !cellModel.type) return null;
  if (cellModel.price != null && Number.isFinite(Number(cellModel.price))) {
    return Math.max(0, Number(cellModel.price));
  }
  return getDefaultPriceForType(state, cellModel.type);
}

/* =========================
   8) Snapshot / Restore
   Para:
   - undo/redo
   - guardar/cargar con storage.js
========================= */
export function createSnapshot(state) {
  return {
    version: 1,
    ts: new Date().toISOString(),

    rows: state.rows,
    cols: state.cols,
    zoom: state.zoom,

    tool: state.tool,
    mode: state.mode,

    showNumbers: !!state.showNumbers,
    autoNumber: !!state.autoNumber,
    continuousPaint: !!state.continuousPaint,
    legendVisible: !!state.legendVisible,
    gridLinesVisible: !!state.gridLinesVisible,

    eventName: state.eventName,

    priceSeat: state.priceSeat,
    priceTable: state.priceTable,

    nextSeatNumber: state.nextSeatNumber,

    // Importantísimo: convertir Set a array
    selected: Array.from(state.selected),

    // Clonar cells
    cells: state.cells.map(c => ({
      type: c.type ?? null,
      seatNumber: c.seatNumber ?? null,
      zone: sanitizeZone(c.zone),
      price: (c.price === null || c.price === undefined) ? null : Math.max(0, Number(c.price)),
      sellState: sanitizeSellState(c.sellState)
    }))
  };
}

export function applySnapshot(state, snap) {
  if (!snap || typeof snap !== "object") return false;

  const rows = clamp(safeInt(snap.rows, state.rows), 5, 80);
  const cols = clamp(safeInt(snap.cols, state.cols), 5, 80);

  // Validación de tamaño
  if (!Array.isArray(snap.cells) || snap.cells.length !== rows * cols) return false;

  state.rows = rows;
  state.cols = cols;
  state.zoom = clamp(safeNumber(snap.zoom, state.zoom), 0.5, 2.0);

  state.tool = sanitizeTool(snap.tool);
  state.mode = sanitizeMode(snap.mode);

  state.showNumbers = !!snap.showNumbers;
  state.autoNumber = !!snap.autoNumber;
  state.continuousPaint = !!snap.continuousPaint;
  state.legendVisible = !!snap.legendVisible;
  state.gridLinesVisible = !!snap.gridLinesVisible;

  state.eventName = String(snap.eventName ?? "");

  const prices = sanitizePrices(snap.priceSeat, snap.priceTable);
  state.priceSeat = prices.priceSeat;
  state.priceTable = prices.priceTable;

  state.nextSeatNumber = safeInt(snap.nextSeatNumber, 1) || 1;

  // Selection
  state.selected.clear();
  if (Array.isArray(snap.selected)) {
    for (const idx of snap.selected) {
      const n = safeInt(idx, -1);
      if (n >= 0 && n < rows * cols) state.selected.add(n);
    }
  }

  // Cells sanitizadas
  state.cells = snap.cells.map((c) => {
    const type = isPlaceableType(c.type) ? c.type : null;
    const seatNumber = (type === "seat" && Number.isFinite(Number(c.seatNumber)) && Number(c.seatNumber) > 0)
      ? Math.trunc(Number(c.seatNumber))
      : null;

    const zone = sanitizeZone(c.zone);
    const price = (c.price === null || c.price === undefined) ? null : Number(c.price);
    const sellState = sanitizeSellState(c.sellState);

    return {
      type,
      seatNumber,
      zone,
      price: (Number.isFinite(price) && price >= 0) ? price : null,
      sellState
    };
  });

  // Historial se conserva aparte (no viene del snapshot normalmente)
  return true;
}

/* =========================
   9) Historial (Undo/Redo)
   - Helpers listos para usar en app.js
========================= */
export function pushUndo(state, reason = "Cambio") {
  const snap = createSnapshot(state);
  state.undoStack.push({ reason, snap });
  if (state.undoStack.length > state.historyLimit) state.undoStack.shift();
  state.redoStack.length = 0;
  return true;
}

export function undo(state) {
  if (state.undoStack.length === 0) return null;

  const current = createSnapshot(state);
  const prev = state.undoStack.pop();

  state.redoStack.push({ reason: "Rehacer", snap: current });
  applySnapshot(state, prev.snap);
  return prev.reason || "Deshacer";
}

export function redo(state) {
  if (state.redoStack.length === 0) return null;

  const current = createSnapshot(state);
  const next = state.redoStack.pop();

  state.undoStack.push({ reason: "Deshacer", snap: current });
  applySnapshot(state, next.snap);
  return next.reason || "Rehacer";
}
