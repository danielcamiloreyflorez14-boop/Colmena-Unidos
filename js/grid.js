/* ============================================================
   Colmena Unidos - grid.js
   Responsabilidad:
   - Crear y reconstruir el grid (DOM)
   - Manejar conversiones index <-> (row,col)
   - Renderizar celdas según un modelo de datos (cells[])
   - Soportar zoom, gridlines y helpers de selección visual
   - NO maneja UI general, NO maneja storage, NO maneja export.
   ============================================================ */

/**
 * Modelo esperado por celda (recomendación):
 * {
 *   type: null | "seat" | "table" | "stage" | "wall" | "aisle",
 *   seatNumber: number|null,
 *   zone: "none"|"vip"|"preferencial"|"general"|"balcon",
 *   price: number|null,
 *   sellState: "available"|"reserved"|"sold"|"blocked"
 * }
 */

export function makeCellModel() {
  return {
    type: null,
    seatNumber: null,
    zone: "none",
    price: null,
    sellState: "available",
  };
}

export function isPlaceableType(t) {
  return ["seat", "table", "stage", "wall", "aisle"].includes(t);
}

export function sanitizeZone(z) {
  const zone = String(z ?? "none");
  return ["none", "vip", "preferencial", "general", "balcon"].includes(zone)
    ? zone
    : "none";
}

export function sanitizeSellState(s) {
  const ss = String(s ?? "available");
  return ["available", "reserved", "sold", "blocked"].includes(ss)
    ? ss
    : "available";
}

/** index -> {r,c} */
export function indexToRC(index, cols) {
  return {
    r: Math.floor(index / cols),
    c: index % cols
  };
}

/** (r,c) -> index */
export function rcToIndex(r, c, cols) {
  return r * cols + c;
}

/**
 * Inicializa un arreglo de celdas de tamaño rows*cols
 */
export function createCells(rows, cols) {
  const total = rows * cols;
  return Array.from({ length: total }, makeCellModel);
}

/**
 * Construye el grid DOM (celdas) dentro de gridEl.
 * - Asigna dataset.index por celda
 * - Aplica grid-template-columns acorde a cols
 */
