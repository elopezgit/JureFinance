// StepServicios.jsx - Paso 2: servicios del presupuesto, costos separados por proveedor
// (Proveedor 1 Aero vs Proveedor 2 Azabache Constructor PDF) y vencimientos automáticos.
//
// Flujo real de JureTravel:
//   1. Proveedor 1 (Aero): se consulta y compra el vuelo al costo real más barato.
//      Cuando está Emitido (= Confirmado por JureTravel), se paga a las 24-48 hs posteriores.
//   2. Proveedor 2 (Azabache): se cotiza vuelo (más caro, referencia) + hotel + traslado.
//      Desde el constructor de PDF de Azabache (aplicando un % opcional) sale el precio
//      final enviado al cliente. Los servicios reservados en Azabache (hotel, traslado, etc.)
//      se pagan según la grilla de Configuración Mensual (ej. reservados del 1-5 -> día 20).
import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Plane,
  Hotel,
  Car,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Building2,
  AlertCircle,
  TrendingUp,
  CalendarClock,
  FileText,
  Percent
} from 'lucide-react';
import {
  SECCION_LABEL,
  createEmptyItem,
  createEmptyOferta,
  createEmptyTramo,
  generarDescripcionItinerario,
  costoCompraItem,
  costoBasePresupuestoItem,
  ahorroArbitrajeItem,
  precioVentaItem,
  gananciaItem,
  ofertaCompraDe,
  ofertaBasePresupuestoDe,
  desgloseCostosPorProveedor,
  totalCostoItems,
  totalCostoBasePresupuestoItems,
  totalAhorroArbitrajeItems,
  totalVentaItems,
  totalGananciaItems,
  redondear,
  formatoMoneda,
  formatoPct
} from '../wizardUtils';
import { getBloqueBCP, getFechaPagoAereoEmitido } from '../../../../services/ttoService';
import { formatFechaLarga } from '../../../../services/calendarioService';

const TIPOS_ORDEN = ['aereo', 'hotel', 'traslados', 'asistencia', 'extra'];

const ESTILO_POR_TIPO = {
  aereo: { Icono: Plane, label: 'Vuelo', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.28)' },
  hotel: { Icono: Hotel, label: 'Hotel', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.28)' },
  traslados: { Icono: Car, label: 'Traslado', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)', border: 'rgba(167, 139, 250, 0.28)' },
  asistencia: { Icono: ShieldCheck, label: 'Asistencia', color: '#34d399', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.28)' },
  extra: { Icono: Sparkles, label: 'Extra', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.28)' }
};

const PLACEHOLDER_NOMBRE = {
  aereo: 'Ej: Vuelo TUC → CUN ida y vuelta',
  hotel: 'Ej: Hotel Riu Palace - 7 noches All Inclusive',
  traslados: 'Ej: Traslado aeropuerto / hotel / aeropuerto',
  asistencia: 'Ej: Asistencia al viajero 30 días',
  extra: 'Ej: Excursión a Isla Mujeres'
};

