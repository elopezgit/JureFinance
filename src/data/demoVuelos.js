// demoVuelos.js - Vuelos de ejemplo ya cotizados y EMITIDOS.
//
// Objetivo: poder ver en el Calendario de Pagos cómo varias emisiones caen en
// distintas fechas de pago según la Configuración Mensual de Aero.
//
// Los días de emisión están elegidos para caer en los 5 bloques de la plantilla
// de configuración (1-5, 6-10, 11-15, 16-20, 21-31), con 2 vuelos por bloque.
//
// Nota: el `vencimientoTTOO` de cada aéreo se deja vacío a propósito, para que
// la app lo calcule con `getFechaPagoTTOO` a partir de la fecha de emisión.

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha local en formato 'YYYY-MM-DD'. */
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Suma días a una fecha y devuelve ISO. */
function sumarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return iso(d);
}

// Bloques de emisión (mismos rangos que la plantilla de Configuración Mensual).
const BLOQUES = [
  { rango: '01-05', dias: [2, 4] },
  { rango: '06-10', dias: [7, 9] },
  { rango: '11-15', dias: [12, 14] },
  { rango: '16-20', dias: [17, 19] },
  { rango: '21-31', dias: [22, 24] }
];

// Datos de los 10 vuelos (orden: se asignan a los días de emisión de arriba).
const VUELOS = [
  { cliente: 'RODRIGUEZ MARÍA', destino: 'Bariloche (BRC) · Aéreo + Traslado', pax: 2, neto: 1240 },
  { cliente: 'GÓMEZ CARLOS', destino: 'Miami (MIA) · Aéreo directo', pax: 1, neto: 890 },
  { cliente: 'FERNÁNDEZ LAURA', destino: 'Río de Janeiro (GIG)', pax: 2, neto: 1380 },
  { cliente: 'LÓPEZ JAVIER', destino: 'Madrid (MAD) · Escala Lisboa', pax: 3, neto: 2640 },
  { cliente: 'SÁNCHEZ PAULA', destino: 'Salta (SLA)', pax: 1, neto: 420 },
  { cliente: 'DÍAZ MARTÍN', destino: 'Cancún (CUN) · Vía Ciudad de Panamá', pax: 2, neto: 1960 },
  { cliente: 'TORRES SOFÍA', destino: 'Ushuaia (USH)', pax: 2, neto: 980 },
  { cliente: 'RAMÍREZ DIEGO', destino: 'Punta Cana (PUJ)', pax: 4, neto: 3200 },
  { cliente: 'MORALES VALENTINA', destino: 'Santiago de Chile (SCL)', pax: 1, neto: 540 },
  { cliente: 'SILVA NICOLÁS', destino: 'Recife (REC)', pax: 2, neto: 1120 }
];

// Hotel opcional en algunos vuelos (para ver liquidaciones de Price/Azabache).
const HOTELES = {
  1: { proveedor: 'Price', nombre: 'Bariloche · Hotel Catedral 4*', neto: 620 },
  4: { proveedor: 'Azabache', nombre: 'Salta · Hotel Solar de la Plaza', neto: 180 },
  7: { proveedor: 'Price', nombre: 'Punta Cana · Riu Palace (All Inclusive)', neto: 2100 }
};

/** Precio de venta con 20% de ganancia, redondeado cada 10 USD por pax. */
function precioVenta(neto, pax) {
  const totalConMarkup = neto * 1.2;
  const porPax = Math.max(10, Math.round(totalConMarkup / Math.max(pax, 1) / 10) * 10);
  return { porPax, total: porPax * pax };
}

/**
 * Genera los 10 vuelos de ejemplo emitidos en el mes de `hoy`.
 * @returns {Array} cotizaciones listas para el estado de la app
 */
