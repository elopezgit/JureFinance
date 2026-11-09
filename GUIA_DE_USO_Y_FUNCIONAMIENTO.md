# Manual de Uso y Guía Funcional — JureFinance (JureTravel)

## 1. ¿Qué es JureFinance y para qué sirve?

**JureFinance** es la herramienta de organización diaria de la agencia **JureTravel**. Fue diseñada para llevar el control exacto de los números reales de cada viaje vendido, desde que se arma la cotización hasta que se le paga a cada operador mayorista y se guardan los vouchers del pasajero.

> **La idea central del sistema:**  
> El presupuesto comercial que se le entrega al pasajero (el PDF con el precio final) se sigue armando en la plataforma del proveedor mayorista. **JureFinance es el registro interno de la agencia**: aquí anotamos **a cuánto se lo vendimos al cliente** y **a qué proveedor y a qué costo real se lo compramos nosotros**.

### ¿Qué problemas resuelve en el día a día?
1. **Permite vender con un proveedor y comprar con otro más barato:** Podés armar el presupuesto para el cliente tomando el precio de un operador (por ejemplo, Price), pero terminar comprando ese mismo vuelo o hotel en otro operador más económico (por ejemplo, Aero o Azabache). El sistema calcula tu **ganancia real** al instante.
2. **Ordena la "caja" y los bloques de pago de los operadores (como AERO):** Cuando emitís un pasaje aéreo, no siempre se paga ese mismo día. Operadores como AERO juntan todos los boletos emitidos durante varios días (por ejemplo, del día 1 al 5 del mes) y te los cobran todos juntos en una fecha de vencimiento (por ejemplo, el día 20). El sistema agrupa esos vuelos solo y te dice exactamente cuánto tenés que pagar en cada vencimiento.
3. **Evita olvidos de vencimientos:** Te avisa con anticipación qué pagos a proveedores están por vencer o vencidos y qué vuelos ya fueron reservados o emitidos.
4. **Separa claramente Dólares (USD) y Pesos (ARS):** Nunca mezcla monedas en los totales del mes para que tu flujo de caja dé exactamente igual que lo que te reclama cada operador.
5. **Conecta las ventas con los documentos del pasajero:** Vincula cada cliente con su carpeta de Google Drive donde se guardan pasajes, vouchers y fotos de DNI o pasaportes.

---

## 2. El Circuito Completo de un Viaje (6 Pasos)

1. **Preparar el Mes:** Cargar o revisar las fechas de pago por bloques de cada operador mayorista para el mes en curso.
2. **Cotizar:** Cargar el viaje en el Cotizador indicando el precio de venta al cliente y los costos reales de los proveedores.
3. **Cerrar la Venta:** Actualizar el estado de la operación a medida que el pasajero responde (`Borrador` → `Enviada` → `Aceptada` → `Pagada`).
4. **Emitir el Aéreo:** Cuando se emite el boleto, pasar el estado del vuelo a `Emitido` y anotar la fecha de emisión para que el sistema calcule cuándo vence su pago.
5. **Pagar al Proveedor:** Revisar el Calendario de Pagos / Flujo de Caja y registrar el pago individual o del bloque completo en su fecha de vencimiento.
6. **Armar la Carpeta Drive:** Guardar en la carpeta del cliente los pasajes emitidos, vouchers de hotel/traslados y fotos de DNI o pasaportes.

---

## 3. Cómo Usar Cada Pantalla del Sistema (Paso a Paso)

### 3.1. Pantalla "Cotizador" — Cómo cargar un viaje nuevo
Se accede desde el menú lateral izquierdo o tocando el botón **"+ Nueva Cotización"** arriba a la derecha. Está dividido en **3 pasos guiados**:

- **Paso 1: Datos del Viaje y Proveedores**
  - Completá el nombre del **Cliente titular**, su teléfono/email, el **Destino**, las fechas del viaje, la cantidad de pasajeros (**PAX**) y la **Moneda** (Dólares USD o Pesos ARS).
  - Podés anotar los **nombres de cada pasajero** para identificarlos fácilmente después al pagar los tickets.
  - Tildá con qué **Proveedores** (por ejemplo: Aero, Price, Azabache) estás cotizando este viaje y tocá **"Siguiente"**.

