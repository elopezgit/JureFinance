// cobroService.js - Cuentas por cobrar a clientes, derivadas de las cotizaciones.
//
// El cobro se deriva del precio de venta de cada cotización. Los pagos que el
// cliente realiza se guardan como un overlay (`pagosClientes`) y se imputan a
// las cotizaciones por `cotizacionId`. Un pago puede ser:
//   · general / de paquete (un número de operación cubre todo o parte),
//   · por servicios (vuelo, hotel, traslado...), con monto y moneda por línea,
//   · a cuenta (sin destino), que se reparte FIFO por fecha de viaje.
//
// Las aplicaciones por servicio se guardan en `pago.aplicaciones[]`:
//   { cotizacionId, itemId, concepto, monto, moneda, equivalente, descripcion }
// `equivalente` permite imputar un pago en otra moneda (p. ej. ARS) al saldo en
// USD de la cotización sin mezclar totales de monedas distintas.

import { mesDeISO, hoyISO, nuevoId, formatearMonto } from './calendarioService';
import { normalizarServicios, SECCION_LABEL } from './serviciosService';

export const MONEDAS_COBRO = ['USD', 'ARS', 'EUR'];
export const MEDIOS_COBRO = [
  'Transferencia',
  'Efectivo',
  'Tarjeta',
  'Cheque',
  'Mercado Pago',
  'Depósito',
  'Otro'
];

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

/* ------------------------------------------------------------------ */
/* Servicios de una cotización (para pagos por servicio)               */
/* ------------------------------------------------------------------ */

/** Servicios con precio de venta de una cotización, listos para imputar pagos. */
export function serviciosDeCotizacion(cotizacion = {}) {
  const items = normalizarServicios(cotizacion?.servicios, {
    pax: Number(cotizacion?.pax) || 1
  });
  const moneda = cotizacion?.moneda || 'USD';
  return (items || [])
    .filter((item) => item && item.activo !== false)
    .map((item) => {
      const etiquetaTipo = SECCION_LABEL[item.tipo] || item.tipo || 'Servicio';
      return {
        itemId: item.id || '',
        tipo: item.tipo || 'extra',
        etiquetaTipo,
        nombre: item.nombre || etiquetaTipo,
        concepto: `${etiquetaTipo} · ${item.nombre || etiquetaTipo}`,
        monto: Number(item.precioVenta) || 0,
        moneda,
        cotizacionId: cotizacion?.id || ''
      };
    })
    .filter((servicio) => servicio.monto > 0);
}

/** Todos los servicios con saldo de los viajes de un cliente. */
export function serviciosPendientesDeCliente(cotizaciones = [], cliente = '') {
  const lista = [];
  (cotizaciones || []).forEach((quote) => {
    if (!quote || (quote.cliente || 'Sin cliente') !== cliente) return;
    serviciosDeCotizacion(quote).forEach((servicio) => lista.push(servicio));
  });
  return lista;
}

/* ------------------------------------------------------------------ */
/* Pagos de clientes: normalización, aplicaciones e imputación         */
/* ------------------------------------------------------------------ */

/** Normaliza un pago histórico al modelo actual sin perder información. */
export function normalizarPagoCliente(pago = {}) {
  const aplicaciones = aplicacionesDePago(pago).map((a) => ({
    cotizacionId: a?.cotizacionId || '',
    itemId: a?.itemId || '',
    concepto: a?.concepto || '',
    monto: Number(a?.monto) || 0,
    moneda: a?.moneda || pago.moneda || 'USD',
    equivalente: Number(a?.equivalente) || 0,
    descripcion: a?.descripcion || ''
  }));

  return {
    id: pago.id || '',
    cliente: pago.cliente || 'Sin cliente',
    cotizacionId: pago.cotizacionId || '',
    itemId: pago.itemId || '',
    monto: Number(pago.monto) || 0,
    moneda: pago.moneda || 'USD',
    equivalente: Number(pago.equivalente) || 0,
    fecha: pago.fecha || hoyISO(),
    medio: pago.medio || 'Transferencia',
    numeroOperacion: pago.numeroOperacion || '',
    nota: pago.nota || '',
    enCaja: pago.enCaja !== false,
    tipo: pago.tipo || (aplicaciones.length ? 'servicios' : pago.cotizacionId ? 'paquete' : 'general'),
    aplicaciones,
    createdAt: pago.createdAt || ''
  };
}

