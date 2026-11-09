// cobroService.js - Cuentas por cobrar a clientes, derivadas de las cotizaciones.
//
// Primera versión (básica): no registra cobros todavía. Muestra, por cotización,
// cuánto hay que cobrarle al cliente (precio de venta) y su estado.
// La fecha de referencia es el inicio del viaje (el cobro se espera antes de viajar).
// Próxima fase: señas, cuotas y arreglos de cobro (arreglosCobro).

import { mesDeISO } from './calendarioService';

/** Total de venta de una cotización (usa el total manual o el precio por pax). */
export function ventaTotalCotizacion(quote) {
  const totalManual = Number(quote?.precioVentaTotalManual) || 0;
  if (totalManual > 0) return totalManual;
  const porPax = Number(quote?.precioVentaRedondeadoXPax) || 0;
  const pax = Number(quote?.pax) || 0;
  return porPax * pax;
}

/** Etiqueta y color según el estado de la cotización, visto como cobro. */
export function etiquetaEstadoCobro(cobro) {
  if (cobro.estadoCotizacion === 'Pagada') {
    return { texto: 'Cobrado', badge: 'badge-success' };
  }
  switch (cobro.estadoCotizacion) {
    case 'Aceptada':
      return { texto: 'A cobrar', badge: 'badge-info' };
    case 'Vencida':
      return { texto: 'Vencida', badge: 'badge-danger' };
    case 'Enviada':
      return { texto: 'A confirmar', badge: 'badge-neutral' };
    case 'Borrador':
      return { texto: 'Borrador', badge: 'badge-neutral' };
    default:
      return { texto: 'Pendiente', badge: 'badge-neutral' };
  }
}

/**
 * Deriva las obligaciones de cobro a partir de las cotizaciones guardadas.
 * @returns {Array} cobros con { montoTotal, pagado, saldo, estado }
 */
export function derivarCobrosDesdeCotizaciones(cotizaciones = []) {
  return (cotizaciones || [])
    .map((quote) => {
      if (!quote) return null;
      const total = ventaTotalCotizacion(quote);
      if (total <= 0) return null;
      const cobrado = quote.estado === 'Pagada';
      return {
        clave: quote.id,
        cotizacionId: quote.id,
        cliente: quote.cliente || 'Sin cliente',
        concepto: quote.destino || 'Viaje',
        moneda: quote.moneda || 'USD',
        pax: Number(quote.pax) || 0,
        montoTotal: total,
        pagado: cobrado ? total : 0,
        saldo: cobrado ? 0 : total,
        estado: cobrado ? 'Cobrado' : 'Pendiente',
        estadoCotizacion: quote.estado || '',
        fechaReferencia: quote.fechaViajeInicio || quote.fechaCotizacion || ''
      };
    })
    .filter(Boolean);
}

/** Totales para las tarjetas de métricas. */
export function resumenCobros(cobros = []) {
  let totalCartera = 0;
  let cobrado = 0;
  let aCobrar = 0;
  let cantidadPendientes = 0;
  let cantidadCobradas = 0;

  (cobros || []).forEach((c) => {
    totalCartera += Number(c.montoTotal) || 0;
    cobrado += Number(c.pagado) || 0;
    aCobrar += Math.max(Number(c.saldo) || 0, 0);
    if ((Number(c.saldo) || 0) > 0.005) cantidadPendientes += 1;
    if ((Number(c.pagado) || 0) > 0.005) cantidadCobradas += 1;
  });

  return { totalCartera, cobrado, aCobrar, cantidadPendientes, cantidadCobradas };
}

/**
 * Agrupa los cobros por mes (según la fecha de referencia = inicio del viaje).
 * @returns {Array} [{ mes, total, cobrado, saldo, cantidad, items }]
 */
export function cobrosPorMes(cobros = []) {
  const mapa = new Map();

  (cobros || []).forEach((c) => {
    const mes = mesDeISO(c.fechaReferencia) || 'sin-fecha';
    if (!mapa.has(mes)) {
      mapa.set(mes, { mes, total: 0, cobrado: 0, saldo: 0, cantidad: 0, items: [] });
    }
    const grupo = mapa.get(mes);
    grupo.items.push(c);
    grupo.total += Number(c.montoTotal) || 0;
    grupo.cobrado += Number(c.pagado) || 0;
    grupo.saldo += Math.max(Number(c.saldo) || 0, 0);
    grupo.cantidad += 1;
  });

  return [...mapa.values()].sort((a, b) => {
    if (a.mes === 'sin-fecha') return 1;
    if (b.mes === 'sin-fecha') return -1;
    return a.mes.localeCompare(b.mes);
  });
}
