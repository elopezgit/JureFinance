// calendarioService.js - Lógica del Calendario de Pagos a TTOOs (M7)
// Deriva las obligaciones de pago desde las cotizaciones guardadas, las une con
// los pagos cargados a mano, les aplica los pagos registrados (parciales) y
// calcula saldos, estados y niveles temporales para el calendario.

import {
  getFechaPagoTTOO,
  getBloqueBCP,
  getBloquesBCPPorVencimiento,
  getMesFromFecha
} from './ttoService';
import { normalizarServicios, SECCION_LABEL, TIPO_AEREO } from './serviciosService';

// La etiqueta de sección vive en el modelo de servicios; se re-exporta para
// no romper los imports existentes.
export { SECCION_LABEL };

const MONEDA_SIMBOLO = { USD: 'US$', ARS: '$', EUR: '€', BRL: 'R$' };

/** Genera un id único simple con prefijo. */
export function nuevoId(prefijo = 'ID') {
  return `${prefijo}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Formatea un monto con símbolo de moneda y separadores es-AR. */
export function formatearMonto(monto, moneda = 'USD') {
  const n = Number(monto) || 0;
  const sim = MONEDA_SIMBOLO[moneda] || (moneda ? `${moneda} ` : '');
  return `${sim} ${n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/** Fecha de hoy en ISO local 'YYYY-MM-DD'. */
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** 'YYYY-MM' de una fecha ISO. */
export function mesDeISO(iso) {
  return (iso || '').slice(0, 7);
}

/** Formatea una fecha ISO como "17 oct 2026". */
export function formatFechaLarga(iso) {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[m - 1]} ${y}`;
}

/** Días (con signo) desde `desdeISO` hasta `iso`. null si no hay fecha. */
export function diasHasta(iso, desdeISO = hoyISO()) {
  if (!iso) return null;
  const a = new Date(`${iso}T00:00:00`);
  const b = new Date(`${desdeISO}T00:00:00`);
  return Math.round((a - b) / 86400000);
}

/** Estado de un pago según cuánto se lleva pagado. */
export function estadoPago(pago) {
  const total = Number(pago.montoTotal) || 0;
  const pagado = Number(pago.pagado) || 0;
  if (pagado <= 0) return 'Pendiente';
  if (pagado + 0.005 < total) return 'Parcial';
  return 'Pagado';
}

/** Nivel temporal usado para colorear el calendario. */
export function nivelTemporal(pago, hoy = hoyISO()) {
  if (pago.estado === 'Pagado') return 'pagado';
  if (!pago.fechaVencimiento) return 'sin-fecha';
  const d = diasHasta(pago.fechaVencimiento, hoy);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  if (d <= 7) return 'proximo';
  return 'futuro';
}

const BADGE_POR_NIVEL = {
  vencido: 'badge-danger',
  hoy: 'badge-warning',
  proximo: 'badge-info',
  futuro: 'badge-neutral',
  'sin-fecha': 'badge-neutral',
  pagado: 'badge-success'
};

/** Etiqueta corta y clase de insignia según estado + nivel temporal. */
export function etiquetaEstado(pago, hoy = hoyISO()) {
  if (pago.estado === 'Pagado') return { texto: 'Pagado', badge: 'badge-success' };
  if (pago.estado === 'Parcial') return { texto: 'Parcial', badge: 'badge-warning' };
  const nivel = nivelTemporal(pago, hoy);
  if (nivel === 'vencido') return { texto: 'Vencido', badge: BADGE_POR_NIVEL.vencido };
  if (nivel === 'hoy') return { texto: 'Vence hoy', badge: BADGE_POR_NIVEL.hoy };
  if (nivel === 'sin-fecha') return { texto: 'Sin fecha', badge: 'badge-neutral' };
  return { texto: 'Pendiente', badge: 'badge-neutral' };
}

/* --------------------------------------------------------------------------
   Derivación de pagos
   -------------------------------------------------------------------------- */

function basePago(overrides) {
  return {
    clave: '',
    clavesAlias: [],
    origen: 'auto',
    cotizacionId: '',
    cliente: '',
    pax: 1,
    pasajeros: [],
    destino: '',
    seccion: '',
    seccionLabel: '',
    proveedor: '',
    concepto: '',
    moneda: 'USD',
    montoTotal: 0,
    fechaEmision: '',
    fechaVencimiento: '',
    origenVencimiento: '',
    ...overrides
  };
}

/**
 * Construye la obligación de pago de una línea de servicio.
 * La clave canónica es `${quoteId}::${itemId}`. Para que los pagos que ya
 * estaban registrados (con la clave anterior `${quoteId}::${tipo}`) sigan
 * imputando a esta línea, se guarda además esa clave como alias.
 */
function pagoDesdeItem(quote, item, configMensual) {
  const esAereo = item.tipo === TIPO_AEREO;
  const bloqueBCP =
    esAereo && item.fechaEmision
      ? getBloqueBCP(configMensual, item.proveedor || 'Aero', item.fechaEmision)
      : null;

  let fechaVencimiento = item.vencimientoTTOO || '';
  let origenVencimiento = fechaVencimiento ? 'manual' : '';

  // Para aéreos, si la oferta no trae vencimiento manual, manda el BCP.
  if (esAereo && !fechaVencimiento && item.fechaEmision) {
    fechaVencimiento = getFechaPagoTTOO(
      configMensual,
      item.proveedor || 'Aero',
      item.fechaEmision
    );
    origenVencimiento = fechaVencimiento ? 'bcp' : 'sin-config';
  }

  if (!fechaVencimiento) {
    origenVencimiento = esAereo && item.fechaEmision ? 'sin-config' : 'sin-fecha';
  }

  const clavesAlias = item.claveLegacy ? [`${quote.id}::${item.claveLegacy}`] : [];

  return basePago({
    clave: `${quote.id}::${item.id}`,
    clavesAlias,
    origen: 'auto',
    cotizacionId: quote.id,
    cliente: quote.cliente || 'Sin cliente',
    pax: quote.pax || 1,
    pasajeros: Array.isArray(quote.pasajeros)
      ? quote.pasajeros.map((p) => String(p || '').trim()).filter(Boolean)
      : [],
    destino: quote.destino || '',
    seccion: item.tipo,
    seccionLabel: SECCION_LABEL[item.tipo] || item.tipo,
    proveedor: item.proveedor || '',
    concepto: item.nombre || SECCION_LABEL[item.tipo] || item.tipo,
    fechaEmision: item.fechaEmision || '',
    bloqueBCP,
    rangoBCP: bloqueBCP?.rangoLabel || '',
    rangoBCPCorto: bloqueBCP?.rangoCorto || '',
    moneda: quote.moneda || 'USD',
    montoTotal: Number(item.montoTotalNeto) || 0,
    fechaVencimiento,
    origenVencimiento,
    estadoVuelo: esAereo ? item.estadoVuelo || 'SinReservar' : undefined
  });
}

/** Construye los pagos automáticos derivados de las cotizaciones guardadas. */
export function derivarPagosDesdeCotizaciones(cotizaciones = [], configMensual = []) {
  const pagos = [];

  (cotizaciones || []).forEach((quote) => {
    if (!quote) return;

    const items = normalizarServicios(quote.servicios, { pax: quote.pax });

    items.forEach((item) => {
      if (!item.activo) return;
      const monto = Number(item.montoTotalNeto) || 0;
      if (monto <= 0) return;
      pagos.push(pagoDesdeItem(quote, item, configMensual));
    });
  });

  return pagos;
}

/** Convierte un pago manual guardado en un pago de la agenda. */
export function pagoDesdeManual(manual) {
  return basePago({
    clave: `manual::${manual.id}`,
    origen: 'manual',
    manualId: manual.id,
    cotizacionId: '',
    cliente: manual.cliente || 'Pago a proveedor',
    seccion: 'manual',
    seccionLabel: SECCION_LABEL.manual,
    proveedor: manual.proveedor || '',
    concepto: manual.concepto || 'Pago a proveedor',
    moneda: manual.moneda || 'USD',
    montoTotal: Number(manual.monto) || 0,
    fechaVencimiento: manual.fechaVencimiento || '',
    notas: manual.notas || ''
  });
}

function aplicarPagos(pago, registros) {
  const ordenados = [...registros].sort((a, b) =>
    String(a.fecha || '').localeCompare(String(b.fecha || ''))
  );
  const pagado = ordenados.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  const saldo = (Number(pago.montoTotal) || 0) - pagado;
  const result = { ...pago, pagado, saldo, registros: ordenados };
  result.estado = estadoPago(result);
  return result;
}

/**
 * Agenda completa de pagos a TTOOs: automáticos + manuales, con pagos aplicados.
 */
export function construirAgendaPagos({
  cotizaciones = [],
  configMensual = [],
  pagosTTOOManuales = [],
  pagosTTOO = []
} = {}) {
  const automaticos = derivarPagosDesdeCotizaciones(cotizaciones, configMensual);
  const manuales = (pagosTTOOManuales || []).map(pagoDesdeManual);

  // Mapa de claves anteriores (modelo de secciones fijas) a la clave canónica
  // de la línea, para que los pagos ya registrados sigan imputando.
  const aliasMap = new Map();
  automaticos.forEach((pago) => {
    (pago.clavesAlias || []).forEach((alias) => aliasMap.set(alias, pago.clave));
  });

  const pagosPorClave = {};
  (pagosTTOO || []).forEach((registro) => {
    if (!registro || !registro.clave) return;
    const clave = aliasMap.get(registro.clave) || registro.clave;
    if (!pagosPorClave[clave]) pagosPorClave[clave] = [];
    pagosPorClave[clave].push(registro);
  });

  return [...automaticos, ...manuales].map((pago) =>
    aplicarPagos(pago, pagosPorClave[pago.clave] || [])
  );
}

/** Totales para las tarjetas de métricas. */
export function resumenAgendaPagos(pagos = [], hoy = hoyISO()) {
  const mes = mesDeISO(hoy);
  let totalMes = 0;
  let pagadoTotal = 0;
  let saldoTotal = 0;
  let saldoVencido = 0;
  let cantidadVencidos = 0;

  (pagos || []).forEach((p) => {
    const saldo = Math.max(Number(p.saldo) || 0, 0);
    saldoTotal += saldo;
    pagadoTotal += Number(p.pagado) || 0;

    if (p.fechaVencimiento && mesDeISO(p.fechaVencimiento) === mes) {
      totalMes += Number(p.montoTotal) || 0;
    }

    if (p.estado !== 'Pagado' && p.fechaVencimiento && p.fechaVencimiento < hoy) {
      saldoVencido += saldo;
      cantidadVencidos += 1;
    }
  });

  return { totalMes, pagadoTotal, saldoTotal, saldoVencido, cantidadVencidos };
}

/* --------------------------------------------------------------------------
   Flujo de caja por fecha de vencimiento
   --------------------------------------------------------------------------
   El BCP acumula emisiones y las paga en una fecha. Para el reporte financiero
   necesitamos ver, por cada fecha de pago, cuánto hay que desembolsar y qué
   tickets (cliente + PAX + cotización) componen ese monto. Nunca se suman
   monedas distintas: cada moneda se totaliza por separado.
   -------------------------------------------------------------------------- */

/** Totales por moneda de una lista de obligaciones. */
export function totalesPorMoneda(pagos = [], hoy = hoyISO()) {
  const mapa = new Map();

  (pagos || []).forEach((pago) => {
    const moneda = pago?.moneda || 'USD';
    if (!mapa.has(moneda)) {
      mapa.set(moneda, {
        moneda,
        montoTotal: 0,
        pagado: 0,
        saldo: 0,
        saldoVencido: 0,
        cantidad: 0,
        totalPax: 0,
        vencidos: 0
      });
    }

    const total = mapa.get(moneda);
    const saldo = Math.max(
      Number(pago.saldo ?? (Number(pago.montoTotal) || 0) - (Number(pago.pagado) || 0)) || 0,
      0
    );
    total.montoTotal += Number(pago.montoTotal) || 0;
    total.pagado += Number(pago.pagado) || 0;
    total.saldo += saldo;
    total.cantidad += 1;
    total.totalPax += Number(pago.pax) || 1;

    if (
      pago.estado !== 'Pagado' &&
      pago.fechaVencimiento &&
      pago.fechaVencimiento < hoy
    ) {
      total.saldoVencido += saldo;
      total.vencidos += 1;
    }
  });

  return [...mapa.values()].sort((a, b) => a.moneda.localeCompare(b.moneda));
}

/**
 * Agrupa las obligaciones por fecha de vencimiento. Cada grupo trae sus
 * totales por moneda y el detalle de tickets para auditar el pago.
 * Las obligaciones sin fecha van al final.
 */
export function agruparPorFechaVencimiento(pagos = []) {
  const mapa = new Map();

  (pagos || []).forEach((pago) => {
    const fecha = pago?.fechaVencimiento || '';
    if (!mapa.has(fecha)) mapa.set(fecha, []);
    mapa.get(fecha).push(pago);
  });

  return [...mapa.entries()]
    .sort(([fechaA], [fechaB]) => {
      if (!fechaA && !fechaB) return 0;
      if (!fechaA) return 1;
      if (!fechaB) return -1;
      return fechaA.localeCompare(fechaB);
    })
    .map(([fecha, items]) => {
      const ordenados = [...items].sort((a, b) => {
        const prov = String(a.proveedor || '').localeCompare(String(b.proveedor || ''));
        if (prov !== 0) return prov;
        return String(a.cliente || '').localeCompare(String(b.cliente || ''));
      });
      return {
        fecha,
        items: ordenados,
        monedas: totalesPorMoneda(ordenados),
        cantidad: ordenados.length,
        totalPax: ordenados.reduce((acc, p) => acc + (Number(p.pax) || 1), 0)
      };
    });
}

/**
 * Agrupa los tickets de una fecha por proveedor + moneda. Es la unidad que el
 * proveedor liquida junta ("bloque") y permite registrar un pago consolidado.
 */
export function agruparTicketsPorProveedor(items = []) {
  const mapa = new Map();

  (items || []).forEach((pago) => {
    const clave = `${pago.proveedor || 'Sin proveedor'}::${pago.moneda || 'USD'}`;
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        proveedor: pago.proveedor || 'Sin proveedor',
        moneda: pago.moneda || 'USD',
        fechaVencimiento: pago.fechaVencimiento || '',
        items: [],
        montoTotal: 0,
        pagado: 0,
        saldo: 0,
        totalPax: 0
      });
    }
    const grupo = mapa.get(clave);
    grupo.items.push(pago);
    grupo.montoTotal += Number(pago.montoTotal) || 0;
    grupo.pagado += Number(pago.pagado) || 0;
    grupo.saldo += Math.max(
      Number(pago.saldo ?? (Number(pago.montoTotal) || 0) - (Number(pago.pagado) || 0)) || 0,
      0
    );
    grupo.totalPax += Number(pago.pax) || 1;
  });

  return [...mapa.values()].map((grupo) => ({
    ...grupo,
    cantidad: grupo.items.length,
    estado: estadoPago({ montoTotal: grupo.montoTotal, pagado: grupo.pagado })
  }));
}

/** Escapa un valor para CSV (Excel es-AR usa punto y coma). */
function csvValor(valor) {
  const texto = String(valor ?? '').replace(/"/g, '""');
  return `"${texto}"`;
}

/**
 * Genera el CSV de auditoría del flujo de caja: una fila por ticket con su
 * fecha de pago, proveedor, cliente, PAX, emisión, rango BCP y saldo.
 */
export function generarCSVFlujoCaja(pagos = []) {
  const columnas = [
    'Fecha de pago',
    'Proveedor',
    'Moneda',
    'Cliente',
    'Pasajeros',
    'PAX',
    'Destino',
    'Cotización',
    'Concepto',
    'Fecha de emisión',
    'Rango BCP',
    'Total',
    'Pagado',
    'Saldo',
    'Estado'
  ];

  const filas = [...(pagos || [])]
    .sort((a, b) => {
      const fecha = String(a.fechaVencimiento || '').localeCompare(
        String(b.fechaVencimiento || '')
      );
      if (fecha !== 0) return fecha;
      return String(a.proveedor || '').localeCompare(String(b.proveedor || ''));
    })
    .map((pago) =>
      [
        pago.fechaVencimiento || 'Sin fecha',
        pago.proveedor || '',
        pago.moneda || 'USD',
        pago.cliente || '',
        Array.isArray(pago.pasajeros) ? pago.pasajeros.join(' | ') : '',
        pago.pax || 1,
        pago.destino || '',
        pago.cotizacionId || '',
        pago.concepto || '',
        pago.fechaEmision || '',
        pago.rangoBCP || '',
        Number(pago.montoTotal) || 0,
        Number(pago.pagado) || 0,
        Math.max(
          Number(pago.saldo ?? (Number(pago.montoTotal) || 0) - (Number(pago.pagado) || 0)) || 0,
          0
        ),
        pago.estado || estadoPago(pago)
      ]
        .map(csvValor)
        .join(';')
    );

  return `\uFEFF${columnas.map(csvValor).join(';')}\r\n${filas.join('\r\n')}`;
}

/* --------------------------------------------------------------------------
   Liquidaciones por proveedor y fecha de pago ("caja" de los TTOO)
   --------------------------------------------------------------------------
   Los proveedores como AERO no cobran cada emisión al momento: acumulan todo lo
   emitido en un bloque (p. ej. días 1-5) y lo liquidan junto en una fecha de pago
   (p. ej. el día 20). Estas funciones agrupan las obligaciones en esa "liquidación"
   y permiten registrar un único pago del bloque, repartiéndolo entre las
   obligaciones que lo componen.
   -------------------------------------------------------------------------- */

/** Clave estable que identifica una liquidación: proveedor + vencimiento + moneda. */
export function claveLiquidacion(pago) {
  const prov = String(pago?.proveedor || 'Sin proveedor').trim();
  const venc = pago?.fechaVencimiento || 'sin-fecha';
  const mon = pago?.moneda || 'USD';
  return `${prov}::${venc}::${mon}`;
}

/**
 * Agrupa las obligaciones (pagos) en liquidaciones por proveedor y fecha de pago.
 * @param {Array} pagos obligaciones ya resueltas (salida de construirAgendaPagos)
 * @param {Array} configMensual configuración BCP opcional para resolver rangos
 * @returns {Array} liquidaciones ordenadas por fecha (las sin fecha van al final)
 */
export function liquidacionesPorProveedorYFecha(pagos = [], configMensual = []) {
  const mapa = new Map();

  (pagos || []).forEach((pago) => {
    const clave = claveLiquidacion(pago);
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        proveedor: pago.proveedor || 'Sin proveedor',
        fechaVencimiento: pago.fechaVencimiento || '',
        moneda: pago.moneda || 'USD',
        items: [],
        montoTotal: 0,
        pagado: 0,
        saldo: 0
      });
    }
    const liq = mapa.get(clave);
    liq.items.push(pago);
    liq.montoTotal += Number(pago.montoTotal) || 0;
    liq.pagado += Number(pago.pagado) || 0;
    liq.saldo += Math.max(
      Number(pago.saldo ?? (Number(pago.montoTotal) || 0) - (Number(pago.pagado) || 0)) || 0,
      0
    );
  });

  return [...mapa.values()]
    .map((liq) => {
      // Resuelve TODOS los bloques BCP que caen en esta fecha (puede haber
      // varios rangos consolidados en el mismo día de pago).
      const bloques = [];
      const vistos = new Set();
      const agregarBloque = (bloque) => {
        if (!bloque) return;
        const clave = `${bloque.desde}-${bloque.hasta}-${bloque.fechaPago}`;
        if (vistos.has(clave)) return;
        vistos.add(clave);
        bloques.push(bloque);
      };

      liq.items.forEach((it) => agregarBloque(it.bloqueBCP));

      if (configMensual.length && liq.fechaVencimiento) {
        // Si algún ítem no trae el bloque resuelto, se busca en la configuración
        // del mes de emisión (nunca en todos los meses, para no mezclar rangos).
        const mesesEmision = [
          ...new Set(
            liq.items
              .map((it) => getMesFromFecha(it.fechaEmision))
              .filter(Boolean)
          )
        ];

        if (mesesEmision.length > 0) {
          mesesEmision.forEach((mesEmision) => {
            getBloquesBCPPorVencimiento(
              configMensual,
              liq.proveedor,
              liq.fechaVencimiento,
              mesEmision
            ).forEach(agregarBloque);
          });
        } else {
          getBloquesBCPPorVencimiento(
            configMensual,
            liq.proveedor,
            liq.fechaVencimiento
          ).forEach(agregarBloque);
        }
      }

      const totalPax = liq.items.reduce((acc, it) => acc + (Number(it.pax) || 1), 0);
      const rangoBCP = bloques.map((b) => b.rangoLabel).join(' · ');
      const rangoCorto = bloques.map((b) => b.rangoCorto).join(' · ');

      return {
        ...liq,
        cantidad: liq.items.length,
        totalPax,
        bloqueBCP: bloques[0] || null,
        bloquesBCP: bloques,
        rangoBCP,
        rangoCorto,
        esConsolidable: Boolean(liq.fechaVencimiento),
        estado: estadoPago({ montoTotal: liq.montoTotal, pagado: liq.pagado })
      };
    })
    .sort((a, b) => {
      if (a.fechaVencimiento && b.fechaVencimiento) {
        if (a.fechaVencimiento !== b.fechaVencimiento) {
          return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
        }
      } else if (!a.fechaVencimiento && b.fechaVencimiento) {
        return 1;
      } else if (a.fechaVencimiento && !b.fechaVencimiento) {
        return -1;
      }
      return String(a.proveedor).localeCompare(String(b.proveedor));
    });
}

/**
 * Reparte un pago consolidado de una liquidación entre sus obligaciones.
 * Reparto secuencial (FIFO): primero las de vencimiento más antiguo y, a igualdad,
 * por clave. Nunca reparte más que el saldo disponible de cada obligación.
 * @returns {Array} registros de pago listos para guardar en el overlay pagosTTOO
 */
export function repartirPagoEnLiquidacion(liquidacion, monto, datos = {}) {
  const { fecha = hoyISO(), medio = 'Transferencia', nota = '' } = datos;
  let restante = Number(monto) || 0;
  if (restante <= 0 || !Array.isArray(liquidacion?.items) || liquidacion.items.length === 0) {
    return [];
  }

  const abiertos = [...liquidacion.items]
    .filter((p) => Math.max(Number(p.saldo) || 0, 0) > 0.005)
    .sort((a, b) => {
      const fa = a.fechaVencimiento || '';
      const fb = b.fechaVencimiento || '';
      if (fa !== fb) return fa.localeCompare(fb);
      return String(a.clave).localeCompare(String(b.clave));
    });

  const registros = [];
  for (const item of abiertos) {
    if (restante <= 0.005) break;
    const saldoItem = Math.max(Number(item.saldo) || 0, 0);
    const asignado = Math.min(restante, saldoItem);
    if (asignado <= 0.005) continue;

    registros.push({
      id: nuevoId('PAGO'),
      clave: item.clave,
      cotizacionId: item.cotizacionId || '',
      proveedor: item.proveedor || liquidacion.proveedor || '',
      concepto: item.concepto || '',
      cliente: item.cliente || '',
      monto: Math.round(asignado * 100) / 100,
      fecha,
      medio,
      nota,
      moneda: item.moneda || liquidacion.moneda || 'USD',
      liquidacionClave: liquidacion.clave
    });

    restante -= asignado;
  }

  return registros;
}
