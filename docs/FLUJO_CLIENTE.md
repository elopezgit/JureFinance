# Flujo de trabajo de la agencia (JureTravel)

Documento de referencia: cómo trabaja la agencia en el día a día y cómo lo modela
la aplicación. Pensado para que cualquiera entienda el circuito **cotización →
venta → emisión → pago a proveedores** sin tener que leer el código.

> **Aclaración de términos.** En este documento **"el cliente" es la agencia**
> (JureTravel) que opera la app. El viajero final se llama **pasajero**.
> "Proveedores" son AERO (aéreos), Price/Azabache (hoteles, traslados, asistencia).

---

## 1. Resumen del circuito

```
Cotizar con los proveedores (costos reales)
        │
        ▼
Armar el presupuesto del cliente ──► PDF externo del proveedor 2/3
        │                                   (ya incluye el % de ganancia)
        │
        ▼
Registrar en JureFinance: precio de venta + proveedor y costo de compra
        │
        ▼
Ganancia real = venta − costo real ◄── puede venderse con un proveedor
        │                               y comprarse a otro más barato
        ▼
Vender al pasajero (Borrador→Enviada→Aceptada→Pagada)
        │
        ▼
Reservar / Emitir el aéreo
        │
        ▼
El proveedor de compra ACUMULA lo emitido en un bloque (p. ej. días 1–5)
        │
        ▼
Fecha de pago del bloque (p. ej. día 20) ──► Pagar al proveedor de compra
        │
        ▼
Expediente en Drive (vouchers, pasajes, DNI) + cobranza y métricas
```

---

## 2. Paso a paso

### 2.1 Cotizar con los proveedores

En el **paso 1 del wizard** se tildan los proveedores con los que se va a
trabajar. Esa selección queda disponible como opción al cargar las ofertas de
cada servicio. El wizard tiene tres pasos fijos:

| Paso | Contenido |
|---|---|
| **1. Datos del viaje** | Cliente, destino, fechas, pax, moneda y proveedores |
| **2. Servicios y costos** | Precio de venta al cliente + ofertas de compra de cada proveedor |
| **3. Resumen & Guardar** | Venta, costo real, ganancia y margen |

Dentro de cada servicio se pueden cargar **varias ofertas de distintos
proveedores** (por ejemplo, el mismo vuelo cotizado por Aero y por Price). Una de
ellas se marca como **oferta de compra**: es la que se paga y la que determina
el costo real y el vencimiento.

Para **vuelos** se define el **itinerario** (origen, destino, fechas, aerolínea)
y cantidad de **pasajeros (pax)**. El itinerario es del servicio; cada proveedor
cotiza su costo total.

### 2.2 Precio de venta al cliente

El presupuesto que recibe el cliente se arma **fuera de la app**, con la
herramienta del proveedor 2/3. Esa herramienta ya aplica el % de ganancia. En
JureFinance se carga el **precio de venta final** de cada servicio, tal como
figura en ese PDF. No se recalcula el markup.

Los importes son **totales del viaje**, no por pasajero. La app muestra el
equivalente por pax sólo como referencia.

### 2.3 Costo real de compra

Cada servicio se compra a un proveedor concreto. Puede ser el mismo que hizo el
presupuesto o **otro distinto**, incluso más barato o gratuito:

```
Vuelo:    venta 8.700  ·  oferta Price 8.450 (referencia)  ·  compra Aero 8.000
Traslado: venta   250  ·  compra Azabache 0 (bonificado)
Ganancia real = (8.700 + 250) − (8.000 + 0) = 950
```

El costo alternativo del proveedor que hizo el presupuesto queda cargado como
oferta, pero **no entra a pagos ni a ganancia**: sólo se usa para comparar.

### 2.4 Ganancia real

```
ganancia = Σ precio de venta − Σ costo de la oferta de compra
margen   = ganancia / venta total × 100
```

Un costo 0 (por ejemplo, un traslado bonificado) **no genera obligación de pago**,
pero la venta sí suma a la ganancia.

### 2.5 Vender al pasajero

Estados de la cotización:

| Estado | Significado |
|---|---|
| `Borrador` | En preparación, todavía no se envió. |
| `Enviada` | Enviada al pasajero, esperando respuesta. |
| `Aceptada` | El pasajero aceptó; se puede reservar/emitir. |
| `Pagada` | El pasajero pagó la venta. |
| `Vencida` | Pasó el plazo de la cotización sin respuesta. |

