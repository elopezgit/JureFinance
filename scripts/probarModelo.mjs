// Prueba manual del modelo de servicios (venta vs. costo de compra) y de la
// derivación de pagos.
import {
  normalizarServicios,
  totalNetoItems,
  totalVentaItems,
  totalCostoItems,
  totalCostoBasePresupuestoItems,
  totalAhorroArbitrajeItems,
  desgloseCostosPorProveedor,
  totalGananciaItems,
  margenVentaItems
} from '../src/services/serviciosService.js';
import {
  derivarPagosDesdeCotizaciones,
  construirAgendaPagos,
  agruparPorFechaVencimiento,
  agruparTicketsPorProveedor,
  totalesPorMoneda,
  generarCSVFlujoCaja,
  liquidacionesPorProveedorYFecha,
  repartirPagoEnLiquidacion
} from '../src/services/calendarioService.js';
import {
  validateBloques,
  generarBloquesDesdeRegla,
  getBloqueBCP,
  getBloquesBCPPorVencimiento,
  desplazarBloquesAMes,
  diasDelMes
} from '../src/services/ttoService.js';
import { INITIAL_COTIZACIONES, buildConfiguracionMensual } from '../src/data/initialData.js';
import { DEMO_VUELOS_EMITIDOS } from '../src/data/demoVuelos.js';

let fallas = 0;
function check(nombre, condicion, detalle = '') {
  if (condicion) {
    console.log(`OK   ${nombre}`);
  } else {
    fallas++;
    console.log(`FALLA ${nombre} ${detalle}`);
  }
}

// 1) Migración del modelo plano (secciones fijas) al modelo de servicios.
const q1 = INITIAL_COTIZACIONES[0];
const items1 = normalizarServicios(q1.servicios, { pax: q1.pax });
check('migra secciones fijas a items', items1.length === 4, `=> ${items1.length}`);
check(
  'conserva el costo del aéreo en la oferta',
  items1.find((i) => i.tipo === 'aereo')?.montoTotalNeto === 1600.88,
  `=> ${items1.find((i) => i.tipo === 'aereo')?.montoTotalNeto}`
);
check(
  'genera una oferta por servicio migrado',
  items1.every((item) => (item.ofertas || []).length === 1),
  `=> ${items1.map((i) => (i.ofertas || []).length).join(',')}`
);
check('genera claveLegacy', items1.find((i) => i.tipo === 'aereo')?.claveLegacy === 'aereo');
check('total costo migrate = 3286.88', totalNetoItems(items1) === 3286.88, `=> ${totalNetoItems(items1)}`);

// 2) Demo emitidos: se derivan pagos con la oferta de compra.
const demo = DEMO_VUELOS_EMITIDOS[0];
const pagosDemo = derivarPagosDesdeCotizaciones([demo], []);
const pagoAereo = pagosDemo.find((p) => p.seccion === 'aereo');
check('demo: deriva pago de aéreo', !!pagoAereo);
check(
  'demo: monto del aéreo',
  pagoAereo?.montoTotal === demo.servicios.aereo.montoTotalNeto,
  `=> ${pagoAereo?.montoTotal}`
);
check('demo: clave con itemId', /::srv-aereo-0$/.test(pagoAereo?.clave || ''), `=> ${pagoAereo?.clave}`);

// 3) Modelo nuevo: venta con un proveedor y compra con otro.
const cotizacionDosPrecios = {
  id: 'COT-TEST-1',
  cliente: 'Cliente Prueba',
  pax: 8,
  moneda: 'USD',
  estado: 'Aceptada',
  servicios: {
    proveedores: ['aero', 'price', 'azabache'],
    items: [
      {
        id: 'srv-vuelo',
        tipo: 'aereo',
        activo: true,
        nombre: 'Vuelo TUC → CUN',
        precioVenta: 8700,
        estadoVuelo: 'Emitido',
        fechaEmision: '2026-09-10',
        tramos: [],
        ofertaCompraId: 'of-aero',
        ofertas: [
          { id: 'of-aero', proveedorId: 'aero', proveedor: 'Aero', costo: 8000 },
          { id: 'of-price', proveedorId: 'price', proveedor: 'Price', costo: 8450 }
        ]
      },
      {
        id: 'srv-traslado',
        tipo: 'traslados',
        activo: true,
        nombre: 'Traslado aeropuerto',
        precioVenta: 250,
        ofertaCompraId: 'of-azabache',
        ofertas: [{ id: 'of-azabache', proveedorId: 'azabache', proveedor: 'Azabache', costo: 0 }]
      }
    ]
  }
};