export function buildGridDOM(gridEl, rows, cols, cellSizeVar = "var(--cell)") {
  if (!gridEl) throw new Error("gridEl es requerido");

  gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSizeVar})`;
  gridEl.innerHTML = "";

  const total = rows * cols;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < total; i++) {
    const div = document.createElement("div");
    div.className = "cell";
    div.dataset.index = String(i);
    div.setAttribute("role", "gridcell");
    frag.appendChild(div);
  }

  gridEl.appendChild(frag);
}

/**
 * Obtiene índice desde un evento (pointer/mouse/keyboard) si apunta a una celda
 */
export function getCellIndexFromEvent(e) {
  const el = e.target?.closest?.(".cell");
  if (!el) return null;
  const idx = Number(el.dataset.index);
  return Number.isFinite(idx) ? idx : null;
}

/**
 * Renderiza UNA celda al DOM según cells[index] y selectedSet.
 * selectedSet: Set<number> o null
 * options.showNumbers: boolean (para mostrar seatNumber)
 */
export function renderCell(gridEl, index, cells, selectedSet = null, options = {}) {
  const showNumbers = options.showNumbers ?? true;

  const cellDiv = gridEl.querySelector(`.cell[data-index="${index}"]`);
  if (!cellDiv) return;

  const model = cells[index];
  if (!model) return;

  // Reset base
  cellDiv.className = "cell";

  // Type
  if (model.type) cellDiv.classList.add(model.type);

  // Selection
  if (selectedSet && selectedSet.has(index)) cellDiv.classList.add("selected");

  // Sell state visual
  if (model.sellState && model.sellState !== "available") {
    cellDiv.classList.add(model.sellState);
  }

  // Content: seat number
  if (showNumbers && model.type === "seat" && model.seatNumber) {
    cellDiv.textContent = String(model.seatNumber);
  } else {
    cellDiv.textContent = "";
  }

  // Data attributes (útiles para export/inspector)
  cellDiv.dataset.zone = sanitizeZone(model.zone);
  cellDiv.dataset.seatNumber = model.seatNumber ? String(model.seatNumber) : "";
  cellDiv.dataset.price = (model.price ?? "") + "";
  cellDiv.dataset.sellState = sanitizeSellState(model.sellState);
}

/**
 * Renderiza TODO el grid
 */
export function renderAllCells(gridEl, cells, selectedSet = null, options = {}) {
  for (let i = 0; i < cells.length; i++) {
    renderCell(gridEl, i, cells, selectedSet, options);
  }
}

/**
 * Aplica zoom (scale) al grid
 */
export function applyZoom(gridEl, zoom) {
  gridEl.style.transform = `scale(${zoom})`;
  gridEl.style.transformOrigin = "top left";
}

/**
 * Toggle gridlines (clase gridlines en el grid)
 */
export function setGridLines(gridEl, enabled) {
  gridEl.classList.toggle("gridlines", !!enabled);
}

/**
 * Selección visual masiva: cuando cambias selectedSet grande,
 * esto ayuda a actualizar solo las necesarias.
 */
export function renderSelectionOnly(gridEl, indices, cells, selectedSet, options = {}) {
  for (const idx of indices) {
    renderCell(gridEl, idx, cells, selectedSet, options);
  }
}

/**
 * Limpia completamente el grid data (no DOM) dejando todas las celdas vacías
 */
export function clearCells(cells) {
  for (let i = 0; i < cells.length; i++) {
    cells[i] = makeCellModel();
  }
  return cells;
}

/**
 * Aplica una herramienta sobre una celda data (no DOM):
 * - tool: seat/table/stage/wall/aisle/erase
 * - nextSeatNumber: contador externo (objeto con .value)
 * - autoNumber: si true, asigna número al crear asiento
 *
 * Devuelve:
 * { changed: boolean, seatNumberAssigned: number|null }
 */
export function applyToolToCell({
  tool,
  cellModel,
  nextSeatNumberRef,
  autoNumber = true
}) {
  if (!cellModel) return { changed: false, seatNumberAssigned: null };

  // erase
  if (tool === "erase") {
    const hadSomething = !!cellModel.type || !!cellModel.seatNumber || cellModel.zone !== "none" || cellModel.price != null;
    cellModel.type = null;
    cellModel.seatNumber = null;
    cellModel.zone = "none";
    cellModel.price = null;
    cellModel.sellState = "available";
    return { changed: hadSomething, seatNumberAssigned: null };
  }

  if (!isPlaceableType(tool)) {
    return { changed: false, seatNumberAssigned: null };
  }

  let assigned = null;
  let changed = false;

  // Si cambias a un tipo distinto, ajusta seatNumber según reglas
  if (tool !== cellModel.type) {
    changed = true;
  }

  // Si pones seat
  if (tool === "seat") {
    if (autoNumber && !cellModel.seatNumber) {
      assigned = nextSeatNumberRef.value++;
      cellModel.seatNumber = assigned;
      changed = true;
    }
    cellModel.sellState = cellModel.sellState || "available";
  } else {
    // Si era seat y cambias a otro tipo, elimina seatNumber
    if (cellModel.type === "seat" && cellModel.seatNumber != null) {
      cellModel.seatNumber = null;
      cellModel.sellState = "available";
      changed = true;
    }
  }

  cellModel.type = tool;
  return { changed, seatNumberAssigned: assigned };
}

/**
 * Aplica zona a selección (data only)
 */
export function applyZoneToSelection(cells, selectedSet, zone) {
  const z = sanitizeZone(zone);
  let changed = false;
  for (const idx of selectedSet) {
    if (!cells[idx]) continue;
    if (cells[idx].zone !== z) {
      cells[idx].zone = z;
      changed = true;
    }
  }
  return changed;
}

/**
 * Limpia zona en selección (data only)
 */
export function clearZoneFromSelection(cells, selectedSet) {
  let changed = false;
  for (const idx of selectedSet) {
    if (!cells[idx]) continue;
    if (cells[idx].zone !== "none") {
      cells[idx].zone = "none";
      changed = true;
    }
  }
  return changed;
}

/**
 * Aplica precio a selección (data only)
 */
export function applyPriceToSelection(cells, selectedSet, price) {
  if (!Number.isFinite(price) || price < 0) return false;
  let changed = false;
  for (const idx of selectedSet) {
    if (!cells[idx]) continue;
    if (cells[idx].price !== price) {
      cells[idx].price = price;
      changed = true;
    }
  }
  return changed;
}

/**
 * Limpia precio en selección
 */
export function clearPriceFromSelection(cells, selectedSet) {
  let changed = false;
  for (const idx of selectedSet) {
    if (!cells[idx]) continue;
    if (cells[idx].price != null) {
      cells[idx].price = null;
      changed = true;
    }
  }
  return changed;
}

/**
 * Aplica estado de venta a selección
 */
export function applySellStateToSelection(cells, selectedSet, sellState) {
  const ss = sanitizeSellState(sellState);
  let changed = false;
  for (const idx of selectedSet) {
    if (!cells[idx]) continue;
    if (cells[idx].sellState !== ss) {
      cells[idx].sellState = ss;
      changed = true;
    }
  }
  return changed;
}

/**
 * Reset estado de venta a selección
 */
export function resetSellStateSelection(cells, selectedSet) {
  let changed = false;
  for (const idx of selectedSet) {
    if (!cells[idx]) continue;
    if (cells[idx].sellState !== "available") {
      cells[idx].sellState = "available";
      changed = true;
    }
  }
  return changed;
}

/**
 * Obtiene resumen del grid para UI
 */
export function computeStats(cells) {
  let seats = 0;
  let tables = 0;

  for (const c of cells) {
    if (c.type === "seat") seats++;
    else if (c.type === "table") tables++;
  }

  const capacity = seats + tables * 4;
  return { seats, tables, capacity };
}

/**
 * Obtiene modelo de celda de forma segura
 */
export function getCellModel(cells, index) {
  return cells[index] ?? null;
}