/** Aplicaciones de un pago, con compatibilidad con pagos históricos. */
export function aplicacionesDePago(pago = {}) {
  if (Array.isArray(pago.aplicaciones) && pago.aplicaciones.length > 0) {
    return pago.aplicaciones;
  }
  if (pago.cotizacionId) {
    return [{
      cotizacionId: pago.cotizacionId,
      itemId: pago.itemId || '',
      concepto: 'Pago de paquete',
      monto: Number(pago.monto) || 0,
      moneda: pago.moneda || 'USD',
      equivalente: 0,
      descripcion: pago.nota || ''
    }];
  }
  return [];
}

/** Imputa los pagos a las cotizaciones correspondientes. */
export function imputarPagosPorViaje(cobros = [], pagosClientes = []) {
  const lista = (cobros || []).map((c) => ({
    ...c,
    pagado: 0,
    saldo: Number(c.montoTotal) || 0,
    estado: 'Pendiente',
    aplicacionesPago: []
  }));

  const registrarAplicacion = (target, aplicacion, pago, montoImputado) => {
    target.pagado += montoImputado;
    target.aplicacionesPago.push({
      pagoId: pago.id || '',
      fecha: pago.fecha || '',
      medio: pago.medio || '',
      numeroOperacion: pago.numeroOperacion || '',
      nota: pago.nota || '',
      concepto: aplicacion.concepto || 'Pago',
      itemId: aplicacion.itemId || '',
      moneda: aplicacion.moneda || pago.moneda || target.moneda,
      monto: Number(aplicacion.monto) || 0,
      equivalente: Number(aplicacion.equivalente) || 0,
      montoImputado
    });
  };

  (pagosClientes || []).forEach((pago) => {
    const aplicaciones = aplicacionesDePago(pago);
    aplicaciones.forEach((aplicacion) => {
      if (!aplicacion.cotizacionId) return;
      const target = lista.find(
        (c) => c.cotizacionId === aplicacion.cotizacionId || c.clave === aplicacion.cotizacionId
      );
      if (!target) return;

      const monedaAplicacion = aplicacion.moneda || pago.moneda || target.moneda;
      let montoImputado = Number(aplicacion.equivalente) || 0;
      if (montoImputado <= 0 && monedaAplicacion === target.moneda) {
        montoImputado = Number(aplicacion.monto) || 0;
      }
      // Moneda distinta sin equivalente: no se imputa al saldo (sólo historial).
      if (montoImputado <= 0) return;
      registrarAplicacion(target, aplicacion, pago, montoImputado);
    });
  });

  // Pagos generales (sin aplicaciones): distribución FIFO por fecha de viaje.
  const pagosGenerales = (pagosClientes || []).filter((p) => aplicacionesDePago(p).length === 0);
  const porCliente = new Map();
  pagosGenerales.forEach((p) => {
    const cli = p.cliente || 'Sin cliente';
    if (!porCliente.has(cli)) porCliente.set(cli, []);
    porCliente.get(cli).push(p);
  });

  porCliente.forEach((pagos, cliente) => {
    const viajesCliente = lista
      .filter((c) => (c.cliente || 'Sin cliente') === cliente)
      .sort((a, b) => String(a.fechaReferencia || '').localeCompare(String(b.fechaReferencia || '')));
    pagos.forEach((pago) => {
      // Igual que en los pagos de paquete/servicio: el equivalente manda y, si no
      // hay equivalente, sólo imputa cuando la moneda coincide con la del viaje.
      // Así un pago general en ARS no se contamina como si fuera USD.
      const equivalente = Number(pago.equivalente) || 0;
      const monedaPago = pago.moneda || 'USD';
      let restante = equivalente > 0
        ? equivalente
        : (monedaPago === 'USD' ? Number(pago.monto) || 0 : 0);
      if (restante <= 0) return;
      viajesCliente.forEach((viaje) => {
        if (restante <= 0) return;
        const monedaViaje = viaje.moneda || 'USD';
        // Sin equivalente: misma moneda. Con equivalente: el importe ya está
        // convertido a la moneda del viaje, por eso se aplica a otra moneda.
        if (equivalente > 0 ? monedaViaje === monedaPago : monedaViaje !== monedaPago) return;
        const cupo = Math.max((Number(viaje.montoTotal) || 0) - viaje.pagado, 0);
        const aplicado = Math.min(restante, cupo);
        if (aplicado <= 0) return;
        registrarAplicacion(
          viaje,
          { concepto: 'Pago general a cuenta', monto: aplicado, moneda: monedaPago, itemId: '' },
          pago,
          aplicado
        );
        restante -= aplicado;
      });
    });
  });

  lista.forEach((c) => {
    const total = Number(c.montoTotal) || 0;
    const pagado = Math.min(c.pagado, total);
    c.pagado = pagado;
    c.saldo = Math.max(total - pagado, 0);
    if (c.saldo <= 0.005 && total > 0) c.estado = 'Cobrado';
    else if (pagado > 0.005) c.estado = 'Pago parcial';
    else c.estado = 'Pendiente';
  });

  return lista;
}

