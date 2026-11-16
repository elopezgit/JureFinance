// Pruebas del módulo de cobranzas: derivación, imputación multi-moneda,
// agenda (semana/mes), filtros/orden e historial por cliente.
import {
  derivarCobrosDesdeCotizaciones,
  imputarPagosPorViaje,
  serviciosDeCotizacion,
  cobrosParaAgenda,
  agruparCobrosPorFecha,
  rangoAgenda,
  inicioSemanaISO,
  finSemanaISO,
  finMesISO,
  historialPagosPorCliente,
  totalesPagosPorMoneda,
  generarCSVPagosClientes,
  normalizarPagoCliente,
  construirPagosDesdeBorrador,
  analizarRegistroCobro
} from '../src/services/cobroService.js';

let fallas = 0;
function check(nombre, condicion, detalle = '') {
  if (condicion) {
    console.log(`OK   ${nombre}`);
  } else {
    fallas++;
    console.log(`FALLA ${nombre} ${detalle}`);
  }
}

const cotizacion1 = {
  id: 'COT-TEST-1',
  cliente: 'CLIENTE A',
  destino: 'Cancún',
  moneda: 'USD',
  pax: 2,
  estado: 'Aceptada',
  fechaViajeInicio: '2026-11-18',
  precioVentaTotalManual: 3800,
  servicios: {
    items: [
      { id: 'srv-aereo-0', tipo: 'aereo', activo: true, nombre: 'Vuelos', precioVenta: 3000, ofertas: [], ofertaCompraId: '' },
      { id: 'srv-hotel-0', tipo: 'hotel', activo: true, nombre: 'Hotel', precioVenta: 800, ofertas: [], ofertaCompraId: '' }
    ]
  }
};

const cotizacion2 = {
  id: 'COT-TEST-2',
  cliente: 'CLIENTE A',
  destino: 'Bariloche',
  moneda: 'USD',
  pax: 1,
  estado: 'Aceptada',
  fechaViajeInicio: '2026-11-25',
  precioVentaTotalManual: 1000,
  servicios: {
    items: [
      { id: 'srv-aereo-1', tipo: 'aereo', activo: true, nombre: 'Vuelo Bariloche', precioVenta: 1000, ofertas: [], ofertaCompraId: '' }
    ]
  }
};

const cotizaciones = [cotizacion1, cotizacion2];
const hoy = '2026-11-16';

// 1) Derivación y servicios
const cobros = derivarCobrosDesdeCotizaciones(cotizaciones);
check('deriva un cobro por cotización', cobros.length === 2, `=> ${cobros.length}`);
check('cobra el precio de venta total', cobros[0].montoTotal === 3800, `=> ${cobros[0].montoTotal}`);
const servicios = serviciosDeCotizacion(cotizacion1);
check('extrae servicios con precio', servicios.length === 2, `=> ${servicios.length}`);
check('etiqueta el aéreo', servicios[0].etiquetaTipo === 'Aéreos', `=> ${servicios[0].etiquetaTipo}`);

// 2) Pago de paquete (número genérico que cubre el viaje)
const pagoPaquete = {
  id: 'p1', cliente: 'CLIENTE A', cotizacionId: 'COT-TEST-1',
  monto: 1000, moneda: 'USD', fecha: hoy, medio: 'Transferencia',
  numeroOperacion: 'OP-001'
};
let imputados = imputarPagosPorViaje(cobros, [pagoPaquete]);
let viaje1 = imputados.find((c) => c.cotizacionId === 'COT-TEST-1');
check('pago de paquete imputa al viaje', viaje1.pagado === 1000 && viaje1.saldo === 2800, `=> ${viaje1.pagado}/${viaje1.saldo}`);
check('guarda la aplicación del pago', viaje1.aplicacionesPago.length === 1);

