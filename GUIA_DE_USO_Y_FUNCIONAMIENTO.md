# Guía de Uso y Funcionamiento — JureFinance (JureTravel)

> **Manual Funcional para el Usuario**  
> Esta guía explica paso a paso cómo usar **JureFinance** en la operatoria diaria de **JureTravel**, desde que cotizás en las webs de los proveedores (**Aero** y **Azabache**) y enviás el presupuesto al cliente, hasta que controlás día por día cuánto y cuándo debés pagar a cada proveedor en el **Mapa de Calendario de Pagos**.

---

## 1. ¿Para qué sirve JureFinance y cuál es su objetivo principal?

En el trabajo diario de **JureTravel**, un viaje combina precios y reglas de pago distintas según cada proveedor:

1. **Proveedor 1 (Aero — `#TurismoConfiable`):** donde consultás y comprás realmente el vuelo al costo más económico para la agencia. **Aero** liquida los vuelos emitidos en **cuenta corriente** según una tabla de **umbrales semanales de emisión** que **se renueva cada 2 meses (bimestralmente)**.
2. **Proveedor 2 (Azabache):** donde cotizás el paquete completo (**el mismo vuelo** —que allí figura más caro— **+ hotel + traslado + otros servicios**) y usás su **armador de PDF** (sumándole o no un **% de ganancia**) para generar el presupuesto que recibe el cliente final.

**El objetivo principal de JureFinance es:**
- **Guardar todos esos valores por separado y con su desglose completo:** cuánto cuesta el vuelo en Aero, cuánto figuraba en Azabache, cuánto cuestan el hotel y los traslados reservados en Azabache, y cuánto se le pasó finalmente al cliente.
- **Mostrarte en un Mapa de Calendario de Pagos qué debés pagar cada día, a qué proveedor y por qué servicios**, aplicando automáticamente los **umbrales de vencimiento de Aero (renovables cada 2 meses)** y los vencimientos de los servicios reservados en Azabache.

---

## 2. Paso a Paso: Cómo armar y guardar un Presupuesto

### Paso 1: Cotizar el vuelo en la web de AERO (Proveedor 1)
1. Ingresás a la web de **Aero** y buscás el vuelo para tu pasajero o grupo.
2. Obtenés el precio neto de Aero (por ejemplo, **USD 1.900**).
3. **Importante:** Este precio **no** es el que va al público; es el **costo real de compra para JureTravel** y sirve para saber cuánto debés pagarle a **Aero** en la fecha de vencimiento de su umbral correspondiente.

### Paso 2: Cotizar el paquete en la web de AZABACHE (Proveedor 2) y armar el PDF al Cliente
1. Ingresás a la web de **Azabache** y pedís la cotización completa: **el mismo vuelo + hotel + traslado** (y asistencia o excursiones si corresponden).
2. En Azabache verás que el mismo vuelo tiene un costo más alto que en Aero (por ejemplo, **USD 2.200**), además del costo del hotel (ej. **USD 1.500**) y del traslado (ej. **USD 100**).
3. Dentro del **armador de PDF de Azabache**, podés aplicarle un **porcentaje (%) adicional** para obtener el **precio final que le enviás al cliente** en el PDF.

### Paso 3: Registrar las sabanas en el Cotizador de JureFinance
Abriendo **Cotizador de Viajes** en el menú izquierdo, completás los 4 pasos. Todo se carga en **dólares** y los montos son **totales del servicio** (no por pasajero).

1. **Sabanas por proveedor:**
   - Cargás cliente, destino, fechas, pasajeros y notas.
   - Tocás un proveedor (por ejemplo **Aero**) y cargás sus precios. **Aero solo permite Vuelo**; los demás permiten Vuelo, Hotel, Traslado, Asistencia y Excursiones.
   - En cada precio podés indicar la descripción, la vigencia de la cotización, si es reembolsable, si incluye impuestos y (opcional) la fecha de vencimiento de pago.
   - Repetís con **Azabache**, **Price** o cualquier otro proveedor. Cada uno tiene su propia sabana.

2. **Armar mi set:**
   - Aparecen todos los precios juntos, agrupados por servicio. El más bajo queda marcado como pista y los avisos (cotización vencida, no reembolsable, sin impuestos) aparecen al lado.
   - **Nada se elige automáticamente**: tocás línea por línea de qué proveedor comprás. Podés tomar el vuelo de Aero, el hotel de Price y los traslados de Azabache.
   - Podés escribir una nota por línea (por ejemplo *"Elegí Aero aunque no reembolsable, por US$ 300 menos"*).
   - Abajo ves en vivo el **costo de tu set** y el ahorro contra la opción más cara.

3. **Precio al cliente:**
   - Elegís **número fijo** o **porcentaje**. Con porcentaje se calcula `costo × (1 + % / 100)` y se recalcula en vivo al moverlo.
   - Vés juntos el costo, la venta, la ganancia y el margen.

4. **Resumen y guardado:**
   - Revisás el set armado y hacés clic en **"Guardar Cotización"**. Podés imprimir el resumen interno desde el botón **"Resumen imprimible"**.
   - En la **Ficha del Viaje** podés ver la pestaña **Comparación** con las sabanas cargadas y lo que elegiste en cada servicio.

---

## 3. Umbrales de Vencimiento de AERO (Renovación cada 2 Meses)

**Aero** liquida los pasajes aéreos emitidos en **cuenta corriente** dividiendo cada mes en **4 umbrales semanales de emisión**, y **renueva esta configuración cada 2 meses (bimestralmente)**.

### Ejemplo Oficial de Umbrales de Aero (Bimestre Noviembre – Diciembre)

