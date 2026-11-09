// serviciosService.js - Modelo canónico de los servicios de una cotización.
//
// Cada SERVICIO del presupuesto (vuelo, hotel, traslado, asistencia, extra) es
// una línea `item` con:
//   · `precioVenta`: lo que se le cobra al cliente (sale del PDF que arma la
//     herramienta del proveedor 2/3).
//   · `ofertas[]`: los costos que cotizó cada proveedor para ese mismo
//     servicio. Cada oferta tiene proveedor, costo y vencimiento de pago.
//   · `ofertaCompraId`: con cuál de esas ofertas se compra realmente.
//
// La ganancia real es `precioVenta - costo de la oferta de compra`. Así se
// puede mostrar/vender el presupuesto de un proveedor y comprar el mismo
// servicio al más barato de otro.
//
// Este módulo es la única fuente de verdad del modelo. El wizard, el calendario
// de pagos, el historial y el dashboard leen de acá.

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

export const TIPO_AEREO = 'aereo';

export const TIPOS_SERVICIO = ['aereo', 'hotel', 'traslados', 'asistencia', 'extra'];

export const SECCION_LABEL = {
  aereo: 'Aéreos',
  hotel: 'Hotel',
  traslados: 'Traslados',
  asistencia: 'Asistencia',
  extra: 'Extra',
  manual: 'Manual'
};

export const ESTADOS_VUELO = ['SinReservar', 'Reservado', 'Emitido'];

const NOMBRE_DEFAULT = {
  aereo: 'Pasajes Aéreos',
  hotel: 'Alojamiento',
  traslados: 'Traslados',
  asistencia: 'Asistencia al Viajero',
  extra: 'Servicio Extra'
};

const POLITICA_DEFAULT = {
  aereo: 'NO REEM',
  hotel: 'Reembolsable hasta vencimiento',
  traslados: 'Incluido',
  asistencia: 'Cancelable sin cargo',
  extra: ''
};

/* ------------------------------------------------------------------ */
/* Utilidades generales                                                */
/* ------------------------------------------------------------------ */

/** Redondea a 2 decimales. */
export function redondear(numero) {
  return Math.round((Number(numero) || 0) * 100) / 100;
}

