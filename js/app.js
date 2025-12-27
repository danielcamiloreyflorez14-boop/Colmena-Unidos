import { buildGridDOM, createCells, renderAllCells } from "./grid.js";
import { State, createSnapshot, applySnapshot } from "./state.js";
import { saveToLocal, loadAndApply } from "./storage.js";
import { quickStats } from "./capacity.js";
import {
  downloadLayoutJSON,
  downloadCatalogJSON,
  downloadLayoutCSV,
  downloadCatalogCSV
} from "./export.js";

/* ============================================================
   Colmena Unidos - app.js (Entry / Orchestrator)
   ============================================================ */

/* -------------------------
   Referencias DOM
------------------------- */
const gridEl = document.getElementById("grid");

const statSeats = document.getElementById("statSeats");
const statTables = document.getElementById("statTables");
const statCapacity = document.getElementById("statCapacity");

/* -------------------------
   Inicialización de Estado
------------------------- */
State.cells = createCells(State.rows, State.cols);

/* -------------------------
   Construcción del Grid
------------------------- */
buildGridDOM(gridEl, State.rows, State.cols);
renderAllCells(
  gridEl,
  State.cells,
  State.selected,
  { showNumbers: State.showNumbers }
);

/* -------------------------
   Carga desde localStorage
------------------------- */
loadAndApply(State);

/* -------------------------
   Estadísticas iniciales
------------------------- */
function updateStats() {
  const s = quickStats(State.cells);
  statSeats.textContent = s.seats;
  statTables.textContent = s.tables;
  statCapacity.textContent = s.capacity;
}

updateStats();

/* -------------------------
   Persistencia inicial
------------------------- */
saveToLocal(State);




