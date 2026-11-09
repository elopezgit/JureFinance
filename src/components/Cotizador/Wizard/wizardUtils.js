// wizardUtils.js - Helpers del wizard de cotización.
//
// El modelo de datos vive en `src/services/serviciosService.js`: cada servicio
// tiene precio de venta al cliente y una o más ofertas de compra (proveedor +
// costo). Acá se re-exporta lo que usa el wizard y se suman los helpers propios
// de la interfaz.

export {
  // Constantes
  TIPO_AEREO,
  TIPOS_SERVICIO,
  SECCION_LABEL,
  ESTADOS_VUELO,
  // Utilidades
  redondear,
  nuevoIdItem,
  nuevoIdOferta,
  proveedorIdDe,
  nombreProveedorDe,
  // Tramos
  createEmptyTramo,
  generarDescripcionItinerario,
  nombreAereoDesdeTramos,
  // Ofertas y servicios
  createEmptyOferta,
  normalizarOferta,
  createEmptyItem,
  normalizarItem,
  normalizarServicios,
  ofertaCompraDe,
  costoCompraItem,
  proveedorCompraItem,
  precioVentaItem,
  gananciaItem,
  // Totales
  serviciosActivos,
  totalCostoItems,
  totalVentaItems,
  totalGananciaItems,
  margenVentaItems,
  totalNetoItems,
  itemsPorTipo,
  itemsPorProveedor,
  netoPorTipo,
  ventaPorTipo
} from '../../../services/serviciosService';

import { TIPO_AEREO, costoCompraItem, totalCostoItems, redondear } from '../../../services/serviciosService';

/* ------------------------------------------------------------------ */
/* Proveedores                                                         */
/* ------------------------------------------------------------------ */

/** Prestación declarada por el operador → tipo de servicio del modelo. */
const PRESTACION_A_TIPO = {
  'Aéreos': TIPO_AEREO,
  Hotel: 'hotel',
  Traslados: 'traslados',
  'Asistencia al Viajero': 'asistencia'
};

/** Tipos de servicio que ofrece un operador, según sus prestaciones. */
export function tiposDeProveedor(operador) {
  if (!operador) return [];
  const tipos = [];
  (operador.prestaciones || []).forEach((prestacion) => {
    const tipo = PRESTACION_A_TIPO[prestacion];
    if (tipo && !tipos.includes(tipo)) tipos.push(tipo);
  });
  if (tipos.length === 0) tipos.push('extra');
  return tipos;
}

/** ¿El operador vende aéreos? (informativo: define el ícono del operador). */
export function esProveedorAereo(operador) {
  return tiposDeProveedor(operador).includes(TIPO_AEREO);
}

/* ------------------------------------------------------------------ */
/* Pasos del wizard                                                    */
/* ------------------------------------------------------------------ */

/**
 * El wizard tiene tres pasos fijos:
 *   1. Datos del viaje y proveedores con los que se puede comprar.
 *   2. Servicios: precio de venta al cliente + ofertas de cada proveedor.
 *   3. Resumen: ganancia real y guardado.
 *
 * Los proveedores tildados ya no generan pasos: se usan como opciones al
 * cargar las ofertas de cada servicio (un mismo servicio se puede cotizar con
 * varios proveedores y comprar con cualquiera de ellos).
 */
export function construirPasos() {
  return [
    { id: 'datos', tipo: 'datos', label: 'Datos del viaje', short: 'Datos' },
    { id: 'servicios', tipo: 'servicios', label: 'Servicios y costos', short: 'Servicios' },
    { id: 'resumen', tipo: 'resumen', label: 'Resumen & Guardar', short: 'Resumen' }
  ];
}

/* ------------------------------------------------------------------ */
/* Migración de precios de venta                                       */
/* ------------------------------------------------------------------ */

/**
 * Si una cotización vieja no tiene precio de venta por servicio pero sí un
 * total de venta a nivel cotización, reparte ese total entre los servicios
 * activos (proporcional al costo; en partes iguales si todo es costo 0).
 * Así, al editar una cotización existente, los números no arrancan en cero.
 */
export function sembrarPreciosVenta(items = [], totalVenta = 0) {
  const total = Number(totalVenta) || 0;
  if (total <= 0) return items;

  const activos = (items || []).filter((item) => item.activo);
  if (activos.length === 0) return items;
  if (activos.some((item) => Number(item.precioVenta) > 0)) return items;

  const costoTotal = totalCostoItems(items);
  const asignados = new Map();

  let acumulado = 0;
  activos.forEach((item, index) => {
    let monto;
    if (index === activos.length - 1) {
      monto = redondear(total - acumulado);
    } else if (costoTotal > 0) {
      monto = redondear((total * costoCompraItem(item)) / costoTotal);
    } else {
      monto = redondear(total / activos.length);
    }
    acumulado += monto;
    asignados.set(item.id, monto);
  });

  return items.map((item) =>
    asignados.has(item.id) ? { ...item, precioVenta: asignados.get(item.id) } : item
  );
}

/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

/** Formatea un importe con la moneda de la cotización. */
export function formatoMoneda(moneda, valor) {
  return `${moneda || 'USD'} $${Number(valor || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/** Formatea un porcentaje con un decimal. */
export function formatoPct(valor) {
  return `${(Number(valor) || 0).toFixed(1)}%`;
}