#### NOVIEMBRE
| Fecha de Emisión del Aéreo | Fecha de Vencimiento de Pago |
| :--- | :--- |
| **01 al 07 Noviembre** | **13 Noviembre** |
| **08 al 15 Noviembre** | **19 Noviembre** |
| **16 al 22 Noviembre** | **27 Noviembre** |
| **23 al 30 Noviembre** | **04 Diciembre** |

#### DICIEMBRE
| Fecha de Emisión del Aéreo | Fecha de Vencimiento de Pago |
| :--- | :--- |
| **01 al 07 Diciembre** | **14 Diciembre** |
| **08 al 15 Diciembre** | **21 Diciembre** |
| **16 al 22 Diciembre** | **30 Diciembre** |
| **23 al 31 Diciembre** | **07 Enero** |

> **Condiciones importantes de Aero:**  
> - Estas fechas aplican únicamente para clientes con **cuenta corriente**.  
> - Se cobrarán intereses para pagos **fuera de término** tanto para liquidaciones en **pesos (ARS)** como en **dólares (USD)**.  
> - **Cada 2 meses**, cuando Aero publica la nueva placa del bimestre siguiente, podés entrar a **Configuración Mensual TTOs** en JureFinance, pulsar **"Renovar Bimestre Oficial"** o ajustar los días exactos de vencimiento de los dos meses siguientes en segundos.

---

## 4. El Mapa de Calendario de Pagos y su Desglose Diario

Al entrar en **Calendario de Pagos** en el menú izquierdo, tenés a la vista tu herramienta principal de control diario:

1. **Mapa de Calendario Mensual:**
   - Muestra todos los días del mes con los vencimientos acumulados (como el **13, 19 y 27 de Noviembre** o el **04, 14, 21 y 30 de Diciembre**).
   - Cada día con pagos pendientes muestra el **importe total a desembolsar** y un indicador de color según su urgencia (rojo si venció, amarillo si vence hoy, azul para próximos días, verde cuando ya fue saldado).
2. **Desglose del Día Seleccionado:**
   - Al hacer clic en cualquier día del calendario, ves el listado detallado de **qué debés pagar ese día**:
     - **A qué proveedor** corresponde cada pago (`Aero`, `Azabache`, `Price`).
     - **Qué umbral de emisión agrupa** (por ejemplo, `📅 Umbral 01-07 → Vence 13 nov`).
     - **A qué cliente, pasajero y viaje** pertenece cada ticket.
     - **Los tres valores guardados por separado:** el **Costo Real de Compra** (lo que debés pagar al proveedor), el **Costo de Referencia del PDF** (Azabache) y el **Precio al Cliente**.
3. **Flujo de Caja por Día de Vencimiento y Liquidaciones por Bloque:**
   - Agrupa todos los tickets emitidos dentro de un mismo umbral (por ejemplo, todos los aéreos emitidos entre el 01 y el 07 de Noviembre que vencen juntos el 13 de Noviembre) para que puedas registrar **un solo pago consolidado del bloque** (`Pagar bloque`) o pagos parciales (`Registrar pago`).
   - Separa estrictamente los totales en **dólares (`USD`)** y en **pesos (`ARS`)** sin mezclarlos, y permite descargar una planilla completa con **"Exportar CSV"**.

---

## 5. Las demás secciones de JureFinance para completar tu gestión

- **Configuración Mensual TTOs (Renovación Bimestral):** muestra lado a lado los **2 meses del bimestre activo** (por ejemplo, Noviembre y Diciembre) para que puedas revisar o renovar cada dos meses las fechas de vencimiento de Aero y de los demás operadores.
- **Historial de Cotizaciones:** buscador de todos los presupuestos guardados para abrirlos, editarlos, cambiar su estado o ver el **Resumen Interno de Números**.
- **Calendario de Cobros (Ingresos de Clientes):** para registrar las señas, cuotas y pagos de los pasajeros y controlar cuánto falta cobrar de cada viaje.
- **Expedientes & Drive:** acceso directo por cliente a las carpetas con los vouchers emitidos, pasajes y fotos de DNI/pasaportes.
- **Métricas & Ganancias:** tablero de rentabilidad donde comparás el total cobrado a clientes contra el costo real pagado a Aero y Azabache, viendo tu ganancia neta real.

---

## 6. La Ficha del Viaje: todo un viaje en una sola pantalla

Cuando querés ver **todo lo de un viaje junto**, entrá al **Historial de Cotizaciones** y pulsá el botón **"Ver ficha"** (es el botón principal de cada fila). También podés llegar desde el nombre del cliente en el Calendario de Cobros, en el Calendario de Pagos, desde los próximos vencimientos del tablero o desde Expedientes & Drive.

La ficha tiene una franja arriba con los cuatro números que importan —**Venta al cliente, Costo real, Ganancia real y Estado de cobro**— y cinco pestañas:

| Pestaña | Qué respondés acá |
|---|---|
| **Datos** | Cliente, pasajeros, itinerario y la diferencia entre lo que se cotizó en Azabache y lo que se compró en Aero. |
| **Cobros** | Cuánto te deben, cuándo vence la próxima fecha de cobro (la podés cambiar) y el botón **Cobrar** ya precargado con el saldo. |
| **Pagos a proveedores** | A quién le debés y en qué fecha, agrupado por bloque, con el botón **Registrar pago del bloque**. |
| **Documentos** | Los vouchers, pasajes y fotos de DNI del cliente en Google Drive, con acceso directo y opción de subir archivos. |
| **Resumen interno** | El documento imprimible con los números reales del viaje (no es el presupuesto del cliente). |

Al cerrar la ficha volvés exactamente al módulo desde donde la abriste.
