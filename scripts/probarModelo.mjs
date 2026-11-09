// Prueba manual del modelo de servicios (venta vs. costo de compra) y de la
// derivación de pagos.
import {
  normalizarServicios,
  totalNetoItems,
  totalVentaItems,
  totalCostoItems,
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

// 7) BCP: rangos de emisión → fecha de pago y acumulación por bloque.
const configNov = buildConfiguracionMensual(['2026-11']);
check(
  'BCP: emisión 03/11 cae en el bloque 01-05 con pago 20/11',
  getBloqueBCP(configNov, 'Aero', '2026-11-03')?.fechaPago === '2026-11-20',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-11-03')?.fechaPago}`
);
check(
  'BCP: emisión 07/11 cae en el bloque 06-10 con pago 25/11',
  getBloqueBCP(configNov, 'Aero', '2026-11-07')?.fechaPago === '2026-11-25',
  `=> ${getBloqueBCP(configNov, 'Aero', '2026-11-07')?.fechaPago}`
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
      ['srv-bcp-2', '2026-11-03', 2000],
      ['srv-bcp-3', '2026-11-02', 1250],
      ['srv-bcp-4', '2026-11-07', 1500]
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
  'BCP: bloque 01-05 acumula 4250',
  pagosBCP
    .filter((p) => p.fechaVencimiento === '2026-11-20')
    .reduce((acc, p) => acc + p.montoTotal, 0) === 4250
);
check(
  'BCP: bloque 06-10 acumula 1500',
  pagosBCP
    .filter((p) => p.fechaVencimiento === '2026-11-25')
    .reduce((acc, p) => acc + p.montoTotal, 0) === 1500
);
check(
  'BCP: el rango visible es 01-05',
  pagosBCP.find((p) => p.fechaVencimiento === '2026-11-20')?.rangoBCPCorto === '01-05',
  `=> ${pagosBCP.find((p) => p.fechaVencimiento === '2026-11-20')?.rangoBCPCorto}`
);
check(
  'auditoría: los nombres de pasajeros llegan al pago',
  pagosBCP.every((p) => p.pasajeros?.[0] === 'Ana Pérez'),
  `=> ${pagosBCP[0]?.pasajeros?.join(', ')}`
);

const flujoBCP = agruparPorFechaVencimiento(pagosBCP);
check('flujo: 2 fechas de pago', flujoBCP.length === 2, `=> ${flujoBCP.length}`);
check('flujo: primera fecha 20/11', flujoBCP[0]?.fecha === '2026-11-20');
check('flujo: 3 tickets el 20/11', flujoBCP[0]?.cantidad === 3, `=> ${flujoBCP[0]?.cantidad}`);
check('flujo: total USD 4250 el 20/11', flujoBCP[0]?.monedas[0]?.montoTotal === 4250);

const gruposProv = agruparTicketsPorProveedor(flujoBCP[0].items);
check('flujo: agrupa por proveedor', gruposProv.length === 1 && gruposProv[0].proveedor === 'Aero');
check('flujo: saldo del grupo 4250', gruposProv[0].saldo === 4250);

// 7.b Liquidación y pago consolidado del bloque: un pago se reparte FIFO.
const agendaBCP = construirAgendaPagos({
  cotizaciones: [cotizacionBCP],
  configMensual: configNov
});
const liquidacionesBCP = liquidacionesPorProveedorYFecha(agendaBCP, configNov);
const liq20 = liquidacionesBCP.find((l) => l.fechaVencimiento === '2026-11-20');
check(
  'liquidación: 20/11 agrupa 3 tickets por 4250',
  liq20?.cantidad === 3 && liq20?.montoTotal === 4250,
  `=> ${liq20?.cantidad} / ${liq20?.montoTotal}`
);
check('liquidación: muestra el rango 01-05', liq20?.rangoCorto === '01-05');

const registrosBloque = repartirPagoEnLiquidacion(liq20, 4250, {
  fecha: '2026-11-20'
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
const saldo20 = agendaPagada
  .filter((p) => p.fechaVencimiento === '2026-11-20')
  .reduce((acc, p) => acc + p.saldo, 0);
check('pago de bloque: el bloque 01-05 queda saldado', saldo20 === 0, `=> ${saldo20}`);

const registrosParciales = repartirPagoEnLiquidacion(liq20, 1000, {
  fecha: '2026-11-20'
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

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