const itemsDosPrecios = normalizarServicios(cotizacionDosPrecios.servicios, { pax: 8 });
check('venta total = 8950', totalVentaItems(itemsDosPrecios) === 8950, `=> ${totalVentaItems(itemsDosPrecios)}`);
check('costo total = 8000', totalCostoItems(itemsDosPrecios) === 8000, `=> ${totalCostoItems(itemsDosPrecios)}`);
check('ganancia total = 950', totalGananciaItems(itemsDosPrecios) === 950, `=> ${totalGananciaItems(itemsDosPrecios)}`);
check('margen sobre venta = 10.61%', margenVentaItems(itemsDosPrecios) === 10.61, `=> ${margenVentaItems(itemsDosPrecios)}`);

const vuelo = itemsDosPrecios.find((i) => i.id === 'srv-vuelo');
check('se compra el vuelo a Aero', vuelo?.proveedor === 'Aero', `=> ${vuelo?.proveedor}`);
check('costo del vuelo = 8000', vuelo?.montoTotalNeto === 8000, `=> ${vuelo?.montoTotalNeto}`);
check('ganancia del vuelo = 700', vuelo?.precioVenta - vuelo?.montoTotalNeto === 700);

// Cambiar la oferta de compra recalcula el costo real.
const vueloConPrice = normalizarServicios(
  {
    items: [
      {
        ...cotizacionDosPrecios.servicios.items[0],
        ofertaCompraId: 'of-price'
      }
    ]
  },
  { pax: 8 }
)[0];
check('compra alternativa Price = 8450', vueloConPrice.montoTotalNeto === 8450, `=> ${vueloConPrice.montoTotalNeto}`);
check('ganancia con Price = 250', vueloConPrice.precioVenta - vueloConPrice.montoTotalNeto === 250);

// 4) Pagos: usa el proveedor de compra y omite los costos 0.
const pagosDosPrecios = derivarPagosDesdeCotizaciones([cotizacionDosPrecios], []);
check('sólo genera pago del vuelo (traslado gratis)', pagosDosPrecios.length === 1, `=> ${pagosDosPrecios.length}`);
check('proveedor del pago = Aero', pagosDosPrecios[0]?.proveedor === 'Aero', `=> ${pagosDosPrecios[0]?.proveedor}`);
check('monto del pago = 8000', pagosDosPrecios[0]?.montoTotal === 8000, `=> ${pagosDosPrecios[0]?.montoTotal}`);

// 5) Alias de pagos viejos (clave ::aereo) imputa a la línea nueva.
const registroViejo = { id: 'p1', clave: `${q1.id}::aereo`, monto: 100, fecha: '2026-08-01' };
const agenda = construirAgendaPagos({ cotizaciones: [q1], pagosTTOO: [registroViejo] });
const obligacionAereo = agenda.find((p) => p.cotizacionId === q1.id && p.seccion === 'aereo');
check('pago viejo imputa a la línea nueva', obligacionAereo?.pagado === 100, `=> ${obligacionAereo?.pagado}`);
check('saldo correcto', obligacionAereo?.saldo === 1500.88, `=> ${obligacionAereo?.saldo}`);

// 6) El modelo normalizado es estable (idempotente).
const itemsDos = normalizarServicios({ items: items1 }, { pax: q1.pax });
check(
  'modelo nuevo estable',
  JSON.stringify(itemsDos.map((i) => i.id)) === JSON.stringify(items1.map((i) => i.id))
);
check(
  'ofertas estables',
  JSON.stringify(itemsDos.map((i) => (i.ofertas || []).map((o) => o.id))) ===
    JSON.stringify(items1.map((i) => (i.ofertas || []).map((o) => o.id)))
);

