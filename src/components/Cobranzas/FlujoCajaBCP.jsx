// FlujoCajaBCP.jsx - Reporte financiero del Calendario BCP
// Muestra el total a desembolsar por fecha de vencimiento y el detalle de los
// tickets (cliente + PAX + cotización + emisión + rango BCP) que componen cada
// monto. Los totales siempre se separan por moneda.
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Download,
  Info,
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

  // El padre ya filtra por moneda, pero el reporte también lo hace para poder
  // reutilizarse con la lista completa de obligaciones.
  const pagosVisibles = useMemo(
    () =>
      moneda === 'todas'
        ? pagos
        : pagos.filter((p) => (p.moneda || 'USD') === moneda),
    [pagos, moneda]
  );

  const totales = useMemo(
    () => totalesPorMoneda(pagosVisibles, hoy),
    [pagosVisibles, hoy]
  );
  const grupos = useMemo(
    () => agruparPorFechaVencimiento(pagosVisibles),
    [pagosVisibles]
  );

  const totalTickets = pagosVisibles.length;
  const totalPax = pagosVisibles.reduce((acc, p) => acc + (Number(p.pax) || 1), 0);
  const totalBloques = useMemo(
    () =>
      grupos.reduce(
        (acc, grupo) => acc + agruparTicketsPorProveedor(grupo.items).length,
        0
      ),
    [grupos]
  );

  const toggleGrupo = (fecha) => {
    setGruposAbiertos((prev) => ({
      ...prev,
      [fecha]: prev[fecha] === false ? true : false
    }));
  };

  const estaAbierto = (fecha) => gruposAbiertos[fecha] !== false;

  const totalesVisibles =
    moneda === 'todas'
      ? totales
      : totales.filter((t) => t.moneda === moneda);

  return (
    <div>
      {/* Barra de filtros del reporte */}
      <div
        className="card"
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="section-heading" style={{ fontSize: '0.82rem' }}>
            <CalendarClock size={15} />
            Período del reporte
          </div>

          {!verTodos && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm btn-icon-only"
                onClick={() => onCambiarMes(shiftMes(mes, -1))}
                title="Mes anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <strong style={{ minWidth: '120px', textAlign: 'center' }}>
                {formatMesLabel(mes)}
              </strong>
              <button
                className="btn btn-secondary btn-sm btn-icon-only"
                onClick={() => onCambiarMes(shiftMes(mes, 1))}
                title="Mes siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <button
            className={verTodos ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={onToggleVerTodos}
          >
            {verTodos ? 'Viendo todos los meses' : 'Ver todos los meses'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            className="select-field"
            value={moneda}
            onChange={(e) => onCambiarMoneda(e.target.value)}
            title="Moneda"
          >
            <option value="todas">Todas las monedas</option>
            {monedas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            className="select-field"
            value={filtroProveedor}
            onChange={(e) => onCambiarProveedor(e.target.value)}
            title="Proveedor"
          >
            <option value="todos">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {onExportarCSV && (
            <button className="btn btn-outline btn-sm" onClick={onExportarCSV}>
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

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
              <div className="metric-label">
                Total general · {t.moneda} <Wallet size={15} />
              </div>
              <div className="metric-value">{formatearMonto(t.montoTotal, t.moneda)}</div>
              <div className="metric-sub">
                {t.cantidad} ticket(s) · {t.totalPax} PAX · saldo{' '}
                {formatearMonto(t.saldo, t.moneda)}
              </div>
            </div>
          ))
        )}

        <div className="metric-card">
          <div className="metric-label">
            Tickets / PAX <Users size={15} />
          </div>
          <div className="metric-value">{totalTickets}</div>
          <div className="metric-sub">{totalPax} pasajeros en el período</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Bloques de pago <Building2 size={15} />
          </div>
          <div className="metric-value">{totalBloques}</div>
          <div className="metric-sub">
            {grupos.length} fecha(s) de vencimiento
          </div>
        </div>
      </div>

      {/* Detalle por fecha de vencimiento */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <CalendarClock size={18} />
            </div>
            <div>
              <h3 className="card-title">Flujo de caja por día de vencimiento</h3>
              <p className="card-subtitle">
                Todo lo emitido en cada rango BCP se acumula y se paga en la fecha indicada
              </p>
            </div>
          </div>
          <span className="badge badge-info">
            {grupos.length} {grupos.length === 1 ? 'fecha' : 'fechas'}
          </span>
        </div>

        {grupos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <CalendarClock size={24} />
            </div>
            <h3>Sin vencimientos en el período</h3>
            <p>
              Cargá emisiones con fecha o configurá el calendario BCP del proveedor para ver el
              flujo de caja.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {grupos.map((grupo) => {
              const abierto = estaAbierto(grupo.fecha);
              const sinFecha = !grupo.fecha;
              const estado = estadoDeGrupo(grupo.items);
              const etiqueta = etiquetaEstado(
                { estado, fechaVencimiento: grupo.fecha },
                hoy
              );
              const nivel = nivelTemporal(
                { estado, fechaVencimiento: grupo.fecha },
                hoy
              );
              const gruposProveedor = agruparTicketsPorProveedor(grupo.items);

              return (
                <div key={grupo.fecha || 'sin-fecha'} className="row-soft">
                  {/* Cabecera de la fecha */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm btn-icon-only"
                        onClick={() => toggleGrupo(grupo.fecha)}
                        title={abierto ? 'Ocultar detalle' : 'Ver detalle'}
                      >
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
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {grupo.monedas.map((m) => (
                        <div key={m.moneda} style={{ textAlign: 'right' }}>
                          <div className="metric-label" style={{ marginBottom: '2px' }}>
                            {m.moneda}
                          </div>
                          <strong className="mono" style={{ fontSize: '0.95rem' }}>
                            {formatearMonto(m.montoTotal, m.moneda)}
                          </strong>
                          {m.saldo > 0.005 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>
                              saldo {formatearMonto(m.saldo, m.moneda)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {sinFecha && (
                    <div
                      className="row-soft is-alert"
                      style={{
                        marginTop: '10px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                    >
                      <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
                      <span style={{ fontSize: '0.8rem' }}>
                        Estas obligaciones no tienen fecha de pago. Completá el vencimiento en la
                        oferta o, si es un aéreo, configurá el BCP del proveedor.
                      </span>
                    </div>
                  )}

                  {abierto && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      {gruposProveedor.map((prov) => {
                        const abiertoProv = prov.saldo > 0.005;
                        return (
                          <div
                            key={prov.clave}
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Cabecera del proveedor / bloque */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '10px',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: 'var(--bg-inset)'
                              }}
                            >
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
                                  <strong className="mono">
                                    {formatearMonto(prov.montoTotal, prov.moneda)}
                                  </strong>
                                  {prov.saldo > 0.005 && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>
                                      saldo {formatearMonto(prov.saldo, prov.moneda)}
                                    </div>
                                  )}
                                </div>
                                {onPagarBloque && grupo.fecha && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => onPagarBloque(prov.items[0])}
                                    disabled={!abiertoProv}
                                    title={
                                      abiertoProv
                                        ? 'Registrar el pago consolidado del bloque'
                                        : 'El bloque ya está pago'
                                    }
                                  >
                                    <CreditCard size={13} />
                                    <span>Pagar bloque</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Detalle de tickets */}
                            <div className="jf-table-wrap">
                              <table className="jf-table">
                                <thead>
                                  <tr>
                                    <th>Cliente / PAX</th>
                                    <th>Concepto / Destino</th>
                                    <th>Emisión</th>
                                    <th>Rango BCP</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th style={{ textAlign: 'right' }}>Pagado</th>
                                    <th style={{ textAlign: 'right' }}>Saldo</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acción</th>
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
                                            {pago.pax || 1} PAX
                                            {pago.cotizacionId ? ` · ${pago.cotizacionId}` : ''}
                                          </div>
                                          {Array.isArray(pago.pasajeros) && pago.pasajeros.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: '0.72rem',
                                                color: 'var(--text-secondary)',
                                                marginTop: '2px'
                                              }}
                                              title={pago.pasajeros.join(', ')}
                                            >
                                              {pago.pasajeros.join(', ')}
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ maxWidth: '260px' }}>
                                          <div>{pago.concepto}</div>
                                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                            {pago.destino || pago.seccionLabel}
                                            {pago.origenVencimiento === 'manual'
                                              ? ' · vencimiento manual'
                                              : pago.origenVencimiento === 'bcp'
                                                ? ' · calculado por BCP'
                                                : ''}
                                          </div>
                                        </td>
                                        <td>
                                          {pago.fechaEmision ? (
                                            formatFechaLarga(pago.fechaEmision)
                                          ) : (
                                            <span className="badge badge-neutral">Sin emisión</span>
                                          )}
                                        </td>
                                        <td>
                                          {pago.rangoBCP ? (
                                            <span title={pago.rangoBCP}>
                                              <span className="badge badge-info">
                                                {pago.rangoBCPCorto || pago.rangoBCP}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="badge badge-neutral">Sin BCP</span>
                                          )}
                                        </td>
                                        <td className="mono" style={{ textAlign: 'right' }}>
                                          {formatearMonto(pago.montoTotal, pago.moneda)}
                                        </td>
                                        <td
                                          className="mono"
                                          style={{ textAlign: 'right', color: 'var(--success)' }}
                                        >
                                          {formatearMonto(pago.pagado, pago.moneda)}
                                        </td>
                                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                                          {formatearMonto(saldo, pago.moneda)}
                                        </td>
                                        <td>
                                          <span className={`badge ${etiquetaTicket.badge}`}>
                                            {etiquetaTicket.texto}
                                          </span>
                                        </td>
                                        <td>
                                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                              className="btn btn-outline btn-sm"
                                              onClick={() => onPagar?.(pago)}
                                              disabled={saldo <= 0.005 || !onPagar}
                                              title={saldo > 0.005 ? 'Registrar pago del ticket' : 'Ya está pago'}
                                            >
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

        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}
        >
          <Info size={14} />
          <span>
            El detalle incluye cliente, pasajeros (si se cargaron), cantidad de PAX, cotización,
            fecha de emisión y rango BCP para auditar cada monto. Los totales no mezclan monedas.
          </span>
        </div>
      </div>
    </div>
  );
}
