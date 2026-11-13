# Guía de Uso y Funcionamiento — JureFinance (JureTravel)

> **Manual Funcional para el Usuario**  
> Esta guía explica paso a paso cómo usar **JureFinance** en la operatoria diaria de **JureTravel**, desde que cotizás en las webs de los proveedores (**Aero** y **Azabache**) y enviás el presupuesto al cliente, hasta que controlás día por día cuánto y cuándo debés pagar a cada proveedor en el **Mapa de Calendario de Pagos**.

---

## 1. ¿Para qué sirve JureFinance y cuál es su objetivo principal?

En el trabajo diario de **JureTravel**, un viaje combina precios y reglas de pago distintas según cada proveedor:

1. **Proveedor 1 (Aero):** donde consultás y comprás realmente el vuelo al costo más económico para la agencia.
2. **Proveedor 2 (Azabache):** donde cotizás el paquete completo (**el mismo vuelo** —que allí figura más caro— **+ hotel + traslado + otros servicios**) y usás su **armador de PDF** (sumándole o no un **% de ganancia**) para generar el presupuesto que recibe el cliente final.

**El objetivo principal de JureFinance es:**
- **Guardar todos esos valores por separado y con su desglose completo:** cuánto cuesta el vuelo en Aero, cuánto figuraba en Azabache, cuánto cuestan el hotel y los traslados reservados en Azabache, y cuánto se le pasó finalmente al cliente.
- **Mostrarte en un Mapa de Calendario de Pagos qué debés pagar cada día, a qué proveedor y por qué servicios**, aplicando automáticamente la regla de cada operador:
  - **Aero (Vuelo Emitido = Confirmado por JureTravel):** vence a las **24 o 48 horas posteriores a la fecha de emisión confirmada**.
  - **Azabache / Price (Hotel, Traslado y demás servicios reservados):** vence según la **grilla de configuración mensual de bloques** (por ejemplo, todo lo reservado del **día 1 al 5 del mes se paga el día 20**, del **6 al 10 se paga el 25**, etc.).

---

## 2. Paso a Paso: Cómo armar y guardar un Presupuesto

### Paso 1: Cotizar el vuelo en la web de AERO (Proveedor 1)
1. Ingresás a la web de **Aero** y buscás el vuelo para tu pasajero o grupo.
2. Obtenés el precio neto de Aero (por ejemplo, **USD 1.900**).
3. **Importante:** Este precio **no** es el que va al público; es el **costo real de compra para JureTravel** y sirve como referencia exacta de cuánto debés pagarle al proveedor **Aero**.

### Paso 2: Cotizar el paquete en la web de AZABACHE (Proveedor 2) y armar el PDF al Cliente
1. Ingresás a la web de **Azabache** y pedís la cotización completa: **el mismo vuelo + hotel + traslado** (y asistencia o excursiones si corresponden).
2. En Azabache verás que el mismo vuelo tiene un costo más alto que en Aero (por ejemplo, **USD 2.200**), además del costo del hotel (ej. **USD 1.500**) y del traslado (ej. **USD 100**).
3. Dentro del **armador de PDF de Azabache**, podés aplicarle un **porcentaje (%) adicional** para obtener el **precio final que le enviás al cliente** en el PDF.

### Paso 3: Registrar los valores por separado en el Cotizador de JureFinance
Abriendo **Cotizador de Viajes** en el menú izquierdo de JureFinance, completás los 3 pasos del asistente:

1. **Datos del Viaje:**
   - Cargás el nombre del cliente, destino, fechas del viaje, cantidad y nombres de pasajeros, y moneda (`USD`, `ARS`, `EUR` o `BRL`).
2. **Servicios, Costos por Proveedor y Precio al Cliente:**
   - Podés usar el botón rápido **"+ Armar Paquete (Vuelo Aero/Azabache + Hotel + Traslado)"** o agregar cada servicio.
   - **En el Vuelo:**
     - En la fila de **Aero**, cargás el costo real de Aero (ej. USD 1.900) y lo dejás marcado con **"Se compra y paga"**.
     - En la fila de **Azabache**, cargás el costo del vuelo en Azabache (ej. USD 2.200) y lo marcás como **"★ Base PDF Cliente"**.
     - El sistema calcula y guarda automáticamente la diferencia que JureTravel ahorra por emitir el vuelo en Aero en lugar de Azabache.
     - Cuando el vuelo se emite, cambiás el estado a **Emitido (= Confirmado JureTravel)**, indicás la **Fecha de Emisión Confirmada** y elegís el plazo (**24 hs** o **48 hs posteriores al emitido**).
   - **En el Hotel, Traslado y demás servicios:**
     - Seleccionás **Azabache** (o el proveedor correspondiente), cargás el costo neto de cada servicio y verificás que figure como **Reservado** con su **Fecha de Reserva**.
     - El sistema lee el día en que se reservó (por ejemplo, día 3 del mes → bloque `01-05`) y le asigna automáticamente la fecha de pago de la grilla (día `20`).
   - **Precio Final al Cliente (% del Constructor PDF):**
     - En la barra superior del **Constructor de Presupuesto (Azabache → Cliente)** podés ingresar el **% de aumento** (ej. 20%) y pulsar **"Calcular Precio al Cliente"**, o escribir el precio final enviado en el PDF.
   - Al pie de la pantalla verás en vivo la tabla **"Vista Previa de Pagos a Proveedores y Números Guardados por Separado"** con lo cotizado en cada proveedor, lo que realmente se paga a cada uno y cuándo vence cada pago.