// 7) BCP (Aero Bimestral): rangos de emisión → fecha de pago y acumulación por umbral.
const configNov = buildConfiguracionMensual(['2026-11', '2026-12']);
check(
  'BCP Aero Nov: emisión 03/11 cae en el umbral 01-07 con pago 13/11',
  getBloqueBCP(configNov, 'Aero', '2026-11-03')?.fechaPago === '2026-11-13',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-11-03')?.fechaPago}`
);
check(
  'BCP Aero Nov: emisión 10/11 cae en el umbral 08-15 con pago 19/11',
  getBloqueBCP(configNov, 'Aero', '2026-11-10')?.fechaPago === '2026-11-19',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-11-10')?.fechaPago}`
);
check(
  'BCP Aero Nov: emisión 18/11 cae en el umbral 16-22 con pago 27/11',
  getBloqueBCP(configNov, 'Aero', '2026-11-18')?.fechaPago === '2026-11-27',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-11-18')?.fechaPago}`
);
check(
  'BCP Aero Nov: emisión 25/11 cae en el umbral 23-30 con pago 04/12',
  getBloqueBCP(configNov, 'Aero', '2026-11-25')?.fechaPago === '2026-12-04',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-11-25')?.fechaPago}`
);
check(
  'BCP Aero Dic: emisión 03/12 cae en el umbral 01-07 con pago 14/12',
  getBloqueBCP(configNov, 'Aero', '2026-12-03')?.fechaPago === '2026-12-14',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-12-03')?.fechaPago}`
);
check(
  'BCP Aero Dic: emisión 10/12 cae en el umbral 08-15 con pago 21/12',
  getBloqueBCP(configNov, 'Aero', '2026-12-10')?.fechaPago === '2026-12-21',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-12-10')?.fechaPago}`
);
check(
  'BCP Aero Dic: emisión 18/12 cae en el umbral 16-22 con pago 30/12',
  getBloqueBCP(configNov, 'Aero', '2026-12-18')?.fechaPago === '2026-12-30',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-12-18')?.fechaPago}`
);
check(
  'BCP Aero Dic: emisión 28/12 cae en el umbral 23-31 con pago 07/01',
  getBloqueBCP(configNov, 'Aero', '2026-12-28')?.fechaPago === '2027-01-07',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-12-28')?.fechaPago}`
);

const cotizacionBCP = {
  id: 'COT-BCP-1',
  cliente: 'Cliente BCP',
  pax: 1,
  pasajeros: ['Ana Pérez'],
  moneda: 'USD',
  servicios: {
    items: [
      ['srv-bcp-1', '2026-11-03', 1000],
      ['srv-bcp-2', '2026-11-05', 2000],
      ['srv-bcp-3', '2026-11-02', 1250],
      ['srv-bcp-4', '2026-11-10', 1500]
    ].map(([id, fechaEmision, costo]) => ({
      id,
      tipo: 'aereo',
      activo: true,
      nombre: 'Vuelo ' + id,
      precioVenta: costo * 1.2,
      estadoVuelo: 'Emitido',
      fechaEmision,
      tramos: [],
      ofertaCompraId: 'of-' + id,
      ofertas: [
        {
          id: 'of-' + id,
          proveedorId: 'aero',
          proveedor: 'Aero',
          costo
        }
      ]
    }))
  }
};

const pagosBCP = derivarPagosDesdeCotizaciones([cotizacionBCP], configNov);
check('BCP: deriva 4 obligaciones', pagosBCP.length === 4, `=> ${pagosBCP.length}`);
check(
  'BCP: todas las fechas salen del calendario (no manuales)',
  pagosBCP.every((p) => p.origenVencimiento === 'bcp'),
  `=> ${pagosBCP.map((p) => p.origenVencimiento).join(',')}`
);
check(
  'BCP: bloque 01-07 acumula 4250 el 13/11',
  pagosBCP
    .filter((p) => p.fechaVencimiento === '2026-11-13')
    .reduce((acc, p) => acc + p.montoTotal, 0) === 4250
);
check(
  'BCP: bloque 08-15 acumula 1500 el 19/11',
  pagosBCP
    .filter((p) => p.fechaVencimiento === '2026-11-19')
    .reduce((acc, p) => acc + p.montoTotal, 0) === 1500
);
check(
  'BCP: el rango visible es 01-07',
  pagosBCP.find((p) => p.fechaVencimiento === '2026-11-13')?.rangoBCPCorto === '01-07',
  `=> ${pagosBCP.find((p) => p.fechaVencimiento === '2026-11-13')?.rangoBCPCorto}`
);
check(
  'auditoría: los nombres de pasajeros llegan al pago',
  pagosBCP.every((p) => p.pasajeros?.[0] === 'Ana Pérez'),
  `=> ${pagosBCP[0]?.pasajeros?.join(', ')}`
);

const flujoBCP = agruparPorFechaVencimiento(pagosBCP);
check('flujo: 2 fechas de pago', flujoBCP.length === 2, `=> ${flujoBCP.length}`);
check('flujo: primera fecha 13/11', flujoBCP[0]?.fecha === '2026-11-13');
check('flujo: 3 tickets el 13/11', flujoBCP[0]?.cantidad === 3, `=> ${flujoBCP[0]?.cantidad}`);
check('flujo: total USD 4250 el 13/11', flujoBCP[0]?.monedas[0]?.montoTotal === 4250);