/** Id único para un servicio nuevo. */
export function nuevoIdItem(tipo = 'srv') {
  return `srv-${tipo}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Id único para una oferta nueva. */
export function nuevoIdOferta() {
  return `of-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Normaliza el nombre de un proveedor a su id ('Aero' → 'aero'). */
export function proveedorIdDe(proveedor) {
  return String(proveedor || '').trim().toLowerCase();
}

/** Nombre legible de un proveedor a partir de su id ('aero' → 'Aero'). */
export function nombreProveedorDe(proveedorId) {
  const id = proveedorIdDe(proveedorId);
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/* ------------------------------------------------------------------ */
/* Tramos de vuelo                                                     */
/* ------------------------------------------------------------------ */

/** Crea un tramo de vuelo vacío. */
export function createEmptyTramo() {
  return {
    id: `tramo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tipo: 'tramo',
    origen: '',
    destino: '',
    fechaSalida: '',
    horaSalida: '',
    fechaLlegada: '',
    horaLlegada: '',
    aerolinea: '',
    vuelo: '',
    clase: '',
    observacion: ''
  };
}

/** Descripción legible del itinerario: "TUC → MEX (29/10) | AR 1234 • ...". */
export function generarDescripcionItinerario(tramos) {
  if (!Array.isArray(tramos) || tramos.length === 0) return '';

  const partes = [];
  tramos.forEach((tramo) => {
    if (!tramo.origen && !tramo.destino) return;
    let desc = `${tramo.origen || '???'} → ${tramo.destino || '???'}`;
    if (tramo.fechaSalida) desc += ` (${tramo.fechaSalida})`;
    if (tramo.aerolinea && tramo.vuelo) desc += ` | ${tramo.aerolinea} ${tramo.vuelo}`;
    partes.push(desc);
  });

  return partes.join(' • ');
}

/** Nombre corto del vuelo a partir del itinerario: "TUC → MEX → TUC". */
export function nombreAereoDesdeTramos(tramos) {
  if (!Array.isArray(tramos) || tramos.length === 0) return '';
  const puntos = [];
  tramos.forEach((tramo) => {
    if (tramo.origen && puntos[puntos.length - 1] !== tramo.origen) puntos.push(tramo.origen);
    if (tramo.destino) puntos.push(tramo.destino);
  });
  return puntos.join(' → ');
}

/* ------------------------------------------------------------------ */
/* Ofertas de proveedores                                              */
/* ------------------------------------------------------------------ */

/**
 * Crea una oferta vacía de un proveedor para un servicio.
 * `costo` es el neto total que cobra ese proveedor por el servicio completo
 * (todos los pasajeros), no por pax.
 */
export function createEmptyOferta({ proveedorId = '', proveedor = '' } = {}) {
  const idProveedor = proveedorId || proveedorIdDe(proveedor);
  return {
    id: nuevoIdOferta(),
    proveedorId: idProveedor,
    proveedor: proveedor || nombreProveedorDe(idProveedor),
    costo: 0,
    vencimientoTTOO: '',
    politicaReembolso: ''
  };
}

/** Normaliza una oferta suelta (acepta el modelo anterior con `montoTotalNeto`). */
export function normalizarOferta(oferta, { itemId = '', indice = 0, tipo = 'extra' } = {}) {
  if (!oferta) return null;
  const idProveedor = oferta.proveedorId || proveedorIdDe(oferta.proveedor);

  return {
    id: oferta.id || `of-${itemId || 'srv'}-${indice}`,
    proveedorId: idProveedor,
    proveedor: oferta.proveedor || nombreProveedorDe(idProveedor),
    costo: redondear(Number(oferta.costo ?? oferta.montoTotalNeto) || 0),
    vencimientoTTOO: oferta.vencimientoTTOO || '',
    politicaReembolso: oferta.politicaReembolso ?? (POLITICA_DEFAULT[tipo] || '')
  };
}

/** Elige la oferta de compra guardada o, si no hay, la más barata con costo. */
export function ofertaCompraDe(item) {
  if (!item) return null;
  const ofertas = Array.isArray(item.ofertas) ? item.ofertas : [];
  if (ofertas.length === 0) return null;

  const elegida = ofertas.find((oferta) => oferta.id === item.ofertaCompraId);
  if (elegida) return elegida;

  const conCosto = ofertas.filter((oferta) => Number(oferta.costo) > 0);
  if (conCosto.length > 0) {
    return conCosto.reduce((min, oferta) =>
      Number(oferta.costo) < Number(min.costo) ? oferta : min
    );
  }

  return ofertas[0];
}

/** Costo real del servicio (lo que paga la agencia al proveedor de compra). */
export function costoCompraItem(item) {
  return redondear(Number(ofertaCompraDe(item)?.costo) || 0);
}

/** Proveedor con el que realmente se compra el servicio. */
export function proveedorCompraItem(item) {
  return ofertaCompraDe(item)?.proveedor || '';
}

/** Precio de venta al cliente del servicio. */
export function precioVentaItem(item) {
  return redondear(Number(item?.precioVenta) || 0);
}

/** Ganancia real del servicio: venta al cliente − costo de compra. */
export function gananciaItem(item) {
  return redondear(precioVentaItem(item) - costoCompraItem(item));
}

/* ------------------------------------------------------------------ */
/* Servicios (líneas del presupuesto)                                  */
/* ------------------------------------------------------------------ */

/** Crea un servicio vacío con una oferta inicial. */
export function createEmptyItem(tipo, { proveedorId = '', proveedor = '' } = {}) {
  const tipoFinal = TIPOS_SERVICIO.includes(tipo) ? tipo : 'extra';
  const oferta = createEmptyOferta({ proveedorId, proveedor });

  const base = {
    id: nuevoIdItem(tipoFinal),
    tipo: tipoFinal,
    activo: true,
    nombre: NOMBRE_DEFAULT[tipoFinal] || '',
    precioVenta: 0,
    detalles: '',
    ofertas: [oferta],
    ofertaCompraId: oferta.id
  };

  if (tipoFinal === TIPO_AEREO) {
    return {
      ...base,
      estadoVuelo: 'SinReservar',
      fechaReserva: '',
      fechaEmision: '',
      tramos: []
    };
  }

  return base;
}

/**
 * Normaliza un servicio. Acepta:
 * - el modelo nuevo (`ofertas[]` + `precioVenta`),
 * - el modelo intermedio (una sola oferta en `montoTotalNeto` + `proveedor`),
 * - y las secciones fijas viejas, que se convierten antes de llegar acá.
 *
 * Además deja campos derivados (`proveedor`, `montoTotalNeto`,
 * `vencimientoTTOO`) para que los lectores existentes sigan funcionando.
 */
export function normalizarItem(item) {
  if (!item) return null;

  const tipo = TIPOS_SERVICIO.includes(item.tipo) ? item.tipo : 'extra';
  const id = item.id || nuevoIdItem(tipo);

  const ofertasPrevias = Array.isArray(item.ofertas) ? item.ofertas.filter(Boolean) : [];
  let ofertas;

  if (ofertasPrevias.length > 0) {
    ofertas = ofertasPrevias
      .map((oferta, indice) => normalizarOferta(oferta, { itemId: id, indice, tipo }))
      .filter(Boolean);
  } else if (
    item.proveedorId ||
    item.proveedor ||
    Number(item.montoTotalNeto) > 0 ||
    item.vencimientoTTOO
  ) {
    ofertas = [
      normalizarOferta(
        {
          id: `of-${id}-0`,
          proveedorId: item.proveedorId || proveedorIdDe(item.proveedor),
          proveedor: item.proveedor,
          costo: item.montoTotalNeto,
          vencimientoTTOO: item.vencimientoTTOO,
          politicaReembolso: item.politicaReembolso
        },
        { itemId: id, indice: 0, tipo }
      )
    ];
  } else {
    ofertas = [];
  }

  let ofertaCompraId = item.ofertaCompraId || '';
  if (!ofertas.some((oferta) => oferta.id === ofertaCompraId)) {
    ofertaCompraId = ofertaCompraDe({ ofertas })?.id || '';
  }
  const compra = ofertas.find((oferta) => oferta.id === ofertaCompraId) || null;

  const base = {
    id,
    tipo,
    activo: item.activo !== false,
    nombre: item.nombre ?? NOMBRE_DEFAULT[tipo] ?? '',
    precioVenta: redondear(Number(item.precioVenta) || 0),
    detalles: item.detalles || '',
    ofertas,
    ofertaCompraId,
    // Derivados (compatibilidad con los lectores de la versión anterior):
    proveedorId: compra?.proveedorId || '',
    proveedor: compra?.proveedor || '',
    montoTotalNeto: redondear(Number(compra?.costo) || 0),
    vencimientoTTOO: compra?.vencimientoTTOO || '',
    politicaReembolso: compra?.politicaReembolso || '',
    // Clave con la que el servicio se guardaba antes del modelo por líneas.
    // Se usa para imputar pagos ya registrados (ver calendarioService).
    claveLegacy: item.claveLegacy || ''
  };

  if (tipo === TIPO_AEREO) {
    const tramos = Array.isArray(item.tramos)
      ? item.tramos.map((tramo) => ({ ...createEmptyTramo(), ...tramo }))
      : [];

    return {
      ...base,
      nombre: base.nombre || nombreAereoDesdeTramos(tramos) || NOMBRE_DEFAULT.aereo,
      estadoVuelo: item.estadoVuelo || 'SinReservar',
      fechaReserva: item.fechaReserva || '',
      fechaEmision: item.fechaEmision || '',
      tramos
    };
  }

  return base;
}

/**
 * Normaliza `quote.servicios` (cualquiera de los modelos) a `servicios[]`.
 * - Modelo nuevo: `{ items: [...] }` con `ofertas[]`.
 * - Modelo intermedio: `{ items: [...] }` con una oferta por `montoTotalNeto`.
 * - Modelo viejo: secciones fijas (`aereo`, `hotel`, `traslados`, `asistencia`,
 *   `extras[]`, `aereoSecundario[]`) → servicios con id estable.
 */
export function normalizarServicios(servicios, { pax = 1 } = {}) {
  if (!servicios) return [];

  if (Array.isArray(servicios.items)) {
    return servicios.items.map((item) => normalizarItem(item, { pax })).filter(Boolean);
  }

  const items = [];
  const contadores = {};

  const desdeSeccion = (tipo, data) => {
    if (!data || !data.activo) return;
    contadores[tipo] = (contadores[tipo] || 0) + 1;
    items.push(
      normalizarItem(
        {
          ...data,
          tipo,
          id: `srv-${tipo}-${contadores[tipo] - 1}`,
          proveedorId: proveedorIdDe(data.proveedor),
          proveedor: data.proveedor,
          claveLegacy: `${tipo}`
        },
        { pax }
      )
    );
  };

  desdeSeccion(TIPO_AEREO, servicios.aereo);
  desdeSeccion('hotel', servicios.hotel);
  desdeSeccion('traslados', servicios.traslados);
  desdeSeccion('asistencia', servicios.asistencia);

  (servicios.extras || []).forEach((extra) => {
    if (!extra || !extra.activo) return;
    contadores.extra = (contadores.extra || 0) + 1;
    items.push(
      normalizarItem(
        {
          ...extra,
          tipo: 'extra',
          id: `srv-extra-${contadores.extra - 1}`,
          proveedorId: proveedorIdDe(extra.proveedor),
          proveedor: extra.proveedor,
          claveLegacy: `extras:${extra.id}`
        },
        { pax }
      )
    );
  });

  (servicios.aereoSecundario || []).forEach((secundario, index) => {
    if (!secundario || !secundario.activo) return;
    contadores.aereo = (contadores.aereo || 0) + 1;
    items.push(
      normalizarItem(
        {
          ...secundario,
          tipo: TIPO_AEREO,
          id: `srv-aereo-${contadores.aereo - 1}`,
          proveedorId: proveedorIdDe(secundario.proveedor),
          proveedor: secundario.proveedor,
          claveLegacy: `aereoSecundario:${secundario.id || index}`
        },
        { pax }
      )
    );
  });

  return items;
}

/* ------------------------------------------------------------------ */
/* Totales                                                             */
/* ------------------------------------------------------------------ */

/** Servicios activos. */
export function serviciosActivos(items = []) {
  return (items || []).filter((item) => item && item.activo);
}

/** Costo real total (lo que se paga a los proveedores de compra). */
export function totalCostoItems(items = []) {
  return redondear(
    serviciosActivos(items).reduce((acc, item) => acc + costoCompraItem(item), 0)
  );
}

/** Precio de venta total al cliente. */
export function totalVentaItems(items = []) {
  return redondear(
    serviciosActivos(items).reduce((acc, item) => acc + precioVentaItem(item), 0)
  );
}

/** Ganancia real total (venta − costo de compra). */
export function totalGananciaItems(items = []) {
  return redondear(totalVentaItems(items) - totalCostoItems(items));
}

/** Margen sobre la venta, en porcentaje. */
export function margenVentaItems(items = []) {
  const venta = totalVentaItems(items);
  if (venta <= 0) return 0;
  return redondear((totalGananciaItems(items) / venta) * 100);
}

/**
 * Alias histórico: el "total neto" que usaban los lectores era el costo.
 * Se mantiene para no tocar dashboard, historial y operadores.
 */
export function totalNetoItems(items = []) {
  return totalCostoItems(items);
}

/** Servicios de un tipo. */
export function itemsPorTipo(items = [], tipo) {
  return (items || []).filter((item) => item && item.tipo === tipo);
}

/** Servicios que se compran a un proveedor. */
export function itemsPorProveedor(items = [], proveedorId) {
  const id = proveedorIdDe(proveedorId);
  return (items || []).filter(
    (item) => item && proveedorIdDe(item.proveedorId || proveedorCompraItem(item)) === id
  );
}

/** Costo real acumulado de un tipo. */
export function netoPorTipo(items = [], tipo) {
  return redondear(
    itemsPorTipo(items, tipo)
      .filter((item) => item.activo)
      .reduce((acc, item) => acc + costoCompraItem(item), 0)
  );
}

/** Venta acumulada de un tipo. */
export function ventaPorTipo(items = [], tipo) {
  return redondear(
    itemsPorTipo(items, tipo)
      .filter((item) => item.activo)
      .reduce((acc, item) => acc + precioVentaItem(item), 0)
  );
}
