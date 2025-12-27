# Colmena Unidos — Editor de Recintos (MVP)

**Colmena Unidos** es un editor web para diseñar recintos de eventos (sillas, mesas, escenario, pasillos y obstáculos) y preparar la estructura de venta de entradas **sin depender de backend ni servicios externos**.

Este repositorio construye el **núcleo del producto** que se mencionó en el chat/audios del grupo (proyecto web):  
**gestión de espacios + disposición física + base para venta de entradas**.

---

## Estado del proyecto

- MVP funcional (Editor visual + datos + export).
- Funciona en navegador (GitHub Pages o local).
- Sin IA.
- Sin pasarela de pago (por ahora).
- Sin servidor (por ahora).

---

## Qué hace (y por qué vale la pena)

### ✅ Hace
- Crea un plano (grid) del recinto.
- Permite colocar:
  - **Sillas**
  - **Mesas**
  - **Escenario**
  - **Bloques/obstáculos**
  - **Pasillos**
- **Auto-numeración** de sillas.
- Modo **pintar** y modo **selección**.
- Asignación de:
  - **Zona** (VIP, Preferencial, General, Balcón)
  - **Precio base** por tipo
  - **Precio personalizado** por selección
  - **Estado de venta** simulado: disponible/reservado/vendido/bloqueado
- Cálculo de capacidad (sillas + mesas × 4 por defecto).
- Guardar/Cargar en `localStorage`.
- Exportación:
  - JSON (layout)
  - JSON (catálogo vendible)
  - CSV (layout)
  - CSV (catálogo)

### ❌ No hace (todavía)
- Cobrar pagos.
- Gestionar usuarios/logins.
- Enviar tickets con QR.
- Reservas en tiempo real multiusuario.

Eso viene después, cuando el producto base esté sólido.

---

## Demo / Despliegue

### GitHub Pages
Este proyecto puede correr como página estática.

1) Subir a GitHub
2) Settings → Pages
3) Branch: `main` / folder root
4) Guardar y esperar
5) Abrir la URL pública

### Local (sin instalar nada)
- Abre `index.html` en el navegador.
- Recomendación: usar un servidor local (evita problemas de módulos):
  - VS Code → extensión “Live Server”
  - o `python -m http.server` en la raíz del proyecto

---

## Estructura del repositorio

```text
index.html
css/
  main.css
js/
  app.js        ← orquestador (UI, eventos, conecta módulos)
  grid.js       ← grid + render + modelos de celda
  tools.js      ← interacción usuario (pintar/seleccionar/arrastrar)
  state.js      ← estado global + snapshot + undo/redo helpers
  storage.js    ← guardar/cargar + export/import como texto
  capacity.js   ← cálculo de capacidad/ocupación/métricas
  sales.js      ← catálogo vendible + resumen + carrito simple
  export.js     ← export layout/catalog/summary a JSON/CSV
README.md
````

---

## Guía de uso (Paso a paso)

### 1) Crear el recinto

* Ajusta **Filas** y **Columnas**.
* Presiona **Aplicar tamaño**.

### 2) Diseñar el plano

* Selecciona una herramienta:

  * **Silla**
  * **Mesa**
  * **Escenario**
  * **Bloque**
  * **Pasillo**
  * **Borrar**
* Haz clic sobre el grid o arrastra si está activado “Pintar arrastrando”.

### 3) Numeración de asientos

* Si “Auto-numerar” está activo, las sillas reciben un número automáticamente.
* Si “Mostrar números” está activo, se ven en el grid.

### 4) Seleccionar elementos (para zonas/precios/estado)

* Activa **Modo Selección**.
* Selecciona celdas (clic o arrastre).
* Puedes asignar:

  * Zona
  * Precio personalizado
  * Estado de venta simulado

### 5) Capacidad

* Se calcula en barra de estadísticas:

  * Sillas
  * Mesas
  * Capacidad total (mesas × 4)

### 6) Guardar y cargar

* **Guardar**: guarda el layout completo en el navegador.
* **Cargar**: recupera el último guardado.

### 7) Exportar

* Exporta a JSON para:

  * backend futuro
  * compartir diseño
  * generar entradas
* Exporta a CSV para:

  * Excel/Google Sheets
  * validación manual

---

## Atajos de teclado (recomendados)

* `1` → Silla
* `2` → Mesa
* `3` → Escenario
* `4` → Bloque
* `5` → Pasillo
* `E` → Borrar
* `S` → Guardar
* `L` → Cargar
* `Ctrl + Z` → Deshacer
* `Ctrl + Y` → Rehacer
* `Esc` → Limpiar selección

---

## Cómo se guarda la data (modelo)

Cada celda del grid tiene un modelo:

```js
{
  type: "seat" | "table" | "stage" | "wall" | "aisle" | null,
  seatNumber: number|null,
  zone: "none" | "vip" | "preferencial" | "general" | "balcon",
  price: number|null,
  sellState: "available" | "reserved" | "sold" | "blocked"
}
```

El guardado usa un **snapshot** que incluye:

* rows/cols
* precios base
* nextSeatNumber
* cells[]
* selección (cuando aplica)

---

## Roadmap (Siguiente evolución)

### Prioridad 1 — Producto sólido

* Numeración por filas (A, B, C…) + asiento (A1, A2…)
* Herramienta “Zona” como pincel (en vez de solo selección)
* Mejorar reglas de capacidad por tipo de mesa

### Prioridad 2 — Preparación de venta (cliente)

* Vista “Cliente” para elegir asientos
* Generar carrito real y bloqueo temporal (reservas)

### Prioridad 3 — Backend

* API para persistencia multiusuario
* Usuarios y roles
* Órdenes de compra
* Integración de pagos
* Tickets QR / validación en puerta

---

## Reglas de contribución (para evitar caos)

* No mezclar UI con lógica: cada archivo cumple su rol.
* Cambios grandes → se documentan en README o notas del PR.
* PR pequeño y claro es mejor que PR gigante.
* Si un dev se bloquea: pedir ayuda temprano (no quemarse).

---

## Troubleshooting (problemas comunes)

### “No se ven cambios en CSS/JS”

Chrome cachea:

* Haz recarga fuerte: `Ctrl + Shift + R`
* O abre DevTools → Network → “Disable cache”
* O cambia el query: `main.css?v=2`

### “No carga el JS (módulos)”

Si abres `index.html` directo, algunos móviles/Chrome bloquean módulos.
Solución:

* usar Live Server en VS Code
* o servidor local (ej. `python -m http.server`)

### “El grid no se ve”

* Verifica que `css/main.css` exista y esté en la ruta correcta.
* Verifica que `#grid` tenga `display:grid` en CSS (ya está en main.css).

---

## Licencia

Este repositorio puede definirse como MIT o privada según el equipo.

```

---

Ya completamos el paquete de archivos.  
Si quieres, el siguiente paso es **hacer una mini-integración final** (2–3 cambios en `app.js`) para que:

- use `storage.js` (guardar/cargar profesional)
- use `capacity.js` (stats reales y ocupación)
- use `export.js` (descarga/copia desde UI)

Si me dices **“integración final”**, te doy exactamente los bloques de reemplazo dentro de `app.js` para dejarlo completamente conectado.
::contentReference[oaicite:0]{index=0}