export default function StepServicios({
  items = [],
  setItems,
  operadoresList = [],
  proveedoresActivos = [],
  pax,
  moneda,
  fechaCotizacion,
  configMensual = []
}) {
  const paxCount = Math.max(1, Number(pax) || 1);
  const [markupGlobalPct, setMarkupGlobalPct] = useState(20);

  /** Proveedores disponibles para cargar ofertas (los seleccionados en paso 1 o todos) */
  const proveedoresDisponibles = useMemo(() => {
    const filtrados = (operadoresList || []).filter((op) => proveedoresActivos.includes(op.id));
    return filtrados.length > 0 ? filtrados : operadoresList || [];
  }, [operadoresList, proveedoresActivos]);

  const proveedorDefault = proveedoresDisponibles[0] || operadoresList[0] || null;

  /* ------------------------- Operaciones sobre el estado ------------------------ */

  const actualizarServicio = (id, fn) => {
    setItems((prev) => prev.map((servicio) => (servicio.id === id ? fn(servicio) : servicio)));
  };

  const agregarServicio = (tipo) => {
    const nuevo = createEmptyItem(tipo, {
      proveedorId: proveedorDefault?.id || '',
      proveedor: proveedorDefault?.nombre || '',
      fechaReserva: fechaCotizacion || ''
    });
    setItems((prev) => [...prev, nuevo]);
  };

  /** Carga rápida de la estructura típica: Vuelo (Aero + Azabache) + Hotel (Azabache) + Traslado (Azabache) */
  const cargarPlantillaPaquete = () => {
    const fechaBase = fechaCotizacion || new Date().toISOString().split('T')[0];
    const nuevos = [
      createEmptyItem('aereo', { fechaReserva: fechaBase }),
      createEmptyItem('hotel', { proveedorId: 'azabache', proveedor: 'Azabache', fechaReserva: fechaBase }),
      createEmptyItem('traslados', { proveedorId: 'azabache', proveedor: 'Azabache', fechaReserva: fechaBase })
    ];
    setItems((prev) => [...prev, ...nuevos]);
  };

  /** Aplica un % de aumento sobre el costo base del Constructor PDF (Azabache) para calcular el precio al cliente */
  const aplicarMarkupGlobalSobreBase = () => {
    const factor = 1 + (Number(markupGlobalPct) || 0) / 100;
    setItems((prev) =>
      prev.map((srv) => {
        if (!srv.activo) return srv;
        const costoBase = costoBasePresupuestoItem(srv);
        if (costoBase <= 0) return srv;
        return {
          ...srv,
          markupPct: redondear(Number(markupGlobalPct) || 0),
          precioVenta: redondear(costoBase * factor)
        };
      })
    );
  };

  const eliminarServicio = (id) => {
    setItems((prev) => prev.filter((servicio) => servicio.id !== id));
  };

  const alternarServicio = (id) => {
    actualizarServicio(id, (servicio) => ({ ...servicio, activo: !servicio.activo }));
  };

  const actualizarOferta = (servicioId, ofertaId, patch) => {
    actualizarServicio(servicioId, (servicio) => ({
      ...servicio,
      ofertas: (servicio.ofertas || []).map((oferta) =>
        oferta.id === ofertaId ? { ...oferta, ...patch } : oferta
      )
    }));
  };

  const marcarOfertaBasePresupuesto = (servicioId, ofertaId) => {
    actualizarServicio(servicioId, (servicio) => ({
      ...servicio,
      ofertas: (servicio.ofertas || []).map((oferta) => ({
        ...oferta,
        esBasePresupuesto: oferta.id === ofertaId
      }))
    }));
  };

  const agregarOferta = (servicio) => {
    const proveedor = proveedorDefault;
    const oferta = createEmptyOferta({
      proveedorId: proveedor?.id || '',
      proveedor: proveedor?.nombre || ''
    });

    actualizarServicio(servicio.id, (prev) => ({
      ...prev,
      ofertas: [...(prev.ofertas || []), oferta],
      ofertaCompraId: prev.ofertaCompraId || oferta.id
    }));
  };

  const eliminarOferta = (servicioId, ofertaId) => {
    actualizarServicio(servicioId, (servicio) => {
      const ofertas = (servicio.ofertas || []).filter((oferta) => oferta.id !== ofertaId);
      return {
        ...servicio,
        ofertas,
        ofertaCompraId:
          servicio.ofertaCompraId === ofertaId
            ? ofertas[0]?.id || ''
            : servicio.ofertaCompraId
      };
    });
  };

  const elegirOfertaCompra = (servicioId, ofertaId) => {
    actualizarServicio(servicioId, (servicio) => ({
      ...servicio,
      ofertaCompraId: ofertaId
    }));
  };

  const cambiarProveedorOferta = (servicioId, ofertaId, proveedorId) => {
    const operador = operadoresList.find((op) => op.id === proveedorId);
    actualizarOferta(servicioId, ofertaId, {
      proveedorId,
      proveedor: operador?.nombre || proveedorId
    });
  };

  /* ------------------------------ Tramos aéreos ------------------------------ */

  const agregarTramo = (servicio) => {
    actualizarServicio(servicio.id, (prev) => ({
      ...prev,
      tramos: [...(prev.tramos || []), createEmptyTramo()]
    }));
  };

  const eliminarTramo = (servicioId, index) => {
    actualizarServicio(servicioId, (prev) => ({
      ...prev,
      tramos: (prev.tramos || []).filter((_, i) => i !== index)
    }));
  };

  const actualizarTramo = (servicioId, index, campo, valor) => {
    actualizarServicio(servicioId, (prev) => {
      const tramos = [...(prev.tramos || [])];
      tramos[index] = { ...tramos[index], [campo]: valor };
      return { ...prev, tramos };
    });
  };

  /* ------------------------ Cálculo de vencimiento en vivo ----------------------- */

  const calcularInfoVencimiento = (servicio) => {
    const compra = ofertaCompraDe(servicio);
    if (!compra) return { fecha: '', etiqueta: 'Sin proveedor de compra', origen: 'sin-fecha' };

    if (compra.vencimientoTTOO) {
      return {
        fecha: compra.vencimientoTTOO,
        etiqueta: `Fecha manual fija (${formatFechaLarga(compra.vencimientoTTOO)})`,
        origen: 'manual'
      };
    }

    if (servicio.tipo === 'aereo') {
      const usarBCP = servicio.reglaVencimiento === 'bcp';
      if (!servicio.fechaEmision) {
        return {
          fecha: '',
          etiqueta:
            servicio.estadoVuelo === 'Emitido'
              ? 'Cargá la Fecha de Emisión para calcular las 24-48 hs'
              : 'Al marcar como Emitido (Confirmado), vencerá a las 24-48 hs de la emisión',
          origen: 'pendiente-emision'
        };
      }
      if (!usarBCP) {
        const horas = Number(servicio.plazoPagoHoras) === 24 ? 24 : 48;
        const fecha = getFechaPagoAereoEmitido(servicio.fechaEmision, horas);
        return {
          fecha,
          etiqueta: `Pago a ${compra.proveedor || 'Aero'} en ${horas} hs post-emisión (${formatFechaLarga(fecha)})`,
          origen: '24-48hs'
        };
      }
      const bloque = getBloqueBCP(configMensual, compra.proveedor || 'Aero', servicio.fechaEmision);
      if (bloque) {
        return {
          fecha: bloque.fechaPago,
          etiqueta: `Bloque ${bloque.rangoCorto} → Pago el ${formatFechaLarga(bloque.fechaPago)}`,
          origen: 'bcp'
        };
      }
      return {
        fecha: '',
        etiqueta: 'Sin bloque configurado para ese mes',
        origen: 'sin-config'
      };
    }

    // Servicios terrestres (Hotel, Traslado, Asistencia, Extra) -> Grilla de bloques por Fecha de Reserva
    if (servicio.estadoReserva === 'SinReservar') {
      return {
        fecha: '',
        etiqueta: 'Sin reservar aún (al pasar a Reservado entra en la grilla mensual)',
        origen: 'sin-reservar'
      };
    }

    const fechaRef = servicio.fechaReserva || fechaCotizacion || '';
    if (!fechaRef) {
      return {
        fecha: '',
        etiqueta: 'Cargá la Fecha de Reserva para calcular el bloque de pago (ej. 1-5 → día 20)',
        origen: 'sin-fecha'
      };
    }

    const bloque = getBloqueBCP(configMensual, compra.proveedor || 'Azabache', fechaRef);
    if (bloque) {
      return {
        fecha: bloque.fechaPago,
        etiqueta: `Reservado en bloque ${bloque.rangoCorto} → Se paga a ${compra.proveedor || 'Azabache'} el ${formatFechaLarga(bloque.fechaPago)}`,
        origen: 'bcp',
        bloque
      };
    }

    return {
      fecha: '',
      etiqueta: `Sin bloque configurado en ${compra.proveedor || 'el proveedor'} para ${fechaRef.slice(0, 7)}`,
      origen: 'sin-config'
    };
  };

  /* --------------------------------- Totales -------------------------------- */

  const grupos = TIPOS_ORDEN.map((tipo) => ({
    tipo,
    servicios: items.filter((servicio) => servicio.tipo === tipo)
  }));

  const desgloseProveedores = useMemo(() => desgloseCostosPorProveedor(items), [items]);
  const totalCostoReal = totalCostoItems(items);
  const totalCostoBasePDF = totalCostoBasePresupuestoItems(items);
  const totalAhorroAero = totalAhorroArbitrajeItems(items);
  const totalVentaCliente = totalVentaItems(items);
  const totalGanancia = totalGananciaItems(items);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado y Circuito Aero + Azabache + Cliente */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div className="card-header" style={{ marginBottom: '12px' }}>
          <div className="card-title-group">
            <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--neon-cyan)' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="card-title">Carga de Servicios: Costos por Proveedor y Precio al Cliente</h3>
              <span className="card-subtitle">
                1° Costo de Vuelo en Aero (pago 24-48 hs de emitido) · 2° Costo en Azabache de Vuelo + Hotel + Traslado (pago por grilla 1-5 → día 20) · 3° Precio PDF al Cliente.
              </span>
            </div>
          </div>
          <span className="badge badge-info" style={{ fontWeight: 700, padding: '5px 12px' }}>
            {paxCount} pasajero{paxCount > 1 ? 's' : ''}
          </span>
        </div>

        {/* Barra del Constructor PDF (% de aumento al cliente) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(56, 189, 248, 0.28)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <FileText size={16} color="var(--neon-cyan)" />
            <span style={{ fontSize: '0.84rem', color: '#e2e8f0' }}>
              <strong>Constructor de Presupuesto (Azabache → Cliente):</strong> Costo Base Paquete:{' '}
              <strong className="mono" style={{ color: 'var(--neon-amber)' }}>
                {formatoMoneda(moneda, totalCostoBasePDF)}
              </strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>% aumento al cliente:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '90px' }}>
              <input
                type="number"
                step="0.5"
                min="0"
                className="input-field mono"
                style={{ height: '32px', fontSize: '0.84rem', textAlign: 'right', paddingRight: '8px' }}
                value={markupGlobalPct}
                onChange={(e) => setMarkupGlobalPct(parseFloat(e.target.value) || 0)}
              />
              <Percent size={13} color="var(--neon-cyan)" />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={aplicarMarkupGlobalSobreBase}
              title="Calcula el Precio Venta al Cliente aplicando este % sobre el costo base de Azabache en cada servicio"
            >
              Calcular Precio al Cliente (+{markupGlobalPct || 0}%)
            </button>
            {items.length === 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={cargarPlantillaPaquete}
              >
                + Armar Paquete (Vuelo Aero/Azabache + Hotel + Traslado)
              </button>
            )}
          </div>
        </div>

        {/* Botones de acción rápida para agregar servicios */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          {TIPOS_ORDEN.map((t) => {
            const est = ESTILO_POR_TIPO[t] || ESTILO_POR_TIPO.extra;
            const { Icono } = est;
            return (
              <button
                key={t}
                type="button"
                className="btn btn-sm"
                onClick={() => agregarServicio(t)}
                style={{
                  background: est.bg,
                  color: est.color,
                  border: `1px solid ${est.border}`,
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                <Plus size={13} />
                <Icono size={14} />
                <span>+ {SECCION_LABEL[t] || t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estado inicial limpio cuando aún no se agregaron servicios */}
      {items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <div className="empty-state-icon">
            <Plane size={22} />
          </div>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '6px' }}>Empezá a armar el presupuesto</h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 16px' }}>
            Podés cargar de una vez la estructura completa (Vuelo en Aero/Azabache + Hotel + Traslado) o agregar cada servicio con los botones de arriba.
          </p>
          <button type="button" className="btn btn-primary" onClick={cargarPlantillaPaquete}>
            <Plus size={15} />
            <span>Armar Paquete (Vuelo Aero/Azabache + Hotel + Traslado)</span>
          </button>
        </div>
      )}

      {/* Renderizado únicamente de las categorías que tienen servicios cargados */}
      {grupos
        .filter(({ servicios }) => servicios.length > 0)
        .map(({ tipo, servicios }) => {
        const estilo = ESTILO_POR_TIPO[tipo] || ESTILO_POR_TIPO.extra;
        const { Icono } = estilo;

        return (
          <div key={tipo} className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div className="card-title-group">
                <div className="card-icon" style={{ background: estilo.bg, color: estilo.color, border: `1px solid ${estilo.border}` }}>
                  <Icono size={18} />
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.15rem' }}>{SECCION_LABEL[tipo] || tipo}</h3>
                  <span className="card-subtitle">
                    {tipo === 'aereo'
                      ? 'Cargá el costo en Aero (Compra Real → pago 24-48 hs post-emisión) y el costo en Azabache (Referencia Constructor PDF)'
                      : 'Cargá el costo en Azabache/Proveedor → los reservados del 1-5 vencen el día 20 según la grilla mensual'}
                  </span>
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => agregarServicio(tipo)}
                style={{ gap: '6px' }}
              >
                <Plus size={14} />
                <span>Agregar {tipo === 'aereo' ? 'vuelo' : 'servicio'}</span>
              </button>
            </div>

            {servicios.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  margin: '16px 0 0',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(14, 8, 30, 0.5)',
                  border: '1px dashed rgba(139, 92, 246, 0.25)',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)'
                }}
              >
                No hay {SECCION_LABEL[tipo].toLowerCase()} en esta cotización. Hacé clic en "+ Agregar {tipo === 'aereo' ? 'vuelo' : 'servicio'}" para sumar uno.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                {servicios.map((servicio) => {
                  const ofertas = servicio.ofertas || [];
                  const venta = precioVentaItem(servicio);
                  const costo = costoCompraItem(servicio);
                  const costoBase = costoBasePresupuestoItem(servicio);
                  const ahorro = ahorroArbitrajeItem(servicio);
                  const ganancia = gananciaItem(servicio);
                  const margen = venta > 0 ? (ganancia / venta) * 100 : 0;
                  const compra = ofertaCompraDe(servicio);
                  const basePresup = ofertaBasePresupuestoDe(servicio);
                  const infoVenc = calcularInfoVencimiento(servicio);

                  return (
                    <div
                      key={servicio.id}
                      className={`service-card ${servicio.activo ? 'active' : 'inactive'}`}
                    >
                      {/* 1. Barra Superior del Servicio */}
                      <div className="service-card-topbar">
                        <div className="service-card-left">
                          <input
                            type="checkbox"
                            checked={servicio.activo !== false}
                            onChange={() => alternarServicio(servicio.id)}
                            title="Incluir / excluir este servicio del presupuesto"
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--neon-cyan)' }}
                          />

                          <span
                            className="service-type-badge"
                            style={{
                              background: estilo.bg,
                              color: estilo.color,
                              border: `1px solid ${estilo.border}`
                            }}
                          >
                            <Icono size={13} />
                            {estilo.label}
                          </span>

                          <input
                            type="text"
                            className="service-title-input"
                            placeholder={PLACEHOLDER_NOMBRE[tipo]}
                            value={servicio.nombre || ''}
                            onChange={(e) =>
                              actualizarServicio(servicio.id, (prev) => ({ ...prev, nombre: e.target.value }))
                            }
                          />
                        </div>

                        {/* Métricas en vivo y botón de eliminar */}
                        <div className="service-card-metrics">
                          <span className="service-metric-pill" title="Costo en el proveedor constructor del PDF (ej. Azabache)">
                            Base PDF: <strong>{formatoMoneda(moneda, costoBase)}</strong>
                          </span>

                          <span className="service-metric-pill" title="Costo real pagado al operador donde se compra">
                            Compra Real: <strong>{formatoMoneda(moneda, costo)}</strong>
                          </span>

                          <span className="service-metric-pill" title="Precio final cobrado al cliente">
                            Cliente: <strong>{formatoMoneda(moneda, venta)}</strong>
                          </span>

                          <span
                            className={`service-metric-pill ${ganancia >= 0 ? 'ganancia-pos' : 'ganancia-neg'}`}
                            title="Ganancia neta de JureTravel en este servicio"
                          >
                            <TrendingUp size={12} />
                            <strong>{ganancia >= 0 ? `+${formatoMoneda(moneda, ganancia)}` : formatoMoneda(moneda, ganancia)}</strong>
                            <span>({formatoPct(margen)})</span>
                          </span>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => eliminarServicio(servicio.id)}
                            title="Eliminar este servicio"
                            style={{ padding: '6px 10px', height: '34px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* 2. Cuerpo del Servicio */}
                      <div className="service-card-body">
                        {/* Fila: Precio al Cliente Final + % sobre Constructor + Detalles */}
                        <div className="service-price-grid">
                          <div className="service-price-col">
                            <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '5px' }}>
                              Precio Final al Cliente (PDF {basePresup?.proveedor || 'Constructor'}) ({moneda}) *
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <div className="input-wrapper" style={{ flex: 1 }}>
                                <span className="input-prefix">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="input-field input-with-prefix"
                                  style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.98rem' }}
                                  value={servicio.precioVenta ?? 0}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({
                                      ...prev,
                                      precioVenta: parseFloat(e.target.value) || 0
                                    }))
                                  }
                                />
                              </div>
                              {costoBase > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  style={{ height: '38px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                                  onClick={() =>
                                    actualizarServicio(servicio.id, (prev) => ({
                                      ...prev,
                                      markupPct: markupGlobalPct,
                                      precioVenta: redondear(costoBase * (1 + (Number(markupGlobalPct) || 0) / 100))
                                    }))
                                  }
                                  title="Calcula el precio al cliente sumando el % sobre el costo de Azabache"
                                >
                                  Usar Base +{markupGlobalPct}%
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="service-details-col">
                            <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '5px' }}>
                              Detalles / Condiciones del servicio
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Régimen de comidas, categoría hotelera, equipaje en bodega, observaciones..."
                              value={servicio.detalles || ''}
                              onChange={(e) =>
                                actualizarServicio(servicio.id, (prev) => ({ ...prev, detalles: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        {/* 3A. Bloque Especial para AÉREOS: Tramos + Emisión Confirmada (Pago 24-48 hs) */}
                        {tipo === 'aereo' && (
                          <div className="service-subcard">
                            <div className="service-subcard-header">
                              <div className="service-subcard-title">
                                <Plane size={15} color="var(--neon-cyan)" />
                                <span>Itinerario y Confirmación de Emisión (Pago a Aero en 24-48 hs)</span>
                                <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                  {(servicio.tramos || []).length} tramo{(servicio.tramos || []).length === 1 ? '' : 's'}
                                </span>
                              </div>

                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => agregarTramo(servicio)}
                                style={{ height: '32px', fontSize: '0.8rem', padding: '4px 12px', gap: '6px' }}
                              >
                                <Plus size={13} />
                                <span>+ Tramo</span>
                              </button>
                            </div>

                            {(servicio.tramos || []).length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                <div className="tramo-compact-header">
                                  <span>#</span>
                                  <span>Origen</span>
                                  <span>Destino</span>
                                  <span>Fecha Salida</span>
                                  <span>Hora</span>
                                  <span>Aerolínea / N° Vuelo</span>
                                  <span></span>
                                </div>

                                {(servicio.tramos || []).map((tramo, index) => (
                                  <div key={tramo.id} className="tramo-compact-row">
                                    <div className="tramo-num-badge">{index + 1}</div>
                                    <input
                                      type="text"
                                      className="input-field"
                                      placeholder="TUC"
                                      style={{ height: '34px', fontSize: '0.84rem', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}
                                      value={tramo.origen || ''}
                                      onChange={(e) => actualizarTramo(servicio.id, index, 'origen', e.target.value.toUpperCase())}
                                    />
                                    <input
                                      type="text"
                                      className="input-field"
                                      placeholder="CUN"
                                      style={{ height: '34px', fontSize: '0.84rem', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}
                                      value={tramo.destino || ''}
                                      onChange={(e) => actualizarTramo(servicio.id, index, 'destino', e.target.value.toUpperCase())}
                                    />
                                    <input
                                      type="date"
                                      className="input-field"
                                      style={{ height: '34px', fontSize: '0.84rem' }}
                                      value={tramo.fechaSalida || ''}
                                      onChange={(e) => actualizarTramo(servicio.id, index, 'fechaSalida', e.target.value)}
                                    />
                                    <input
                                      type="time"
                                      className="input-field"
                                      style={{ height: '34px', fontSize: '0.84rem' }}
                                      value={tramo.horaSalida || ''}
                                      onChange={(e) => actualizarTramo(servicio.id, index, 'horaSalida', e.target.value)}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '6px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="AR"
                                        style={{ height: '34px', fontSize: '0.84rem', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center' }}
                                        value={tramo.aerolinea || ''}
                                        onChange={(e) => actualizarTramo(servicio.id, index, 'aerolinea', e.target.value.toUpperCase())}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="1234"
                                        style={{ height: '34px', fontSize: '0.84rem', fontWeight: 600 }}
                                        value={tramo.vuelo || ''}
                                        onChange={(e) => actualizarTramo(servicio.id, index, 'vuelo', e.target.value)}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={() => eliminarTramo(servicio.id, index)}
                                      style={{ height: '34px', width: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="Eliminar tramo"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 10px',
                                    background: 'rgba(0, 245, 212, 0.06)',
                                    border: '1px solid rgba(0, 245, 212, 0.2)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.78rem',
                                    color: 'var(--neon-cyan)'
                                  }}
                                >
                                  <strong>Itinerario:</strong>
                                  <span>{generarDescripcionItinerario(servicio.tramos) || '—'}</span>
                                </div>
                              </div>
                            )}

                            {/* Ciclo del Vuelo (Reserva, Emisión Confirmada y Plazo 24-48 hs) */}
                            <div className="flight-lifecycle-strip">
                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Estado del Vuelo (JureTravel)
                                </label>
                                <select
                                  className="select-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.estadoVuelo || 'SinReservar'}
                                  onChange={(e) => {
                                    const nuevoEstado = e.target.value;
                                    actualizarServicio(servicio.id, (prev) => ({
                                      ...prev,
                                      estadoVuelo: nuevoEstado,
                                      fechaEmision:
                                        nuevoEstado === 'Emitido' && !prev.fechaEmision
                                          ? fechaCotizacion || new Date().toISOString().split('T')[0]
                                          : prev.fechaEmision
                                    }));
                                  }}
                                >
                                  <option value="SinReservar">Sin reservar</option>
                                  <option value="Reservado">Reservado</option>
                                  <option value="Emitido">Emitido (= Confirmado JureTravel)</option>
                                </select>
                              </div>

                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Fecha Emisión Confirmada
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.fechaEmision || ''}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({
                                      ...prev,
                                      fechaEmision: e.target.value,
                                      estadoVuelo: e.target.value ? 'Emitido' : prev.estadoVuelo
                                    }))
                                  }
                                />
                              </div>

                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Plazo de Pago al Proveedor Aéreo
                                </label>
                                <select
                                  className="select-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={
                                    servicio.reglaVencimiento === 'bcp'
                                      ? 'bcp'
                                      : String(Number(servicio.plazoPagoHoras) === 24 ? 24 : 48)
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'bcp') {
                                      actualizarServicio(servicio.id, (prev) => ({
                                        ...prev,
                                        reglaVencimiento: 'bcp'
                                      }));
                                    } else {
                                      actualizarServicio(servicio.id, (prev) => ({
                                        ...prev,
                                        reglaVencimiento: '24-48hs',
                                        plazoPagoHoras: Number(val)
                                      }));
                                    }
                                  }}
                                >
                                  <option value="24">⚡ 24 hs posteriores al Emitido (+1 día)</option>
                                  <option value="48">⚡ 48 hs posteriores al Emitido (+2 días)</option>
                                  <option value="bcp">📅 Según Grilla Mensual BCP</option>
                                </select>
                              </div>

                              <div
                                style={{
                                  flex: 1,
                                  minWidth: '220px',
                                  padding: '8px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: infoVenc.fecha ? 'rgba(0, 245, 212, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                  border: `1px solid ${infoVenc.fecha ? 'rgba(0, 245, 212, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                                  fontSize: '0.78rem',
                                  color: infoVenc.fecha ? 'var(--neon-cyan)' : 'var(--text-muted)'
                                }}
                              >
                                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <CalendarClock size={14} />
                                  <span>Vencimiento de Pago (Vuelo):</span>
                                </div>
                                <div style={{ marginTop: '2px', color: '#fff' }}>{infoVenc.etiqueta}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3B. Bloque Especial para HOTEL, TRASLADOS Y SERVICIOS RESERVADOS (Grilla 1-5 -> día 20) */}
                        {tipo !== 'aereo' && (
                          <div className="service-subcard">
                            <div className="flight-lifecycle-strip" style={{ marginTop: 0 }}>
                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Estado de Reserva en {compra?.proveedor || 'Proveedor 2'}
                                </label>
                                <select
                                  className="select-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.estadoReserva || 'Reservado'}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({
                                      ...prev,
                                      estadoReserva: e.target.value
                                    }))
                                  }
                                >
                                  <option value="Reservado">Reservado (Impacta en Calendario de Pagos)</option>
                                  <option value="SinReservar">Sin reservar aún</option>
                                </select>
                              </div>

                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Fecha de Reserva (Define bloque 1-5 → pago día 20)
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.fechaReserva || fechaCotizacion || ''}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({
                                      ...prev,
                                      fechaReserva: e.target.value
                                    }))
                                  }
                                />
                              </div>

                              <div
                                style={{
                                  flex: 1,
                                  minWidth: '240px',
                                  padding: '8px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: infoVenc.fecha ? 'rgba(250, 204, 21, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                  border: `1px solid ${infoVenc.fecha ? 'rgba(250, 204, 21, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                                  fontSize: '0.78rem',
                                  color: infoVenc.fecha ? 'var(--neon-amber)' : 'var(--text-muted)'
                                }}
                              >
                                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <CalendarClock size={14} />
                                  <span>Vencimiento según Grilla Mensual:</span>
                                </div>
                                <div style={{ marginTop: '2px', color: '#fff' }}>{infoVenc.etiqueta}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. Ofertas de Proveedores (Separación Proveedor 1 Aero vs Proveedor 2 Azabache) */}
                        <div className="service-subcard">
                          <div className="service-subcard-header">
                            <div className="service-subcard-title">
                              <Building2 size={15} color="#c084fc" />
                              <span>Valores por Proveedor (Guardados por Separado)</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                — Marcá con quién se <strong>Compra Realmente</strong> y cuál es la <strong>Base del PDF (Azabache)</strong>
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => agregarOferta(servicio)}
                              style={{ height: '32px', fontSize: '0.8rem', padding: '4px 12px', gap: '6px' }}
                            >
                              <Plus size={13} />
                              <span>+ Agregar Proveedor</span>
                            </button>
                          </div>

                          {ofertas.length === 0 ? (
                            <div style={{ padding: '8px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              Sin ofertas cargadas: agregá al menos una para registrar el costo de compra y el vencimiento de pago.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div className="offers-compact-header" style={{ gridTemplateColumns: '64px 1.2fr 1.1fr 1fr 1.2fr 36px' }}>
                                <span style={{ textAlign: 'center' }}>Pagar a</span>
                                <span>Proveedor / Operador</span>
                                <span>Costo Neto ({moneda})</span>
                                <span>Venc. Manual (Opc.)</span>
                                <span style={{ textAlign: 'center' }}>Rol en el Presupuesto</span>
                                <span></span>
                              </div>

                              {ofertas.map((oferta) => {
                                const elegida = oferta.id === servicio.ofertaCompraId;
                                const esBase = oferta.id === basePresup?.id;
                                const opciones = [...proveedoresDisponibles];
                                if (
                                  oferta.proveedorId &&
                                  !opciones.some((op) => op.id === oferta.proveedorId)
                                ) {
                                  opciones.push({
                                    id: oferta.proveedorId,
                                    nombre: oferta.proveedor || oferta.proveedorId
                                  });
                                }

                                return (
                                  <div
                                    key={oferta.id}
                                    className={`offer-compact-row ${elegida ? 'selected' : ''}`}
                                    style={{ gridTemplateColumns: '64px 1.2fr 1.1fr 1fr 1.2fr 36px' }}
                                  >
                                    <label
                                      className="offer-radio-label"
                                      title="JureTravel compra y paga este servicio a este proveedor"
                                    >
                                      <input
                                        type="radio"
                                        name={`compra-${servicio.id}`}
                                        className="offer-radio-input"
                                        checked={elegida}
                                        onChange={() => elegirOfertaCompra(servicio.id, oferta.id)}
                                      />
                                    </label>

                                    <select
                                      className="select-field"
                                      style={{ height: '36px', fontSize: '0.84rem' }}
                                      value={oferta.proveedorId || ''}
                                      onChange={(e) =>
                                        cambiarProveedorOferta(servicio.id, oferta.id, e.target.value)
                                      }
                                    >
                                      <option value="">Seleccionar Proveedor...</option>
                                      {opciones.map((op) => (
                                        <option key={op.id} value={op.id}>
                                          {op.nombre}
                                        </option>
                                      ))}
                                    </select>

                                    <div className="input-wrapper">
                                      <span className="input-prefix" style={{ fontSize: '0.85rem' }}>$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input-field input-with-prefix"
                                        style={{ height: '36px', fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                                        placeholder="Costo"
                                        value={oferta.costo ?? 0}
                                        onChange={(e) =>
                                          actualizarOferta(servicio.id, oferta.id, {
                                            costo: parseFloat(e.target.value) || 0
                                          })
                                        }
                                      />
                                    </div>

                                    <input
                                      type="date"
                                      className="input-field"
                                      style={{ height: '36px', fontSize: '0.82rem' }}
                                      title="Dejar vacío para usar el cálculo automático (24-48 hs en Aero / Grilla 1-5 en Azabache)"
                                      value={oferta.vencimientoTTOO || ''}
                                      onChange={(e) =>
                                        actualizarOferta(servicio.id, oferta.id, {
                                          vencimientoTTOO: e.target.value
                                        })
                                      }
                                    />

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      {elegida ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            background: 'rgba(0, 245, 212, 0.15)',
                                            color: 'var(--neon-cyan)',
                                            fontSize: '0.71rem',
                                            fontWeight: 800,
                                            border: '1px solid rgba(0, 245, 212, 0.4)'
                                          }}
                                        >
                                          <CheckCircle2 size={11} /> Se compra y paga
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          style={{ height: '24px', fontSize: '0.68rem', padding: '2px 7px' }}
                                          onClick={() => elegirOfertaCompra(servicio.id, oferta.id)}
                                        >
                                          Comprar acá
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        className="btn btn-sm"
                                        style={{
                                          height: '24px',
                                          fontSize: '0.68rem',
                                          padding: '2px 7px',
                                          background: esBase ? 'rgba(250, 204, 21, 0.18)' : 'transparent',
                                          color: esBase ? 'var(--neon-amber)' : 'var(--text-muted)',
                                          border: `1px solid ${esBase ? 'rgba(250, 204, 21, 0.45)' : 'rgba(255,255,255,0.12)'}`
                                        }}
                                        onClick={() => marcarOfertaBasePresupuesto(servicio.id, oferta.id)}
                                        title="Marca este costo como el que figura en el armador de PDF al cliente (ej. Azabache)"
                                      >
                                        {esBase ? '★ Base PDF Cliente' : 'Usar Base PDF'}
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={() => eliminarOferta(servicio.id, oferta.id)}
                                      style={{ height: '34px', width: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="Eliminar oferta"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5. Pie del Servicio con Desglose Completo */}
                      <div className="service-footer-summary">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          <span>
                            Costo {compra?.proveedor || 'Compra'}:{' '}
                            <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{formatoMoneda(moneda, costo)}</strong>
                          </span>
                          {ofertas.length > 1 && (
                            <span>
                              Costo Ref. {basePresup?.proveedor || 'PDF'}:{' '}
                              <strong style={{ color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)' }}>
                                {formatoMoneda(moneda, costoBase)}
                              </strong>
                              {ahorro > 0 && (
                                <span style={{ color: 'var(--neon-emerald)', marginLeft: '6px', fontSize: '0.76rem' }}>
                                  (Ahorro compra: +{formatoMoneda(moneda, ahorro)})
                                </span>
                              )}
                            </span>
                          )}
                          <span>
                            Precio Cliente:{' '}
                            <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{formatoMoneda(moneda, venta)}</strong>
                          </span>
                          <span style={{ color: ganancia >= 0 ? 'var(--neon-cyan)' : 'var(--neon-pink)', fontWeight: 700 }}>
                            Ganancia JureTravel: {formatoMoneda(moneda, ganancia)} ({formatoPct(margen)})
                          </span>
                        </div>

                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                          {infoVenc.fecha ? (
                            <span>
                              Pagadero a <strong style={{ color: 'var(--neon-cyan)' }}>{compra?.proveedor}</strong> el{' '}
                              <strong style={{ color: '#fff' }}>{formatFechaLarga(infoVenc.fecha)}</strong>
                            </span>
                          ) : (
                            <span>{infoVenc.etiqueta}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 6. Panel en Vivo: Resumen Separado por Proveedor y Mapa de Cuándo Pagar */}
      {items.filter((i) => i.activo).length > 0 && (
        <div className="card" style={{ padding: '20px', border: '1.5px solid rgba(0, 245, 212, 0.35)' }}>
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div className="card-title-group">
              <div className="card-icon" style={{ background: 'rgba(0, 245, 212, 0.15)', color: 'var(--neon-cyan)' }}>
                <CalendarClock size={18} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
                  Vista Previa de Pagos a Proveedores y Números Guardados por Separado
                </h3>
                <span className="card-subtitle">
                  Control en tiempo real: cuánto se cotizó en cada proveedor, cuánto se le pasa al cliente y cuándo vence cada pago en tu Calendario.
                </span>
              </div>
            </div>
          </div>

          {/* Tarjetas por Proveedor y Cliente */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {desgloseProveedores.map((prov) => (
              <div
                key={prov.proveedorId}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}
              >
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Proveedor: {prov.proveedor}
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  Cotizado en {prov.proveedor}:{' '}
                  <strong className="mono">{formatoMoneda(moneda, prov.totalCotizadoReferencia)}</strong>
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.92rem', color: 'var(--neon-cyan)' }}>
                  A pagar realmente:{' '}
                  <strong className="mono">{formatoMoneda(moneda, prov.totalAPagarCompra)}</strong>
                </div>
                {prov.serviciosReferencia.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '0.73rem', color: 'var(--neon-amber)' }}>
                    Incluye {prov.serviciosReferencia.map((s) => `${s.nombre} (${formatoMoneda(moneda, s.costo)})`).join(', ')} solo como referencia para el PDF al cliente.
                  </div>
                )}
              </div>
            ))}

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 245, 212, 0.1)',
                border: '1px solid rgba(0, 245, 212, 0.4)'
              }}
            >
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--neon-cyan)', fontWeight: 800 }}>
                Presupuesto Final al Cliente (PDF)
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                Costo Total Compra Real: <strong className="mono">{formatoMoneda(moneda, totalCostoReal)}</strong>
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.95rem', color: '#fff' }}>
                Precio al Cliente: <strong className="mono">{formatoMoneda(moneda, totalVentaCliente)}</strong>
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.82rem', color: 'var(--neon-emerald)', fontWeight: 700 }}>
                Ganancia Neta: {formatoMoneda(moneda, totalGanancia)}
                {totalAhorroAero > 0 ? ` (incluye ${formatoMoneda(moneda, totalAhorroAero)} ahorrados en vuelo)` : ''}
              </div>
            </div>
          </div>

          {/* Tabla de cuándo y cuánto pagar por cada servicio activo */}
          <div className="jf-table-wrap">
            <table className="jf-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Proveedor a Pagar</th>
                  <th>Regla de Vencimiento</th>
                  <th>Fecha de Pago</th>
                  <th style={{ textAlign: 'right' }}>Costo a Pagar</th>
                  <th style={{ textAlign: 'right' }}>Costo Ref. PDF</th>
                  <th style={{ textAlign: 'right' }}>Precio al Cliente</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((i) => i.activo)
                  .map((srv) => {
                    const compra = ofertaCompraDe(srv);
                    const info = calcularInfoVencimiento(srv);
                    const costo = costoCompraItem(srv);
                    const base = costoBasePresupuestoItem(srv);
                    const venta = precioVentaItem(srv);
                    return (
                      <tr key={srv.id}>
                        <td>
                          <strong>{srv.nombre || SECCION_LABEL[srv.tipo]}</strong>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            {SECCION_LABEL[srv.tipo]}
                          </div>
                        </td>
                        <td>
                          <strong>{compra?.proveedor || '—'}</strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              info.origen === '24-48hs'
                                ? 'badge-warning'
                                : info.origen === 'bcp'
                                  ? 'badge-info'
                                  : 'badge-neutral'
                            }`}
                          >
                            {info.origen === '24-48hs'
                              ? `⚡ ${srv.plazoPagoHoras || 48} hs post-emisión`
                              : info.origen === 'bcp'
                                ? `📅 Grilla Bloque ${info.bloque?.rangoCorto || ''}`
                                : info.origen === 'manual'
                                  ? 'Fecha manual'
                                  : 'Pendiente de fecha'}
                          </span>
                        </td>
                        <td>
                          {info.fecha ? (
                            <strong>{formatFechaLarga(info.fecha)}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              {info.etiqueta}
                            </span>
                          )}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--neon-cyan)' }}>
                          {costo > 0 ? formatoMoneda(moneda, costo) : 'Bonificado ($0)'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--neon-amber)' }}>
                          {formatoMoneda(moneda, base)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatoMoneda(moneda, venta)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '14px 18px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <AlertCircle size={16} color="var(--neon-cyan)" style={{ flexShrink: 0 }} />
        <span>
          Fecha de cotización: <strong style={{ color: '#fff' }}>{fechaCotizacion || '—'}</strong>. Todos los costos de cada proveedor y el precio al cliente quedan guardados por separado e impactan automáticamente en el Calendario de Pagos.
        </span>
      </div>
    </div>
  );
}