/* ------------------------------------------------------------------ */
/* Análisis del registro de cobro (preview inteligente del modal)        */
/* ------------------------------------------------------------------ */

/**
 * Construye los registros de pago a partir del borrador del formulario.
 * Es la ÚNICA fuente de verdad: lo que muestra el análisis es exactamente lo
 * que se guarda, porque el modal y la vista usan esta misma función.
 */
export function construirPagosDesdeBorrador(borrador = {}) {
  const {
    cliente, tipo, cotizacionId, monto, moneda, equivalente,
    fecha, medio, numeroOperacion, nota, enCaja, lineasServicio = []
  } = borrador;
  const grupoPagoId = nuevoId('GRUPO');
  const datosComunes = {
    fecha: fecha || hoyISO(),
    medio: medio || 'Transferencia',
    numeroOperacion: String(numeroOperacion || '').trim(),
    nota: String(nota || '').trim(),
    enCaja: enCaja !== false,
    createdAt: new Date().toISOString(),
    grupoPagoId
  };

  if (tipo === 'servicios') {
    return (lineasServicio || [])
      .filter((l) => (Number(l?.monto) || 0) > 0)
      .map((l) => {
        const lineaMoneda = l.moneda || moneda || 'USD';
        return {
          ...datosComunes,
          id: nuevoId('COBRO'),
          cliente: cliente || 'Sin cliente',
          cotizacionId: '',
          itemId: l.itemId || '',
          monto: Number(l.monto) || 0,
          moneda: lineaMoneda,
          equivalente: Number(l.equivalente) || 0,
          tipo: 'servicios',
          aplicaciones: [{
            cotizacionId: l.cotizacionId || '',
            itemId: l.itemId || '',
            concepto: l.concepto || 'Servicio',
            monto: Number(l.monto) || 0,
            moneda: lineaMoneda,
            equivalente: Number(l.equivalente) || 0,
            descripcion: l.descripcion || datosComunes.nota
          }]
        };
      });
  }

  const esPaquete = tipo === 'paquete';
  return [{
    ...datosComunes,
    id: nuevoId('COBRO'),
    cliente: cliente || 'Sin cliente',
    cotizacionId: esPaquete ? (cotizacionId || '') : '',
    monto: Number(monto) || 0,
    moneda: moneda || 'USD',
    equivalente: Number(equivalente) || 0,
    tipo: tipo || 'general',
    aplicaciones: esPaquete && cotizacionId ? [{
      cotizacionId,
      itemId: '',
      concepto: 'Pago de paquete',
      monto: Number(monto) || 0,
      moneda: moneda || 'USD',
      equivalente: Number(equivalente) || 0,
      descripcion: datosComunes.nota
    }] : []
  }];
}

/**
 * Simula el cobro antes de guardarlo y devuelve el impacto proyectado sobre los
 * viajes del cliente, con alertas de sobrepago, moneda sin equivalente, etc.
 * Reutiliza `imputarPagosPorViaje` para que la proyección coincida con el
 * resultado real: si el preview dice que imputa X, al guardar imputa X.
 */
