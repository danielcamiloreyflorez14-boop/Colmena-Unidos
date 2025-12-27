/* ============================================================
   Colmena Unidos - tools.js
   Responsabilidad:
   - Manejar interacción del usuario con el grid:
     - pintar (paint)
     - seleccionar (select)
     - arrastrar (continuous paint/select)
   - No guarda, no exporta, no calcula capacidad.
   - Se integra con grid.js (render y applyToolToCell).
   ============================================================ */

import {
  getCellIndexFromEvent,
  applyToolToCell,
  renderCell
} from "./grid.js";

/**
 * Crea controlador de herramientas sobre el grid.
 *
 * @param {Object} cfg
 * @param {HTMLElement} cfg.gridEl - contenedor del grid
 * @param {Array} cfg.cells - array de modelos
 * @param {Set<number>} cfg.selected - set de índices seleccionados
 * @param {Object} cfg.stateRef - referencia a state (tool/mode/showNumbers/autoNumber/continuousPaint)
 * @param {Object} cfg.seatCounterRef - { value: number } contador de asientos
 *
 * @param {Function} cfg.onChange - callback cuando cambia algo (paint/erase/selection)
 * @param {Function} cfg.onInspect - callback cuando se deba actualizar inspector (idx o null)
 * @param {Function} cfg.onSelectChange - callback cuando cambia selección
 * @param {Function} cfg.onBeforeMutate - callback antes de mutar (para pushHistory)
 */