- **Paso 2: Servicios y Costos Reales**
  - Agregá cada servicio del viaje (**Aéreo, Hotel, Traslado, Asistencia, Excursión, Crucero**).
  - En **Precio de Venta al Cliente**, escribí el importe total que le cobrás al cliente por ese servicio (el total de todos los pasajeros juntos, tal como figura en el presupuesto que le mandaste).
  - Abajo, en **Ofertas de Compra**, cargá cuánto te cobra de costo neto cada proveedor por ese servicio. Si pediste precio en dos operadores, podés cargar las dos ofertas para compararlas y marcar con el botón **"Comprar"** cuál es la que realmente vas a contratar.
  - **Importante para Vuelos (Aéreos):** Completá el origen, destino, aerolínea y el **Estado del Vuelo**: `Sin Reservar` → `Reservado` → `Emitido`. Cuando lo marques como **Emitido** y pongas la **Fecha de Emisión**, el sistema calculará solo qué día vence el pago al operador.

- **Paso 3: Resumen y Guardar**
  - Revisá el cuadro final: verás el **Total de Venta**, el **Costo Real de Compra**, tu **Ganancia Real** en dinero y el porcentaje de margen.
  - Podés tocar **"Ver resumen interno"** para imprimir una hoja de control interno para la agencia.
  - Tocá **"Guardar Cotización"** para dejarla registrada.

---

### 3.2. Pantalla "Historial" — Cómo buscar y actualizar tus cotizaciones
Aquí quedan guardadas todas las operaciones cargadas. Desde esta lista podés:
- **Buscar rápido:** Filtrar por nombre del cliente, destino o por el estado de la venta.
- **Seguir el estado del viaje:**
  - `Borrador`: Todavía lo estás armando.
  - `Enviada`: Ya le mandaste el presupuesto al pasajero y estás esperando respuesta.
  - `Aceptada`: El pasajero confirmó el viaje (momento de reservar y emitir).
  - `Pagada`: El pasajero ya abonó su viaje.
  - `Vencida`: El pasajero no confirmó a tiempo.
- **Botones de acción:** Podés **Editar** la cotización para cambiar costos o marcar un vuelo como emitido, **Duplicar** el viaje si otro cliente te pide el mismo destino, o **Abrir Drive** para ir directo a los documentos de ese pasajero.

---

### 3.3. Pantalla "Configuración Mensual TTOs" — Cómo armar los bloques de pago del mes
Al empezar cada mes, cada operador mayorista (especialmente AERO) informa su calendario de cierres y pagos. En esta pantalla configurás esas reglas una sola vez por mes:
- Elegí el **Mes** (por ejemplo, Octubre 2026) y el **Proveedor**.
- Definí los **Bloques de Emisión** indicando desde qué día hasta qué día abarca cada bloque y qué día se paga. Por ejemplo:
  - *Bloque 1:* Vuelos emitidos del **día 1 al 5** → se pagan el **día 20**.
  - *Bloque 2:* Vuelos emitidos del **día 6 al 10** → se pagan el **día 23**.
- **Herramientas rápidas para ahorrar tiempo:**
  - **Generar por regla automática:** Le decís cada cuántos días corta el bloque (por ejemplo, cada 5 días) y cuántos días después se paga, y el sistema arma todo el mes solo.
  - **Copiar de otro mes:** Copia los bloques del mes pasado y los adapta automáticamente si el mes nuevo tiene 28, 30 o 31 días.
  - **Semáforo de Cobertura:** Arriba te avisa en verde cuando todos los días del mes están cubiertos sin días sueltos ni superpuestos.

---

### 3.4. Pantalla "Calendario de Pagos" — Cómo controlar vencimientos y pagar a proveedores
Es la pantalla financiera principal para saber cuánto, cuándo y a quién hay que pagarle. Tiene tres secciones complementarias:

1. **Reporte de Flujo de Caja por Día de Vencimiento (arriba):**
   - Te muestra el **Total General del Mes** separado por moneda (cuántos Dólares USD y cuántos Pesos ARS tenés que pagar en el mes).
   - Agrupa los pagos día por día según su **Fecha de Vencimiento**. Dentro de cada fecha ves qué proveedor vence y el listado detallado de todos los boletos que entran en esa liquidación (con nombre del cliente, pasajeros, cantidad de PAX, destino, fecha en que se emitió y a qué bloque pertenece).
   - Botón **"Exportar CSV"**: Descarga una planilla lista para abrir en Excel con todo el detalle del mes.
2. **Liquidación Consolidada por Bloque:**
   - Cuando le transferís a un proveedor como AERO todo el bloque junto (por ejemplo, 4 vuelos que vencen el día 20), tocás **"Registrar Pago de Liquidación"**.
   - Si pagás el total, los 4 vuelos quedan marcados como **Pagados** en un solo paso. Si hacés una entrega o pago parcial, el sistema reparte el dinero automáticamente empezando por los boletos más antiguos y deja el saldo pendiente exacto.