export function analizarRegistroCobro(borrador = {}, contexto = {}) {
  const { cobros = [], pagosClientes = [], cotizaciones = [] } = contexto;
  const cliente = borrador.cliente || 'Sin cliente';
  const pagos = construirPagosDesdeBorrador(borrador);

  const base = imputarPagosPorViaje(cobros, pagosClientes);
  const proyectado = imputarPagosPorViaje(
    cobros,
    pagos.length ? [...pagosClientes, ...pagos] : pagosClientes
  );

  const viajesBase = base.filter((c) => (c.cliente || 'Sin cliente') === cliente);
  const impacto = viajesBase
    .map((c) => {
      const despues = proyectado.find((x) => x.cotizacionId === c.cotizacionId);
      const delta = (Number(despues?.pagado) || 0) - (Number(c.pagado) || 0);
      return {
        cotizacionId: c.cotizacionId,
        concepto: c.concepto,
        moneda: c.moneda || 'USD',
        total: Number(c.montoTotal) || 0,
        pagado: Number(c.pagado) || 0,
        saldo: Number(c.saldo) || 0,
        saldoProyectado: Math.max(Number(despues?.saldo) || 0, 0),
        delta
      };
    })
    .filter((v) => Math.abs(v.delta) > 0.001);

  const totalImputado = impacto.reduce((a, v) => a + v.delta, 0);
  const montoRegistrado = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const monedasRegistradas = [...new Set(pagos.map((p) => p.moneda || 'USD'))];
  const viajeElegido = borrador.tipo === 'paquete'
    ? base.find((c) => c.cotizacionId === borrador.cotizacionId)
    : null;
  // El resumen siempre se muestra en la moneda de la DEUDA (no en la del pago),
  // para que un pago en ARS con equivalente USD no pinte la cifra como ARS.
  const monedaAnalisis = viajeElegido?.moneda || viajesBase[0]?.moneda || 'USD';
  // Monto ya expresado en la moneda de la deuda: usa el equivalente cuando el
  // pago se hizo en otra moneda; si no, sólo cuenta la misma moneda.
  const montoAImputar = pagos.reduce((a, p) => {
    const equivalente = Number(p.equivalente) || 0;
    if (equivalente > 0) return a + equivalente;
    return (p.moneda || 'USD') === monedaAnalisis ? a + (Number(p.monto) || 0) : a;
  }, 0);
  const viajesMoneda = viajesBase.filter((c) => (c.moneda || 'USD') === monedaAnalisis);
  const resumenCliente = {
    moneda: monedaAnalisis,
    total: viajesMoneda.reduce((a, c) => a + (Number(c.montoTotal) || 0), 0),
    pagado: viajesMoneda.reduce((a, c) => a + (Number(c.pagado) || 0), 0),
    saldo: viajesMoneda.reduce((a, c) => a + Math.max(Number(c.saldo) || 0, 0), 0)
  };

  const advertencias = [];
  const agregar = (nivel, texto) => advertencias.push({ nivel, texto });
  const textoMoneda = (moneda) => moneda || 'USD';

  if (!borrador.cliente) {
    agregar('info', 'Elegí un cliente para ver el análisis del cobro.');
  }
  if (borrador.tipo !== 'servicios' && !(Number(borrador.monto) > 0)) {
    agregar('info', 'Ingresá un monto mayor a cero para proyectar la imputación.');
  }
  if (borrador.tipo === 'servicios' && pagos.length === 0) {
    agregar('info', 'Agregá al menos un servicio con monto para proyectar la imputación.');
  }

  if (borrador.tipo === 'paquete') {
    const viaje = base.find((c) => c.cotizacionId === borrador.cotizacionId);
    if (!viaje) {
      agregar('warning', 'Elegí el viaje que cubre este pago.');
    } else {
      const monto = Number(borrador.monto) || 0;
      const saldo = Number(viaje.saldo) || 0;
      if (monto > saldo + 0.005) {
        agregar(
          'warning',
          `El pago supera el saldo del viaje por ${formatearMonto(monto - saldo, viaje.moneda)}. El excedente no reduce deudas.`
        );
      }
      if (textoMoneda(borrador.moneda) !== textoMoneda(viaje.moneda) && !(Number(borrador.equivalente) > 0)) {
        agregar(
          'danger',
          `Pagaste en ${textoMoneda(borrador.moneda)} pero no cargaste el equivalente en ${textoMoneda(viaje.moneda)}: este pago no se imputará.`
        );
      }
    }
  }

  if (borrador.tipo === 'general') {
    const monedaPrincipal = viajesBase[0]?.moneda || 'USD';
    if (textoMoneda(borrador.moneda) !== textoMoneda(monedaPrincipal) && !(Number(borrador.equivalente) > 0)) {
      agregar(
        'danger',
        `Pagaste en ${textoMoneda(borrador.moneda)} pero no cargaste el equivalente en ${textoMoneda(monedaPrincipal)}: el pago no se imputará.`
      );
    }
    if (viajesBase.length > 0 && viajesBase.every((c) => (Number(c.saldo) || 0) <= 0.005)) {
      agregar('info', 'El cliente no tiene saldo pendiente: el pago quedará sólo en el historial.');
    }
  }

  if (borrador.tipo === 'servicios') {
    const claves = (borrador.lineasServicio || [])
      .filter((l) => (Number(l?.monto) || 0) > 0)
      .map((l) => `${l.cotizacionId}::${l.itemId}`);
    if (new Set(claves).size !== claves.length) {
      agregar('warning', 'Hay servicios repetidos en el detalle: revisá las líneas antes de guardar.');
    }
    const serviciosValidos = new Map();
    cotizaciones.forEach((quote) => {
      serviciosDeCotizacion(quote).forEach((s) => serviciosValidos.set(`${s.cotizacionId}::${s.itemId}`, s));
    });
    (borrador.lineasServicio || []).forEach((l) => {
      const permitido = serviciosValidos.get(`${l.cotizacionId}::${l.itemId}`);
      if (permitido && (Number(l.monto) || 0) > (Number(permitido.monto) || 0) + 0.005) {
        agregar(
          'warning',
          `${permitido.concepto}: cargaste más que el precio del servicio (${formatearMonto(permitido.monto, permitido.moneda)}).`
        );
      }
    });
  }

  if (
    pagos.length > 0 &&
    montoAImputar - totalImputado > 0.005 &&
    !advertencias.some((a) => a.nivel === 'warning' || a.nivel === 'danger')
  ) {
    agregar(
      'info',
      `Quedarían ${formatearMonto(montoAImputar - totalImputado, monedaAnalisis)} sin destino; se guardan en el historial pero no reducen saldos.`
    );
  }

  const nivel = advertencias.some((a) => a.nivel === 'danger')
    ? 'danger'
    : advertencias.some((a) => a.nivel === 'warning')
      ? 'warning'
      : advertencias.some((a) => a.nivel === 'info')
        ? 'info'
        : 'ok';

  return {
    cliente,
    pagos,
    impacto,
    totalImputado,
    montoRegistrado,
    monedasRegistradas,
    resumenCliente,
    advertencias,
    nivel,
    listoParaGuardar: pagos.length > 0 && !advertencias.some((a) => a.nivel === 'danger')
  };
}

