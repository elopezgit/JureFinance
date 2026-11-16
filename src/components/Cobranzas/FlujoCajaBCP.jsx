// FlujoCajaBCP.jsx - Reporte financiero del Calendario BCP
// Muestra el total a desembolsar por fecha de vencimiento y el detalle de los
// tickets (cliente + PAX + cotización + emisión + rango BCP) que componen cada
// monto. Los totales siempre se separan por moneda.
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Download,
  Info,
  Search,
  Users,
  Wallet
} from 'lucide-react';
import {
  agruparPorFechaVencimiento,
  agruparTicketsPorProveedor,
  estadoPago,
  etiquetaEstado,
  formatFechaLarga,
  formatearMonto,
  nivelTemporal,
  totalesPorMoneda
} from '../../services/calendarioService';
import { formatMesLabel, shiftMes } from '../../services/ttoService';

function estadoDeGrupo(items = []) {
  const total = items.reduce((acc, p) => acc + (Number(p.montoTotal) || 0), 0);
  const pagado = items.reduce((acc, p) => acc + (Number(p.pagado) || 0), 0);
  return estadoPago({ montoTotal: total, pagado });
}

function textoBusqueda(p) {
  return `${p.cliente || ''} ${p.concepto || ''} ${p.cotizacionId || ''} ${p.destino || ''} ${
    Array.isArray(p.pasajeros) ? p.pasajeros.join(' ') : ''
  } ${p.proveedor || ''}`.toLowerCase();
}