3. **Resumen y Guardado:**
   - Revisás el desglose completo por proveedor, la ganancia neta real de JureTravel y hacés clic en **"Guardar Cotización"**.

---

## 3. Reglas de Pago a Proveedores (Cómo calcula el sistema cuándo pagar)

Una vez guardada la cotización, JureFinance impacta automáticamente cada obligación en el sistema de pagos respetando la regla de cada proveedor:

| Proveedor | Qué servicios incluye | Cuándo se debe pagar | Cómo lo muestra el sistema |
| :--- | :--- | :--- | :--- |
| **Proveedor 1: AERO** | **Vuelo** (al costo real de Aero) | **24 a 48 horas posteriores** a que el vuelo pasa a **Emitido (= Confirmado por JureTravel)**. | Expuesto con alerta `⚡ 24 hs / 48 hs post-emisión` y la fecha exacta (1 o 2 días después de la emisión confirmada). |
| **Proveedor 2: AZABACHE** (y otros operadores terrestres) | **Hotel, Traslado, Asistencia y Extras** reservados | Según la **Grilla de Configuración Mensual** por bloques de fecha de reserva:<br>• Reservados del **1 al 5** → se pagan el **día 20**<br>• Reservados del **6 al 10** → se pagan el **día 25**<br>• Reservados del **11 al 15** → se pagan el **día 28**<br>• Reservados del **16 al 20** → se pagan el **día 5 del mes siguiente**<br>• Reservados del **21 al fin de mes** → se pagan el **día 10 del mes siguiente** | Expuesto con etiqueta `📅 Bloque 01-05` (o el bloque correspondiente) y acumulado en la liquidación de ese día de pago. |

> **Nota:** Si algún día un proveedor cambia sus fechas de corte o de pago, podés ajustarlas en segundos desde la pantalla **Configuración Mensual TTOs** y todo el calendario se recalculará solo.

---

## 4. El Mapa de Calendario de Pagos y su Desglose Diario

Al entrar en **Calendario de Pagos** en el menú izquierdo, tenés a la vista tu herramienta principal de control diario:

1. **Mapa de Calendario Mensual (a la izquierda):**
   - Muestra todos los días del mes.
   - Cada día en el que hay vencimientos (ya sea un vuelo emitido de Aero a las 24–48 hs o un corte de bloque de Azabache como el día 20 o 25) muestra el **importe total pendiente de pago** y un indicador de color según su urgencia (rojo si venció, amarillo si vence hoy o en las próximas 48 hs, azul para próximos días, verde cuando ya fue pagado).
2. **Desglose del Día Seleccionado (a la derecha del calendario):**
   - Al hacer clic en cualquier día del calendario (o en los botones rápidos de días con vencimiento), ves el listado detallado de **qué debés pagar ese día**:
     - **A qué proveedor** corresponde cada pago (`Aero`, `Azabache`, `Price`).
     - **Por qué regla vence hoy** (`⚡ 48 hs post-emisión` o `📅 Bloque 01-05`).
     - **A qué cliente, pasajero y servicio** pertenece.
     - **Los tres valores guardados por separado:** el **Costo de Compra** (lo que debés pagar hoy al proveedor), el **Costo de Referencia del PDF** (Azabache) y el **Precio al Cliente**.
3. **Flujo de Caja por Día de Vencimiento y Liquidaciones por Bloque (debajo del mapa):**
   - Agrupa todos los servicios que vencen en una misma fecha y de un mismo proveedor para que puedas hacer **un solo pago consolidado del bloque** (`Pagar bloque`) o registrar **pagos individuales o parciales** (`Registrar pago`).
   - Permite filtrar por proveedor, por moneda (`USD`, `ARS`, `EUR`, `BRL`) y descargar el detalle completo en una planilla con el botón **"Exportar CSV"**.

---

## 5. Las demás secciones de JureFinance para completar tu gestión

- **Historial de Cotizaciones:** buscador de todos los presupuestos guardados para volver a abrirlos, editarlos, cambiar su estado (`Borrador`, `Enviada`, `Aceptada`, `Pagada`, `Vencida`) o imprimir el **Resumen Interno de Números**.
- **Calendario de Cobros (Ingresos de Clientes):** para anotar las señas, cuotas y pagos que te hacen los pasajeros y saber siempre cuánto falta cobrar de cada viaje.
- **Expedientes & Drive:** acceso ordenado por cliente a las carpetas con los vouchers emitidos, pasajes y fotos de DNI/pasaportes.
- **Métricas & Ganancias:** tablero de rentabilidad donde comparás el total cobrado a clientes contra el costo real pagado a Aero y Azabache, viendo tu ganancia neta real.
- **Configuración Mensual TTOs y Proveedores TTOO:** donde definís la grilla de bloques del mes (1–5 → día 20, etc.) y los datos de tus operadores mayoristas.
