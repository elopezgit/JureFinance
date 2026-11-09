// QuotePreviewModal.jsx - Resumen interno de números de la cotización.
//
// El presupuesto que recibe el cliente se arma fuera de la app con la
// herramienta del proveedor. Este documento es de uso interno: muestra precio
// de venta, costo real de compra y ganancia por servicio.
import React from 'react';
import {
  X,
  Printer,
  Plane,
  Hotel,
  ShieldCheck,
  Car,
  Calendar,
  Users,
  MapPin,
  Sparkles,
  TrendingUp,
  Lock
} from 'lucide-react';
import {
  normalizarServicios,
  SECCION_LABEL,
  precioVentaItem,
  costoCompraItem,
  gananciaItem,
  ofertaCompraDe,
  totalVentaItems,
  totalCostoItems,
  totalGananciaItems,
  margenVentaItems
} from '../../services/serviciosService';

const ESTILO_POR_TIPO = {
  aereo: { Icono: Plane, fondo: '#dbeafe', color: '#1d4ed8' },
  hotel: { Icono: Hotel, fondo: '#fef3c7', color: '#b45309' },
  traslados: { Icono: Car, fondo: '#e0e7ff', color: '#4338ca' },
  asistencia: { Icono: ShieldCheck, fondo: '#d1fae5', color: '#065f46' },
  extra: { Icono: Sparkles, fondo: '#fce7f3', color: '#9d174d' }
};

const formato = (moneda, valor) =>
  `${moneda || 'USD'} $${Number(valor || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function QuotePreviewModal({ quote, onClose }) {
  if (!quote) return null;

  const { destino, fechaViajeInicio, fechaViajeFin, fechaCotizacion, pax, pasajeros, moneda, notas } = quote;
  const cliente = quote.cliente;
  const paxCount = Math.max(1, Number(pax) || 1);

  const items = normalizarServicios(quote.servicios, { pax }).filter((item) => item.activo);
  const totalVenta = totalVentaItems(items);
  const totalCosto = totalCostoItems(items);
  const ganancia = totalGananciaItems(items);
  const margen = margenVentaItems(items);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '900px', background: '#ffffff', color: '#111827' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior del modal (oculta al imprimir) */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>
                Resumen interno de números
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Documento interno: no enviar al cliente
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={15} />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button onClick={onClose} className="modal-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Documento imprimible */}
        <div className="modal-body printable-quote" style={{ padding: '36px 44px', background: '#ffffff' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '24px',
              marginBottom: '28px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    color: '#1e3a8a',
                    letterSpacing: '-0.02em'
                  }}
                >
                  JureFinance
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#b45309',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#fef3c7'
                  }}
                >
                  Uso interno
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>
                Venta al cliente, costo real de compra y ganancia
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                Ref: {quote.id || 'COT-NUEVA'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Fecha: <strong>{fechaCotizacion || new Date().toISOString().split('T')[0]}</strong>
              </div>
            </div>
          </div>

          {/* Cliente y viaje */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '28px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Cliente
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                {cliente || 'Nombre del Cliente'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Destino
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#3b82f6" />
                {destino || 'Destino a convenir'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Fechas
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="#3b82f6" />
                {fechaViajeInicio || '—'} al {fechaViajeFin || '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                Pasajeros
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#3b82f6" />
                {paxCount}
              </div>
              {Array.isArray(pasajeros) && pasajeros.length > 0 && (
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                  {pasajeros.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Detalle por servicio */}
          <div style={{ marginBottom: '28px' }}>
            <h4
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#0f172a',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '8px',
                marginBottom: '14px'
              }}
            >
              Detalle por servicio
            </h4>

            {items.length === 0 && (
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                No hay servicios activos en esta cotización.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item) => {
                const estilo = ESTILO_POR_TIPO[item.tipo] || ESTILO_POR_TIPO.extra;
                const { Icono } = estilo;
                const compra = ofertaCompraDe(item);
                const venta = precioVentaItem(item);
                const costo = costoCompraItem(item);
                const utilidad = gananciaItem(item);

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: estilo.fondo,
                        color: estilo.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icono size={17} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                        {item.nombre || SECCION_LABEL[item.tipo] || 'Servicio'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {SECCION_LABEL[item.tipo] || item.tipo} · Compra a{' '}
                        {compra?.proveedor || 'sin proveedor'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Venta</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formato(moneda, venta)}</div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Costo real</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formato(moneda, costo)}</div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '92px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Ganancia</div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          color: utilidad >= 0 ? '#047857' : '#b91c1c'
                        }}
                      >
                        {formato(moneda, utilidad)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '22px 26px',
              marginBottom: '22px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '18px',
              boxShadow: '0 10px 25px -5px rgba(30, 58, 138, 0.4)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
                Venta total
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {formato(moneda, totalVenta)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {formato(moneda, totalVenta / paxCount)} por pax
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
                Costo real
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {formato(moneda, totalCosto)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {formato(moneda, totalCosto / paxCount)} por pax
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <TrendingUp size={13} /> Ganancia real
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: ganancia >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                {formato(moneda, ganancia)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                Margen sobre venta: {margen.toFixed(1)}%
              </div>
            </div>
          </div>

          {notas && (
            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                Notas internas
              </div>
              <p style={{ fontSize: '0.82rem', color: '#334155', margin: 0, whiteSpace: 'pre-line' }}>
                {notas}
              </p>
            </div>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', fontSize: '0.72rem', color: '#64748b' }}>
            <p style={{ margin: 0 }}>
              Documento de uso interno. El presupuesto que recibe el cliente se genera con la
              herramienta del proveedor. Los importes son totales del viaje, expresados en{' '}
              {moneda || 'USD'}.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cerrar resumen
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={15} />
            <span>Imprimir / Exportar a PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