export default function FlujoCajaBCP({
  pagos = [],
  mes,
  onCambiarMes,
  verTodos,
  onToggleVerTodos,
  moneda = 'todas',
  onCambiarMoneda,
  monedas = [],
  proveedores = [],
  filtroProveedor = 'todos',
  onCambiarProveedor,
  onPagar,
  onPagarBloque,
  onExportarCSV,
  hoy
}) {
  const [gruposAbiertos, setGruposAbiertos] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroRegla, setFiltroRegla] = useState('todas');
  const [vista, setVista] = useState('fecha'); // 'fecha' | 'proveedor'
  const [detallado, setDetallado] = useState(false);

  const pagosVisibles = useMemo(() => {
    let base = moneda === 'todas' ? pagos : pagos.filter((p) => (p.moneda || 'USD') === moneda);
    if (filtroProveedor !== 'todos') base = base.filter((p) => p.proveedor === filtroProveedor);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      base = base.filter((p) => textoBusqueda(p).includes(q));
    }
    if (filtroEstado !== 'todos') {
      base = base.filter((p) => {
        const et = etiquetaEstado(p, hoy);
        const txt = (et.texto || '').toLowerCase();
        if (filtroEstado === 'vencido') return txt.includes('vencido');
        if (filtroEstado === 'pagado') return txt === 'pagado';
        if (filtroEstado === 'parcial') return txt === 'parcial';
        if (filtroEstado === 'pendiente') return txt === 'pendiente' || txt === 'vence hoy';
        return true;
      });
    }
    if (filtroRegla !== 'todas') {
      base = base.filter((p) => {
        if (filtroRegla === 'bcp') return p.origenVencimiento === 'bcp';
        if (filtroRegla === 'semana') return p.origenVencimiento === 'semana-antes-viaje';
        if (filtroRegla === 'manual') return p.origenVencimiento === 'manual';
        if (filtroRegla === 'sinfecha') return !p.fechaVencimiento;
        return true;
      });
    }
    return base;
  }, [pagos, moneda, filtroProveedor, busqueda, filtroEstado, filtroRegla, hoy]);

  const totales = useMemo(() => totalesPorMoneda(pagosVisibles, hoy), [pagosVisibles, hoy]);
  const grupos = useMemo(() => agruparPorFechaVencimiento(pagosVisibles), [pagosVisibles]);

  const totalTickets = pagosVisibles.length;
  const totalPax = pagosVisibles.reduce((acc, p) => acc + (Number(p.pax) || 1), 0);
  const totalBloques = useMemo(
    () => grupos.reduce((acc, g) => acc + agruparTicketsPorProveedor(g.items).length, 0),
    [grupos]
  );

  // Colapso inteligente: por defecto abiertos los grupos vencidos o con vencimiento hoy
  const estaAbierto = (fecha) => {
    if (gruposAbiertos[fecha] !== undefined) return gruposAbiertos[fecha];
    if (!fecha) return false;
    const hoyStr = hoy || '';
    const nivel = nivelTemporal({ estado: 'Pendiente', fechaVencimiento: fecha }, hoyStr);
    return nivel === 'vencido' || nivel === 'hoy';
  };
  const toggleGrupo = (fecha) => {
    setGruposAbiertos((prev) => ({ ...prev, [fecha]: !estaAbierto(fecha) }));
  };

  const totalesVisibles = moneda === 'todas' ? totales : totales.filter((t) => t.moneda === moneda);

  // Alertas
  const alertas = useMemo(() => {
    const hoyStr = hoy || '';
    const vencidos = pagosVisibles.filter(
      (p) => p.estado !== 'Pagado' && p.fechaVencimiento && p.fechaVencimiento < hoyStr
    );
    const proximos = pagosVisibles.filter((p) => {
      if (p.estado === 'Pagado' || !p.fechaVencimiento) return false;
      const d = (new Date(`${p.fechaVencimiento}T00:00:00`) - new Date(`${hoyStr}T00:00:00`)) / 86400000;
      return d >= 0 && d <= 7;
    });
    return { vencidos, proximos };
  }, [pagosVisibles, hoy]);

  // Running total por fecha
  const runningTotal = useMemo(() => {
    
    return grupos.map((g, i) => {
      const t = (g.monedas || []).reduce((a, m) => a + (Number(m.montoTotal) || 0), 0);
      
      return { fecha: g.fecha, total: t, acumulado: grupos.slice(0, i + 1).reduce((suma, actual) => suma + (actual.monedas || []).reduce((a, moneda) => a + (Number(moneda.montoTotal) || 0), 0), 0) };
    });
  }, [grupos]);

  // Datos para gráfico de barras por fecha
  const chartData = useMemo(() => {
    const max = Math.max(...grupos.map((g) => (g.monedas || []).reduce((a, m) => a + (Number(m.montoTotal) || 0), 0)), 1);
    return grupos.map((g) => {
      const t = (g.monedas || []).reduce((a, m) => a + (Number(m.montoTotal) || 0), 0);
      const estado = estadoDeGrupo(g.items);
      return { fecha: g.fecha, total: t, pct: (t / max) * 100, estado };
    });
  }, [grupos]);

  // Vista por proveedor
  const gruposPorProveedor = useMemo(() => {
    const mapa = new Map();
    pagosVisibles.forEach((p) => {
      const prov = p.proveedor || 'Sin proveedor';
      if (!mapa.has(prov)) mapa.set(prov, { proveedor: prov, moneda: p.moneda || 'USD', items: [], total: 0, pagado: 0, saldo: 0, fechas: new Set() });
      const g = mapa.get(prov);
      g.items.push(p);
      g.total += Number(p.montoTotal) || 0;
      g.pagado += Number(p.pagado) || 0;
      g.saldo += Math.max(Number(p.saldo) || 0, 0);
      if (p.fechaVencimiento) g.fechas.add(p.fechaVencimiento);
    });
    return [...mapa.values()]
      .map((g) => ({ ...g, fechas: [...g.fechas].sort(), cantidad: g.items.length }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [pagosVisibles]);

  return (
    <div>
      {/* Barra de filtros del reporte */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="section-heading" style={{ fontSize: '0.82rem' }}>
              <CalendarClock size={15} />
              Período del reporte
            </div>

            {!verTodos && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => onCambiarMes(shiftMes(mes, -1))} title="Mes anterior">
                  <ChevronLeft size={14} />
                </button>
                <strong style={{ minWidth: '120px', textAlign: 'center' }}>{formatMesLabel(mes)}</strong>
                <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => onCambiarMes(shiftMes(mes, 1))} title="Mes siguiente">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <button className={verTodos ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={onToggleVerTodos}>
              {verTodos ? 'Viendo todos los meses' : 'Ver todos los meses'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: '26px', minWidth: '180px', height: '32px' }}
                placeholder="Buscar cliente, cotización…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <select className="select-field" value={moneda} onChange={(e) => onCambiarMoneda(e.target.value)} title="Moneda">
              <option value="todas">Todas las monedas</option>
              {monedas.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>

            <select className="select-field" value={filtroProveedor} onChange={(e) => onCambiarProveedor(e.target.value)} title="Proveedor">
              <option value="todos">Todos los proveedores</option>
              {proveedores.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>

            <select className="select-field" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} title="Estado">
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="vencido">Vencido</option>
              <option value="pagado">Pagado</option>
            </select>

            <select className="select-field" value={filtroRegla} onChange={(e) => setFiltroRegla(e.target.value)} title="Regla de vencimiento">
              <option value="todas">Todas las reglas</option>
              <option value="bcp">BCP</option>
              <option value="semana">7 días antes del viaje</option>
              <option value="manual">Manual</option>
              <option value="sinfecha">Sin fecha</option>
            </select>

            <button className={detallado ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setDetallado((v) => !v)} title="Mostrar todas las columnas">
              {detallado ? 'Vista compacta' : 'Vista detallada'}
            </button>

            {onExportarCSV && (
              <button className="btn btn-outline btn-sm" onClick={onExportarCSV}>
                <Download size={14} />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {(alertas.vencidos.length > 0 || alertas.proximos.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {alertas.vencidos.length > 0 && (
            <div className="row-soft is-alert" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
              <span style={{ fontSize: '0.84rem' }}>
                <strong>{alertas.vencidos.length}</strong> obligación(es) vencida(s) sin pagar.
              </span>
            </div>
          )}
          {alertas.proximos.length > 0 && (
            <div className="row-soft" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderLeft: '3px solid var(--warning)' }}>
              <CalendarClock size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: '0.84rem' }}>
                <strong>{alertas.proximos.length}</strong> vencimiento(s) en los próximos 7 días.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Resumen general del período */}
      <div className="metrics-strip" style={{ marginBottom: '16px' }}>
        {totalesVisibles.length === 0 ? (
          <div className="metric-card">
            <div className="metric-label">Total general</div>
            <div className="metric-value">{formatearMonto(0, moneda === 'todas' ? 'USD' : moneda)}</div>
            <div className="metric-sub">Sin obligaciones en el período</div>
          </div>
        ) : (
          totalesVisibles.map((t) => (
            <div className="metric-card" key={t.moneda}>
              <div className="metric-label">Total general · {t.moneda} <Wallet size={15} /></div>
              <div className="metric-value">{formatearMonto(t.montoTotal, t.moneda)}</div>
              <div className="metric-sub">
                {t.cantidad} ticket(s) · {t.totalPax} PAX · saldo {formatearMonto(t.saldo, t.moneda)}
              </div>
            </div>
          ))
        )}

        <div className="metric-card">
          <div className="metric-label">Tickets / PAX <Users size={15} /></div>
          <div className="metric-value">{totalTickets}</div>
          <div className="metric-sub">{totalPax} pasajeros en el período</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Bloques de pago <Building2 size={15} /></div>
          <div className="metric-value">{totalBloques}</div>
          <div className="metric-sub">{grupos.length} fecha(s) de vencimiento</div>
        </div>

        {alertas.vencidos.length > 0 && (
          <div className="metric-card highlight-warning">
            <div className="metric-label">Vencido <AlertTriangle size={15} /></div>
            <div className="metric-value" style={{ color: 'var(--danger)' }}>
              {formatearMonto(alertas.vencidos.reduce((a, p) => a + (Number(p.saldo) || 0), 0), moneda === 'todas' ? 'USD' : moneda)}
            </div>
            <div className="metric-sub">{alertas.vencidos.length} obligación(es) vencidas</div>
          </div>
        )}
      </div>

      {/* Tabs de vista */}
      <div className="toolbar" style={{ marginBottom: '16px', gap: '8px', flexWrap: 'wrap' }}>
        <button className={vista === 'fecha' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setVista('fecha')}>
          Por fecha
        </button>
        <button className={vista === 'proveedor' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setVista('proveedor')}>
          Por proveedor
        </button>
      </div>

      {/* Gráfico de barras por fecha (solo vista por fecha) */}
      {vista === 'fecha' && chartData.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BarChart3 size={15} />
            <strong style={{ fontSize: '0.84rem' }}>Distribución por fecha de pago</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px', overflowX: 'auto' }}>
            {chartData.map((d) => {
              const color =
                d.estado === 'Pagado' ? 'var(--success)' : d.estado === 'Vencido' ? 'var(--danger)' : 'var(--primary)';
              return (
                <div key={d.fecha || 'sin-fecha'} style={{ flex: '1 0 24px', minWidth: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div
                    title={`${d.fecha || 'Sin fecha'}: ${formatearMonto(d.total, moneda === 'todas' ? 'USD' : moneda)}`}
                    style={{
                      width: '100%',
                      height: `${Math.max(d.pct, 4)}%`,
                      background: color,
                      borderRadius: '3px 3px 0 0',
                      opacity: 0.85
                    }}
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {(d.fecha || '').slice(8, 10) || '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista por proveedor */}
      {vista === 'proveedor' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon"><Building2 size={18} /></div>
              <div>
                <h3 className="card-title">Flujo por proveedor</h3>
                <p className="card-subtitle">Totales y fechas de pago por proveedor</p>
              </div>
            </div>
          </div>
          {gruposPorProveedor.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-state-icon"><Building2 size={22} /></div>
              <h3>Sin datos</h3>
              <p>No hay obligaciones para los filtros elegidos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gruposPorProveedor.map((g) => (
                <div key={g.proveedor} className="row-soft" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <Building2 size={14} style={{ color: 'var(--primary-light)' }} />
                      <strong>{g.proveedor}</strong>
                      <span className="badge badge-neutral">{g.moneda}</span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {g.cantidad} ticket(s) · {g.fechas.length} fecha(s)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
                      <div>
                        <div className="metric-label">Total</div>
                        <strong className="mono">{formatearMonto(g.total, g.moneda)}</strong>
                      </div>
                      <div>
                        <div className="metric-label">Pagado</div>
                        <strong className="mono" style={{ color: 'var(--success)' }}>{formatearMonto(g.pagado, g.moneda)}</strong>
                      </div>
                      <div>
                        <div className="metric-label">Saldo</div>
                        <strong className="mono" style={{ color: g.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {formatearMonto(g.saldo, g.moneda)}
                        </strong>
                      </div>
                    </div>
                  </div>
                  {g.fechas.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {g.fechas.map((f) => (
                        <span key={f} className="badge badge-info" title={f}>
                          {formatFechaLarga(f)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detalle por fecha de vencimiento */}
      {vista === 'fecha' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon"><CalendarClock size={18} /></div>
              <div>
                <h3 className="card-title">Flujo de caja por día de vencimiento</h3>
                <p className="card-subtitle">Todo lo emitido en cada rango se acumula y se paga en la fecha indicada</p>
              </div>
            </div>
            <span className="badge badge-info">{grupos.length} {grupos.length === 1 ? 'fecha' : 'fechas'}</span>
          </div>

          {grupos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><CalendarClock size={24} /></div>
              <h3>Sin vencimientos en el período</h3>
              <p>Cargá emisiones con fecha o configurá el calendario BCP del proveedor para ver el flujo de caja.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {grupos.map((grupo) => {
                const abierto = estaAbierto(grupo.fecha);
                const sinFecha = !grupo.fecha;
                const estado = estadoDeGrupo(grupo.items);
                const etiqueta = etiquetaEstado({ estado, fechaVencimiento: grupo.fecha }, hoy);
                const nivel = nivelTemporal({ estado, fechaVencimiento: grupo.fecha }, hoy);
                const gruposProveedor = agruparTicketsPorProveedor(grupo.items);
                const acumulado = (runningTotal.find((r) => r.fecha === grupo.fecha) || {}).acumulado || 0;

                return (
                  <div key={grupo.fecha || 'sin-fecha'} className="row-soft" style={{ borderLeft: `3px solid ${nivel === 'vencido' ? 'var(--danger)' : nivel === 'hoy' ? 'var(--warning)' : nivel === 'pagado' ? 'var(--success)' : 'var(--border)'}` }}>
                    {/* Cabecera de la fecha */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => toggleGrupo(grupo.fecha)} title={abierto ? 'Ocultar detalle' : 'Ver detalle'}>
                          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <strong style={{ fontSize: '0.98rem' }}>
                          {sinFecha ? 'Sin fecha de vencimiento' : formatFechaLarga(grupo.fecha)}
                        </strong>
                        <span className={`badge ${etiqueta.badge}`}>{etiqueta.texto}</span>
                        <span className={`cal-dot nivel-${nivel}`} title={nivel} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {grupo.cantidad} ticket(s) · {grupo.totalPax} PAX
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          acum. {formatearMonto(acumulado, moneda === 'todas' ? 'USD' : moneda)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {grupo.monedas.map((m) => (
                          <div key={m.moneda} style={{ textAlign: 'right' }}>
                            <div className="metric-label" style={{ marginBottom: '2px' }}>{m.moneda}</div>
                            <strong className="mono" style={{ fontSize: '0.95rem' }}>{formatearMonto(m.montoTotal, m.moneda)}</strong>
                            {m.saldo > 0.005 && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>saldo {formatearMonto(m.saldo, m.moneda)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {sinFecha && (
                      <div className="row-soft is-alert" style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
                        <span style={{ fontSize: '0.8rem' }}>
                          Estas obligaciones no tienen fecha de pago. Completá el vencimiento en la oferta o, si es un aéreo, configurá el BCP del proveedor.
                        </span>
                      </div>
                    )}

                    {abierto && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        {gruposProveedor.map((prov) => {
                          const abiertoProv = prov.saldo > 0.005;
                          return (
                            <div key={prov.clave} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                              {/* Cabecera del proveedor / bloque */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-inset)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <Building2 size={14} style={{ color: 'var(--primary-light)' }} />
                                  <strong>{prov.proveedor}</strong>
                                  <span className="badge badge-neutral">{prov.moneda}</span>
                                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                    {prov.cantidad} ticket(s) · {prov.totalPax} PAX
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <strong className="mono">{formatearMonto(prov.montoTotal, prov.moneda)}</strong>
                                    {prov.saldo > 0.005 && (
                                      <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>saldo {formatearMonto(prov.saldo, prov.moneda)}</div>
                                    )}
                                  </div>
                                  {onPagarBloque && grupo.fecha && (
                                    <button className="btn btn-primary btn-sm" onClick={() => onPagarBloque(prov.items[0])} disabled={!abiertoProv} title={abiertoProv ? 'Registrar el pago consolidado del bloque' : 'El bloque ya está pago'}>
                                      <CreditCard size={13} />
                                      <span>Pagar bloque</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Detalle de tickets */}
                              <div className="jf-table-wrap">
                                <table className="jf-table">
                                  <caption className="sr-only">Detalle financiero</caption>
                                  <thead>
                                    <tr>
                                      <th scope="col">Cliente / PAX</th>
                                      <th scope="col">Concepto / Destino</th>
                                      {detallado && <th scope="col">Emisión</th>}
                                      {detallado && <th scope="col">Rango BCP</th>}
                                      <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                                      {detallado && <th scope="col" style={{ textAlign: 'right' }}>Pagado</th>}
                                      <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                                      <th scope="col">Estado</th>
                                      <th scope="col" style={{ textAlign: 'right' }}>Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {prov.items.map((pago) => {
                                      const etiquetaTicket = etiquetaEstado(pago, hoy);
                                      const saldo = Math.max(Number(pago.saldo) || 0, 0);
                                      return (
                                        <tr key={pago.clave}>
                                          <td style={{ minWidth: '180px' }}>
                                            <div style={{ fontWeight: 600 }}>{pago.cliente}</div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                              {pago.pax || 1} PAX{pago.cotizacionId ? ` · ${pago.cotizacionId}` : ''}
                                            </div>
                                            {Array.isArray(pago.pasajeros) && pago.pasajeros.length > 0 && (
                                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }} title={pago.pasajeros.join(', ')}>
                                                {pago.pasajeros.join(', ')}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ maxWidth: '280px' }}>
                                            <div style={{ fontWeight: 600 }}>{pago.concepto}</div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                              {pago.destino || pago.seccionLabel}
                                              {pago.origenVencimiento === 'manual' ? ' · vencimiento manual' : pago.origenVencimiento === 'bcp' ? ' · calculado por BCP' : pago.origenVencimiento === 'semana-antes-viaje' ? ' · 7 días antes del viaje' : ''}
                                            </div>
                                            {(pago.precioVenta > 0) && (
                                              <div style={{ fontSize: '0.71rem', color: 'var(--neon-cyan)', marginTop: '3px' }}>
                                                Cliente: {formatearMonto(pago.precioVenta, pago.moneda)}
                                              </div>
                                            )}
                                          </td>
                                          {detallado && (
                                            <td>
                                              {pago.fechaEmision ? (
                                                <div>
                                                  <div>{formatFechaLarga(pago.fechaEmision)}</div>
                                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                    {pago.seccion === 'aereo' ? 'Emitido confirmado' : 'Reservado'}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span className="badge badge-neutral">Sin emisión</span>
                                              )}
                                            </td>
                                          )}
                                          {detallado && (
                                            <td>
                                              {pago.rangoBCP ? (
                                                <span title={pago.rangoBCP}>
                                                  <span className={`badge ${pago.origenVencimiento === 'semana-antes-viaje' ? 'badge-warning' : 'badge-info'}`}>
                                                    {pago.rangoBCPCorto || pago.rangoBCP}
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className="badge badge-neutral">Sin BCP</span>
                                              )}
                                            </td>
                                          )}
                                          <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(pago.montoTotal, pago.moneda)}</td>
                                          {detallado && (
                                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{formatearMonto(pago.pagado, pago.moneda)}</td>
                                          )}
                                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatearMonto(saldo, pago.moneda)}</td>
                                          <td>
                                            <span className={`badge ${etiquetaTicket.badge}`}>{etiquetaTicket.texto}</span>
                                          </td>
                                          <td>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                              <button className="btn btn-outline btn-sm" onClick={() => onPagar?.(pago)} disabled={saldo <= 0.005 || !onPagar} title={saldo > 0.005 ? 'Registrar pago del ticket' : 'Ya está pago'}>
                                                <CreditCard size={13} />
                                                <span>Pagar</span>
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <Info size={14} />
            <span>
              El detalle incluye cliente, pasajeros (si se cargaron), cantidad de PAX, cotización y rango BCP para auditar cada monto. Los totales no mezclan monedas. Activá "Vista detallada" para ver emisión, rango BCP y pagado.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}