export function buildDemoVuelosEmitidos(hoy = new Date()) {
  const anio = hoy.getFullYear();
  const mesIdx = hoy.getMonth();
  const mes = `${anio}-${String(mesIdx + 1).padStart(2, '0')}`;

  const cotizaciones = [];
  let n = 0;

  BLOQUES.forEach((bloque) => {
    bloque.dias.forEach((dia) => {
      const dato = VUELOS[n];
      const fechaEmision = iso(new Date(anio, mesIdx, dia));
      const fechaReserva = sumarDias(fechaEmision, -3);
      const fechaViajeInicio = sumarDias(fechaEmision, 45);
      const fechaViajeFin = sumarDias(fechaEmision, 52);
      const { porPax, total } = precioVenta(dato.neto, dato.pax);
      const hotel = HOTELES[n];
      n += 1;

      cotizaciones.push({
        id: `COT-DEMO-${String(n).padStart(3, '0')}`,
        cliente: dato.cliente,
        emailCliente: `${dato.cliente.split(' ')[0].toLowerCase()}@email.com`,
        telefonoCliente: '+54 9 11 5555-0000',
        destino: dato.destino,
        fechaViajeInicio,
        fechaViajeFin,
        fechaCotizacion: fechaReserva,
        pax: dato.pax,
        moneda: 'USD',
        estado: n % 4 === 0 ? 'Pagada' : 'Aceptada',
        comisionOptimaPct: 20,
        servicios: {
          aereo: {
            activo: true,
            nombre: 'Pasajes Aéreos Ida y Vuelta',
            proveedor: 'Aero',
            montoTotalNeto: dato.neto,
            vencimientoTTOO: '', // se calcula desde la fecha de emisión
            detalles: `Emitido el ${dia} ${MESES_ABREV[mesIdx]} · bloque de emisión ${bloque.rango}`,
            politicaReembolso: 'NO REEM',
            estadoVuelo: 'Emitido',
            fechaReserva,
            fechaEmision
          },
          hotel: hotel
            ? {
                activo: true,
                nombre: hotel.nombre,
                proveedor: hotel.proveedor,
                montoTotalNeto: hotel.neto,
                vencimientoTTOO: sumarDias(fechaEmision, 35),
                detalles: 'Reserva de alojamiento',
                politicaReembolso: 'Reembolsable hasta vencimiento'
              }
            : {
                activo: false,
                nombre: '',
                proveedor: 'Price',
                montoTotalNeto: 0,
                vencimientoTTOO: '',
                detalles: '',
                politicaReembolso: 'Reembolsable hasta vencimiento'
              },
          traslados: {
            activo: false,
            nombre: 'Traslados In / Out',
            proveedor: 'Price',
            montoTotalNeto: 0,
            vencimientoTTOO: '',
            detalles: '',
            politicaReembolso: 'Incluido'
          },
          asistencia: {
            activo: false,
            nombre: '',
            proveedor: 'Price',
            montoTotalNeto: 0,
            vencimientoTTOO: '',
            detalles: '',
            politicaReembolso: 'Cancelable sin cargo'
          },
          extras: []
        },
        precioVentaRedondeadoXPax: porPax,
        precioVentaTotalManual: total,
        notas: `Vuelo de ejemplo (${mes}). Emitido el ${fechaEmision}; el pago a Aero cae en el bloque ${bloque.rango}.`
      });
    });
  });

  return cotizaciones;
}

/** Vuelos de ejemplo del mes en curso (para datos iniciales). */
export const DEMO_VUELOS_EMITIDOS = buildDemoVuelosEmitidos();

/**
 * Devuelve las cotizaciones con los vuelos de ejemplo agregados, sin duplicar
 * los que ya existen (por id). No toca ni reemplaza datos del usuario.
 */
export function mergeDemoVuelos(cotizaciones = []) {
  const existentes = new Set((cotizaciones || []).map((q) => q && q.id));
  const faltantes = DEMO_VUELOS_EMITIDOS.filter((q) => !existentes.has(q.id));
  return [...(cotizaciones || []), ...faltantes];
}

/** Cuántos vuelos de ejemplo faltan por cargar en la lista dada. */
export function contarDemoFaltantes(cotizaciones = []) {
  const existentes = new Set((cotizaciones || []).map((q) => q && q.id));
  return DEMO_VUELOS_EMITIDOS.filter((q) => !existentes.has(q.id)).length;
}