### 2.6 Reservar / emitir el aéreo

Ciclo del vuelo (`estadoVuelo`), dentro del servicio aéreo:

```
SinReservar ──► Reservado (fecha de reserva) ──► Emitido (fecha de emisión)
```

Al **emitir** se fija la **fecha de emisión**, que es la que determina el bloque
y, por lo tanto, cuándo hay que pagarle al **proveedor de compra**. Si el
vencimiento de la oferta queda vacío, el calendario usa la **Configuración
Mensual** de ese proveedor para derivar la obligación.

### 2.7 Acumulación en la "caja" del proveedor

**Clave del modelo de AERO:** al emitir, el vuelo **no se cobra en el momento**.
AERO **acumula** todo lo emitido dentro de un **bloque de días** y define una
**fecha de pago** para ese bloque.

Ejemplo (configurable por proveedor y por mes):

| Bloque de emisión | Fecha de pago |
|---|---|
| Emitidos del **1 al 5** | se pagan el **20** |
| Emitidos del **6 al 10** | se pagan el **23** |
| … | … |

> **Regla confirmada:** el pago de AERO es **consolidado por bloque**. Si son uno
> o n vuelos emitidos entre el 1 y el 5, **todos caen juntos** para pago el día
> que indica AERO (p. ej. el 20). No se paga vuelo por vuelo.

### 2.8 Pagar a proveedores

Se registra el pago del bloque: **total o parcial**. Un pago parcial puede
repartirse entre los vuelos del bloque (ver §5).

El módulo de Pagos incluye un **reporte mensual de flujo de caja** que agrupa
todas las obligaciones por **fecha de vencimiento** y muestra, para cada fecha,
el **total general del mes por moneda** y el detalle auditable de cada ticket:
cliente, nombres de pasajeros (si se cargaron), cantidad de PAX, cotización,
destino, fecha de emisión y rango BCP. Los totales de monedas distintas nunca se
suman entre sí. El reporte se puede exportar a CSV y permite registrar el pago
de un ticket individual o de la liquidación completa del bloque.

### 2.9 Expediente en Drive

Por cliente se guardan **vouchers + pasajes + DNI/pasaportes**. La app sincroniza
con Google Drive (ver §3.3).

### 2.10 Cobranza y métricas

Arreglos de cobro de la venta + tablero de ganancias.

---

## 3. Cómo lo modela la app

### 3.1 Mapa al código

| Concepto | Archivo / función |
|---|---|
| Precio de venta + costo real + ganancia | `src/components/Cotizador/Wizard/CotizadorWizard.jsx` (`totalVenta`, `totalCosto`, `gananciaRealTotal`, `margenRealPct`) |
| Modelo de servicios (venta + ofertas de compra) | `src/services/serviciosService.js` → `normalizarServicios`, `createEmptyItem`, `createEmptyOferta`, `ofertaCompraDe`, `totalVentaItems`, `totalCostoItems`, `totalGananciaItems` |
| Pasos del wizard | `src/components/Cotizador/Wizard/wizardUtils.js` → `construirPasos`, `tiposDeProveedor` |
| Estados de cotización | `Borrador / Enviada / Aceptada / Pagada / Vencida` |
| Ciclo del aéreo | `estadoVuelo` `SinReservar / Reservado / Emitido` + `fechaReserva` / `fechaEmision` en el servicio |
| Bloques "día de emisión → fecha de pago" | `src/components/Configuracion/ConfiguracionMensualView.jsx` (por proveedor y por mes; manual, regla, plantilla, copia y cobertura) |
| Cálculo de la fecha de pago | `src/services/ttoService.js` → `getFechaPagoTTOO`, `getBloqueBCP`, `getBloquesBCPPorVencimiento` |
| Obligaciones + pagos parciales | `src/services/calendarioService.js` → `construirAgendaPagos`, `resumenAgendaPagos`, `aplicarPagos` |
| Liquidación por proveedor + fecha | `src/services/calendarioService.js` → `liquidacionesPorProveedorYFecha`, `repartirPagoEnLiquidacion` |
| Reporte de flujo de caja + CSV | `src/components/Cobranzas/FlujoCajaBCP.jsx` + `totalesPorMoneda`, `agruparPorFechaVencimiento`, `generarCSVFlujoCaja` |
| Calendario / cuentas a pagar | `src/components/Cobranzas/CalendarioPagosView.jsx` |
| Nombres de pasajeros | `CotizadorWizard.jsx` → `pasajeros[]`; se muestran en `FlujoCajaBCP` y en el CSV |
| Sincronización con Drive | `src/services/driveService.js` + `google-apps-script/Code.gs` (v3.1) |