const gruposProv = agruparTicketsPorProveedor(flujoBCP[0].items);
check('flujo: agrupa por proveedor', gruposProv.length === 1 && gruposProv[0].proveedor === 'Aero');
check('flujo: saldo del grupo 4250', gruposProv[0].saldo === 4250);

// 7.b Liquidación y pago consolidado del bloque: un pago se reparte FIFO.
const agendaBCP = construirAgendaPagos({
  cotizaciones: [cotizacionBCP],
  configMensual: configNov
});
const liquidacionesBCP = liquidacionesPorProveedorYFecha(agendaBCP, configNov);
const liq13 = liquidacionesBCP.find((l) => l.fechaVencimiento === '2026-11-13');
check(
  'liquidación: 13/11 agrupa 3 tickets por 4250',
  liq13?.cantidad === 3 && liq13?.montoTotal === 4250,
  `=> ${liq13?.cantidad} / ${liq13?.montoTotal}`
);
check('liquidación: muestra el rango 01-07', liq13?.rangoCorto === '01-07');

const registrosBloque = repartirPagoEnLiquidacion(liq13, 4250, {
  fecha: '2026-11-13'
});
check(
  'pago de bloque: genera un registro por ticket',
  registrosBloque.length === 3,
  `=> ${registrosBloque.length}`
);
check(
  'pago de bloque: suma exactamente 4250',
  registrosBloque.reduce((acc, r) => acc + r.monto, 0) === 4250
);

const agendaPagada = construirAgendaPagos({
  cotizaciones: [cotizacionBCP],
  configMensual: configNov,
  pagosTTOO: registrosBloque
});
const saldo13 = agendaPagada
  .filter((p) => p.fechaVencimiento === '2026-11-13')
  .reduce((acc, p) => acc + p.saldo, 0);
check('pago de bloque: el bloque 01-07 queda saldado', saldo13 === 0, `=> ${saldo13}`);

const registrosParciales = repartirPagoEnLiquidacion(liq13, 1000, {
  fecha: '2026-11-13'
});
check(
  'pago parcial: imputa 1000 al primer ticket y deja saldo',
  registrosParciales.length === 1 && registrosParciales[0].monto === 1000
);

// 8) Monedas: nunca se suman USD y ARS en el mismo total.
const totalesMoneda = totalesPorMoneda([
  { moneda: 'USD', montoTotal: 100, pagado: 40, saldo: 60, estado: 'Parcial', pax: 2 },
  { moneda: 'ARS', montoTotal: 5000, pagado: 0, saldo: 5000, estado: 'Pendiente', pax: 1 }
]);
check('monedas: dos totales separados', totalesMoneda.length === 2, `=> ${totalesMoneda.length}`);
check(
  'monedas: USD 100 / ARS 5000',
  totalesMoneda.find((m) => m.moneda === 'USD')?.montoTotal === 100 &&
    totalesMoneda.find((m) => m.moneda === 'ARS')?.montoTotal === 5000
);
check(
  'monedas: PAX acumulados por moneda',
  totalesMoneda.find((m) => m.moneda === 'USD')?.totalPax === 2
);

// 9) Validación de la configuración: cobertura, solapamientos y fechas.
const conHueco = validateBloques(
  [
    { desde: 1, hasta: 5, fechaPago: '2026-11-20' },
    { desde: 7, hasta: 10, fechaPago: '2026-11-25' }
  ],
  '2026-11'
);
check('validación: detecta día 6 sin cobertura', conHueco.diasSinCobertura.includes(6));
check('validación: avisa del hueco', conHueco.warnings.some((w) => w.includes('sin bloque')));

const solapado = validateBloques(
  [
    { desde: 1, hasta: 5, fechaPago: '2026-11-20' },
    { desde: 5, hasta: 10, fechaPago: '2026-11-25' }
  ],
  '2026-11'
);
check('validación: detecta solapamiento', !solapado.ok && solapado.errors.some((e) => e.includes('superponen')));

const fechaInvalida = validateBloques(
  [{ desde: 1, hasta: 5, fechaPago: '2026-02-30' }],
  '2026-02'
);
check('validación: rechaza 30/02', !fechaInvalida.ok);

