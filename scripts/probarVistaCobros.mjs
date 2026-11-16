// Smoke test (SSR) de la vista de cobranza: valida que monte con datos reales
// y que renderice la agenda, la caja por cliente y los pagos registrados.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CalendarioCobrosView from '../src/components/Cobranzas/CalendarioCobrosView.jsx';
import RegistrarCobroModal from '../src/components/Cobranzas/RegistrarCobroModal.jsx';
import { derivarCobrosDesdeCotizaciones } from '../src/services/cobroService.js';

let fallas = 0;
function check(nombre, fn) {
  try {
    fn();
    console.log(`OK   ${nombre}`);
  } catch (error) {
    fallas += 1;
    console.log(`FALLA ${nombre}`);
    console.log(error?.stack || error);
  }
}

const cotizacion = {
  id: 'COT-UI-COBRO-1',
  cliente: 'CLIENTE PRUEBA COBRO',
  destino: 'Cancún',
  moneda: 'USD',
  pax: 2,
  estado: 'Aceptada',
  fechaViajeInicio: '2026-11-18',
  precioVentaTotalManual: 3800,
  servicios: {
    items: [
      { id: 'srv-ui-aereo', tipo: 'aereo', activo: true, nombre: 'Vuelos', precioVenta: 3000, ofertas: [], ofertaCompraId: '' },
      { id: 'srv-ui-hotel', tipo: 'hotel', activo: true, nombre: 'Hotel', precioVenta: 800, ofertas: [], ofertaCompraId: '' }
    ]
  }
};

const pagos = [{
  id: 'pago-ui-1',
  cliente: 'CLIENTE PRUEBA COBRO',
  cotizacionId: 'COT-UI-COBRO-1',
  monto: 1000,
  moneda: 'USD',
  fecha: '2026-11-16',
  medio: 'Transferencia',
  numeroOperacion: 'OP-9001',
  nota: 'Señal de aéreos',
  enCaja: true,
  tipo: 'paquete',
  aplicaciones: [{
    cotizacionId: 'COT-UI-COBRO-1',
    itemId: 'srv-ui-aereo',
    concepto: 'Aéreos',
    monto: 1000,
    moneda: 'USD',
    equivalente: 0,
    descripcion: ''
  }]
}];

const props = {
  cotizaciones: [cotizacion],
  pagosClientes: pagos,
  onIrACotizador: () => {},
  onRegistrarCobroCliente: () => {},
  onRegistrarCobrosClientesLote: () => {},
  onEliminarCobroCliente: () => {}
};

let html = '';
check('monta la vista sin excepciones', () => {
  html = renderToStaticMarkup(React.createElement(CalendarioCobrosView, props));
});
check('muestra la agenda de cobro', () => {
  if (!html.includes('Agenda de cobro')) throw new Error('falta la agenda');
});
check('muestra el cliente y su viaje', () => {
  if (!html.includes('CLIENTE PRUEBA COBRO') || !html.includes('Cancún')) throw new Error('faltan datos');
});
check('muestra los filtros y el botón de registrar', () => {
  if (!html.includes('Organizar agenda de cobranza') || !html.includes('Registrar cobro')) {
    throw new Error('faltan controles');
  }
});
check('muestra los ingresos registrados', () => {
  if (!html.includes('Ingresos registrados')) throw new Error('faltan métricas');
});
check('monta sin pagos ni cotizaciones', () => {
  const vacio = renderToStaticMarkup(React.createElement(CalendarioCobrosView, {
    cotizaciones: [], pagosClientes: []
  }));
  if (!vacio.includes('Cuentas a cobrar a clientes')) throw new Error('falló el estado vacío');
});

check('monta el modal con el panel de análisis en vivo', () => {
  const cobros = derivarCobrosDesdeCotizaciones([cotizacion]);
  const modalHtml = renderToStaticMarkup(React.createElement(RegistrarCobroModal, {
    cobro: {
      cliente: 'CLIENTE PRUEBA COBRO',
      cotizacionId: 'COT-UI-COBRO-1',
      saldo: 2800,
      moneda: 'USD'
    },
    clientesUnicos: ['CLIENTE PRUEBA COBRO'],
    cobros,
    pagosClientes: pagos,
    cotizaciones: [cotizacion],
    onCerrar: () => {},
    onGuardar: () => {}
  }));
  if (!modalHtml.includes('Análisis del cobro') ||
      !modalHtml.includes('Proyección de este cobro') ||
      !modalHtml.includes('Situación del cliente')) {
    throw new Error('falta el panel de análisis');
  }
  if (!modalHtml.includes('2.800,00')) throw new Error('falta la proyección del saldo');
});

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
