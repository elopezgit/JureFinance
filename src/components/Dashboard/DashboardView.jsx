// DashboardView.jsx - Agency Performance & Profit Metrics (Cyber-Fintech Aesthetic)
import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Plane,
  Building2,
  Calendar,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Car,
  Sparkles,
  Hotel
} from 'lucide-react';
import { normalizarServicios, SECCION_LABEL } from '../../services/serviciosService';

export default function DashboardView({
  cotizaciones = [],
  onNavigateToCotizador,
  onNavigateToDrive
}) {
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Cálculos agregados
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
        serviceDistribution[item.tipo] += (Number(item.precioVenta) || costoItem || 1);
      }

      if (item.vencimientoTTOO) {
        upcomingDeadlines.push({
          cliente: q.cliente || 'Sin cliente',
          quoteId: q.id,
          servicio: `${SECCION_LABEL[item.tipo] || item.tipo} (${item.proveedor || 'Sin proveedor'})`,
          fechaVencimiento: item.vencimientoTTOO,
          monto: item.montoTotalNeto,
          tipo: item.tipo
        });
      }
    });

    totalCotizadoVenta += venta;
    totalNetoAgencia += neto;
    totalGananciaReal += (venta - neto);
    totalPaxCount += Number(q.pax) || 1;
  });

  const margenPromedioGlobal =
    totalCotizadoVenta > 0 ? (totalGananciaReal / totalCotizadoVenta) * 100 : 0;

  const totalQuotesCount = Math.max(cotizaciones.length, 1);
  const conversionRate = Math.round(((statusCounts.Aceptada + statusCounts.Pagada) / totalQuotesCount) * 100);

  // Ordenar vencimientos por fecha
  upcomingDeadlines.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Datos para el mini calendario interactivo
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0

  // Total de servicios para porcentaje
  const totalServicesVolume = Object.values(serviceDistribution).reduce((a, b) => a + b, 0) || 1;

  // Fechas con vencimiento en este mes para pintar el calendario
  const datesWithEvents = new Set(
    upcomingDeadlines
      .map(d => d.fechaVencimiento)
      .filter(f => f && f.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
      .map(f => parseInt(f.slice(8, 10), 10))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Franja Superior de 4 Tarjetas KPI */}
      <div className="metrics-strip">
        {/* KPI 1: Ventas Cotizadas */}
        <div className="metric-card">
          <div className="metric-label">
            <span>Total Ventas Cotizadas</span>
            <DollarSign size={16} color="var(--neon-cyan)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--neon-cyan)', textShadow: '0 0 12px rgba(0, 245, 212, 0.4)' }}>
            USD ${totalCotizadoVenta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-sub">
            <span className="badge badge-info">{cotizaciones.length} propuestas registradas</span>
          </div>
        </div>

        {/* KPI 2: Costo de Compra TTOO */}
        <div className="metric-card">
          <div className="metric-label">
            <span>Costo Real Compra (TTOO)</span>
            <Building2 size={16} color="var(--primary-light)" />
          </div>
          <div className="metric-value">
            USD ${totalNetoAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-sub">
            <span>Obligaciones netas con proveedores</span>
          </div>
        </div>

        {/* KPI 3: Ganancia Real Neta */}
        <div className="metric-card highlight-profit">
          <div className="metric-label">
            <span>Ganancia Real Total</span>
            <TrendingUp size={16} color="var(--neon-emerald)" />
          </div>
          <div className="metric-value" style={{ color: '#00f5d4', textShadow: '0 0 14px rgba(0, 245, 212, 0.5)' }}>
            USD ${totalGananciaReal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-sub">
            <span className="badge badge-success">Margen Promedio {margenPromedioGlobal.toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 4: Pasajeros Cotizados */}
        <div className="metric-card">
          <div className="metric-label">
            <span>Pasajeros Cotizados</span>
            <Users size={16} color="var(--neon-pink)" />
          </div>
          <div className="metric-value">
            {totalPaxCount} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>PAX</span>
          </div>
          <div className="metric-sub">
            <span className="badge badge-danger">{(totalPaxCount / (cotizaciones.length || 1)).toFixed(1)} pax / viaje</span>
          </div>
        </div>
      </div>

      {/* 2. Visual Neon Gauges & Segmented Bars (Inspirado en el modelo Cyber-Dashboard) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
        {/* 3 Medidores Circulares Neón */}
        <div
          className="card"
          style={{
            gridColumn: 'span 7',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px'
          }}
        >
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div className="card-title-group">
              <div className="card-icon">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="card-title">Métricas de Conversión & Eficiencia</h3>
                <span className="card-subtitle">Indicadores circulares de rendimiento comercial</span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              textAlign: 'center',
              alignItems: 'center'
            }}
          >
            {/* Medidor 1: Propuestas */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#00f5d4"
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * Math.min(cotizaciones.length * 10, 100)) / 100}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(0, 245, 212, 0.6))' }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    color: '#ffffff'
                  }}
                >
                  {cotizaciones.length}
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>
                PROPUESTAS
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Activas en sistema</div>
            </div>

            {/* Medidor 2: Tasa de Cierre */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255, 42, 133, 0.2)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#ff2a85"
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * conversionRate) / 100}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(255, 42, 133, 0.6))' }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    color: '#ff2a85',
                    textShadow: '0 0 10px rgba(255, 42, 133, 0.5)'
                  }}
                >
                  {conversionRate}%
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>
                TASA CIERRE
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Aceptadas y pagadas</div>
            </div>

            {/* Medidor 3: Margen Promedio */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(250, 204, 21, 0.2)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#facc15"
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * Math.min(margenPromedioGlobal, 100)) / 100}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.6))' }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    color: '#facc15',
                    textShadow: '0 0 10px rgba(250, 204, 21, 0.5)'
                  }}
                >
                  {margenPromedioGlobal.toFixed(0)}%
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>
                MARGEN NETO
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ganancia / Venta total</div>
            </div>
          </div>
        </div>

        {/* Barras Segmentadas Neón por Categoría de Servicio */}
        <div
          className="card"
          style={{
            gridColumn: 'span 5',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px'
          }}
        >
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div>
              <h3 className="card-title">Distribución por Servicio</h3>
              <span className="card-subtitle">Volumen operado por prestación</span>
            </div>
            <span className="badge badge-info">100% Cartera</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Vuelos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
                  <Plane size={13} color="var(--neon-cyan)" /> Aéreos & Vuelos
                </span>
                <span style={{ fontWeight: 700, color: 'var(--neon-cyan)' }}>
                  {Math.round((serviceDistribution.aereo / totalServicesVolume) * 100)}%
                </span>
              </div>
              <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(5, Math.round((serviceDistribution.aereo / totalServicesVolume) * 100))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #00f5d4, #0284c7)',
                    boxShadow: '0 0 8px rgba(0, 245, 212, 0.5)'
                  }}
                />
              </div>
            </div>

            {/* Hoteles */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
                  <Hotel size={13} color="var(--neon-amber)" /> Hoteles & Resorts
                </span>
                <span style={{ fontWeight: 700, color: 'var(--neon-amber)' }}>
                  {Math.round((serviceDistribution.hotel / totalServicesVolume) * 100)}%
                </span>
              </div>
              <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(5, Math.round((serviceDistribution.hotel / totalServicesVolume) * 100))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #facc15, #ff7849)',
                    boxShadow: '0 0 8px rgba(250, 204, 21, 0.5)'
                  }}
                />
              </div>
            </div>

            {/* Traslados */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
                  <Car size={13} color="#c084fc" /> Traslados
                </span>
                <span style={{ fontWeight: 700, color: '#c084fc' }}>
                  {Math.round((serviceDistribution.traslados / totalServicesVolume) * 100)}%
                </span>
              </div>
              <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(5, Math.round((serviceDistribution.traslados / totalServicesVolume) * 100))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                    boxShadow: '0 0 8px rgba(168, 85, 247, 0.5)'
                  }}
                />
              </div>
            </div>

            {/* Asistencia */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
                  <ShieldCheck size={13} color="var(--neon-emerald)" /> Asistencia Médica
                </span>
                <span style={{ fontWeight: 700, color: 'var(--neon-emerald)' }}>
                  {Math.round((serviceDistribution.asistencia / totalServicesVolume) * 100)}%
                </span>
              </div>
              <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(5, Math.round((serviceDistribution.asistencia / totalServicesVolume) * 100))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #00f5d4)',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Fila Intermedia: Curva Neón Ondulada & Mini Calendario de Operaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
        {/* Curva Neón Ondulada (Estilo gráfico de la imagen de referencia) */}
        <div className="card" style={{ gridColumn: 'span 8', padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <div className="card-title-group">
              <div className="card-icon" style={{ background: 'rgba(255, 42, 133, 0.15)', color: 'var(--neon-pink)' }}>
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="card-title">Curva de Cotización & Tendencia</h3>
                <span className="card-subtitle">Evolución de ventas y márgenes registrados</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-pink)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--neon-pink)', boxShadow: '0 0 6px var(--neon-pink)' }} />
                Ventas
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-cyan)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--neon-cyan)', boxShadow: '0 0 6px var(--neon-cyan)' }} />
                Ganancia Neta
              </span>
            </div>
          </div>

          {/* Gráfico SVG Neón con ondas y gradiente translúcido */}
          <div style={{ position: 'relative', width: '100%', height: '180px', marginTop: '10px' }}>
            <svg viewBox="0 0 600 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="neonPinkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff2a85" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ff2a85" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="neonCyanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f5d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00f5d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Líneas horizontales de guía */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4 4" />
              <line x1="0" y1="130" x2="600" y2="130" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4 4" />

              {/* Relleno con gradiente bajo la curva rosa */}
              <path
                d="M 20 150 Q 120 170 200 110 T 380 40 T 520 80 T 580 50 L 580 170 L 20 170 Z"
                fill="url(#neonPinkGrad)"
              />

              {/* Curva Rosa Neón (Ventas) */}
              <path
                d="M 20 150 Q 120 170 200 110 T 380 40 T 520 80 T 580 50"
                fill="none"
                stroke="#ff2a85"
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 8px rgba(255, 42, 133, 0.7))' }}
              />

              {/* Curva Cyan Neón (Ganancia) */}
              <path
                d="M 20 160 Q 120 155 200 135 T 380 90 T 520 115 T 580 95"
                fill="none"
                stroke="#00f5d4"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 8px rgba(0, 245, 212, 0.7))' }}
              />

              {/* Puntos destacados con halos brillantes */}
              <circle cx="200" cy="110" r="5" fill="#ffffff" stroke="#ff2a85" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 6px #ff2a85)' }} />
              <circle cx="380" cy="40" r="5" fill="#ffffff" stroke="#ff2a85" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 6px #ff2a85)' }} />
              <circle cx="520" cy="80" r="5" fill="#ffffff" stroke="#ff2a85" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 6px #ff2a85)' }} />

              <circle cx="380" cy="90" r="4.5" fill="#ffffff" stroke="#00f5d4" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 6px #00f5d4)' }} />
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', padding: '0 10px' }}>
            <span>Cotizaciones Recientes</span>
            <span>Propuestas en Trámite</span>
            <span>Cierres de Mes</span>
            <span>Objetivo Superado</span>
          </div>
        </div>

        {/* Mini Calendario de Operaciones (Inspirado en el widget del modelo) */}
        <div className="card" style={{ gridColumn: 'span 4', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button
              className="btn btn-secondary btn-icon-only"
              onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
              style={{ width: '30px', height: '30px' }}
            >
              <ChevronLeft size={15} />
            </button>
            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff', letterSpacing: '0.04em' }}>
              {monthNames[month]} {year}
            </div>
            <button
              className="btn btn-secondary btn-icon-only"
              onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
              style={{ width: '30px', height: '30px' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Días de la semana en letras simples: D L M M J V S */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <span key={i} style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                {d}
              </span>
            ))}
          </div>

          {/* Celdas numéricas del mini calendario */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} style={{ height: '30px' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const hasEvent = datesWithEvents.has(dayNum);
              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={dayNum}
                  style={{
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: isToday || hasEvent ? 800 : 500,
                    borderRadius: '8px',
                    color: isToday ? '#0c071e' : hasEvent ? '#ff2a85' : '#cbd5e1',
                    background: isToday
                      ? 'var(--neon-cyan)'
                      : hasEvent
                      ? 'rgba(255, 42, 133, 0.18)'
                      : 'transparent',
                    border: hasEvent ? '1px solid rgba(255, 42, 133, 0.45)' : 'none',
                    boxShadow: isToday
                      ? '0 0 10px rgba(0, 245, 212, 0.6)'
                      : hasEvent
                      ? '0 0 8px rgba(255, 42, 133, 0.3)'
                      : 'none',
                    cursor: 'default'
                  }}
                  title={hasEvent ? `Vencimiento programado el día ${dayNum}` : undefined}
                >
                  {dayNum}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-cyan)' }} /> Hoy
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-pink)', marginLeft: '12px' }} /> Vencimiento de pago
          </div>
        </div>
      </div>

      {/* 4. Fila Inferior: Vencimientos Próximos de Operadores & Timeline de Estados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        {/* Tabla de Vencimientos de Operadores (8 cols) */}
        <div style={{ gridColumn: 'span 8' }} className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon" style={{ background: 'var(--danger-bg)', color: 'var(--neon-pink)' }}>
                <Clock size={18} />
              </div>
              <div>
                <h3 className="card-title">Vencimientos Próximos de Operadores</h3>
                <span className="card-subtitle">
                  Fechas límite de pago para evitar la caída de cupos reservados
                </span>
              </div>
            </div>
            <span className="badge badge-warning">{upcomingDeadlines.length} vencimientos activos</span>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={36} color="var(--neon-cyan)" style={{ margin: '0 auto 10px' }} />
              <h3>Todo al día</h3>
              <p>No hay obligaciones de pago inmediatas con operadores registradas.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingDeadlines.slice(0, 5).map((dl, idx) => {
                const targetDate = new Date(dl.fechaVencimiento);
                const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
                const isUrgent = diffDays <= 2;
                const isExpired = diffDays < 0;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      background: isUrgent ? 'rgba(255, 42, 133, 0.12)' : 'rgba(20, 13, 44, 0.7)',
                      border: `1.5px solid ${isUrgent ? 'rgba(255, 42, 133, 0.45)' : 'var(--border)'}`,
                      boxShadow: isUrgent ? '0 0 16px rgba(255, 42, 133, 0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#ffffff' }}>
                          {dl.cliente}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {dl.quoteId}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        {dl.servicio} • Costo neto: <strong style={{ color: '#ffffff' }}>${Number(dl.monto).toFixed(2)}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        {dl.fechaVencimiento}
                      </div>
                      <div style={{ marginTop: '3px' }}>
                        {isExpired ? (
                          <span className="badge badge-danger">Vencido</span>
                        ) : isUrgent ? (
                          <span className="badge badge-danger urgent-indicator">
                            {diffDays === 0 ? '¡Vence Hoy!' : `¡Quedan ${diffDays} días!`}
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

        {/* Acciones Rápidas & Guía de Rentabilidad (4 cols) */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Actions Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={17} color="var(--neon-cyan)" />
              Operaciones Rápidas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={onNavigateToCotizador}
                style={{ justifyContent: 'flex-start', height: '46px' }}
              >
                <Plane size={17} />
                <span>Iniciar Nueva Cotización</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={onNavigateToDrive}
                style={{ justifyContent: 'flex-start', height: '46px' }}
              >
                <FileCheck size={17} style={{ color: 'var(--neon-cyan)' }} />
                <span>Expedientes en Google Drive</span>
              </button>
            </div>
          </div>

          {/* Recordatorio de Rentabilidad y Fórmulas */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 13, 44, 0.8) 100%)',
              borderColor: 'rgba(139, 92, 246, 0.35)'
            }}
          >
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--neon-cyan)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} />
              Reglas de Rentabilidad Agencia
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              <div>• <strong>Venta Total:</strong> Lo que abona el cliente según presupuesto.</div>
              <div>• <strong>Costo Real:</strong> Cotización mayorista de compra pactada con el TTOO.</div>
              <div>• <strong>Ganancia Neta:</strong> Margen neto real retenido por la agencia.</div>
              <div>• <strong>Autonomía:</strong> Podés cotizar con un TTOO y emitir con otro si mejora el precio.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