const compartida = validateBloques(
  [
    { desde: 1, hasta: 5, fechaPago: '2026-11-20' },
    { desde: 6, hasta: 10, fechaPago: '2026-11-20' }
  ],
  '2026-11'
);
check(
  'validación: avisa bloques con la misma fecha de pago',
  compartida.warnings.some((w) => w.includes('comparten'))
);
check(
  'BCP: devuelve los dos bloques de una misma fecha',
  getBloquesBCPPorVencimiento(
    [
      {
        mes: '2026-11',
        proveedorId: 'aero',
        bloques: [
          { desde: 1, hasta: 5, fechaPago: '2026-11-20' },
          { desde: 6, hasta: 10, fechaPago: '2026-11-20' }
        ]
      }
    ],
    'aero',
    '2026-11-20'
  ).length === 2
);

// 10) Generador de regla y copia entre meses.
const reglaFebrero = generarBloquesDesdeRegla({
  mes: '2026-02',
  diasPorBloque: 5,
  diaPago: 20,
  offsetMesPago: 0
});
check('regla: febrero tiene 28 días', diasDelMes('2026-02') === 28);
check(
  'regla: cubre del 1 al 28 sin huecos',
  reglaFebrero[0].desde === 1 &&
    reglaFebrero[reglaFebrero.length - 1].hasta === 28 &&
    reglaFebrero.every((b, i) => i === 0 || b.desde === reglaFebrero[i - 1].hasta + 1)
);
check(
  'regla: pago el 20/02 en todos los bloques',
  reglaFebrero.every((b) => b.fechaPago === '2026-02-20')
);

const copiaMarzo = desplazarBloquesAMes(reglaFebrero, 1);
check(
  'copia: las fechas de pago pasan a marzo',
  copiaMarzo.every((b) => b.fechaPago === '2026-03-20')
);

// Meses de 30 y 31 días: el generador debe cerrar en el último día real.
const reglaAbril = generarBloquesDesdeRegla({
  mes: '2026-04',
  diasPorBloque: 5,
  diaPago: 20
});
const reglaMayo = generarBloquesDesdeRegla({
  mes: '2026-05',
  diasPorBloque: 5,
  diaPago: 20
});
check(
  'regla: abril (30 días) cubre del 1 al 30',
  diasDelMes('2026-04') === 30 &&
    reglaAbril[0].desde === 1 &&
    reglaAbril[reglaAbril.length - 1].hasta === 30
);
check(
  'regla: mayo (31 días) cubre del 1 al 31',
  diasDelMes('2026-05') === 31 &&
    reglaMayo[0].desde === 1 &&
    reglaMayo[reglaMayo.length - 1].hasta === 31
);

// Copiar un mes de 31 días a febrero conserva los rangos y avisa del excedente.
const copiaMayoAFebrero = desplazarBloquesAMes(reglaMayo, -3);
const validacionCopia = validateBloques(copiaMayoAFebrero, '2026-02');
check(
  'copia: mayo a febrero desplaza el pago a febrero',
  copiaMayoAFebrero.every((b) => b.fechaPago === '2026-02-20')
);
check(
  'copia: avisa que un rango de 31 días excede febrero',
  validacionCopia.warnings.some((w) => w.includes('excede'))
);

// 11) CSV de auditoría con el detalle de tickets.
const csv = generarCSVFlujoCaja(pagosBCP);
check('CSV: incluye encabezado de rango BCP', csv.includes('Rango BCP'));
check('CSV: incluye al cliente', csv.includes('Cliente BCP'));
check('CSV: incluye los nombres de pasajeros', csv.includes('Ana Pérez'));
check('CSV: incluye el costo de un ticket', csv.includes('1000'));

