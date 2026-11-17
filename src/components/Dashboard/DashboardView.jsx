// DashboardView.jsx - Métricas y accesos rápidos de la agencia (tema claro/oscuro)
import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Plane,
  Building2,
  FileCheck,
  CheckCircle2,
  Sparkles,
  Hotel,
  Car,
  ShieldCheck
} from 'lucide-react';
import { normalizarServicios, SECCION_LABEL } from '../../services/serviciosService';
import heroLayers from '../../assets/hero.svg';

export default function DashboardView({
  cotizaciones = [],
  onNavigateToCotizador,
  onNavigateToDrive
}) {
  let totalCotizadoVenta = 0;
  let totalNetoAgencia = 0;
  let totalPaxCount = 0;
  let totalGananciaReal = 0;

  const upcomingDeadlines = [];
  const statusCounts = { Borrador: 0, Enviada: 0, Aceptada: 0, Pagada: 0, Vencida: 0 };
  const serviceDistribution = { aereo: 0, hotel: 0, traslados: 0, asistencia: 0, extra: 0 };

  cotizaciones.forEach((q) => {
    const venta = Number(q.precioVentaTotalManual) || 0;
    let neto = 0;

    if (q.estado && statusCounts[q.estado] !== undefined) {
      statusCounts[q.estado]++;
    } else {
      statusCounts.Borrador++;
    }

    const items = normalizarServicios(q.servicios, { pax: q.pax });

    items.forEach((item) => {
      if (!item.activo) return;
      const costoItem = Number(item.montoTotalNeto) || 0;
      neto += costoItem;

      if (serviceDistribution[item.tipo] !== undefined) {
        serviceDistribution[item.tipo] += Number(item.precioVenta) || costoItem || 1;
      }

      if (item.vencimientoTTOO) {
        upcomingDeadlines.push({
          cliente: q.cliente || 'Sin cliente',
          quoteId: q.id,
          servicio: `${SECCION_LABEL[item.tipo] || item.tipo} (${item.proveedor || 'Sin proveedor'})`,
          fechaVencimiento: item.vencimientoTTOO,
          monto: item.montoTotalNeto
        });
      }
    });

    totalCotizadoVenta += venta;
    totalNetoAgencia += neto;
    totalGananciaReal += venta - neto;
    totalPaxCount += Number(q.pax) || 1;
  });

  const margenPromedioGlobal =
    totalCotizadoVenta > 0 ? (totalGananciaReal / totalCotizadoVenta) * 100 : 0;

  const totalQuotesCount = Math.max(cotizaciones.length, 1);
  const _conversionRate = Math.round(
    ((statusCounts.Aceptada + statusCounts.Pagada) / totalQuotesCount) * 100
  );

  upcomingDeadlines.sort(
    (a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalServicesVolume =
    Object.values(serviceDistribution).reduce((a, b) => a + b, 0) || 1;

  const recientes = [...cotizaciones]
    .sort((a, b) => String(b.fechaCotizacion || '').localeCompare(String(a.fechaCotizacion || '')))
    .slice(0, 6);

  const formatMoney = (n) =>
    Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Identidad: las tres capas del negocio */}
      <section className="jf-hero" aria-label="Cómo funciona JureFinance">
        <img className="jf-hero-art" src={heroLayers} alt="Dos capas superpuestas" />
        <div className="jf-hero-copy">
          <span className="jf-hero-eyebrow">El método JureTravel</span>
          <h2 className="jf-hero-title">Cada viaje tiene tres capas</h2>
          <p className="jf-hero-text">
            Lo que se le vende al cliente, lo que realmente cuesta con el proveedor y lo que se cobra
            al final. Acá las tres conviven en un mismo lugar, sin hojas sueltas ni números que se pierden.
          </p>
          {onNavigateToCotizador && (
            <div className="jf-hero-actions">
              <button className="btn btn-primary btn-sm" onClick={onNavigateToCotizador}>
                <Plane size={15} /> Registrar una cotización
              </button>
            </div>
          )}
        </div>
      </section>

      {/* KPIs */}
      <div className="metrics-strip">
        <div className="metric-card">
          <div className="metric-label">
            <span>Total Ventas Cotizadas</span>
            <DollarSign size={16} color="var(--neon-cyan)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--neon-cyan)' }}>
            USD ${formatMoney(totalCotizadoVenta)}
          </div>
          <div className="metric-sub">
            <span className="badge badge-info">{cotizaciones.length} propuestas registradas</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Costo Real Compra (TTOO)</span>
            <Building2 size={16} color="var(--primary-light)" />
          </div>
          <div className="metric-value">USD ${formatMoney(totalNetoAgencia)}</div>
          <div className="metric-sub">
            <span>Obligaciones netas con proveedores</span>
          </div>
        </div>

        <div className="metric-card highlight-profit">
          <div className="metric-label">
            <span>Ganancia Real Total</span>
            <TrendingUp size={16} color="var(--neon-emerald)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--neon-emerald)' }}>
            USD ${formatMoney(totalGananciaReal)}
          </div>
          <div className="metric-sub">
            <span className="badge badge-success">Margen Promedio {margenPromedioGlobal.toFixed(1)}%</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Pasajeros Cotizados</span>
            <Users size={16} color="var(--neon-pink)" />
          </div>
          <div className="metric-value">
            {totalPaxCount}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>PAX</span>
          </div>
          <div className="metric-sub">
            <span className="badge badge-neutral">
              {(totalPaxCount / (cotizaciones.length || 1)).toFixed(1)} pax / viaje
            </span>
          </div>
        </div>
      </div>

      {/* Vencimientos + Acciones */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}
      >
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon" style={{ background: 'var(--danger-bg)', color: 'var(--neon-pink)' }}>
                <Clock size={18} />
              </div>
              <div>
                <h3 className="card-title">Próximos vencimientos</h3>
                <span className="card-subtitle">Fechas límite de pago a proveedores</span>
              </div>
            </div>
            <span className="badge badge-warning">{upcomingDeadlines.length} activos</span>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <CheckCircle2 size={32} color="var(--neon-emerald)" style={{ margin: '0 auto 8px' }} />
              <h3>Todo al día</h3>
              <p>No hay obligaciones de pago inmediatas registradas.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingDeadlines.slice(0, 6).map((dl, idx) => {
                const targetDate = new Date(dl.fechaVencimiento);
                const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
                const isUrgent = diffDays <= 2;
                const isExpired = diffDays < 0;
                return (
                  <div
                    key={idx}
                    className="row-soft"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      background: isUrgent ? 'var(--danger-bg)' : undefined,
                      borderColor: isUrgent ? 'var(--danger-border)' : undefined
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{dl.cliente}</span>
                        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {dl.quoteId}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {dl.servicio} • Costo neto: USD ${Number(dl.monto || 0).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {dl.fechaVencimiento}
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        {isExpired ? (
                          <span className="badge badge-danger">Vencido</span>
                        ) : isUrgent ? (
                          <span className="badge badge-danger">
                            {diffDays === 0 ? 'Vence hoy' : `${diffDays} días`}
                          </span>
                        ) : (
                          <span className="badge badge-info">En {diffDays} días</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <Sparkles size={17} color="var(--neon-cyan)" />
              Operaciones rápidas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={onNavigateToCotizador}
                style={{ justifyContent: 'flex-start', height: '44px' }}
              >
                <Plane size={17} />
                <span>Iniciar nueva cotización</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={onNavigateToDrive}
                style={{ justifyContent: 'flex-start', height: '44px' }}
              >
                <FileCheck size={17} style={{ color: 'var(--neon-cyan)' }} />
                <span>Expedientes en Google Drive</span>
              </button>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
              Distribución por servicio
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { key: 'aereo', label: 'Aéreos', icon: Plane, color: 'var(--neon-cyan)' },
                { key: 'hotel', label: 'Hoteles', icon: Hotel, color: 'var(--neon-amber)' },
                { key: 'traslados', label: 'Traslados', icon: Car, color: 'var(--primary-light)' },
                { key: 'asistencia', label: 'Asistencia', icon: ShieldCheck, color: 'var(--neon-emerald)' }
              ].map(({ key, label, icon: Icon, color }) => {
                const pct = Math.round((serviceDistribution[key] / totalServicesVolume) * 100);
                return (
                  <div key={key}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                        marginBottom: '4px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon size={13} color={color} /> {label}
                      </span>
                      <span style={{ fontWeight: 700, color }}>{pct}%</span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '999px',
                        background: 'var(--bg-subtle)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(4, pct)}%`,
                          height: '100%',
                          background: color,
                          borderRadius: '999px'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--neon-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={15} /> Reglas de rentabilidad
            </h4>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <div>• Venta total: lo que abona el cliente.</div>
              <div>• Costo real: cotización mayorista con el TTOO.</div>
              <div>• Ganancia neta: margen real retenido.</div>
              <div>• Se puede cotizar con un TTOO y emitir con otro.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Últimas cotizaciones */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <FileCheck size={18} />
            </div>
            <div>
              <h3 className="card-title">Últimas cotizaciones</h3>
              <span className="card-subtitle">Actividad reciente registrada</span>
            </div>
          </div>
          <span className="badge badge-neutral">{cotizaciones.length} en total</span>
        </div>

        {recientes.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <CheckCircle2 size={32} color="var(--neon-cyan)" style={{ margin: '0 auto 8px' }} />
            <h3>Sin cotizaciones todavía</h3>
            <p>Creá tu primera cotización desde el botón “Nueva cotización”.</p>
          </div>
        ) : (
          <div className="jf-table-wrap">
            <table className="jf-table">
              <caption className="sr-only">Detalle financiero</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Destino</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Venta</th>
                  <th scope="col">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((q) => {
                  const venta = Number(q.precioVentaTotalManual) || 0;
                  const items = normalizarServicios(q.servicios, { pax: q.pax });
                  const costo = items.reduce((acc, it) => (it.activo ? acc + (Number(it.montoTotalNeto) || 0) : acc), 0);
                  const ganancia = venta - costo;
                  return (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{q.cliente || 'Sin cliente'}</td>
                      <td>{q.destino || '—'}</td>
                      <td>
                        <span className="badge badge-neutral">{q.estado || 'Borrador'}</span>
                      </td>
                      <td className="mono">USD ${formatMoney(venta)}</td>
                      <td
                        className="mono"
                        style={{ color: ganancia >= 0 ? 'var(--neon-emerald)' : 'var(--neon-pink)', fontWeight: 700 }}
                      >
                        USD ${formatMoney(ganancia)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}