/** Caja por cliente: agrupa los cobros por cliente y, dentro de cada cliente, por viaje. */
export function cajaPorCliente(cobros = [], pagosClientes = []) {
  const clientes = new Map();
  (cobros || []).forEach((c) => {
    const cli = c.cliente || 'Sin cliente';
    if (!clientes.has(cli)) {
      clientes.set(cli, {
        cliente: cli,
        viajes: [],
        total: 0,
        cobrado: 0,
        saldo: 0
      });
    }
    const caja = clientes.get(cli);
    caja.viajes.push({
      cotizacionId: c.cotizacionId || '',
      concepto: c.concepto || '',
      fechaViajeInicio: c.fechaReferencia || '',
      moneda: c.moneda || 'USD',
      montoTotal: Number(c.montoTotal) || 0,
      saldo: Math.max(Number(c.saldo) || 0, 0),
      estado: c.estado || ''
    });
    caja.total += Number(c.montoTotal) || 0;
  });

  clientes.forEach((caja, cli) => {
    const pagos = (pagosClientes || []).filter((p) => p.cliente === cli);
    caja.cobrado = pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
    caja.saldo = Math.max(caja.total - caja.cobrado, 0);
    caja.cantidadViajes = caja.viajes.length;
  });

  return [...clientes.values()].sort((a, b) =>
    String(a.cliente).localeCompare(String(b.cliente))
  );
}