3. **Calendario Mensual Visual (abajo):**
   - Muestra el almanaque del mes con cada vencimiento ubicado en su casillero.
   - También te permite cargar un **Compromiso o Pago Manual** si tenés que anotar un pago a un operador que no vino de una cotización.

---

### 3.5. Otras Pantallas del Menú
- **Calendario de Cobros:** Te muestra mes por mes el dinero que tienen que abonar los clientes por los viajes vendidos.
- **Operadores (Proveedores):** Es la agenda de tus operadores mayoristas. Si empezás a trabajar con un proveedor nuevo, lo agregás acá y enseguida aparece disponible en el Cotizador y en la Configuración Mensual.
- **Dashboard (Panel Principal):** Resumen ejecutivo con tus números globales: total vendido, costo total, ganancia neta acumulada y alertas de pagos urgentes (los que vencen en los próximos 3 días).
- **Expedientes Drive:** Te permite ver las carpetas de tus clientes en Google Drive, abrir los pasajes o vouchers guardados y subir archivos nuevos directamente desde la pantalla.

---

## 4. Ejemplos Prácticos del Día a Día

### Ejemplo 1: Vendo con el presupuesto de un operador y compro en otro más barato
Le armás un presupuesto a un cliente en la plataforma de **Price** por **USD 8.700** (donde el costo neto en Price era USD 8.450). Pero antes de emitir, ves que ese mismo vuelo en **Aero** cuesta **USD 8.000**.
- **¿Cómo se carga?** En el Cotizador ponés Precio de Venta: `8.700`. En ofertas cargás Price (`8.450`) y Aero (`8.000`), y marcás **"Comprar" en Aero**.
- **Resultado:** El sistema calcula tu ganancia real de **USD 700** y agenda el pago de **USD 8.000 a Aero**. La oferta de Price queda guardada solo como referencia para que recuerdes con qué presupuesto se vendió.

### Ejemplo 2: Un servicio viene bonificado o sin costo para la agencia
En el presupuesto al cliente le cobraste **USD 250** por un traslado, pero el operador mayorista te lo bonificó al 100% por comprar el hotel.
- **¿Cómo se carga?** Ponés Precio de Venta: `250` y Costo de la oferta de compra: `0`.
- **Resultado:** Esos USD 250 se suman enteros a tu ganancia del viaje y **no se genera ninguna deuda** en el Calendario de Pagos porque el costo es cero.

### Ejemplo 3: Emito varios vuelos en la semana y los pago juntos en la fecha del bloque
Emitiste un vuelo el día 1 de octubre (USD 2.500), otro el día 3 (USD 1.800) y otro el día 5 (USD 3.200) con AERO. En tu Configuración Mensual indicaste que las emisiones del 1 al 5 vencen el **20 de octubre**.
- **Resultado:** El sistema agrupa automáticamente los 3 vuelos para el **20 de octubre** por un total de **USD 7.500**. Ese día hacés una sola transferencia y la registrás en el botón de la liquidación del bloque.

---

## 5. Preguntas Frecuentes de Uso

| Pregunta | Respuesta práctica |
| :--- | :--- |
| **¿Los precios y costos se cargan por pasajero o por el total del viaje?** | Siempre se carga el **importe total del grupo completo** (todos los pasajeros sumados). El sistema divide automáticamente por la cantidad de pasajeros solo para mostrarte el valor individual como referencia. |
| **¿Qué pasa si emito un vuelo y no le pongo fecha de vencimiento manual?** | Con solo marcar el vuelo como **Emitido** y poner su **Fecha de Emisión**, el sistema busca en la Configuración Mensual de ese proveedor a qué bloque pertenece ese día y le asigna solo la fecha de pago correspondiente. |
| **¿Puedo registrar una seña o pago parcial a un proveedor?** | Sí. Podés registrar cualquier monto menor al total (tanto en un servicio individual como en un bloque completo). El estado pasará a **Parcial** y el calendario te mostrará exactamente cuánto saldo queda pendiente por pagar. |
| **¿Se me pierde lo que estoy cargando en el Cotizador si voy a mirar otra pantalla?** | No. Mientras estás armando una cotización podés ir a consultar el Historial, los Operadores o el Calendario de Pagos y, al volver al Cotizador, tus datos siguen exactamente donde los dejaste. |

> **Consejo para probar el sistema sin miedo:** En la pantalla **Calendario de Pagos** tenés el botón **"Cargar ejemplo (10 vuelos)"**, que carga automáticamente 10 operaciones de muestra repartidas en distintos bloques del mes para que puedas practicar cómo se ven los vencimientos, cómo se exporta el Excel y cómo se registran los pagos por bloque.
