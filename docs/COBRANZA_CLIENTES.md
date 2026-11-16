# Cuentas a cobrar a clientes — agenda e historial de pagos

Este documento describe el flujo de cobranza implementado en
`src/components/Cobranzas/CalendarioCobrosView.jsx` y las reglas en
`src/services/cobroService.js`.

## 1. Agenda de cobro

La pestaña **Agenda de cobro** muestra todos los viajes con saldo, con:

- **Período:** `Esta semana` (lunes a domingo), `Este mes` o `Todos`.
- **Filtros:** cliente, moneda, estado (pendiente / parcial / cobrado / vencido)
  y texto de destino.
- **Orden:** fecha de viaje, valor (saldo pendiente), destino o cliente.
- **Agrupación:** por fecha de referencia (inicio del viaje), con el total a
  cobrar de cada día y el detalle por cliente.
- **Calendario mensual** opcional, para ver los cobros sobre el mes y hacer clic
  en un día.

Cada fila tiene un botón **Cobrar** que abre el formulario ya cargado con el
cliente, el viaje y el saldo pendiente.

## 2. Registro de pagos

El formulario permite tres formas de anotar un cobro:

| Tipo | Cuándo usarlo | Qué hace |
|---|---|---|
| **Pago general (a cuenta)** | El cliente pagó sin decir a qué viaje | El importe se reparte entre sus viajes por fecha (FIFO: primero el más próximo) |
| **Pago de paquete / viaje** | Un número de operación cubre un viaje | Se imputa íntegramente a esa cotización; admite "equivalente" si se pagó en otra moneda |
| **Pago por servicios** | Parte al vuelo, parte al hotel, etc. | Cada línea se imputa a su servicio; cada línea tiene su propio monto y moneda |

Campos comunes: **número de operación/comprobante**, **fecha**, **medio**
(transferencia, efectivo, tarjeta, cheque, Mercado Pago, depósito u otro),
**nota libre** y la marca **"Poner en caja"**.

### Análisis en vivo (panel derecho del formulario)

El formulario (`src/components/Cobranzas/RegistrarCobroModal.jsx`) muestra,
mientras se completa, un panel con:

- **Situación del cliente:** venta, cobrado, saldo y barra de progreso en la
  moneda del pago.
- **Proyección del cobro:** por cada viaje afectado, cuánto se imputa y cómo
  cambia su saldo (`saldo actual → saldo proyectado`).
- **Alertas:** sobrepago del saldo del viaje, moneda distinta sin equivalente
  (bloquea el guardado), servicios repetidos, importe mayor al precio del
  servicio, saldo insuficiente del cliente, etc.

La proyección usa `analizarRegistroCobro`, que simula los pagos generados por
`construirPagosDesdeBorrador` con la **misma** función de imputación que se usa
al guardar (`imputarPagosPorViaje`). Por eso lo que muestra el preview es
exactamente lo que se graba: el botón **Registrar cobro** se bloquea si el
análisis detecta un error que dejaría el pago sin imputar.

### Multi-moneda

Los totales de monedas distintas nunca se suman. Para imputar un pago en ARS al
saldo de un viaje en USD, se carga el **equivalente en USD** en esa línea; el
importe original en ARS queda guardado en el historial y el equivalente es lo
que reduce el saldo. Esto vale para los **tres tipos** de pago: paquete,
servicios y general (un pago general en ARS sin equivalente no imputa, para no
contaminar el saldo en USD).

Un comprobante con varias monedas se guarda como varias líneas con el mismo
`grupoPagoId`, de modo que el historial lo muestra como una sola operación con
sus renglones.

## 3. Caja e historial

- **Caja por cliente:** venta, cobrado y saldo por cliente, con detalle por
  viaje. Botón **Historial** por cliente.
- **Historial de pagos:** agrupa las líneas por comprobante (`grupoPagoId` o
  `id`) y muestra fecha, medio, número de operación, estado "En caja", cada
  concepto imputado, monto, moneda, equivalente y nota. Permite eliminar un
  comprobante completo y exportar a CSV.

## 4. Modelo de datos de un pago

```js
{
  id, grupoPagoId, cliente,
  cotizacionId, itemId,
  monto, moneda, fecha, medio, numeroOperacion, nota,
  enCaja, tipo: 'general' | 'paquete' | 'servicios',
  aplicaciones: [
    { cotizacionId, itemId, concepto, monto, moneda, equivalente, descripcion }
  ],
  createdAt
}
```

Los pagos siguen siendo un *overlay* (`pagosClientes`) y se sincronizan con
Google Drive junto al resto de la base. Los pagos históricos que sólo tenían
`cotizacionId` siguen funcionando: se convierten a una aplicación de paquete.

## 5. Validación

```bash
npm run test:cobros          # imputación multi-moneda, pagos generales, análisis del modal, agenda, historial y CSV (36 checks)
npm run test:vista-cobros    # render SSR de la vista con y sin datos
npm run build                # compilación de producción
npm run lint                 # 0 errores
```
