# JureFinance

Aplicación de gestión para la agencia de viajes **JureTravel**: cotización de
viajes, ventas, emisión de aéreos, cuentas a pagar a proveedores y sincronización
con Google Drive.

> ¿Buscás entender cómo trabaja la agencia y cómo lo modela la app?
> Ver **[docs/FLUJO_CLIENTE.md](docs/FLUJO_CLIENTE.md)**.

## Requisitos

- Node.js 20 o superior
- npm

## Puesta en marcha

```bash
npm install
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm run build        # build de producción en dist/
npm run preview      # sirve el build
npm run lint         # oxlint
npm run test:modelo  # pruebas del modelo de servicios y de la agenda de pagos
```

## Módulos

| Módulo | Componente | Qué hace |
|---|---|---|
| Cotizador | `src/components/Cotizador/CotizadorView.jsx` | Wizard por pasos: datos y proveedores → servicios (venta y costo real) → resumen. |
| Operadores | `src/components/Operadores/` | Alta/edición de proveedores (Aero, Price, Azabache…). |
| Configuración mensual | `src/components/Configuracion/ConfiguracionMensualView.jsx` | Bloques "día de emisión → fecha de pago" por proveedor y mes. |
| Cuentas a pagar | `src/components/Cobranzas/CalendarioPagosView.jsx` | Calendario de vencimientos + **liquidación por proveedor** y registro de pagos. |
| Cuentas a cobrar | `src/components/Cobranzas/CalendarioCobrosView.jsx` | Cobros a clientes derivados del precio de venta, agrupados por mes. |
| Historial | `src/components/Historial/HistorialView.jsx` | Cotizaciones guardadas. |
| Dashboard | `src/components/Dashboard/DashboardView.jsx` | Métricas de ganancias y cobros. |
| Drive | `src/components/DriveViewer/` | Expedientes por cliente sincronizados con Google Drive. |

## Arquitectura

```
src/
  App.jsx                  # estado central + sincronización
  components/              # vistas por módulo
  services/
    serviciosService.js    # servicios: precio de venta + ofertas de compra
    ttoService.js          # reglas de fechas de pago de los TTOO
    calendarioService.js   # obligaciones, pagos y liquidaciones por bloque
    driveService.js        # puente con Google Drive (Apps Script)
  data/initialData.js      # proveedores y datos de ejemplo
scripts/probarModelo.mjs   # pruebas del modelo y de la agenda (npm run test:modelo)
google-apps-script/        # Web App (conector v3.1) que habla con Drive
```

### Persistencia

- **localStorage** como caché local.
- **App.jsx** mantiene el estado central.
- **Google Apps Script** (`google-apps-script/Code.gs`, conector v3.1) sincroniza
  con Google Drive: carpetas por cliente + `jurefinance_db.json` y
  `jurefinance_tree.json`.
- La sincronización corre cada 60 s (o 5 min con conector viejo) y al recuperar
  el foco de la ventana.

### Modelo de servicios

El presupuesto que recibe el cliente se arma **fuera** de la app, con la
herramienta del proveedor (que ya aplica el markup). JureFinance es el registro
interno de los números reales.

Una cotización es una lista de **servicios** (`servicios.items[]`). Cada
servicio tiene:

- `precioVenta`: lo que paga el cliente (total del viaje, no por pax).
- `ofertas[]`: los costos cotizados por cada proveedor para ese mismo servicio
  (`costo`, `vencimientoTTOO`, `proveedor`).
- `ofertaCompraId`: con cuál de esas ofertas se compra realmente.

Así se puede vender con el presupuesto de un proveedor y comprar el servicio a
otro más barato, incluso gratis. La ganancia es
`Σ precioVenta − Σ costo de la oferta de compra`. Un costo 0 no genera
obligación de pago pero la venta sí suma a la ganancia.

`servicios.proveedores[]` guarda qué proveedores se tildaron en el paso 1 y
`normalizarServicios()` (en `serviciosService.js`) convierte al vuelo tanto el
modelo anterior (una oferta por línea) como las cotizaciones viejas con
secciones fijas.

### Modelo de pagos a proveedores

Los pagos **no** se guardan dentro de la cotización, sino como un *overlay*
(`pagosTTOO`) que se cruza con las obligaciones por `clave` en cada render. La
clave de una obligación es `${cotizacionId}::${itemId}`; para los pagos
registrados con el modelo anterior (`${cotizacionId}::${tipo}`) se mantiene un
alias, así que siguen imputando sin migración manual. Cada obligación se calcula
con el **proveedor de compra** y el **costo real** de la oferta elegida; los
costos 0 no generan pago. Los proveedores como **AERO** acumulan lo emitido en
un bloque y lo liquidan en una fecha; la solapa **"Liquidación por proveedor"**
agrupa las obligaciones por `proveedor + fecha de pago + moneda` y permite
**registrar un único pago del bloque** que se reparte (FIFO) entre los vuelos
que lo componen.

## Estado del proyecto

Roadmap en [docs/FLUJO_CLIENTE.md](docs/FLUJO_CLIENTE.md) §6. El cotizador por
pasos con precio de venta y costo real de compra está implementado, junto con el
resumen interno imprimible. Pendientes principales: unificación de claves de
almacenamiento y tests automáticos de `ttoService` / `calendarioService`.