/** Semaforización: estado operativo y badge CSS sugerido. */
export function estadoSemaforo(cobro, { diasProximo = 7 } = {}) {
  const saldo = Number(cobro?.saldo) || 0;
  const pagado = Number(cobro?.pagado) || 0;
  const total = Number(cobro?.montoTotal) || 0;
  const fechaViaje = cobro?.fechaReferencia || '';

  if (total <= 0) {
    return { status: 'sin-datos', label: 'Sin datos', badge: 'badge-neutral', color: 'var(--text-muted)' };
  }
  if (saldo <= 0.005) {
    return { status: 'cobrado', label: 'Cobrado', badge: 'badge-success', color: 'var(--success)' };
  }
  if (pagado > 0.005) {
    return { status: 'parcial', label: 'Pago parcial', badge: 'badge-warning', color: 'var(--warning)' };
  }

  let diasRestantes = null;
  if (fechaViaje) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const d = new Date(fechaViaje);
    if (!isNaN(d.getTime())) {
      diasRestantes = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
    }
  }

  if (diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= diasProximo) {
    return { status: 'urgente', label: `Viaje en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`, badge: 'badge-danger', color: 'var(--danger)' };
  }
  if (diasRestantes !== null && diasRestantes < 0) {
    return { status: 'vencido', label: 'Vencido', badge: 'badge-danger', color: 'var(--danger)' };
  }
  return { status: 'pendiente', label: 'Pendiente', badge: 'badge-info', color: 'var(--primary)' };
}

/** Lista de viajes con saldo pendiente que inician dentro de `dias` días. */
export function viajesProximosConSaldo(cobros = [], dias = 14) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + dias);

  return (cobros || [])
    .filter((c) => (Number(c.saldo) || 0) > 0.005 && c.fechaReferencia)
    .map((c) => {
      const d = new Date(c.fechaReferencia);
      const diasRestantes = isNaN(d.getTime()) ? null : Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
      return { ...c, diasRestantes };
    })
    .filter((c) => c.diasRestantes !== null && c.diasRestantes >= 0 && c.diasRestantes <= dias)
    .sort((a, b) => (a.diasRestantes || 0) - (b.diasRestantes || 0));
}

/** Resumen financiero para KPIs de cobranzas. */
export function resumenFinanciero(cobros = [], pagosClientes = []) {
  const lista = imputarPagosPorViaje(cobros, pagosClientes);
  let totalCartera = 0;
  let cobrado = 0;
  let aCobrar = 0;
  let cantidadPendientes = 0;
  let cantidadCobradas = 0;
  let cantidadParciales = 0;

  lista.forEach((c) => {
    totalCartera += Number(c.montoTotal) || 0;
    cobrado += Number(c.pagado) || 0;
    aCobrar += Math.max(Number(c.saldo) || 0, 0);
    if ((Number(c.saldo) || 0) > 0.005) {
      if ((Number(c.pagado) || 0) > 0.005) cantidadParciales += 1;
      else cantidadPendientes += 1;
    } else {
      cantidadCobradas += 1;
    }
  });

  const ingresosRegistrados = (pagosClientes || []).reduce((a, p) => a + (Number(p.monto) || 0), 0);

  return {
    totalCartera,
    cobrado,
    aCobrar,
    cantidadPendientes,
    cantidadCobradas,
    cantidadParciales,
    ingresosRegistrados,
    cantidadViajes: lista.length
  };
}

/* ------------------------------------------------------------------ */
/* Agenda de cobro (semana / mes / todos)                              */
/* ------------------------------------------------------------------ */