// 3) Pago por servicios en monedas distintas (ARS con equivalente en USD)
const pagoServicios = {
  id: 'p2', cliente: 'CLIENTE A', monto: 700, moneda: 'USD', fecha: hoy,
  medio: 'Efectivo', numeroOperacion: 'OP-002',
  aplicaciones: [
    { cotizacionId: 'COT-TEST-1', itemId: 'srv-aereo-0', concepto: 'Aéreos', monto: 500, moneda: 'USD' },
    { cotizacionId: 'COT-TEST-1', itemId: 'srv-hotel-0', concepto: 'Hotel', monto: 200000, moneda: 'ARS', equivalente: 200 }
  ]
};
imputados = imputarPagosPorViaje(cobros, [pagoPaquete, pagoServicios]);
viaje1 = imputados.find((c) => c.cotizacionId === 'COT-TEST-1');
check('pagos por servicios suman al viaje', viaje1.pagado === 1700 && viaje1.saldo === 2100, `=> ${viaje1.pagado}/${viaje1.saldo}`);
check(
  'registra dos aplicaciones del pago por servicios',
  imputarPagosPorViaje(cobros, [pagoServicios])[0].aplicacionesPago.length === 2,
  `=> ${imputarPagosPorViaje(cobros, [pagoServicios])[0].aplicacionesPago.length}`
);
check('moneda distinta sin equivalente no contamina', imputarPagosPorViaje(cobros, [{
  id: 'x', cliente: 'CLIENTE A', monto: 100, moneda: 'ARS', aplicaciones: [{
    cotizacionId: 'COT-TEST-1', monto: 100, moneda: 'ARS'
  }]
}])[0].pagado === 0);

// 4) Pago general a cuenta: se reparte FIFO por fecha de viaje
const pagoGeneral = { id: 'p3', cliente: 'CLIENTE A', monto: 500, moneda: 'USD', fecha: hoy };
imputados = imputarPagosPorViaje(cobros, [pagoGeneral]);
viaje1 = imputados.find((c) => c.cotizacionId === 'COT-TEST-1');
const viaje2 = imputados.find((c) => c.cotizacionId === 'COT-TEST-2');
check('pago general va al viaje más próximo', viaje1.pagado === 500 && viaje2.pagado === 0, `=> ${viaje1.pagado}/${viaje2.pagado}`);

// 5) Rangos de agenda
check('lunes de la semana', inicioSemanaISO(hoy) === '2026-11-16', `=> ${inicioSemanaISO(hoy)}`);
check('domingo de la semana', finSemanaISO(hoy) === '2026-11-22', `=> ${finSemanaISO(hoy)}`);
check('fin de mes', finMesISO(hoy) === '2026-11-30', `=> ${finMesISO(hoy)}`);
check('rango semana', rangoAgenda('semana', hoy).fin === '2026-11-22');

// 6) Agenda: filtros y orden
const todosImputados = imputarPagosPorViaje(cobros, []);
const semana = cobrosParaAgenda(todosImputados, { rango: 'semana', fecha: hoy });
check('agenda semanal incluye viaje del 18', semana.length === 1 && semana[0].cotizacionId === 'COT-TEST-1', `=> ${semana.length}`);
const mes = cobrosParaAgenda(todosImputados, { rango: 'mes', fecha: hoy });
check('agenda mensual incluye ambos viajes', mes.length === 2, `=> ${mes.length}`);
const porValor = cobrosParaAgenda(todosImputados, { rango: 'todos', fecha: hoy, orden: 'valor' });
check('orden por saldo descendente', porValor[0].cotizacionId === 'COT-TEST-1', `=> ${porValor[0].cotizacionId}`);
const filtrado = cobrosParaAgenda(todosImputados, { rango: 'todos', fecha: hoy, destino: 'bariloche' });
check('filtro por destino', filtrado.length === 1 && filtrado[0].cotizacionId === 'COT-TEST-2');
const grupos = agruparCobrosPorFecha(semana);
check('agrupa por fecha', grupos.length === 1 && grupos[0].items.length === 1);

// 7) Historial y CSV
const pagos = [pagoPaquete, pagoServicios, pagoGeneral];
const historial = historialPagosPorCliente(pagos, 'CLIENTE A');
check('historial filtra por cliente', historial.length === 3, `=> ${historial.length}`);
check('historial ordena por fecha desc', historial.every((p, i) => i === 0 || p.fecha <= historial[i - 1].fecha));
const totales = totalesPagosPorMoneda(pagos);
check('totales separan monedas', totales.USD === 2200 && totales.ARS === undefined, JSON.stringify(totales));
check('normaliza pagos históricos', normalizarPagoCliente(pagoPaquete).aplicaciones.length === 1);
const csv = generarCSVPagosClientes(pagos);
check('CSV incluye aplicaciones', csv.includes('Aéreos') && csv.includes('200000.00'));
check('CSV incluye equivalente', csv.includes('200.00'));

