// StepServicios.jsx - Paso 2: servicios del presupuesto y costos reales.
//
// Cada servicio (vuelo, hotel, traslado, asistencia, extra) tiene:
//   · un PRECIO DE VENTA al cliente, que sale del presupuesto que arma la
//     herramienta del proveedor;
//   · una o más OFERTAS de compra, cada una con su proveedor, su costo real y
//     su vencimiento de pago;
//   · una oferta marcada como "compra": la que efectivamente se paga.
//
// La ganancia del servicio es venta − costo de la oferta de compra.
import React, { useMemo } from 'react';
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
  ArrowRight
} from 'lucide-react';
import {
  SECCION_LABEL,
  createEmptyItem,
  createEmptyOferta,
  createEmptyTramo,
  generarDescripcionItinerario,
  costoCompraItem,
  precioVentaItem,
  gananciaItem,
  ofertaCompraDe,
  formatoMoneda,
  formatoPct
} from '../wizardUtils';

const TIPOS_ORDEN = ['aereo', 'hotel', 'traslados', 'asistencia', 'extra'];

const ESTILO_POR_TIPO = {
  aereo: { Icono: Plane, label: 'Vuelo', color: 'var(--neon-cyan)', bg: 'rgba(0, 245, 212, 0.12)', border: 'rgba(0, 245, 212, 0.4)' },
  hotel: { Icono: Hotel, label: 'Hotel', color: 'var(--neon-amber)', bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.4)' },
  traslados: { Icono: Car, label: 'Traslado', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.4)' },
  asistencia: { Icono: ShieldCheck, label: 'Asistencia', color: 'var(--neon-emerald)', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)' },
  extra: { Icono: Sparkles, label: 'Extra', color: 'var(--neon-pink)', bg: 'rgba(255, 42, 133, 0.12)', border: 'rgba(255, 42, 133, 0.4)' }
};

