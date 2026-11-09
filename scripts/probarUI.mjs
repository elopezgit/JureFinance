// Smoke test de render (SSR) para detectar errores de JSX/props en las vistas
// nuevas del módulo BCP. No reemplaza una prueba de navegador, pero valida que
// los componentes puedan montarse con datos reales del modelo.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FlujoCajaBCP from '../src/components/Cobranzas/FlujoCajaBCP.jsx';
import ConfiguracionMensualView from '../src/components/Configuracion/ConfiguracionMensualView.jsx';
import { construirAgendaPagos } from '../src/services/calendarioService.js';
import { getMesActual } from '../src/services/ttoService.js';
import { buildConfiguracionMensual, INITIAL_OPERADORES } from '../src/data/initialData.js';

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

const configMensual = buildConfiguracionMensual(['2026-11']);
const cotizacion = {
  id: 'COT-UI-1',
  cliente: 'CLIENTE DE PRUEBA',
  pax: 2,
  pasajeros: ['Ana Pérez', 'Luis Gómez'],
  moneda: 'USD',
  destino: 'Bariloche (BRC)',
  servicios: {
    items: [
      {
        id: 'srv-ui-1',
        tipo: 'aereo',
        activo: true,
        nombre: 'Pasajes Aéreos',
        precioVenta: 1200,
        estadoVuelo: 'Emitido',
        fechaEmision: '2026-11-03',
        tramos: [],
        ofertaCompraId: 'of-ui-1',
        ofertas: [
          {
            id: 'of-ui-1',
            proveedorId: 'aero',
            proveedor: 'Aero',
            costo: 1000
          }
        ]
      }
    ]
  }
};

const agenda = construirAgendaPagos({
  cotizaciones: [cotizacion],
  configMensual,
  pagosTTOOManuales: [],
  pagosTTOO: []
});

check('renderiza el reporte de flujo de caja BCP', () => {
  const html = renderToStaticMarkup(
    React.createElement(FlujoCajaBCP, {
      pagos: agenda,
      mes: '2026-11',
      onCambiarMes: () => {},
      verTodos: false,
      onToggleVerTodos: () => {},
      moneda: 'todas',
      onCambiarMoneda: () => {},
      monedas: ['USD'],
      proveedores: ['Aero'],
      filtroProveedor: 'todos',
      onCambiarProveedor: () => {},
      onPagar: () => {},
      onPagarBloque: () => {},
      onExportarCSV: () => {},
      hoy: '2026-11-01'
    })
  );
  if (!html.includes('Flujo de caja por día de vencimiento')) {
    throw new Error('No se renderizó el título del reporte');
  }
  if (!html.includes('CLIENTE DE PRUEBA')) {
    throw new Error('No se renderizó el detalle del cliente');
  }
  if (!html.includes('Ana Pérez')) {
    throw new Error('No se renderizaron los nombres de pasajeros');
  }
  if (!html.includes('01-05')) {
    throw new Error('No se renderizó el rango BCP');
  }
});

check('renderiza el reporte vacío sin romper', () => {
  const html = renderToStaticMarkup(
    React.createElement(FlujoCajaBCP, {
      pagos: [],
      mes: '2026-11',
      onCambiarMes: () => {},
      verTodos: false,
      onToggleVerTodos: () => {},
      moneda: 'todas',
      onCambiarMoneda: () => {},
      monedas: [],
      proveedores: [],
      filtroProveedor: 'todos',
      onCambiarProveedor: () => {},
      onPagar: () => {},
      onPagarBloque: () => {},
      onExportarCSV: () => {},
      hoy: '2026-11-01'
    })
  );
  if (!html.includes('Sin vencimientos en el período')) {
    throw new Error('No se renderizó el estado vacío del reporte');
  }
});

check('renderiza varias monedas sin mezclar totales', () => {
  const pagosMulti = [
    {
      ...agenda[0],
      clave: 'USD-1',
      moneda: 'USD',
      montoTotal: 100,
      pagado: 0,
      saldo: 100,
      estado: 'Pendiente'
    },
    {
      ...agenda[0],
      clave: 'ARS-1',
      moneda: 'ARS',
      montoTotal: 5000,
      pagado: 0,
      saldo: 5000,
      estado: 'Pendiente'
    }
  ];
  const html = renderToStaticMarkup(
    React.createElement(FlujoCajaBCP, {
      pagos: pagosMulti,
      mes: '2026-11',
      onCambiarMes: () => {},
      verTodos: false,
      onToggleVerTodos: () => {},
      moneda: 'todas',
      onCambiarMoneda: () => {},
      monedas: ['ARS', 'USD'],
      proveedores: ['Aero'],
      filtroProveedor: 'todos',
      onCambiarProveedor: () => {},
      onPagar: () => {},
      onPagarBloque: () => {},
      onExportarCSV: () => {},
      hoy: '2026-11-01'
    })
  );
  if (!html.includes('USD') || !html.includes('ARS')) {
    throw new Error('No se renderizaron ambas monedas');
  }
});

check('renderiza el administrador de configuración BCP', () => {
  const mesActual = getMesActual();
  const html = renderToStaticMarkup(
    React.createElement(ConfiguracionMensualView, {
      configMensual: buildConfiguracionMensual([mesActual]),
      onSaveConfig: () => {},
      operadoresList: INITIAL_OPERADORES,
      cotizaciones: [cotizacion]
    })
  );
  if (!html.includes('Generar el mes con una regla')) {
    throw new Error('No se renderizó el generador de reglas');
  }
  if (!html.includes('Cobertura de')) {
    throw new Error('No se renderizó la cobertura del mes');
  }
});

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`);