// 8) Pagos generales en otra moneda: no deben contaminar el saldo en USD
const generalARS = { id: 'g-ars', cliente: 'CLIENTE A', monto: 200000, moneda: 'ARS', fecha: hoy };
check('pago general en ARS sin equivalente no imputa',
  imputarPagosPorViaje(cobros, [generalARS]).every((c) => c.pagado === 0));
const generalARSConEquiv = { ...generalARS, id: 'g-ars-2', equivalente: 600 };
let imputadosARS = imputarPagosPorViaje(cobros, [generalARSConEquiv]);
check('pago general en ARS con equivalente imputa al viaje más próximo',
  imputadosARS[0].pagado === 600 && imputadosARS[1].pagado === 0,
  `=> ${imputadosARS[0].pagado}/${imputadosARS[1].pagado}`);

// 9) El borrador construye exactamente lo que se guarda
const borradorPaquete = {
  cliente: 'CLIENTE A', tipo: 'paquete', cotizacionId: 'COT-TEST-1',
  monto: 500, moneda: 'USD', equivalente: 0,
  fecha: hoy, medio: 'Transferencia', numeroOperacion: ' OP-9 ', nota: ' seña '
};
const generados = construirPagosDesdeBorrador(borradorPaquete);
check('el borrador genera un pago con aplicación de paquete',
  generados.length === 1 && generados[0].aplicaciones[0].cotizacionId === 'COT-TEST-1');
check('el borrador limpia operación y nota',
  generados[0].numeroOperacion === 'OP-9' && generados[0].nota === 'seña');
check('los pagos del borrador comparten grupo de comprobante',
  Boolean(generados[0].grupoPagoId) && Boolean(generados[0].id));

// 10) Análisis en vivo del modal
let analisis = analizarRegistroCobro(borradorPaquete, { cobros, pagosClientes: [], cotizaciones });
check('el análisis proyecta la imputación real',
  analisis.totalImputado === 500 && analisis.impacto.length === 1,
  `=> ${analisis.totalImputado}`);
check('el impacto del análisis coincide con imputar al guardar',
  analisis.impacto[0].saldoProyectado ===
    imputarPagosPorViaje(cobros, generados)[0].saldo);
check('un pago correcto queda listo para guardar', analisis.listoParaGuardar === true);

const analisisSobrePago = analizarRegistroCobro(
  { ...borradorPaquete, monto: 5000 },
  { cobros, pagosClientes: [], cotizaciones }
);
check('avisa cuando el pago supera el saldo del viaje',
  analisisSobrePago.nivel === 'warning' &&
  analisisSobrePago.advertencias.some((a) => a.texto.includes('supera el saldo')));

const analisisSinEquiv = analizarRegistroCobro(
  { ...borradorPaquete, moneda: 'ARS', equivalente: '' },
  { cobros, pagosClientes: [], cotizaciones }
);
check('bloquea el guardado si falta el equivalente',
  analisisSinEquiv.nivel === 'danger' && analisisSinEquiv.listoParaGuardar === false &&
  analisisSinEquiv.totalImputado === 0);

const borradorGeneral = {
  cliente: 'CLIENTE A', tipo: 'general', monto: 600, moneda: 'USD', equivalente: 0,
  fecha: hoy, medio: 'Efectivo', numeroOperacion: '', nota: ''
};
analisis = analizarRegistroCobro(borradorGeneral, { cobros, pagosClientes: [], cotizaciones });
check('el análisis general reparte FIFO y muestra el impacto',
  analisis.impacto.length === 1 && analisis.impacto[0].cotizacionId === 'COT-TEST-1');

const analisisARS = analizarRegistroCobro(
  { ...borradorPaquete, moneda: 'ARS', monto: 200000, equivalente: 500 },
  { cobros, pagosClientes: [], cotizaciones }
);
check('el resumen usa la moneda de la deuda, no la del pago',
  analisisARS.resumenCliente.moneda === 'USD');
check('un equivalente correcto no genera sobrante falso',
  analisisARS.totalImputado === 500 &&
  !analisisARS.advertencias.some((a) => a.texto.includes('sin destino')) &&
  analisisARS.listoParaGuardar === true);

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
