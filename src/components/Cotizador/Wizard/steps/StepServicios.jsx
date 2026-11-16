// StepServicios.jsx - Paso 2: servicios y costos (versión simplificada)
// Solo se cargan los costos netos por servicio y el proveedor de compra.
// El precio de venta se define en el Resumen con un markup global sobre el total neto.
import React, { useMemo } from 'react';
import {
  Trash2,
  Plane,
  Hotel,
  Car,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import {
  SECCION_LABEL,
  createEmptyItem,
  createEmptyOferta,
  ofertaCompraDe,
  totalCostoItems,
  formatoMoneda
} from '../wizardUtils';

const TIPOS_ORDEN = ['aereo', 'hotel', 'traslados', 'asistencia', 'extra'];
const ICONO_POR_TIPO = {
  aereo: Plane,
  hotel: Hotel,
  traslados: Car,
  asistencia: ShieldCheck,
  extra: Sparkles
};
const LABEL_POR_TIPO = {
  aereo: 'Vuelo',
  hotel: 'Hotel',
  traslados: 'Traslado',
  asistencia: 'Asistencia',
  extra: 'Extra'
};

export default function StepServicios({
  items = [],
  setItems,
  operadoresList = [],
  proveedoresActivos = [],
  moneda,
  fechaCotizacion,
  _configMensual = []
}) {
  const proveedoresDisponibles = useMemo(() => {
    const filtrados = (operadoresList || []).filter((op) => proveedoresActivos.includes(op.id));
    return filtrados.length > 0 ? filtrados : operadoresList || [];
  }, [operadoresList, proveedoresActivos]);

  const proveedorDefault = proveedoresDisponibles[0] || operadoresList[0] || null;

  const actualizarServicio = (id, fn) => {
    setItems((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  };

  const agregarServicio = (tipo) => {
    const nuevo = createEmptyItem(tipo, {
      proveedorId: proveedorDefault?.id || '',
      proveedor: proveedorDefault?.nombre || '',
      fechaReserva: fechaCotizacion || ''
    });
    setItems((prev) => [...prev, nuevo]);
  };

  const eliminarServicio = (id) => {
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const actualizarCostoCompra = (servicio, costo) => {
    const compra = ofertaCompraDe(servicio);
    if (compra) {
      actualizarServicio(servicio.id, (prev) => ({
        ...prev,
        ofertas: (prev.ofertas || []).map((o) =>
          o.id === compra.id ? { ...o, costo: Number(costo) || 0 } : o
        )
      }));
    } else {
      const oferta = createEmptyOferta({
        proveedorId: servicio.proveedor || proveedorDefault?.id || '',
        proveedor: servicio.proveedor || proveedorDefault?.nombre || '',
        costo: Number(costo) || 0
      });
      actualizarServicio(servicio.id, (prev) => ({
        ...prev,
        ofertas: [oferta],
        ofertaCompraId: oferta.id
      }));
    }
  };

  const cambiarProveedorCompra = (servicio, proveedorId) => {
    const operador = operadoresList.find((op) => op.id === proveedorId);
    const compra = ofertaCompraDe(servicio);
    actualizarServicio(servicio.id, (prev) => ({
      ...prev,
      proveedor: operador?.nombre || proveedorId,
      ofertas: (prev.ofertas || []).map((o) =>
        o.id === compra?.id ? { ...o, proveedorId, proveedor: operador?.nombre || proveedorId } : o
      )
    }));
  };

  const totalCosto = totalCostoItems(items);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Plane size={18} />
            </div>
            <div>
              <h3 className="card-title">Servicios y costos</h3>
              <span className="card-subtitle">Cargá solo el costo neto de cada servicio y el proveedor de compra</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TIPOS_ORDEN.map((tipo) => {
              const Icono = ICONO_POR_TIPO[tipo];
              return (
                <button
                  key={tipo}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => agregarServicio(tipo)}
                  style={{ gap: '6px' }}
                >
                  <Icono size={14} />
                  <span>{LABEL_POR_TIPO[tipo]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <div className="empty-state-icon">
              <Plane size={22} />
            </div>
            <h3>Sin servicios cargados</h3>
            <p>Agregá los servicios del viaje con el costo neto que pagás a cada proveedor.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((servicio) => {
              const Icono = ICONO_POR_TIPO[servicio.tipo] || Sparkles;
              const compra = ofertaCompraDe(servicio);
              return (
                <div key={servicio.id} className="row-soft" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span className="service-type-badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                      <Icono size={13} /> {SECCION_LABEL[servicio.tipo] || servicio.tipo}
                    </span>
                    <input
                      type="text"
                      className="input-field"
                      style={{ flex: 1, minWidth: '200px', height: '36px' }}
                      placeholder="Nombre del servicio"
                      value={servicio.nombre || ''}
                      onChange={(e) =>
                        actualizarServicio(servicio.id, (prev) => ({ ...prev, nombre: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ height: '34px', width: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => eliminarServicio(servicio.id)}
                      title="Eliminar servicio"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '4px' }}>Proveedor de compra</label>
                      <select
                        className="select-field"
                        style={{ height: '36px', fontSize: '0.84rem' }}
                        value={compra?.proveedorId || servicio.proveedor || ''}
                        onChange={(e) => cambiarProveedorCompra(servicio, e.target.value)}
                      >
                        <option value="">Seleccionar proveedor...</option>
                        {(proveedoresDisponibles.length > 0 ? proveedoresDisponibles : operadoresList).map((op) => (
                          <option key={op.id} value={op.id}>{op.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '4px' }}>Costo neto ({moneda})</label>
                      <div className="input-wrapper">
                        <span className="input-prefix">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-field input-with-prefix"
                          style={{ height: '36px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                          value={compra?.costo === 0 ? '' : (compra?.costo ?? '')}
                          onChange={(e) => actualizarCostoCompra(servicio, e.target.value.replace(',', '.'))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '4px' }}>Detalles (opcional)</label>
                      <input
                        type="text"
                        className="input-field"
                        style={{ height: '36px', fontSize: '0.84rem' }}
                        placeholder="Observaciones..."
                        value={servicio.detalles || ''}
                        onChange={(e) =>
                          actualizarServicio(servicio.id, (prev) => ({ ...prev, detalles: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {servicio.tipo === 'aereo' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>Estado del vuelo</label>
                        <select
                          className="select-field"
                          style={{ height: '34px', fontSize: '0.82rem' }}
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
                      {servicio.estadoVuelo === 'Emitido' && (
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>Fecha de emisión</label>
                          <input
                            type="date"
                            className="input-field"
                            style={{ height: '34px', fontSize: '0.82rem' }}
                            value={servicio.fechaEmision || ''}
                            onChange={(e) =>
                              actualizarServicio(servicio.id, (prev) => ({ ...prev, fechaEmision: e.target.value }))
                            }
                          />
                        </div>
                      )}
                      {servicio.estadoVuelo === 'Reservado' && (
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>Fecha de reserva</label>
                          <input
                            type="date"
                            className="input-field"
                            style={{ height: '34px', fontSize: '0.82rem' }}
                            value={servicio.fechaReserva || ''}
                            onChange={(e) =>
                              actualizarServicio(servicio.id, (prev) => ({ ...prev, fechaReserva: e.target.value }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {servicio.tipo !== 'aereo' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '4px' }}>Fecha de reserva</label>
                      <input
                        type="date"
                        className="input-field"
                        style={{ height: '34px', fontSize: '0.82rem', maxWidth: '220px' }}
                        value={servicio.fechaReserva || ''}
                        onChange={(e) =>
                          actualizarServicio(servicio.id, (prev) => ({ ...prev, fechaReserva: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total neto (costo)</div>
            <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {formatoMoneda(moneda, totalCosto)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}