(() => {
  "use strict";

  /* =========================
     1) Helpers base
  ========================== */
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const safeJSONParse = (txt, fallback = null) => {
    try { return JSON.parse(txt); } catch { return fallback; }
  };

  const nowISO = () => new Date().toISOString();

  const downloadText = (filename, text, mime = "application/json") => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback: selección manual
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        ta.remove();
        return true;
      } catch {
        ta.remove();
        return false;
      }
    }
  };

  /* =========================
     2) IDs / Elementos UI
  ========================== */
  // Topbar / general
  const appStatusBadge = $("appStatusBadge");
  const eventNameLabel = $("eventNameLabel");
  const modeLabel = $("modeLabel");

  const btnHelp = $("btnHelp");
  const btnShortcuts = $("btnShortcuts");
  const btnUndo = $("btnUndo");
  const btnRedo = $("btnRedo");

  const btnSave = $("btnSave");
  const btnLoad = $("btnLoad");
  const btnClear = $("btnClear");

  // Tools
  const toolButtons = qsa(".tool"); // incluye data-tool
  const btnSelectMode = $("btnSelectMode");
  const btnPaintMode = $("btnPaintMode");

  const chkShowNumbers = $("chkShowNumbers");
  const chkSnap = $("chkSnap"); // reservado para futuras mejoras
  const chkAutoNumber = $("chkAutoNumber");
  const chkContinuousPaint = $("chkContinuousPaint");

  // Plano inputs
  const eventNameInput = $("eventNameInput");
  const rowsInput = $("rowsInput");
  const colsInput = $("colsInput");
  const gridPreset = $("gridPreset");
  const btnApplyGrid = $("btnApplyGrid");
  const btnCenterView = $("btnCenterView");

  const btnZoomOut = $("btnZoomOut");
  const btnZoomReset = $("btnZoomReset");
  const btnZoomIn = $("btnZoomIn");

  // Zonas y precios
  const zoneSelect = $("zoneSelect");
  const priceSeatInput = $("priceSeatInput");
  const priceTableInput = $("priceTableInput");
  const btnAssignZone = $("btnAssignZone");
  const btnClearZone = $("btnClearZone");

  // Export/Import
  const btnExportJSON = $("btnExportJSON");
  const btnImportJSON = $("btnImportJSON");
  const btnExportCSV = $("btnExportCSV");
  const btnPrint = $("btnPrint");

  // Stats bar
  const statSeats = $("statSeats");
  const statTables = $("statTables");
  const statCapacity = $("statCapacity");
  const statSelected = $("statSelected");
  const statZone = $("statZone");

  // Workspace toggles
  const btnToggleGridLines = $("btnToggleGridLines");
  const btnToggleLegend = $("btnToggleLegend");

  // Canvas
  const canvasWrap = $("canvasWrap");
  const gridEl = $("grid");
  const legendEl = $("legend");

  // Bottom labels
  const hintText = $("hintText");
  const saveStateLabel = $("saveStateLabel");
  const lastActionLabel = $("lastActionLabel");

  // Inspector
  const inspType = $("inspType");
  const inspSeatNumber = $("inspSeatNumber");
  const inspZone = $("inspZone");
  const inspPrice = $("inspPrice");

  const inspPriceInput = $("inspPriceInput");
  const btnApplyPrice = $("btnApplyPrice");
  const btnClearPrice = $("btnClearPrice");

  const sellModeSelect = $("sellModeSelect");
  const btnApplySellState = $("btnApplySellState");
  const btnResetSellState = $("btnResetSellState");

  // Checklist (opcional)
  const chkMvp2 = $("chkMvp2");
  const chkMvp3 = $("chkMvp3");
  const chkMvp4 = $("chkMvp4");
  const chkMvp5 = $("chkMvp5");

  // Modals
  const modalExport = $("modalExport");
  const modalImport = $("modalImport");
  const modalHelp = $("modalHelp");
  const modalShortcuts = $("modalShortcuts");

  const exportTextarea = $("exportTextarea");
  const btnDownloadJSON = $("btnDownloadJSON");
  const btnCopyJSON = $("btnCopyJSON");

  const importTextarea = $("importTextarea");
  const btnApplyImport = $("btnApplyImport");
  const btnCancelImport = $("btnCancelImport");

  /* =========================
     3) Estado global del editor
  ========================== */
  const STORAGE_KEY = "colmena_unidos_layout_v1";

  const State = {
    // Grid
    rows: 25,
    cols: 25,
    zoom: 1.0,

    // Herramientas
    tool: "seat", // seat, table, stage, wall, aisle, erase
    mode: "paint", // paint | select
    showNumbers: true,
    autoNumber: true,
    continuousPaint: true,

    // Numeración
    nextSeatNumber: 1,

    // Selección
    selected: new Set(), // indices

    // Data model por celda (arreglo de tamaño rows*cols)
    // cada item: { type, seatNumber, zone, price, sellState }
    cells: [],

    // Event meta
    eventName: "",

    // Zone/prices UI
    activeZone: "none",
    priceSeat: 20000,
    priceTable: 80000,

    // UI toggles
    legendVisible: true,
    gridLinesVisible: false,

    // History
    undoStack: [],
    redoStack: [],
    historyLimit: 50
  };

  /* =========================
     4) Modelo de celda
  ========================== */
  const makeCellModel = () => ({
    type: null,          // seat/table/stage/wall/aisle/null
    seatNumber: null,    // number
    zone: "none",        // none/vip/preferencial/general/balcon
    price: null,         // number (override)
    sellState: "available" // available/reserved/sold/blocked
  });

  const isPlaceableType = (t) => ["seat","table","stage","wall","aisle"].includes(t);

  const defaultPriceForType = (type) => {
    if (type === "seat") return State.priceSeat;
    if (type === "table") return State.priceTable;
    return 0;
  };

  /* =========================
     5) History (Undo/Redo)
  ========================== */
  const snapshot = () => {
    // Snapshot compactado: meta + cells + nextSeatNumber
    return {
      ts: nowISO(),
      rows: State.rows,
      cols: State.cols,
      zoom: State.zoom,
      nextSeatNumber: State.nextSeatNumber,
      eventName: State.eventName,
      cells: State.cells.map(c => ({...c})),
    };
  };

  const applySnapshot = (snap) => {
    State.rows = snap.rows;
    State.cols = snap.cols;
    State.zoom = snap.zoom ?? 1.0;
    State.nextSeatNumber = snap.nextSeatNumber ?? 1;
    State.eventName = snap.eventName ?? "";
    State.cells = snap.cells.map(c => ({...c}));

    // Reset selection
    State.selected.clear();

    // Render
    syncUIFromState();
    buildGridDOM(gridEl, State.rows, State.cols); // reconstruye DOM con nuevo tamaño
    renderAllCells(gridEl, State.cells, State.selected, { showNumbers: State.showNumbers });
    updateStats();
    updateInspector(null);
  };

  const pushHistory = (reason = "Cambio") => {
    State.undoStack.push(snapshot());
    if (State.undoStack.length > State.historyLimit) {
      State.undoStack.shift();
    }
    State.redoStack.length = 0;
    lastActionLabel.textContent = reason;
    saveStateLabel.textContent = "Sin guardar";
  };

  const undo = () => {
    if (State.undoStack.length === 0) return;
    const current = snapshot();
    const prev = State.undoStack.pop();
    State.redoStack.push(current);
    applySnapshot(prev);
    lastActionLabel.textContent = "Deshacer";
  };

  const redo = () => {
    if (State.redoStack.length === 0) return;
    const current = snapshot();
    const next = State.redoStack.pop();
    State.undoStack.push(current);
    applySnapshot(next);
    lastActionLabel.textContent = "Rehacer";
  };

  /* =========================
     6) Grid: creación DOM y render
  ========================== */
  const indexToRC = (index) => ({
    r: Math.floor(index / State.cols),
    c: index % State.cols
  });

  const rcToIndex = (r, c) => r * State.cols + c;

  const initCells = () => {
    const total = State.rows * State.cols;
    State.cells = Array.from({ length: total }, makeCellModel);
    State.selected.clear();
    State.nextSeatNumber = 1;
  };

  const buildGridDOM = () => {
    // Configurar grid template columns usando CSS variable cell-size (se mantiene)
    gridEl.style.gridTemplateColumns = `repeat(${State.cols}, var(--cell))`;
    gridEl.innerHTML = "";

    const total = State.rows * State.cols;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < total; i++) {
      const div = document.createElement("div");
      div.className = "cell";
      div.dataset.index = String(i);
      // accesibilidad básica
      div.setAttribute("role", "gridcell");
      frag.appendChild(div);
    }

    gridEl.appendChild(frag);
    applyZoom();
  };

  const renderCell = (index) => {
    const cellDiv = gridEl.querySelector(`.cell[data-index="${index}"]`);
    if (!cellDiv) return;

    const model = State.cells[index];
    // base class
    cellDiv.className = "cell";

    // type class
    if (model.type) cellDiv.classList.add(model.type);

    // selection
    if (State.selected.has(index)) cellDiv.classList.add("selected");

    // sell state visual (optional)
    if (model.sellState && model.sellState !== "available") {
      cellDiv.classList.add(model.sellState);
    }

    // show numbers (only for seats)
    if (State.showNumbers && model.type === "seat" && model.seatNumber) {
      cellDiv.textContent = String(model.seatNumber);
    } else {
      cellDiv.textContent = "";
    }

    // zone data attribute for possible future css hooks
    cellDiv.dataset.zone = model.zone || "none";
    cellDiv.dataset.seatNumber = model.seatNumber ? String(model.seatNumber) : "";
    cellDiv.dataset.price = (model.price ?? "") + "";
    cellDiv.dataset.sellState = model.sellState || "available";
  };

  const renderAllCells = () => {
    for (let i = 0; i < State.cells.length; i++) {
      renderCell(i);
    }
    updateStats();
  };

  const applyZoom = () => {
    gridEl.style.transform = `scale(${State.zoom})`;
  };

  /* =========================
     7) Interacción: pintar/seleccionar
  ========================== */
  let isPointerDown = false;

  const setHint = (msg) => { hintText.textContent = msg; };

  const setTool = (tool) => {
    State.tool = tool;

    // aria-pressed en tool buttons
    toolButtons.forEach(btn => {
      const t = btn.dataset.tool;
      btn.setAttribute("aria-pressed", t === tool ? "true" : "false");
    });

    setHint(`Herramienta activa: ${tool.toUpperCase()}`);
  };

  const setMode = (mode) => {
    State.mode = mode;
    modeLabel.textContent = mode === "paint" ? "Edición" : "Selección";

    if (mode === "paint") {
      setHint("Modo pintar: haz clic/arrastra para colocar elementos.");
    } else {
      setHint("Modo selección: selecciona celdas para asignar zona/precio/estado.");
    }
  };

  const toggleSelection = (index) => {
    if (State.selected.has(index)) State.selected.delete(index);
    else State.selected.add(index);

    renderCell(index);
    updateStats();
    updateInspectorFromSelection();
  };

  const clearSelection = () => {
    if (State.selected.size === 0) return;
    const copy = Array.from(State.selected);
    State.selected.clear();
    copy.forEach(i => renderCell(i));
    updateStats();
    updateInspector(null);
  };

  const paintCell = (index) => {
    const model = State.cells[index];
    const tool = State.tool;

    if (tool === "erase") {
      // Si borras un asiento numerado, NO “reutilizamos” número (evita caos).
      model.type = null;
      model.seatNumber = null;
      model.zone = "none";
      model.price = null;
      model.sellState = "available";
      renderCell(index);
      return;
    }

    if (!isPlaceableType(tool)) return;

    // Si es seat y autoNumber activo, asignar número si no tenía.
    if (tool === "seat") {
      if (State.autoNumber && !model.seatNumber) {
        model.seatNumber = State.nextSeatNumber++;
      }
      // default zone: none, sellState: available
      model.sellState = model.sellState || "available";
    } else {
      // al poner otro tipo, si era seat, limpiar seatNumber
      if (model.type === "seat") {
        model.seatNumber = null;
        model.sellState = "available";
      }
    }

    model.type = tool;

    // Precio: si no tiene precio custom, deja null (se calcula por default al exportar)
    // Zone se mantiene si el usuario asignó
    renderCell(index);
  };

  const getCellIndexFromEvent = (e) => {
    const el = e.target.closest(".cell");
    if (!el) return null;
    const idx = Number(el.dataset.index);
    return Number.isFinite(idx) ? idx : null;
  };

  const handlePointerAction = (index, e) => {
    if (index == null) return;

    if (State.mode === "select") {
      // selección con click / arrastre
      toggleSelection(index);
      return;
    }

    // paint mode
    paintCell(index);
    updateStats();
    updateInspector(index);
  };

  const attachGridEvents = () => {
    // pointer down
    gridEl.addEventListener("pointerdown", (e) => {
      const idx = getCellIndexFromEvent(e);
      if (idx == null) return;

      isPointerDown = true;
      gridEl.setPointerCapture(e.pointerId);

      // si shift presionado, forzamos selección sin cambiar modo
      if (e.shiftKey) {
        toggleSelection(idx);
        return;
      }

      pushHistory("Pintar / Seleccionar");
      handlePointerAction(idx, e);
    });

    // pointer move (pintar arrastrando)
    gridEl.addEventListener("pointermove", (e) => {
      if (!isPointerDown) return;
      if (!State.continuousPaint) return;

      const idx = getCellIndexFromEvent(e);
      if (idx == null) return;

      // Evitar toggle repetido en modo selección: si arrastras, no alternar sin control
      if (State.mode === "select") {
        // en selección por arrastre: solo añadir (no toggle) para experiencia mejor
        if (!State.selected.has(idx)) {
          State.selected.add(idx);
          renderCell(idx);
          updateStats();
          updateInspectorFromSelection();
        }
        return;
      }

      paintCell(idx);
      updateStats();
    });

    gridEl.addEventListener("pointerup", () => {
      isPointerDown = false;
    });

    gridEl.addEventListener("pointercancel", () => {
      isPointerDown = false;
    });

    // Click simple para inspector (si el usuario no está arrastrando)
    gridEl.addEventListener("click", (e) => {
      const idx = getCellIndexFromEvent(e);
      if (idx == null) return;

      // si no estamos en selección, actualizamos inspector
      if (State.mode !== "select") updateInspector(idx);
    });

    // Teclado dentro del grid
    gridEl.addEventListener("keydown", (e) => {
      // Escape: limpiar selección
      if (e.key === "Escape") {
        clearSelection();
      }
    });
  };

  /* =========================
     8) Estadísticas y capacidad
  ========================== */
  const computeStats = () => {
    let seats = 0;
    let tables = 0;

    for (const c of State.cells) {
      if (c.type === "seat") seats++;
      else if (c.type === "table") tables++;
    }

    // Capacidad: sillas + mesas*4 (regla simple)
    const capacity = seats + tables * 4;
    const selected = State.selected.size;
    return { seats, tables, capacity, selected };
  };

  const updateStats = () => {
    const s = computeStats();
    statSeats.textContent = String(s.seats);
    statTables.textContent = String(s.tables);
    statCapacity.textContent = String(s.capacity);
    statSelected.textContent = String(s.selected);

    // zona activa
    const z = State.activeZone === "none" ? "—" : State.activeZone.toUpperCase();
    statZone.textContent = z;

    // checklist
    if (chkMvp2) chkMvp2.checked = s.seats > 0; // numeración se valida mejor luego
    if (chkMvp4) chkMvp4.checked = s.capacity > 0;
  };

  /* =========================
     9) Inspector
  ========================== */
  const updateInspector = (indexOrNull) => {
    if (indexOrNull == null) {
      inspType.textContent = "—";
      inspSeatNumber.textContent = "—";
      inspZone.textContent = "—";
      inspPrice.textContent = "—";
      return;
    }

    const cell = State.cells[indexOrNull];
    inspType.textContent = cell.type ? cell.type.toUpperCase() : "VACÍO";
    inspSeatNumber.textContent = cell.seatNumber ? String(cell.seatNumber) : "—";
    inspZone.textContent = cell.zone && cell.zone !== "none" ? cell.zone.toUpperCase() : "—";

    const effectivePrice = (cell.price != null)
      ? cell.price
      : (cell.type ? defaultPriceForType(cell.type) : null);

    inspPrice.textContent = effectivePrice != null ? `$${formatMoney(effectivePrice)}` : "—";
  };

  const updateInspectorFromSelection = () => {
    // Si hay exactamente 1 seleccionado, mostrar ese; si no, mostrar resumen
    const arr = Array.from(State.selected);
    if (arr.length === 1) {
      updateInspector(arr[0]);
      return;
    }

    if (arr.length === 0) {
      updateInspector(null);
      return;
    }

    // Resumen
    let seatCount = 0, tableCount = 0, otherCount = 0;
    for (const idx of arr) {
      const t = State.cells[idx].type;
      if (t === "seat") seatCount++;
      else if (t === "table") tableCount++;
      else if (t) otherCount++;
    }

    inspType.textContent = `SELECCIÓN (${arr.length})`;
    inspSeatNumber.textContent = seatCount ? `${seatCount} sillas` : "—";
    inspZone.textContent = "—";
    inspPrice.textContent = "—";
  };

  const formatMoney = (n) => {
    // Sin Intl para evitar líos; formato simple con miles
    const s = Math.round(n).toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  /* =========================
     10) Zonas, precios, venta
  ========================== */
  const assignZoneToSelection = (zone) => {
    if (State.selected.size === 0) return;

    pushHistory("Asignar zona");
    for (const idx of State.selected) {
      State.cells[idx].zone = zone;
      renderCell(idx);
    }
    if (chkMvp3) chkMvp3.checked = zone !== "none";
    updateStats();
    updateInspectorFromSelection();
  };

  const clearZoneFromSelection = () => {
    if (State.selected.size === 0) return;

    pushHistory("Quitar zona");
    for (const idx of State.selected) {
      State.cells[idx].zone = "none";
      renderCell(idx);
    }
    updateStats();
    updateInspectorFromSelection();
  };

  const applyPriceToSelection = (price) => {
    if (State.selected.size === 0) return;
    if (!Number.isFinite(price) || price < 0) return;

    pushHistory("Aplicar precio");
    for (const idx of State.selected) {
      State.cells[idx].price = price;
      renderCell(idx);
    }
    updateInspectorFromSelection();
  };

  const clearPriceFromSelection = () => {
    if (State.selected.size === 0) return;

    pushHistory("Quitar precio");
    for (const idx of State.selected) {
      State.cells[idx].price = null;
      renderCell(idx);
    }
    updateInspectorFromSelection();
  };

  const applySellStateToSelection = (sellState) => {
    if (State.selected.size === 0) return;

    pushHistory("Aplicar estado venta");
    for (const idx of State.selected) {
      State.cells[idx].sellState = sellState;
      renderCell(idx);
    }
    updateInspectorFromSelection();
  };

  const resetSellStateSelection = () => {
    if (State.selected.size === 0) return;

    pushHistory("Reset estado venta");
    for (const idx of State.selected) {
      State.cells[idx].sellState = "available";
      renderCell(idx);
    }
    updateInspectorFromSelection();
  };

  /* =========================
     11) Export / Import
  ========================== */
  const exportAsJSON = () => {
    const payload = {
      version: 1,
      exportedAt: nowISO(),
      eventName: State.eventName,
      rows: State.rows,
      cols: State.cols,
      nextSeatNumber: State.nextSeatNumber,
      prices: {
        seat: State.priceSeat,
        table: State.priceTable
      },
      cells: State.cells
    };
    return JSON.stringify(payload, null, 2);
  };

  const exportAsCSV = () => {
    // CSV de asientos/mesas (solo elementos relevantes)
    // columns: index,row,col,type,seatNumber,zone,price,sellState
    const lines = [];
    lines.push("index,row,col,type,seatNumber,zone,price,sellState");

    for (let i = 0; i < State.cells.length; i++) {
      const c = State.cells[i];
      if (!c.type) continue;
      const { r, c: col } = indexToRC(i);

      const price = (c.price != null)
        ? c.price
        : defaultPriceForType(c.type);

      lines.push([
        i,
        r,
        col,
        c.type,
        c.seatNumber ?? "",
        c.zone ?? "none",
        price ?? "",
        c.sellState ?? "available"
      ].map(v => `"${String(v).replaceAll('"','""')}"`).join(","));
    }

    return lines.join("\n");
  };

  const importFromJSON = (text) => {
    const data = safeJSONParse(text);
    if (!data || typeof data !== "object") {
      alert("JSON inválido.");
      return false;
    }

    // Validaciones mínimas
    const rows = Number(data.rows);
    const cols = Number(data.cols);
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 5 || cols < 5) {
      alert("JSON inválido: rows/cols.");
      return false;
    }

    if (!Array.isArray(data.cells) || data.cells.length !== rows * cols) {
      alert("JSON inválido: cells no coincide con rows*cols.");
      return false;
    }

    pushHistory("Importar JSON");

    // Aplicar
    State.rows = rows;
    State.cols = cols;
    State.eventName = String(data.eventName ?? "");
    State.nextSeatNumber = Number(data.nextSeatNumber ?? 1) || 1;
    State.priceSeat = Number(data.prices?.seat ?? State.priceSeat) || State.priceSeat;
    State.priceTable = Number(data.prices?.table ?? State.priceTable) || State.priceTable;

    // Sanitizar celdas
    State.cells = data.cells.map((c) => {
      const m = makeCellModel();
      const type = c.type;
      m.type = isPlaceableType(type) ? type : null;

      const sn = Number(c.seatNumber);
      m.seatNumber = (m.type === "seat" && Number.isFinite(sn) && sn > 0) ? sn : null;

      const zone = String(c.zone ?? "none");
      m.zone = ["none","vip","preferencial","general","balcon"].includes(zone) ? zone : "none";

      const price = (c.price === null || c.price === undefined) ? null : Number(c.price);
      m.price = (Number.isFinite(price) && price >= 0) ? price : null;

      const ss = String(c.sellState ?? "available");
      m.sellState = ["available","reserved","sold","blocked"].includes(ss) ? ss : "available";
      return m;
    });

    // Rebuild grid and render
    syncUIFromState();
    buildGridDOM(gridEl, State.rows, State.cols);
    renderAllCells(gridEl, State.cells, State.selected, { showNumbers: State.showNumbers });
    updateStats();
    updateInspector(null);
    saveStateLabel.textContent = "Sin guardar";
    lastActionLabel.textContent = "Importado";
    return true;
  };

  /* =========================
     12) Guardar / Cargar (localStorage)
  ========================== */
  const saveToLocal = () => {
    const payload = exportAsJSON();
    localStorage.setItem(STORAGE_KEY, payload);
    saveStateLabel.textContent = "Guardado";
    lastActionLabel.textContent = "Guardado";
    if (appStatusBadge) appStatusBadge.textContent = "MVP";
  };

  const loadFromLocal = () => {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (!txt) {
      alert("No hay diseño guardado en este navegador.");
      return;
    }
    importFromJSON(txt);
    saveStateLabel.textContent = "Cargado";
    lastActionLabel.textContent = "Cargado";
  };

  const clearAll = () => {
    if (!confirm("¿Seguro que deseas limpiar todo el plano?")) return;

    pushHistory("Limpiar");
    State.cells = createCells(State.rows, State.cols);
    renderAllCells(gridEl, State.cells, State.selected, { showNumbers: State.showNumbers });
    clearSelection();
    updateInspector(null);
    updateStats();
    saveStateLabel.textContent = "Sin guardar";
    lastActionLabel.textContent = "Limpio";
  };

  /* =========================
     13) UI Sync
  ========================== */
  const syncStateFromUI = () => {
    State.showNumbers = !!chkShowNumbers?.checked;
    State.autoNumber = !!chkAutoNumber?.checked;
    State.continuousPaint = !!chkContinuousPaint?.checked;

    State.eventName = eventNameInput?.value?.trim() ?? "";
    State.rows = clamp(Number(rowsInput?.value ?? State.rows), 5, 80);
    State.cols = clamp(Number(colsInput?.value ?? State.cols), 5, 80);

    State.activeZone = zoneSelect?.value ?? "none";
    State.priceSeat = Number(priceSeatInput?.value ?? State.priceSeat) || State.priceSeat;
    State.priceTable = Number(priceTableInput?.value ?? State.priceTable) || State.priceTable;

    eventNameLabel.textContent = State.eventName ? State.eventName : "Sin nombre";
  };

  const syncUIFromState = () => {
    if (eventNameInput) eventNameInput.value = State.eventName;
    if (rowsInput) rowsInput.value = String(State.rows);
    if (colsInput) colsInput.value = String(State.cols);

    if (chkShowNumbers) chkShowNumbers.checked = State.showNumbers;
    if (chkAutoNumber) chkAutoNumber.checked = State.autoNumber;
    if (chkContinuousPaint) chkContinuousPaint.checked = State.continuousPaint;

    if (zoneSelect) zoneSelect.value = State.activeZone;
    if (priceSeatInput) priceSeatInput.value = String(State.priceSeat);
    if (priceTableInput) priceTableInput.value = String(State.priceTable);

    eventNameLabel.textContent = State.eventName ? State.eventName : "Sin nombre";
    modeLabel.textContent = (State.mode === "paint") ? "Edición" : "Selección";

    // legend + gridlines
    legendEl.style.display = State.legendVisible ? "" : "none";
    gridEl.classList.toggle("gridlines", State.gridLinesVisible);

    applyZoom();
  };

  /* =========================
     14) Presets de grid
  ========================== */
  const applyPreset = (preset) => {
    if (!preset || preset === "custom") return false;

    let r = State.rows, c = State.cols;

    if (preset === "small") { r = 15; c = 15; }
    if (preset === "medium") { r = 25; c = 25; }
    if (preset === "large") { r = 35; c = 35; }
    if (preset === "wide_stage") { r = 25; c = 35; }
    if (preset === "ring_center") { r = 30; c = 30; }

    rowsInput.value = String(r);
    colsInput.value = String(c);
    return true;
  };

  /* =========================
     15) Aplicar tamaño de grid
  ========================== */
  const applyGridSize = () => {
    syncStateFromUI();

    const total = State.rows * State.cols;
    pushHistory("Cambiar tamaño");

    // reinit model + rebuild
    State.cells = createCells(State.rows, State.cols);
State.selected.clear();
State.nextSeatNumber = 1;

buildGridDOM(gridEl, State.rows, State.cols);
renderAllCells(gridEl, State.cells, State.selected, { showNumbers: State.showNumbers });

  };

  /* =========================
     16) Zoom / Center
  ========================== */
  const zoomTo = (z) => {
    State.zoom = clamp(z, 0.5, 2.0);
    applyZoom();
    lastActionLabel.textContent = `Zoom ${Math.round(State.zoom * 100)}%`;
  };

  const centerView = () => {
    // “centrar” básico: scroll al inicio
    canvasWrap.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    lastActionLabel.textContent = "Centrar";
  };

  /* =========================
     17) Toggle legend / gridlines
  ========================== */
  const toggleLegend = () => {
    State.legendVisible = !State.legendVisible;
    legendEl.style.display = State.legendVisible ? "" : "none";
    lastActionLabel.textContent = State.legendVisible ? "Leyenda ON" : "Leyenda OFF";
  };

  const toggleGridLines = () => {
    State.gridLinesVisible = !State.gridLinesVisible;
    gridEl.classList.toggle("gridlines", State.gridLinesVisible);
    lastActionLabel.textContent = State.gridLinesVisible ? "Líneas ON" : "Líneas OFF";
  };

  /* =========================
     18) Modales
  ========================== */
  const showDialog = (dlg) => {
    if (!dlg) return;
    try { dlg.showModal(); } catch { /* ignore */ }
  };

  const closeDialog = (dlg) => {
    if (!dlg) return;
    try { dlg.close(); } catch { /* ignore */ }
  };

  /* =========================
     19) Atajos de teclado globales
  ========================== */
  const handleGlobalShortcuts = (e) => {
    // Ignore si estás escribiendo en inputs/textareas
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    // Undo / redo
    if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }

    // Save/load
    if (e.key.toLowerCase() === "s") { e.preventDefault(); saveToLocal(); return; }
    if (e.key.toLowerCase() === "l") { e.preventDefault(); loadFromLocal(); return; }

    // Tools numeric
    if (e.key === "1") { setTool("seat"); return; }
    if (e.key === "2") { setTool("table"); return; }
    if (e.key === "3") { setTool("stage"); return; }
    if (e.key === "4") { setTool("wall"); return; }
    if (e.key === "5") { setTool("aisle"); return; }
    if (e.key.toLowerCase() === "e") { setTool("erase"); return; }

    // Esc = clear selection
    if (e.key === "Escape") { clearSelection(); return; }
  };

  /* =========================
     20) Wiring de eventos UI
  ========================== */
  const wireUI = () => {
    // Tools click
    toolButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.tool;
        if (!t) return;
        setTool(t);
        // si estaba en select mode y elige tool, cambiamos a paint
        if (State.mode !== "paint") setMode("paint");
      });
    });

    // Modes
    btnSelectMode.addEventListener("click", () => setMode("select"));
    btnPaintMode.addEventListener("click", () => setMode("paint"));

    // Toggles
    chkShowNumbers.addEventListener("change", () => {
      State.showNumbers = chkShowNumbers.checked;
      renderAllCells(gridEl, State.cells, State.selected, { showNumbers: State.showNumbers });
    });

    chkAutoNumber.addEventListener("change", () => {
      State.autoNumber = chkAutoNumber.checked;
      lastActionLabel.textContent = State.autoNumber ? "Auto-numerar ON" : "Auto-numerar OFF";
    });

    chkContinuousPaint.addEventListener("change", () => {
      State.continuousPaint = chkContinuousPaint.checked;
      lastActionLabel.textContent = State.continuousPaint ? "Arrastrar ON" : "Arrastrar OFF";
    });

    // Event name live update
    eventNameInput.addEventListener("input", () => {
      State.eventName = eventNameInput.value.trim();
      eventNameLabel.textContent = State.eventName ? State.eventName : "Sin nombre";
      saveStateLabel.textContent = "Sin guardar";
    });

    // Presets
    gridPreset.addEventListener("change", () => {
      const p = gridPreset.value;
      if (applyPreset(p)) {
        lastActionLabel.textContent = `Preset: ${p}`;
      }
    });

    // Apply grid size
    btnApplyGrid.addEventListener("click", applyGridSize);

    // Center/Zoom
    btnCenterView.addEventListener("click", centerView);
    btnZoomOut.addEventListener("click", () => zoomTo(State.zoom - 0.1));
    btnZoomIn.addEventListener("click", () => zoomTo(State.zoom + 0.1));
    btnZoomReset.addEventListener("click", () => zoomTo(1.0));

    // Save/Load/Clear
    btnSave.addEventListener("click", saveToLocal);
    btnLoad.addEventListener("click", loadFromLocal);
    btnClear.addEventListener("click", clearAll);

    // Undo/Redo
    btnUndo.addEventListener("click", undo);
    btnRedo.addEventListener("click", redo);

    // Zone & price settings
    zoneSelect.addEventListener("change", () => {
      State.activeZone = zoneSelect.value;
      updateStats();
    });

    priceSeatInput.addEventListener("change", () => {
      const n = Number(priceSeatInput.value);
      if (Number.isFinite(n) && n >= 0) State.priceSeat = n;
      updateInspectorFromSelection();
    });

    priceTableInput.addEventListener("change", () => {
      const n = Number(priceTableInput.value);
      if (Number.isFinite(n) && n >= 0) State.priceTable = n;
      updateInspectorFromSelection();
    });

    btnAssignZone.addEventListener("click", () => {
      const z = zoneSelect.value;
      assignZoneToSelection(z);
      if (chkMvp3) chkMvp3.checked = (z !== "none");
    });

    btnClearZone.addEventListener("click", clearZoneFromSelection);

    // Inspector: apply price
    btnApplyPrice.addEventListener("click", () => {
      const n = Number(inspPriceInput.value);
      if (!Number.isFinite(n) || n < 0) {
        alert("Precio inválido.");
        return;
      }
      applyPriceToSelection(n);
      if (chkMvp3) chkMvp3.checked = true;
      inspPriceInput.value = "";
    });

    btnClearPrice.addEventListener("click", () => {
      clearPriceFromSelection();
      inspPriceInput.value = "";
    });

    // Sell state simulation
    btnApplySellState.addEventListener("click", () => {
      const s = sellModeSelect.value;
      applySellStateToSelection(s);
    });

    btnResetSellState.addEventListener("click", resetSellStateSelection);

    // Export / import
    btnExportJSON.addEventListener("click", () => {
      const txt = exportAsJSON();
      exportTextarea.value = txt;
      showDialog(modalExport);
      if (chkMvp5) chkMvp5.checked = true;
    });

    btnDownloadJSON.addEventListener("click", () => {
      const txt = exportTextarea.value || exportAsJSON();
      const name = (State.eventName ? State.eventName.replace(/[^\w\s-]/g, "").trim() : "layout") || "layout";
      downloadText(`${name}.json`, txt, "application/json");
    });

    btnCopyJSON.addEventListener("click", async () => {
      const ok = await copyToClipboard(exportTextarea.value || exportAsJSON());
      alert(ok ? "Copiado." : "No se pudo copiar.");
    });

    btnImportJSON.addEventListener("click", () => {
      importTextarea.value = "";
      showDialog(modalImport);
    });

    btnApplyImport.addEventListener("click", () => {
      const txt = importTextarea.value.trim();
      if (!txt) { alert("Pega el JSON."); return; }
      const ok = importFromJSON(txt);
      if (ok) closeDialog(modalImport);
    });

    btnCancelImport.addEventListener("click", () => closeDialog(modalImport));

    btnExportCSV.addEventListener("click", () => {
      const csv = exportAsCSV();
      const name = (State.eventName ? State.eventName.replace(/[^\w\s-]/g, "").trim() : "layout") || "layout";
      downloadText(`${name}.csv`, csv, "text/csv");
    });

    btnPrint.addEventListener("click", () => window.print());

    // Toggle legend / grid lines
    btnToggleLegend.addEventListener("click", toggleLegend);
    btnToggleGridLines.addEventListener("click", toggleGridLines);

    // Help / shortcuts
    btnHelp.addEventListener("click", () => showDialog(modalHelp));
    btnShortcuts.addEventListener("click", () => showDialog(modalShortcuts));

    // Global shortcuts
    window.addEventListener("keydown", handleGlobalShortcuts);
  };

  /* =========================
     21) Inicialización
  ========================== */
  const boot = () => {
    // Estado inicial desde UI
    syncStateFromUI();

    // Set tool & mode
    setTool("seat");
    setMode("paint");

    // Crear modelo + DOM
    State.cells = createCells(State.rows, State.cols);
    buildGridDOM(gridEl, State.rows, State.cols);
    attachGridEvents();
    wireUI();

    // Render
    syncUIFromState();
    renderAllCells(gridEl, State.cells, State.selected, { showNumbers: State.showNumbers });
    updateStats();
    updateInspector(null);

    // Si hay guardado, opcional: cargar automático
    // (por seguridad no auto-cargamos, pero puedes activar esto)
    // const txt = localStorage.getItem(STORAGE_KEY);
    // if (txt) importFromJSON(txt);

    saveStateLabel.textContent = "Sin guardar";
    lastActionLabel.textContent = "Listo";
    setHint("Listo. Selecciona herramienta y pinta sobre el plano.");
  };

  // Ejecutar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
