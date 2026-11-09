# Contexto y estado del proyecto JureFinance

Documento de referencia viva para que el conocimiento del proyecto crezca con el
tiempo. Complementa `docs/FLUJO_CLIENTE.md` (flujo de negocio) con el estado
técnico actual, decisiones y brechas. Última actualización: 2026-10-30.

## 1. Identidad del proyecto

- **Nombre:** JureFinance (agencia de viajes JureTravel).
- **Stack:** React 19.2.8 + Vite 8.3.0, JS (sin TS), CSS variables.
- **Dependencias runtime:** `react`, `react-dom`, `lucide-react`.
- **Dev:** `@vitejs/plugin-react`, `oxlint`, `vite`.
- **Scripts:** `dev`, `build`, `lint`, `test:modelo` (SSR del modelo), `test:ui` (SSR de las vistas BCP), `test:runtime` (navegación real con Chrome headless), `preview`.
- **No es repo git** en el entorno actual (no hay control de versiones).

## 2. Módulos y archivos clave

| Módulo | Componente principal | Función |
|---|---|---|
| Cotizador (presupuestación) | `src/components/Cotizador/CotizadorView.jsx` → `Wizard/CotizadorWizard.jsx` | Wizard 3 pasos: datos+proveedores → servicios → resumen |
| Operadores | `src/components/Operadores/OperadoresView.jsx` | Alta de proveedores; el directorio se persiste y alimenta cotizador/configuración |
| Configuración mensual | `src/components/Configuracion/ConfiguracionMensualView.jsx` | Bloques "día de emisión → fecha de pago" por proveedor y mes: edición manual, regla automática, plantilla estándar, copia entre meses, cobertura y aplicación masiva |
| Cuentas a pagar | `src/components/Cobranzas/CalendarioPagosView.jsx` + `FlujoCajaBCP.jsx` | Calendario de vencimientos, liquidación por proveedor/fecha, flujo de caja auditable, CSV y registro de pagos |
| Cuentas a cobrar | `src/components/Cobranzas/CalendarioCobrosView.jsx` | Cobros al cliente derivados del precio de venta, por mes |
| Historial | `src/components/Historial/HistorialView.jsx` | Cotizaciones guardadas |
| Dashboard | `src/components/Dashboard/DashboardView.jsx` | Métricas de ganancias y cobros |
| Drive | `src/components/DriveViewer/DriveView.jsx` | Expedientes por cliente sincronizados con Google Drive |

Servicios (`src/services/`):
- `serviciosService.js` — modelo de servicios: venta + ofertas de compra. `normalizarServicios`, `createEmptyItem`, `createEmptyOferta`, `ofertaCompraDe`, `totalVentaItems`, `totalCostoItems`, `totalGananciaItems`.
- `ttoService.js` — reglas de fechas de pago de los TTOO. `getFechaPagoTTOO`, `getBloqueBCP`, `getBloquesBCPPorVencimiento`, `validarCoberturaMes`, `validateBloques`, `generarBloquesDesdeRegla`, `desplazarBloquesAMes`, `getMesActual`.
- `calendarioService.js` — obligaciones, pagos, liquidaciones por bloque y reporte. `construirAgendaPagos`, `resumenAgendaPagos`, `aplicarPagos`, `liquidacionesPorProveedorYFecha`, `repartirPagoEnLiquidacion`, `totalesPorMoneda`, `agruparPorFechaVencimiento`, `agruparTicketsPorProveedor`, `generarCSVFlujoCaja`.
- `driveService.js` — puente con Google Drive (Apps Script v3.1).
- `cobroService.js` — cobranzas.

## 3. Arquitectura y persistencia