Vocabulario de datos (lo que "existe" en la app):

- **Cotización** (`quote`): el presupuesto/venta. Contiene `servicios.items[]`,
  una lista de **servicios**; cada servicio tiene `precioVenta` (total al
  cliente), `ofertas[]` (proveedor + costo + vencimiento de pago) y
  `ofertaCompraId` (la oferta que se paga). `servicios.proveedores[]` guarda los
  proveedores tildados en el paso 1.
- **Oferta**: el costo que cotizó un proveedor para un servicio. Sólo la oferta
  de compra genera obligación y entra a la ganancia.
- **Obligación**: un importe derivado de la oferta de compra de un servicio, con
  **proveedor** y **fecha de vencimiento** (cuándo hay que pagarle). Surge de
  `construirAgendaPagos`. Los costos 0 no generan obligación.
- **Registro de pago**: lo que ya se pagó. Es un *overlay* (`pagosTTOO`) que se
  aplica encima de las obligaciones.
- **Liquidación**: el conjunto de obligaciones del mismo **proveedor + fecha de
  pago + moneda**. Es la unidad con la que el proveedor factura (el "bloque").

### 3.2 De la emisión a la obligación de pago

```
Cotización con aéreo Emitido (fechaEmision)
        │
        ▼
Oferta de compra del vuelo: proveedor + costo + vencimiento
        │   si no hay vencimiento cargado:
        ▼
getFechaPagoTTOO(configMensual, proveedorDeCompra, fechaEmision)
        │   busca el bloque que contiene la fechaEmision y devuelve su fecha de pago
        ▼
Obligación: { proveedor: 'Aero', montoTotal: costo de compra, fechaVencimiento, moneda }
        │
        ▼
construirAgendaPagos → grilla del Calendario de Pagos
        │
        ▼
liquidacionesPorProveedorYFecha → una línea por bloque (AERO · vence 20/10)
```

### 3.3 Persistencia y sincronización

```
localStorage (caché) ⇄ App.jsx (estado central) ⇄ Apps Script Web App (conector v3.1)
                                                        │
                                          Google Drive (carpetas por cliente +
                                          jurefinance_db.json + jurefinance_tree.json)
```

- Sincroniza cada **60 s** (o 5 min con conector viejo) y al recuperar el foco de
  la ventana.
- `App.jsx` mantiene el estado central; `driveService.js` habla con Drive.

### 3.4 Fuente de verdad de los pagos

Los pagos **no** se guardan dentro de la cotización. Se guardan en un *overlay*
`pagosTTOO`:

```js
// registro de pago (uno por obligación)
{
  id, clave,               // clave = `${cotizacionId}::${itemId}` (o `manual::<id>`)
  cotizacionId, proveedor, concepto, cliente,
  monto, fecha, medio, nota, moneda,
  liquidacionClave         // opcional: a qué bloque pertenece el pago
}
```

En cada render, `aplicarPagos` cruza los registros con las obligaciones por
`clave` y calcula `pagado` y `saldo`. Ventaja: el estado por vuelo siempre es
exacto y el histórico de pagos es independiente de la cotización.

**Compatibilidad.** Las cotizaciones anteriores al modelo de líneas tenían una
clave por sección (`${cotizacionId}::aereo`). Para no migrar los pagos ya
registrados, cada obligación declara esas claves viejas en `clavesAlias` y
`construirAgendaPagos` las resuelve a la clave canónica de la línea. Los pagos
nuevos se guardan siempre con `::${itemId}`.

### 3.5 Wizard de cotización

```
Paso 1  Datos del viaje + proveedores con los que se trabaja (checkboxes)
Paso 2  Servicios
          ├─ Precio de venta al cliente (del PDF externo)
          ├─ Itinerario y ciclo del vuelo (sólo aéreos)
          └─ Ofertas de compra: proveedor + costo real + vencimiento
                                 (radio "Comprar" en la elegida)
Paso 3  Resumen: venta, costo real, ganancia, margen y vista interna imprimible
```