const PLACEHOLDER_NOMBRE = {
  aereo: 'Ej: Vuelo TUC → CUN ida y vuelta',
  hotel: 'Ej: Hotel Riu Palace - 7 noches',
  traslados: 'Ej: Traslado aeropuerto / hotel',
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
  fechaCotizacion
}) {
  const paxCount = Math.max(1, Number(pax) || 1);

  /** Proveedores disponibles para cargar ofertas (los seleccionados en paso 1) */
  const proveedoresDisponibles = useMemo(
    () => (operadoresList || []).filter((op) => proveedoresActivos.includes(op.id)),
    [operadoresList, proveedoresActivos]
  );

  const proveedorDefault = proveedoresDisponibles[0] || operadoresList[0] || null;

  /* ------------------------- Operaciones sobre el estado ------------------------ */

  const actualizarServicio = (id, fn) => {
    setItems((prev) => prev.map((servicio) => (servicio.id === id ? fn(servicio) : servicio)));
  };

  const agregarServicio = (tipo) => {
    const nuevo = createEmptyItem(tipo, {
      proveedorId: proveedorDefault?.id || '',
      proveedor: proveedorDefault?.nombre || ''
    });
    setItems((prev) => [...prev, nuevo]);
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

  /* --------------------------------- Render --------------------------------- */

  const grupos = TIPOS_ORDEN.map((tipo) => ({
    tipo,
    servicios: items.filter((servicio) => servicio.tipo === tipo)
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado y Barra de Acciones Rápidas */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div className="card-title-group">
            <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--neon-cyan)' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="card-title">Carga de Servicios & Costos Reales</h3>
              <span className="card-subtitle">
                Ingresá el precio cotizado al cliente y compará las ofertas de compra de cada operador.
              </span>
            </div>
          </div>
          <span className="badge badge-info" style={{ fontWeight: 700, padding: '5px 12px' }}>
            {paxCount} pasajero{paxCount > 1 ? 's' : ''}
          </span>
        </div>

        {/* Botones de acción rápida para agregar servicios */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(139, 92, 246, 0.2)' }}>
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
                  border: `1.5px solid ${est.border}`,
                  boxShadow: `0 0 10px ${est.bg}`,
                  gap: '6px',
                  fontWeight: 700
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

      {/* Renderizado de categorías y sus servicios */}
      {grupos.map(({ tipo, servicios }) => {
        const estilo = ESTILO_POR_TIPO[tipo] || ESTILO_POR_TIPO.extra;
        const { Icono } = estilo;
        const activos = servicios.filter((servicio) => servicio.activo);

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
                    {servicios.length} cargado{servicios.length === 1 ? '' : 's'} ·{' '}
                    {activos.length} activo{activos.length === 1 ? '' : 's'} en el presupuesto
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
                  const ganancia = gananciaItem(servicio);
                  const margen = venta > 0 ? (ganancia / venta) * 100 : 0;
                  const compra = ofertaCompraDe(servicio);

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
                          <span className="service-metric-pill" title="Precio total cobrado al cliente">
                            Venta: <strong>{formatoMoneda(moneda, venta)}</strong>
                          </span>

                          <span className="service-metric-pill" title="Costo pagado al operador elegido">
                            Costo: <strong>{formatoMoneda(moneda, costo)}</strong>
                          </span>

                          <span
                            className={`service-metric-pill ${ganancia >= 0 ? 'ganancia-pos' : 'ganancia-neg'}`}
                            title="Ganancia neta del servicio"
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
                        {/* Fila: Precio de venta y Detalles */}
                        <div className="service-price-grid">
                          <div className="service-price-col">
                            <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '5px' }}>
                              Precio Venta Cliente ({moneda}) *
                            </label>
                            <div className="input-wrapper">
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
                          </div>

                          <div className="service-details-col">
                            <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '5px' }}>
                              Detalles / Condiciones de la tarifa
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

                        {/* 3. Bloque Especial: Tramos de Vuelo y Ciclo de Emisión */}
                        {tipo === 'aereo' && (
                          <div className="service-subcard">
                            <div className="service-subcard-header">
                              <div className="service-subcard-title">
                                <Plane size={15} color="var(--neon-cyan)" />
                                <span>Itinerario de Vuelos (Tramos)</span>
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

                            {(servicio.tramos || []).length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                                Sin tramos cargados. Podés agregar el itinerario de ida y vuelta para calcular automáticamente los detalles.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

                            {/* Ciclo del Vuelo (Reserva y Emisión) */}
                            <div className="flight-lifecycle-strip">
                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Estado del Vuelo
                                </label>
                                <select
                                  className="select-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.estadoVuelo || 'SinReservar'}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({ ...prev, estadoVuelo: e.target.value }))
                                  }
                                >
                                  <option value="SinReservar">Sin reservar</option>
                                  <option value="Reservado">Reservado</option>
                                  <option value="Emitido">Emitido</option>
                                </select>
                              </div>

                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Fecha de Reserva
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.fechaReserva || ''}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({ ...prev, fechaReserva: e.target.value }))
                                  }
                                />
                              </div>

                              <div className="flight-lifecycle-col">
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>
                                  Fecha de Emisión
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ height: '36px', fontSize: '0.84rem' }}
                                  value={servicio.fechaEmision || ''}
                                  onChange={(e) =>
                                    actualizarServicio(servicio.id, (prev) => ({ ...prev, fechaEmision: e.target.value }))
                                  }
                                />
                              </div>

                              <div style={{ flex: 1, minWidth: '200px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                ℹ️ Si el vencimiento de pago queda en blanco, se computará de forma automática según el bloque mensual de emisión del proveedor.
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. Ofertas de Compra (Costo Real) */}
                        <div className="service-subcard">
                          <div className="service-subcard-header">
                            <div className="service-subcard-title">
                              <Building2 size={15} color="#c084fc" />
                              <span>Ofertas de Compra & Costo Real</span>
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                (Marcá la opción con la que efectivamente se compra)
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => agregarOferta(servicio)}
                              style={{ height: '32px', fontSize: '0.8rem', padding: '4px 12px', gap: '6px' }}
                            >
                              <Plus size={13} />
                              <span>+ Oferta</span>
                            </button>
                          </div>

                          {ofertas.length === 0 ? (
                            <div style={{ padding: '8px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              Sin ofertas cargadas: agregá al menos una para registrar el costo de compra y el vencimiento de pago.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div className="offers-compact-header">
                                <span style={{ textAlign: 'center' }}>Compra</span>
                                <span>Proveedor / TTOO</span>
                                <span>Costo Real ({moneda})</span>
                                <span>Vencimiento Pago</span>
                                <span style={{ textAlign: 'center' }}>Estado</span>
                                <span></span>
                              </div>

                              {ofertas.map((oferta) => {
                                const elegida = oferta.id === servicio.ofertaCompraId;
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
                                  >
                                    <label
                                      className="offer-radio-label"
                                      title="Comprar con esta oferta"
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
                                      style={{ height: '36px', fontSize: '0.84rem' }}
                                      title="Vencimiento de pago al proveedor"
                                      value={oferta.vencimientoTTOO || ''}
                                      onChange={(e) =>
                                        actualizarOferta(servicio.id, oferta.id, {
                                          vencimientoTTOO: e.target.value
                                        })
                                      }
                                    />

                                    <div style={{ textAlign: 'center' }}>
                                      {elegida ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            background: 'rgba(0, 245, 212, 0.15)',
                                            color: 'var(--neon-cyan)',
                                            fontSize: '0.74rem',
                                            fontWeight: 800,
                                            border: '1px solid rgba(0, 245, 212, 0.4)'
                                          }}
                                        >
                                          <CheckCircle2 size={12} /> Compra
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          style={{ height: '26px', fontSize: '0.72rem', padding: '2px 8px' }}
                                          onClick={() => elegirOfertaCompra(servicio.id, oferta.id)}
                                        >
                                          Elegir
                                        </button>
                                      )}
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

                      {/* 5. Pie del Servicio con Resumen */}
                      <div className="service-footer-summary">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          <span>
                            Venta: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{formatoMoneda(moneda, venta)}</strong>
                          </span>
                          <span>
                            Costo real: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{formatoMoneda(moneda, costo)}</strong>
                          </span>
                          <span style={{ color: ganancia >= 0 ? 'var(--neon-cyan)' : 'var(--neon-pink)', fontWeight: 700 }}>
                            Ganancia: {formatoMoneda(moneda, ganancia)} ({formatoPct(margen)} sobre venta)
                          </span>
                        </div>

                        {compra?.proveedor && (
                          <div style={{ color: 'var(--text-secondary)' }}>
                            Comprando a: <strong style={{ color: 'var(--neon-cyan)' }}>{compra.proveedor}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

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
          Fecha de cotización: <strong style={{ color: '#fff' }}>{fechaCotizacion || '—'}</strong>. Los servicios destildados quedan archivados como referencia pero no computan en el presupuesto final.
        </span>
      </div>
    </div>
  );
}