// 12) Circuito JureTravel: Proveedor 1 (Aero Umbrales Bimestrales: 01-07 -> 13/11) + Proveedor 2 (Azabache PDF + Reservas).
const cotizacionJureTravel = {
  id: 'COT-JT-1',
  cliente: 'Cliente JureTravel',
  pax: 2,
  moneda: 'USD',
  fechaCotizacion: '2026-11-03',
  // Los servicios terrestres vencen 7 días antes del viaje (no usan BCP).
  fechaViajeInicio: '2026-11-20',
  servicios: {
    items: [
      {
        id: 'srv-jt-vuelo',
        tipo: 'aereo',
        activo: true,
        nombre: 'Vuelo TUC → CUN',
        precioVenta: 2640, // 2200 base Azabache + 20%
        markupPct: 20,
        estadoVuelo: 'Emitido',
        fechaEmision: '2026-11-03', // Umbral 01 al 07 Noviembre -> vence 13 Noviembre
        reglaVencimiento: 'bcp',
        ofertaCompraId: 'of-jt-aero',
        ofertas: [
          { id: 'of-jt-aero', proveedorId: 'aero', proveedor: 'Aero', costo: 1900, esBasePresupuesto: false },
          { id: 'of-jt-aza-vuelo', proveedorId: 'azabache', proveedor: 'Azabache', costo: 2200, esBasePresupuesto: true }
        ]
      },
      {
        id: 'srv-jt-hotel',
        tipo: 'hotel',
        activo: true,
        nombre: 'Hotel Riu Palace 7 noches',
        precioVenta: 1800, // 1500 + 20%
        markupPct: 20,
        estadoReserva: 'Reservado',
        fechaReserva: '2026-11-03', // Bloque 01-07 -> vence 13/11
        ofertaCompraId: 'of-jt-aza-hotel',
        ofertas: [
          { id: 'of-jt-aza-hotel', proveedorId: 'azabache', proveedor: 'Azabache', costo: 1500, esBasePresupuesto: true }
        ]
      },
      {
        id: 'srv-jt-traslado',
        tipo: 'traslados',
        activo: true,
        nombre: 'Traslado Aeropuerto / Hotel',
        precioVenta: 120, // 100 + 20%
        markupPct: 20,
        estadoReserva: 'Reservado',
        fechaReserva: '2026-11-04', // Bloque 01-07 -> vence 13/11
        ofertaCompraId: 'of-jt-aza-tras',
        ofertas: [
          { id: 'of-jt-aza-tras', proveedorId: 'azabache', proveedor: 'Azabache', costo: 100, esBasePresupuesto: true }
        ]
      }
    ]
  }
};

const itemsJT = normalizarServicios(cotizacionJureTravel.servicios, { pax: 2 });
check('JT: costo real de compra total = 3500 (1900 Aero + 1600 Azabache)', totalCostoItems(itemsJT) === 3500);
check('JT: costo base PDF (Azabache) = 3800 (2200 + 1500 + 100)', totalCostoBasePresupuestoItems(itemsJT) === 3800);
check('JT: ahorro compra en Aero vs Azabache = 300', totalAhorroArbitrajeItems(itemsJT) === 300);
check('JT: precio final al cliente = 4560', totalVentaItems(itemsJT) === 4560);
check('JT: ganancia neta real = 1060', totalGananciaItems(itemsJT) === 1060);

const desgloseJT = desgloseCostosPorProveedor(itemsJT);
const desgAero = desgloseJT.find((d) => d.proveedorId === 'aero');
const desgAza = desgloseJT.find((d) => d.proveedorId === 'azabache');
check('JT: Aero a pagar = 1900', desgAero?.totalAPagarCompra === 1900);
check('JT: Azabache cotizado ref = 3800 y a pagar real = 1600', desgAza?.totalCotizadoReferencia === 3800 && desgAza?.totalAPagarCompra === 1600);

const pagosJT = derivarPagosDesdeCotizaciones([cotizacionJureTravel], configNov);
const pagoVueloJT = pagosJT.find((p) => p.seccion === 'aereo');
const pagoHotelJT = pagosJT.find((p) => p.seccion === 'hotel');
const pagoTrasJT = pagosJT.find((p) => p.seccion === 'traslados');
check(
  'JT: vuelo emitido en Aero el 03/11 (umbral 01-07) vence el 13/11',
  pagoVueloJT?.fechaVencimiento === '2026-11-13' && pagoVueloJT?.origenVencimiento === 'bcp',
  `=> ${pagoVueloJT?.fechaVencimiento} (${pagoVueloJT?.origenVencimiento})`
);
check(
  'JT: hotel vence 7 días antes del viaje (13/11)',
  pagoHotelJT?.fechaVencimiento === '2026-11-13' &&
    pagoHotelJT?.origenVencimiento === 'semana-antes-viaje',
  `=> ${pagoHotelJT?.fechaVencimiento} (${pagoHotelJT?.origenVencimiento})`
);
check(
  'JT: traslado vence 7 días antes del viaje (13/11)',
  pagoTrasJT?.fechaVencimiento === '2026-11-13' &&
    pagoTrasJT?.origenVencimiento === 'semana-antes-viaje',
  `=> ${pagoTrasJT?.fechaVencimiento} (${pagoTrasJT?.origenVencimiento})`
);

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
