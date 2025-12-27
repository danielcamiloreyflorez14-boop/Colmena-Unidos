/* ============================================================
   Colmena Unidos - export.js
   Responsabilidad:
   - Exportar información del recinto:
     1) Layout JSON (completo)
     2) Catálogo vendible JSON (para venta)
     3) CSV (Excel/Sheets)
     4) Resúmenes (capacidad/ocupación/zonas)
   - Descargar / copiar export sin backend
   ============================================================ */

import { createSnapshot } from "./state.js";
import { computeCapacity, computeOccupancy } from "./capacity.js";
import { buildCatalog, summarizeCatalog } from "./sales.js";

/* =========================
   1) Helpers base
========================= */
function nowISO() {
  return new Date().toISOString();
}

function safeFilename(name, fallback = "export") {
  const cleaned = String(name ?? "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback viejo
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
}

function csvEscape(value) {
  const s = String(value ?? "");
  // Doble comilla dentro de CSV se duplica
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

/* =========================
   2) Export Layout (JSON)
========================= */
/**
 * Exporta el layout completo:
 * - Snapshot del state (rows/cols/cells/zonas/precios/venta)
 * - Métricas (capacidad/ocupación)
 */
export function exportLayoutJSON(state) {
  const snapshot = createSnapshot(state);
  const metrics = computeCapacity(state.cells);
  const occupancy = computeOccupancy(state.cells);

  const out = {
    app: "colmena-unidos",
    type: "layout",
    version: 1,
    exportedAt: nowISO(),
    eventName: state.eventName || "",
    snapshot,
    metrics,
    occupancy
  };

  return JSON.stringify(out, null, 2);
}

/* =========================
   3) Export Catálogo (JSON)
========================= */
/**
 * Exporta catálogo vendible:
 * - Items: seat/table con precio final, zona, estado
 * - Resumen por zona y estado
 */
export function exportCatalogJSON(state) {
  const items = buildCatalog(state);
  const summary = summarizeCatalog(items);

  const out = {
    app: "colmena-unidos",
    type: "catalog",
    version: 1,
    exportedAt: nowISO(),
    eventName: state.eventName || "",
    currency: "COP",
    items,
    summary
  };

  return JSON.stringify(out, null, 2);
}

/* =========================
   4) Export CSV
========================= */
/**
 * CSV del layout completo (incluye tipos no vendibles)
 * columns:
 * index,row,col,type,seatNumber,zone,price,sellState
 */
export function exportLayoutCSV(state) {
  const { cols, cells } = state;

  const lines = [];
  lines.push("index,row,col,type,seatNumber,zone,price,sellState");

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell || !cell.type) continue;

    const row = Math.floor(i / cols);
    const col = i % cols;

    lines.push([
      csvEscape(i),
      csvEscape(row),
      csvEscape(col),
      csvEscape(cell.type),
      csvEscape(cell.seatNumber ?? ""),
      csvEscape(cell.zone ?? "none"),
      csvEscape(cell.price ?? ""),
      csvEscape(cell.sellState ?? "available")
    ].join(","));
  }

  return lines.join("\n");
}

/**
 * CSV del catálogo vendible (solo seat/table)
 * columns:
 * id,type,seatNumber,index,row,col,zone,sellState,price
 */
export function exportCatalogCSV(state) {
  const items = buildCatalog(state);

  const lines = [];
  lines.push("id,type,seatNumber,index,row,col,zone,sellState,price");

  for (const it of items) {
    lines.push([
      csvEscape(it.id),
      csvEscape(it.type),
      csvEscape(it.seatNumber ?? ""),
      csvEscape(it.index),
      csvEscape(it.row),
      csvEscape(it.col),
      csvEscape(it.zone ?? "none"),
      csvEscape(it.sellState ?? "available"),
      csvEscape(it.price ?? 0)
    ].join(","));
  }

  return lines.join("\n");
}

/* =========================
   5) Export Resumen (JSON)
========================= */
/**
 * Exporta solo métricas y resumen para reportes.
 */
export function exportSummaryJSON(state) {
  const cap = computeCapacity(state.cells);
  const occ = computeOccupancy(state.cells);
  const catalog = buildCatalog(state);
  const sum = summarizeCatalog(catalog);

  const out = {
    app: "colmena-unidos",
    type: "summary",
    version: 1,
    exportedAt: nowISO(),
    eventName: state.eventName || "",
    capacity: cap,
    occupancy: occ,
    catalogSummary: sum
  };

  return JSON.stringify(out, null, 2);
}

/* =========================
   6) Descargas directas
========================= */
export function downloadLayoutJSON(state) {
  const name = safeFilename(state.eventName, "layout");
  const txt = exportLayoutJSON(state);
  downloadText(`${name}-layout.json`, txt, "application/json");
}

export function downloadCatalogJSON(state) {
  const name = safeFilename(state.eventName, "catalog");
  const txt = exportCatalogJSON(state);
  downloadText(`${name}-catalog.json`, txt, "application/json");
}

export function downloadSummaryJSON(state) {
  const name = safeFilename(state.eventName, "summary");
  const txt = exportSummaryJSON(state);
  downloadText(`${name}-summary.json`, txt, "application/json");
}

export function downloadLayoutCSV(state) {
  const name = safeFilename(state.eventName, "layout");
  const csv = exportLayoutCSV(state);
  downloadText(`${name}-layout.csv`, csv, "text/csv");
}

export function downloadCatalogCSV(state) {
  const name = safeFilename(state.eventName, "catalog");
  const csv = exportCatalogCSV(state);
  downloadText(`${name}-catalog.csv`, csv, "text/csv");
}

/* =========================
   7) Copiar al portapapeles
========================= */
export async function copyLayoutJSON(state) {
  const txt = exportLayoutJSON(state);
  return copyText(txt);
}

export async function copyCatalogJSON(state) {
  const txt = exportCatalogJSON(state);
  return copyText(txt);
}

export async function copySummaryJSON(state) {
  const txt = exportSummaryJSON(state);
  return copyText(txt);
}