- `App.jsx` mantiene el estado central: cotizaciones, operadores, pagos TTOO (overlay), pagos manuales, config mensual, drive config.
- Persistencia: `localStorage` (caché) ⇄ `App.jsx` ⇄ Apps Script Web App (conector v3.1) ⇄ Google Drive (`jurefinance_db.json`, `jurefinance_tree.json`, carpetas por cliente).
- Sync cada 60 s (o 5 min con conector viejo) y al recuperar el foco de la ventana.
- Pagos **no** se guardan en la cotización: son un *overlay* (`pagosTTOO`) cruzado por `clave = ${cotizacionId}::${itemId}`. Compatibilidad con claves viejas (`${cotizacionId}::${tipo}`) vía `clavesAlias`.

## 4. Modelo de datos (cotización)

Una cotización es una lista de **servicios** (`servicios.items[]`):
- `precioVenta`: lo que paga el cliente (total del viaje, no por pax).
- `ofertas[]`: costos cotizados por cada proveedor (`costo`, `vencimientoTTOO`, `proveedor`). El `costo` es el neto total del servicio completo (todos los pasajeros), no por pasajero; por eso el flujo de caja acumula el costo de cada ticket sin volver a multiplicar por PAX.
- `ofertaCompraId`: con cuál se compra realmente.
- `servicios.proveedores[]`: proveedores tildados en el paso 1.
- `pasajeros[]`: nombres opcionales de los viajeros; si están cargados, el flujo de caja y el CSV los muestran junto al cliente titular.

Totales: `totalNeto` (costo), `totalVenta`, `precioVentaTotalManual`, `gananciaRealTotal`, `margenRealPct`.
Estados de cotización: `Borrador / Enviada / Aceptada / Pagada / Vencida`.
Ciclo del aéreo: `SinReservar → Reservado (fechaReserva) → Emitido (fechaEmision)`.

Ganancia = Σ precioVenta − Σ costo de la oferta de compra. Costo 0 (bonificado) no genera obligación de pago pero la venta sí suma a la ganancia.

## 5. Decisión de producto clave: presupuestación

El **presupuesto que recibe el cliente se arma fuera de la app** con la
herramienta del proveedor (que ya aplica el markup). JureFinance es el registro
interno de los números reales. Por eso no existe un módulo "Presupuesto al
cliente"; el Cotizador registra venta + costo real + ganancia, y el "Ver resumen
interno" es un documento imprimible interno, no el PDF al cliente.

Si en el futuro se quiere generar el presupuesto al cliente desde la app, es una
funcionalidad nueva (decisión de producto), no solo técnica.

## 6. Estado actual vs. roadmap (docs/FLUJO_CLIENTE.md §6)

- **Fase 0 — Desbloqueo (API key OpenCode):** fuera de la app.
- **Fase 1 — Documentar el flujo:** ✅ (FLUJO_CLIENTE.md).
- **Fase 2 — Módulo de Pagos (liquidación por bloque):** ✅ implementado.
- **Fase 3 — Cotizador de números reales:** ✅ implementado (venta por servicio, ofertas de compra, costo real, ganancia, resumen interno imprimible).
- **Fase 4 — Consistencia de datos:** ⏳ pendiente (unificar claves de storage, defaults únicos, diccionario de estados).
- **Fase 5 — Arquitectura:** ⏳ pendiente (`CotizadorWizard.jsx` concentra estado y orquestación; extraer hooks y dividir).
- **Fase 6 — Sincronización robusta:** ⏳ pendiente (versión/timestamp por registro y merge; hoy last-write-wins).
- **Fase 7 — Calidad:** ⏳ pendiente (Vitest para `ttoService` y `calendarioService`; ampliar `scripts/probarModelo.mjs`).

## 7. Brechas conocidas (§4 de FLUJO_CLIENTE.md)