function aISO(localDate) {
  const y = localDate.getFullYear();
  const m = String(localDate.getMonth() + 1).padStart(2, '0');
  const d = String(localDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fechaDesdeISO(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Lunes de la semana de la fecha indicada. */
export function inicioSemanaISO(fechaISO = hoyISO()) {
  const d = fechaDesdeISO(fechaISO);
  if (!d) return '';
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
  return aISO(d);
}

/** Domingo de la semana de la fecha indicada. */
export function finSemanaISO(fechaISO = hoyISO()) {
  const inicio = inicioSemanaISO(fechaISO);
  const d = fechaDesdeISO(inicio);
  if (!d) return '';
  d.setDate(d.getDate() + 6);
  return aISO(d);
}

/** Primer día del mes de la fecha indicada. */
export function inicioMesISO(fechaISO = hoyISO()) {
  return fechaISO ? `${String(fechaISO).slice(0, 7)}-01` : '';
}

/** Último día del mes de la fecha indicada. */
export function finMesISO(fechaISO = hoyISO()) {
  const d = fechaDesdeISO(fechaISO);
  if (!d) return '';
  return aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Rango inclusivo [inicio, fin] para la agenda. */
export function rangoAgenda(tipo = 'mes', fechaISO = hoyISO()) {
  switch (tipo) {
    case 'semana':
      return { inicio: inicioSemanaISO(fechaISO), fin: finSemanaISO(fechaISO), etiqueta: 'semana' };
    case 'todos':
      return { inicio: '', fin: '', etiqueta: 'todos los viajes' };
    case 'mes':
    default:
      return { inicio: inicioMesISO(fechaISO), fin: finMesISO(fechaISO), etiqueta: 'mes' };
  }
}

/** Estado operativo agrupado para filtros: cobrado, parcial, pendiente, vencido. */
export function estadoCobroSimple(cobro, hoy = hoyISO()) {
  const sem = estadoSemaforo(cobro);
  if (sem.status === 'cobrado') return 'cobrado';
  if (sem.status === 'parcial') return 'parcial';
  if (sem.status === 'vencido') return 'vencido';
  const fecha = cobro?.fechaReferencia || '';
  if (fecha && hoy && fecha < hoy) return 'vencido';
  return 'pendiente';
}

/**
 * Filtra y ordena los cobros para la agenda de cobranza.
 * @param {Array} cobros cobros ya imputados (con saldo/pagado calculados).
 * @param {Object} opciones { rango, fecha, cliente, moneda, estado, destino, orden }
 */
export function cobrosParaAgenda(cobros = [], opciones = {}) {
  const {
    rango = 'mes',
    fecha = hoyISO(),
    cliente = '',
    moneda = '',
    estado = '',
    destino = '',
    orden = 'fecha'
  } = opciones;

  const rangoFechas = rangoAgenda(rango, fecha);
  const destinoBuscado = String(destino || '').trim().toLowerCase();

  const lista = (cobros || []).filter((c) => {
    const fechaCobro = c.fechaReferencia || '';
    if (rangoFechas.inicio && (!fechaCobro || fechaCobro < rangoFechas.inicio)) return false;
    if (rangoFechas.fin && fechaCobro > rangoFechas.fin) return false;
    if (cliente && (c.cliente || 'Sin cliente') !== cliente) return false;
    if (moneda && (c.moneda || 'USD') !== moneda) return false;
    if (estado && estadoCobroSimple(c, fecha) !== estado) return false;
    if (destinoBuscado && !String(c.concepto || '').toLowerCase().includes(destinoBuscado)) return false;
    return true;
  });

  const comparadores = {
    fecha: (a, b) =>
      String(a.fechaReferencia || '9999').localeCompare(String(b.fechaReferencia || '9999')) ||
      String(a.cliente || '').localeCompare(String(b.cliente || '')),
    valor: (a, b) => (Number(b.saldo) || 0) - (Number(a.saldo) || 0),
    destino: (a, b) => String(a.concepto || '').localeCompare(String(b.concepto || '')),
    cliente: (a, b) =>
      String(a.cliente || '').localeCompare(String(b.cliente || '')) ||
      String(a.fechaReferencia || '').localeCompare(String(b.fechaReferencia || ''))
  };

  return [...lista].sort(comparadores[orden] || comparadores.fecha);
}

/** Agrupa cobros por fecha de referencia, con total de saldo por día. */
export function agruparCobrosPorFecha(cobros = []) {
  const mapa = new Map();
  (cobros || []).forEach((c) => {
    const fecha = c.fechaReferencia || 'sin-fecha';
    if (!mapa.has(fecha)) mapa.set(fecha, { fecha, items: [], saldo: 0, cantidad: 0 });
    const grupo = mapa.get(fecha);
    grupo.items.push(c);
    grupo.saldo += Math.max(Number(c.saldo) || 0, 0);
    grupo.cantidad += 1;
  });
  return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ------------------------------------------------------------------ */
/* Historial de pagos por cliente                                      */
/* ------------------------------------------------------------------ */

/** Pagos de un cliente, ordenados por fecha (más recientes primero). */
export function historialPagosPorCliente(pagosClientes = [], cliente = '') {
  return (pagosClientes || [])
    .filter((p) => (p?.cliente || 'Sin cliente') === cliente)
    .map(normalizarPagoCliente)
    .sort((a, b) => {
      const porFecha = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      if (porFecha !== 0) return porFecha;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
}

/** Totales de pagos por moneda (nunca suma monedas distintas). */
export function totalesPagosPorMoneda(pagos = []) {
  const totales = {};
  (pagos || []).forEach((p) => {
    const moneda = p?.moneda || 'USD';
    totales[moneda] = (totales[moneda] || 0) + (Number(p?.monto) || 0);
  });
  return totales;
}

/* ------------------------------------------------------------------ */
/* Exportación                                                         */
/* ------------------------------------------------------------------ */

/** CSV del detalle de cobros a clientes. */
export function generarCSVCobros(cobros = [], pagosClientes = []) {
  const lista = imputarPagosPorViaje(cobros, pagosClientes);
  const sep = ';';
  const header = ['Cliente', 'Cotización', 'Viaje', 'Inicio viaje', 'Pax', 'Moneda', 'Total venta', 'Cobrado', 'Saldo', 'Estado'].join(sep);
  const rows = lista.map((c) => [
    c.cliente || '',
    c.cotizacionId || '',
    (c.concepto || '').replace(/;/g, ','),
    c.fechaReferencia || '',
    c.pax || 0,
    c.moneda || 'USD',
    Number(c.montoTotal || 0).toFixed(2),
    Number(c.pagado || 0).toFixed(2),
    Number(c.saldo || 0).toFixed(2),
    c.estado || ''
  ].join(sep));
  return [header, ...rows].join('\n');
}

/** CSV del historial de pagos, con una fila por aplicación. */
export function generarCSVPagosClientes(pagosClientes = []) {
  const sep = ';';
  const header = [
    'Fecha', 'Cliente', 'Número operación', 'Medio', 'Tipo', 'Concepto',
    'Item', 'Monto', 'Moneda', 'Equivalente imputado', 'En caja', 'Nota'
  ].join(sep);

  const rows = [];
  (pagosClientes || []).forEach((pagoRaw) => {
    const pago = normalizarPagoCliente(pagoRaw);
    const aplicaciones = aplicacionesDePago(pago);
    if (aplicaciones.length === 0) {
      aplicaciones.push({
        cotizacionId: '', itemId: '', concepto: 'Pago general',
        monto: pago.monto, moneda: pago.moneda, equivalente: 0, descripcion: pago.nota
      });
    }
    aplicaciones.forEach((a) => {
      rows.push([
        pago.fecha,
        pago.cliente,
        pago.numeroOperacion || '',
        pago.medio || '',
        pago.tipo || '',
        (a.concepto || '').replace(/;/g, ','),
        a.itemId || '',
        Number(a.monto || 0).toFixed(2),
        a.moneda || pago.moneda,
        Number(a.equivalente || 0).toFixed(2),
        pago.enCaja ? 'Sí' : 'No',
        (a.descripcion || pago.nota || '').replace(/;/g, ',')
      ].join(sep));
    });
  });

  return [header, ...rows].join('\n');
}