- Los pasos son fijos (`construirPasos()`); los proveedores tildados en el paso
  1 alimentan los selectores de proveedor de las ofertas.
- Se valida lo mínimo antes de avanzar (cliente, al menos un servicio activo,
  proveedor en la oferta de compra).
- Al guardar se persiste `servicios: { proveedores, items }` y los totales
  `totalVenta`, `totalNeto` (costo), `precioVentaTotalManual` y
  `gananciaRealTotal`, que consumen dashboard, historial y cobranzas.
- El botón **"Ver resumen interno"** abre un documento imprimible con los
  números reales; no es el presupuesto del cliente.

---

## 4. Brechas conocidas (pendientes)

1. **Tarifa del proveedor a mano.** Se tipea el costo; no hay tarifario por ruta
   que autocomplete.
2. **Precio de venta a mano.** Se transcribe el total del PDF externo por
   servicio; no hay integración automática con la herramienta del proveedor.
3. **Consistencia de datos:**
   - Claves de almacenamiento duplicadas: `STORAGE_KEY_QUOTES` (`App.jsx`) y
     `STORAGE_KEY_DB` (`driveService.js`) valen lo mismo
     (`jurefinance_quotes_v1`).
4. **Sincronización last-write-wins**, sin resolución de conflictos.
5. **Tests**: sólo hay pruebas manuales del modelo (`scripts/probarModelo.mjs`);
   falta suite automatizada para `ttoService` y `calendarioService`.

---

## 5. Módulo de Pagos a Proveedores

Tres vistas sobre los mismos datos:

1. **Calendario** (`CalendarioPagosView`). Obligaciones individuales en la grilla
   del mes, filtrable por proveedor, con registro de pagos parciales.
2. **Liquidación por proveedor** (solapa nueva). Agrupa las obligaciones por
   `{proveedor + fecha de pago + moneda}` y muestra una línea por bloque:

   ```
   AERO  · vence 20/10 → 4 vuelos emitidos → Total US$ 6.400,00 (pagado 0 · saldo 6.400)
   AERO  · vence 23/10 → 3 vuelos emitidos → Total US$ 4.100,00
   PRICE · vence 20/10 → hoteles + traslados → Total US$ 3.200,00
   ```

3. **Cuenta corriente del proveedor** (opcional, más adelante). Histórico
   emitido vs. pagado por proveedor.

### Pago consolidado por bloque

Se registra **un pago por liquidación** (p. ej. AERO, vence 20/10) y el sistema lo
**reparte** entre las obligaciones del bloque con criterio **secuencial (FIFO)**:
primero la más antigua por vencimiento y, a igualdad, por clave. El reparto nunca
supera el saldo de cada obligación.

Implementación:

- `liquidacionesPorProveedorYFecha(pagos)` — agrupa y totaliza por bloque.
- `repartirPagoEnLiquidacion(liquidacion, monto, datos)` — devuelve **un registro
  de pago por obligación afectada**; la UI lo guarda en lote
  (`onRegistrarPagosLote` en `App.jsx`).
- Así cada vuelo queda en `Pagado`/`Parcial` y el bloque muestra su
  `pagado`/`saldo` agregado, sin cambiar el modelo de datos.

---

## 6. Roadmap

- **Fase 0 — Desbloqueo.** Renovar API key de OpenCode (fuera de la app).
- **Fase 1 — Documentar el flujo.** Este documento.
- **Fase 2 — Módulo de Pagos (liquidación por bloque).** ✅ implementado.
- **Fase 3 — Cotizador de números reales.** ✅ implementado: precio de venta al
  cliente por servicio, ofertas de compra de varios proveedores, costo real,
  ganancia y resumen interno imprimible.
- **Fase 4 — Consistencia de datos.** Unificar claves, defaults únicos,
  diccionario de estados.
- **Fase 5 — Arquitectura.** Extraer hooks y dividir componentes grandes
  (`CotizadorWizard.jsx` todavía concentra estado y orquestación).
- **Fase 6 — Sincronización robusta.** Versión/timestamp por registro y merge.
- **Fase 7 — Calidad.** Tests (Vitest) para `ttoService` y `calendarioService`;
  ampliar `scripts/probarModelo.mjs`.