1. Tarifa del proveedor a mano (no hay tarifario por ruta que autocomplete).
2. Precio de venta a mano (se transcribe del PDF externo por servicio; sin integración automática).
3. Claves de almacenamiento duplicadas: `STORAGE_KEY_QUOTES` (`App.jsx`) y `STORAGE_KEY_DB` (`driveService.js`) valen lo mismo (`jurefinance_quotes_v1`).
4. Sincronización last-write-wins, sin resolución de conflictos.
5. Tests: hay pruebas SSR del modelo (`scripts/probarModelo.mjs`), de las vistas BCP (`scripts/probarUI.mjs`) y un smoke test de navegación real (`scripts/probarRuntime.mjs`), pero falta una suite con Vitest.
6. El directorio de operadores se persiste en `localStorage`; todavía no viaja en el respaldo de Google Drive, por lo que un proveedor nuevo no se sincroniza entre equipos.

## 8. Validación actual

- `npm run test:modelo` → **TODO OK** (65 asertos: modelo, BCP, acumulación por bloque, liquidación y pago consolidado FIFO, cobertura, monedas, CSV, pasajeros, copia entre meses y meses de 28/30/31 días).
- `npm run test:ui` → **TODO OK** (4 renders SSR: flujo de caja con datos, vacío, multimoneda y configuración BCP).
- `npm run test:runtime` → **TODO OK** (23 chequeos en Chrome headless: los 8 módulos renderizan sin excepciones, genera bloques BCP, carga vuelos de ejemplo y registra el pago consolidado de un bloque persistiéndolo en `localStorage`).
- `npm run lint` → 0 errores, **53 warnings** (imports no usados, impurezas de `Date`/`Math.random`, `setState` en efectos).
- `npm run build` → **OK** (Vite; solo advierte por tamaño de chunk > 500 kB).

## 9. Riesgos técnicos relevantes

- Doble fuente de verdad del presupuesto (PDF externo vs. números en la app) sin validación cruzada → ganancia real puede quedar mal si se transcribe mal.
- Claves de storage duplicadas → inconsistencias entre caché local y Drive.
- Sin tests automatizados de los servicios de cálculo → regresiones silenciosas.
- React Compiler desactivado parcialmente por impurezas en render (`CotizadorWizard`, `QuotePreviewModal`, `App`, `Dashboard`) → rendimiento y re-renders.
- `CotizadorWizard.jsx` concentra estado y orquestación → cambios costosos y frágiles.

## 10. Próximos pasos sugeridos (priorizados)

1. **Fase 4 (consistencia):** unificar `STORAGE_KEY_QUOTES`/`STORAGE_KEY_DB`, defaults únicos, diccionario de estados. Bajo riesgo, alto valor.
2. **Fase 7 (calidad):** instalar Vitest y cubrir `serviciosService`, `ttoService`, `calendarioService` (liquidación FIFO, alias de claves viejas, costos 0). Base: `probarModelo.mjs`.
3. **Limpieza de lint:** quitar imports no usados y mover `Date`/`Math.random` fuera del render para reactivar optimizaciones del compiler.
4. **Fase 5 (arquitectura):** extraer estado del Cotizador a hooks (`useQuoteForm`, `useServicios`).
5. **Decisión de producto:** si se quiere generar el presupuesto al cliente desde la app, definir alcance (PDF/HTML) o integración con la herramienta del proveedor.

## 11. Notas de entorno

- OpenCode: proveedor `opencode` (Default / OpenCode) con credenciales OpenCode Console guardadas (Default + API key). Para cambiar de cuenta: `opencode auth switch`.
- Sync con Drive requiere Apps Script v3.1 desplegado; conector viejo baja la frecuencia de sondeo a 5 min.
- No hay control de versiones (git) en el directorio; los cambios son locales.

## 12. Referencias

- Flujo de negocio: `docs/FLUJO_CLIENTE.md`.
- Pruebas del modelo: `scripts/probarModelo.mjs` (`npm run test:modelo`).
- Pruebas de vistas: `scripts/probarUI.mjs` (`npm run test:ui`).
- Smoke test de runtime: `scripts/probarRuntime.mjs` (`npm run test:runtime`; levanta el dev server y Chrome headless si hace falta).
- Despliegue del conector: `google-apps-script/DESPLIEGUE_v3.1.md`.
- Código del conector: `google-apps-script/Code.gs`.