export function createToolsController(cfg) {
  const {
    gridEl,
    cells,
    selected,
    stateRef,
    seatCounterRef,
    onChange,
    onInspect,
    onSelectChange,
    onBeforeMutate
  } = cfg;

  if (!gridEl) throw new Error("gridEl requerido");
  if (!cells) throw new Error("cells requerido");
  if (!selected) throw new Error("selected requerido");
  if (!stateRef) throw new Error("stateRef requerido");
  if (!seatCounterRef) throw new Error("seatCounterRef requerido");

  // Internos
  let isPointerDown = false;
  let lastHoverIndex = null;

  // Para selección por arrastre: evitamos agregar repetido
  const dragVisited = new Set();

  const renderOptions = () => ({ showNumbers: !!stateRef.showNumbers });

  const renderIndex = (idx) => {
    renderCell(gridEl, idx, cells, selected, renderOptions());
  };

  const renderMany = (indices) => {
    indices.forEach(renderIndex);
  };

  const clearDragVisited = () => dragVisited.clear();

  const setPointerDown = (v) => {
    isPointerDown = v;
    if (!v) {
      clearDragVisited();
      lastHoverIndex = null;
    }
  };

  const safePushHistory = (reason) => {
    if (typeof onBeforeMutate === "function") onBeforeMutate(reason);
  };

  /* ----------------------------------------------------------
     Selección
  ---------------------------------------------------------- */
  const toggleSelection = (idx) => {
    if (selected.has(idx)) selected.delete(idx);
    else selected.add(idx);
    renderIndex(idx);

    if (typeof onSelectChange === "function") onSelectChange(selected);
    if (typeof onInspect === "function") {
      // si hay 1 seleccionado, inspecciona ese; si no, null y que app haga resumen
      if (selected.size === 1) onInspect(Array.from(selected)[0]);
      else onInspect(null);
    }
  };

  const addSelection = (idx) => {
    if (selected.has(idx)) return;
    selected.add(idx);
    renderIndex(idx);

    if (typeof onSelectChange === "function") onSelectChange(selected);
  };

  const clearSelection = () => {
    if (selected.size === 0) return;
    const indices = Array.from(selected);
    selected.clear();
    renderMany(indices);

    if (typeof onSelectChange === "function") onSelectChange(selected);
    if (typeof onInspect === "function") onInspect(null);
  };

  /* ----------------------------------------------------------
     Pintar
  ---------------------------------------------------------- */
  const paintAtIndex = (idx) => {
    const cellModel = cells[idx];
    if (!cellModel) return;

    const tool = stateRef.tool;
    const autoNumber = !!stateRef.autoNumber;

    const result = applyToolToCell({
      tool,
      cellModel,
      nextSeatNumberRef: seatCounterRef,
      autoNumber
    });

    // render solo si cambió
    if (result.changed) {
      renderIndex(idx);
      if (typeof onChange === "function") onChange({ type: "paint", index: idx, tool });
      if (typeof onInspect === "function") onInspect(idx);
    }
  };

  /* ----------------------------------------------------------
     Gestos pointer (mouse/touch/pen)
  ---------------------------------------------------------- */
  const onPointerDown = (e) => {
    const idx = getCellIndexFromEvent(e);
    if (idx == null) return;

    isPointerDown = true;
    dragVisited.clear();

    try {
      gridEl.setPointerCapture(e.pointerId);
    } catch (_) {
      // ignorar
    }

    // SHIFT = selección rápida sin cambiar modo
    if (e.shiftKey) {
      safePushHistory("Selección (Shift)");
      toggleSelection(idx);
      setPointerDown(true);
      dragVisited.add(idx);
      return;
    }

    // Según modo
    if (stateRef.mode === "select") {
      safePushHistory("Selección");
      toggleSelection(idx);
      dragVisited.add(idx);
      setPointerDown(true);
      return;
    }

    // paint mode
    safePushHistory("Pintar");
    paintAtIndex(idx);
    dragVisited.add(idx);
    setPointerDown(true);
  };

  const onPointerMove = (e) => {
    if (!isPointerDown) return;
    if (!stateRef.continuousPaint) return;

    const idx = getCellIndexFromEvent(e);
    if (idx == null) return;

    // Evitar repetir la misma celda en el arrastre
    if (dragVisited.has(idx)) return;
    dragVisited.add(idx);

    // En selección por arrastre: solo añadimos (no toggle) para que no “parpadee”
    if (stateRef.mode === "select") {
      addSelection(idx);
      if (typeof onChange === "function") onChange({ type: "select_drag", index: idx });
      return;
    }

    // paint arrastrando
    paintAtIndex(idx);
  };

  const onPointerUp = () => {
    setPointerDown(false);
    if (typeof onChange === "function") onChange({ type: "pointer_up" });
  };

  const onPointerCancel = () => {
    setPointerDown(false);
    if (typeof onChange === "function") onChange({ type: "pointer_cancel" });
  };

  /* ----------------------------------------------------------
     Hover (opcional)
  ---------------------------------------------------------- */
  const onPointerOver = (e) => {
    const idx = getCellIndexFromEvent(e);
    if (idx == null) return;
    lastHoverIndex = idx;
  };

  /* ----------------------------------------------------------
     Teclado dentro del grid
  ---------------------------------------------------------- */
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      clearSelection();
      return;
    }
  };

  /* ----------------------------------------------------------
     API pública del controlador
  ---------------------------------------------------------- */
  const attach = () => {
    gridEl.addEventListener("pointerdown", onPointerDown);
    gridEl.addEventListener("pointermove", onPointerMove);
    gridEl.addEventListener("pointerup", onPointerUp);
    gridEl.addEventListener("pointercancel", onPointerCancel);
    gridEl.addEventListener("pointerover", onPointerOver);
    gridEl.addEventListener("keydown", onKeyDown);
  };

  const detach = () => {
    gridEl.removeEventListener("pointerdown", onPointerDown);
    gridEl.removeEventListener("pointermove", onPointerMove);
    gridEl.removeEventListener("pointerup", onPointerUp);
    gridEl.removeEventListener("pointercancel", onPointerCancel);
    gridEl.removeEventListener("pointerover", onPointerOver);
    gridEl.removeEventListener("keydown", onKeyDown);
  };

  return {
    attach,
    detach,
    clearSelection,
    toggleSelection,
    addSelection
  };
}
