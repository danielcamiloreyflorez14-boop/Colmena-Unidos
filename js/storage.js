/* ============================================================
   Colmena Unidos - storage.js
   Responsabilidad:
   - Persistencia (localStorage) del layout y config
   - Versionado y migración básica
   - Import/Export como texto (JSON)
   - Integración con state.js (snapshot/restore)
   ============================================================ */

import { createSnapshot, applySnapshot } from "./state.js";

/* =========================
   1) Claves y versión
========================= */
export const STORAGE = Object.freeze({
  KEY: "colmena_unidos_layout",
  VERSION: 1
});

/* =========================
   2) Helpers seguros
========================= */
function safeJSONParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Envuelve payload en un “sobre” (envelope) con metadata
 */
function wrapEnvelope(payload) {
  return {
    app: "colmena-unidos",
    schemaVersion: STORAGE.VERSION,
    savedAt: nowISO(),
    payload
  };
}

/**
 * Verifica si parece un envelope válido
 */
function isValidEnvelope(obj) {
  return !!obj
    && typeof obj === "object"
    && obj.app === "colmena-unidos"
    && typeof obj.schemaVersion === "number"
    && obj.payload
    && typeof obj.payload === "object";
}

/**
 * Migración básica (placeholder)
 * - Si en el futuro cambias el schema, aquí puedes transformar.
 */
function migrateEnvelope(envelope) {
  // Hoy solo existe VERSION 1. Si cambia, aquí se migraría.
  if (!isValidEnvelope(envelope)) return null;

  const v = envelope.schemaVersion;

  // Futuro:
  // if (v === 0) envelope = migrateFromV0(envelope)
  // if (v === 1) ok

  if (v !== STORAGE.VERSION) {
    // Si no sabemos migrar, evitamos romper
    // Puedes decidir aceptar v menores aquí si implementas migración
    return null;
  }

  return envelope;
}

/* =========================
   3) API pública: Guardar / Cargar
========================= */

/**
 * Guarda un snapshot del estado completo en localStorage.
 * Retorna { ok, error? }
 */
export function saveToLocal(state) {
  const snap = createSnapshot(state);

  const envelope = wrapEnvelope({
    version: STORAGE.VERSION,
    snapshot: snap
  });

  try {
    localStorage.setItem(STORAGE.KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Carga desde localStorage y devuelve { ok, snapshot?, error? }
 * NO aplica el snapshot automáticamente (eso lo decide app.js).
 */
export function loadFromLocal() {
  const text = localStorage.getItem(STORAGE.KEY);
  if (!text) return { ok: false, error: "NO_DATA" };

  const parsed = safeJSONParse(text);
  if (!parsed) return { ok: false, error: "INVALID_JSON" };

  const migrated = migrateEnvelope(parsed);
  if (!migrated) return { ok: false, error: "UNSUPPORTED_VERSION" };

  const snap = migrated.payload?.snapshot;
  if (!snap) return { ok: false, error: "MISSING_SNAPSHOT" };

  return { ok: true, snapshot: snap, meta: { savedAt: migrated.savedAt } };
}

/**
 * Aplica directamente el snapshot guardado sobre un state existente.
 * Retorna { ok, error? }
 */
export function loadAndApply(state) {
  const res = loadFromLocal();
  if (!res.ok) return res;

  const ok = applySnapshot(state, res.snapshot);
  if (!ok) return { ok: false, error: "APPLY_FAILED" };

  return { ok: true, meta: res.meta };
}

/**
 * Devuelve true si existe algo guardado.
 */
export function hasSaved() {
  return !!localStorage.getItem(STORAGE.KEY);
}

/**
 * Borra el guardado.
 */
export function clearSaved() {
  try {
    localStorage.removeItem(STORAGE.KEY);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/* =========================
   4) Export/Import como texto (JSON)
   Útil para copiar/pegar o compartir
========================= */

/**
 * Devuelve texto JSON exportable (envelope completo)
 */
export function exportStateAsText(state) {
  const snap = createSnapshot(state);
  const envelope = wrapEnvelope({
    version: STORAGE.VERSION,
    snapshot: snap
  });
  return JSON.stringify(envelope, null, 2);
}

/**
 * Importa texto JSON (envelope) y lo aplica sobre state
 * Retorna { ok, error? }
 */
export function importStateFromText(text, state) {
  const parsed = safeJSONParse(text);
  if (!parsed) return { ok: false, error: "INVALID_JSON" };

  const migrated = migrateEnvelope(parsed);
  if (!migrated) return { ok: false, error: "UNSUPPORTED_VERSION" };

  const snap = migrated.payload?.snapshot;
  if (!snap) return { ok: false, error: "MISSING_SNAPSHOT" };

  const ok = applySnapshot(state, snap);
  if (!ok) return { ok: false, error: "APPLY_FAILED" };

  return { ok: true, meta: { savedAt: migrated.savedAt } };
}

/* =========================
   5) Utilidades extra (opcional)
   - Para debugging / respaldo
========================= */

/**
 * Descarga el export como archivo .json
 */
export function downloadExport(state, filename = "colmena-layout.json") {
  const text = exportStateAsText(state);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/**
 * Intenta copiar export al portapapeles
 */
export async function copyExportToClipboard(state) {
  const text = exportStateAsText(state);

  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
