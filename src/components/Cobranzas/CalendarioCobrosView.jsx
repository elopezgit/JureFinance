// CalendarioCobrosView.jsx - Cuentas a cobrar a clientes.
//
// Organiza la agenda de cobranza (semana / mes / todos), permite filtrar y
// ordenar los viajes por fecha, valor, destino o cliente, y registra pagos con:
//   · un número de operación que cubre el paquete,
//   · pagos parciales por servicio (vuelo, hotel, traslado...) en distintas
//     monedas, con equivalente opcional para imputar al saldo,
//   · pagos generales "a cuenta" que se reparten FIFO entre los viajes,
//   · nota libre y marca "en caja".
// El historial agrupa las líneas de un mismo comprobante y muestra a qué se
// aplicó cada pago.

import React, { useMemo, useState } from 'react';
import {
  HandCoins, Info, Users, ArrowDownCircle, TrendingUp, CalendarClock,
  Plus, CreditCard, Trash2, Search, ReceiptText, Wallet, ChevronDown,
  CalendarDays, Filter, ArrowUpDown, CheckCircle2
} from 'lucide-react';
import CalendarioMensual from '../Calendario/CalendarioMensual';
import RegistrarCobroModal from './RegistrarCobroModal';
import ConfirmDialog from '../Common/ConfirmDialog';
import {
  derivarCobrosDesdeCotizaciones,
  imputarPagosPorViaje,
  viajesProximosConSaldo,
  resumenFinanciero,
  generarCSVCobros,
  generarCSVPagosClientes,
  cobrosParaAgenda,
  agruparCobrosPorFecha,
  rangoAgenda,
  estadoSemaforo,
  totalesPagosPorMoneda,
  MONEDAS_COBRO
} from '../../services/cobroService';
import { formatearMonto, formatFechaLarga, mesDeISO, hoyISO } from '../../services/calendarioService';

const ESTADOS_AGENDA = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial', label: 'Pago parcial' },
  { value: 'cobrado', label: 'Cobrado' },
  { value: 'vencido', label: 'Vencido' }
];

const ORDENES = [
  { value: 'fecha', label: 'Fecha de viaje' },
  { value: 'valor', label: 'Valor (saldo)' },
  { value: 'destino', label: 'Destino' },
  { value: 'cliente', label: 'Cliente' }
];

function descargarCSV(contenido, nombre) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Agrupa los registros de pago por operación/comprobante para el historial. */
function agruparHistorial(pagos = []) {
  const mapa = new Map();
  pagos.forEach((pago) => {
    const clave = pago.grupoPagoId || pago.id;
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        id: clave,
        fecha: pago.fecha,
        cliente: pago.cliente,
        numeroOperacion: pago.numeroOperacion || '',
        medio: pago.medio || '',
        enCaja: pago.enCaja !== false,
        nota: pago.nota || '',
        pagos: []
      });
    }
    mapa.get(clave).pagos.push(pago);
  });
  return [...mapa.values()].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
}

export default function CalendarioCobrosView({
  cotizaciones = [],
  onIrACotizador,
  pagosClientes = [],
  onRegistrarCobroCliente,
  onRegistrarCobrosClientesLote,
  onEliminarCobroCliente,
  onAbrirFicha
}) {
  const cobros = useMemo(() => derivarCobrosDesdeCotizaciones(cotizaciones), [cotizaciones]);
  const cobrosImputados = useMemo(() => imputarPagosPorViaje(cobros, pagosClientes), [cobros, pagosClientes]);
  const resumen = useMemo(() => resumenFinanciero(cobros, pagosClientes), [cobros, pagosClientes]);
  const clientesUnicos = useMemo(
    () => [...new Set((cobros || []).map((c) => c.cliente))].sort((a, b) => a.localeCompare(b)),
    [cobros]
  );
  const monedaGeneral = cobros[0]?.moneda || 'USD';

  const [vista, setVista] = useState('agenda');
  const [rango, setRango] = useState('semana');
  const [filtros, setFiltros] = useState({
    cliente: '', moneda: '', estado: '', destino: '', orden: 'fecha'
  });
  const [mesCalendario, setMesCalendario] = useState(() =>
    cobros[0]?.fechaReferencia ? mesDeISO(cobros[0].fechaReferencia) : mesDeISO(hoyISO())
  );
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  const hoy = hoyISO();
  const rangoActual = useMemo(() => rangoAgenda(rango, hoy), [rango, hoy]);

  const agenda = useMemo(
    () => cobrosParaAgenda(cobrosImputados, { rango, fecha: hoy, ...filtros }),
    [cobrosImputados, rango, hoy, filtros]
  );
  const gruposAgenda = useMemo(() => agruparCobrosPorFecha(agenda), [agenda]);
  const viajesProximos = useMemo(() => viajesProximosConSaldo(cobrosImputados, 14), [cobrosImputados]);
  const monedasEnAgenda = useMemo(() => [...new Set(agenda.map((c) => c.moneda || 'USD'))], [agenda]);
  const totalAgendaPorMoneda = useMemo(() => {
    const totales = {};
    agenda.forEach((c) => {
      const moneda = c.moneda || 'USD';
      totales[moneda] = (totales[moneda] || 0) + Math.max(Number(c.saldo) || 0, 0);
    });
    return totales;
  }, [agenda]);

  const eventosCalendario = useMemo(
    () => cobrosImputados.map((c) => ({
      fecha: c.fechaReferencia,
      monto: c.montoTotal,
      nivel: c.saldo <= 0.005 ? 'pagado' : 'proximo'
    })),
    [cobrosImputados]
  );
  const cobrosDelDia = useMemo(
    () => (diaSeleccionado ? cobrosImputados.filter((c) => c.fechaReferencia === diaSeleccionado) : []),
    [cobrosImputados, diaSeleccionado]
  );

  const balancePorCliente = useMemo(() => clientesUnicos.map((cliente) => {
    const viajes = cobrosImputados.filter((c) => c.cliente === cliente);
    const ventas = viajes.reduce((a, c) => a + (Number(c.montoTotal) || 0), 0);
    const cobrado = viajes.reduce((a, c) => a + (Number(c.pagado) || 0), 0);
    return { cliente, ventas, cobrado, saldo: Math.max(ventas - cobrado, 0), viajes };
  }), [cobrosImputados, clientesUnicos]);

  /* ---------------- Modal de registro de pago ---------------- */
  const [modalPago, setModalPago] = useState({ abierto: false, cobro: null, clave: 0 });
  const abrirModalPago = (cobro = null) =>
    setModalPago((prev) => ({ abierto: true, cobro, clave: prev.clave + 1 }));

  const registrarPagos = (pagos = []) => {
    if (typeof onRegistrarCobrosClientesLote === 'function') {
      onRegistrarCobrosClientesLote(pagos);
    } else {
      pagos.forEach((pago) => onRegistrarCobroCliente(pago));
    }
  };

  /* ---------------- Historial por cliente ---------------- */
  const [clienteHistorial, setClienteHistorial] = useState('');
  const historial =
    clienteHistorial === '__todos__' ? pagosClientes : pagosClientes.filter((p) => p.cliente === clienteHistorial);
  const gruposHistorial = useMemo(() => agruparHistorial(historial), [historial]);
  const totalesHistorial = useMemo(() => totalesPagosPorMoneda(historial), [historial]);

  const [grupoAEliminar, setGrupoAEliminar] = useState(null);
  const eliminarGrupo = (grupo) => setGrupoAEliminar(grupo);
  const confirmarEliminarGrupo = () => {
    (grupoAEliminar?.pagos || []).forEach((p) => onEliminarCobroCliente(p.id));
    setGrupoAEliminar(null);
  };

  return (
    <div>
      {/* Encabezado */}
      <div className="view-header" style={{ marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="section-heading">
          <HandCoins size={16} />
          Cuentas a cobrar a clientes
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onIrACotizador && (
            <button className="btn btn-secondary btn-sm" onClick={onIrACotizador}>Ir al cotizador</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => descargarCSV(generarCSVCobros(cobros, pagosClientes), 'cobros_clientes.csv')}>
            Exportar cobros
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => descargarCSV(generarCSVPagosClientes(pagosClientes), 'historial_pagos_clientes.csv')}>
            Exportar pagos
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => abrirModalPago()}>
            <Plus size={15} /> Registrar cobro
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="metrics-strip">
        <div className="metric-card highlight-profit">
          <div className="metric-label">A cobrar (cartera) <ArrowDownCircle size={15} /></div>
          <div className="metric-value">{formatearMonto(resumen.aCobrar, monedaGeneral)}</div>
          <div className="metric-sub">{resumen.cantidadPendientes} pendiente(s) · {resumen.cantidadParciales} parcial(es)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Cobrado</div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {formatearMonto(resumen.cobrado, monedaGeneral)}
          </div>
          <div className="metric-sub">{resumen.cantidadCobradas} viaje(s) cobrado(s)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><TrendingUp size={15} /> Total de ventas</div>
          <div className="metric-value">{formatearMonto(resumen.totalCartera, monedaGeneral)}</div>
          <div className="metric-sub">Suma del precio de venta</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><Wallet size={15} /> Ingresos registrados</div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {Object.entries(totalesPagosPorMoneda(pagosClientes)).map(([moneda, total]) => (
              <div key={moneda}>{formatearMonto(total, moneda)}</div>
            ))}
          </div>
          <div className="metric-sub">{pagosClientes.length} registro(s) de pago</div>
        </div>
      </div>

      {/* Próximos viajes */}
      {viajesProximos.length > 0 && (
        <div className="panel-inset" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px', borderColor: 'var(--warning-border)', background: 'var(--warning-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Info size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <strong style={{ color: 'var(--warning)' }}>
              {viajesProximos.length} viaje(s) próximo(s) con saldo pendiente
            </strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {viajesProximos.slice(0, 5).map((v) => (
              <div key={v.clave} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span><strong style={{ color: 'var(--text-main)' }}>{v.cliente}</strong> — {v.concepto} (en {v.diasRestantes} día{v.diasRestantes === 1 ? '' : 's'})</span>
                <strong className="mono" style={{ color: 'var(--danger)' }}>{formatearMonto(v.saldo, v.moneda)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div className="tabs-bar" style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[
          { value: 'agenda', label: 'Agenda de cobro', icon: CalendarDays },
          { value: 'caja', label: 'Caja por cliente', icon: Users },
          { value: 'historial', label: 'Historial de pagos', icon: ReceiptText }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              className={`btn ${vista === tab.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setVista(tab.value)}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---------------- VISTA AGENDA ---------------- */}
      {vista === 'agenda' && (
        <>
          <div className="card" style={{ marginBottom: '18px' }}>
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon"><Filter size={18} /></div>
                <div>
                  <h3 className="card-title">Organizar agenda de cobranza</h3>
                  <p className="card-subtitle">
                    {agenda.length} cobro(s) en {rangoActual.etiqueta}
                    {rangoActual.inicio ? ` (${rangoActual.inicio} → ${rangoActual.fin})` : ''}
                    {' · '}a cobrar {monedasEnAgenda.map((m) => formatearMonto(totalAgendaPorMoneda[m] || 0, m)).join(' + ')}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              <div>
                <label className="form-label">Período</label>
                <select className="select-field" value={rango} onChange={(e) => setRango(e.target.value)}>
                  <option value="semana">Esta semana</option>
                  <option value="mes">Este mes</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              <div>
                <label className="form-label">Cliente</label>
                <select className="select-field" value={filtros.cliente} onChange={(e) => setFiltros((f) => ({ ...f, cliente: e.target.value }))}>
                  <option value="">Todos los clientes</option>
                  {clientesUnicos.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Moneda</label>
                <select className="select-field" value={filtros.moneda} onChange={(e) => setFiltros((f) => ({ ...f, moneda: e.target.value }))}>
                  <option value="">Todas</option>
                  {MONEDAS_COBRO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Estado</label>
                <select className="select-field" value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS_AGENDA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label"><ArrowUpDown size={12} /> Ordenar por</label>
                <select className="select-field" value={filtros.orden} onChange={(e) => setFiltros((f) => ({ ...f, orden: e.target.value }))}>
                  {ORDENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label"><Search size={12} /> Destino</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Buscar destino..."
                  value={filtros.destino}
                  onChange={(e) => setFiltros((f) => ({ ...f, destino: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setMostrarCalendario((v) => !v)}>
                <CalendarClock size={14} /> {mostrarCalendario ? 'Ocultar calendario mensual' : 'Ver calendario mensual'}
                <ChevronDown size={13} style={{ transform: mostrarCalendario ? 'rotate(180deg)' : 'none' }} />
              </button>
            </div>
            {mostrarCalendario && (
              <div className="cal-layout" style={{ marginTop: '12px' }}>
                <div className="card">
                  <CalendarioMensual
                    mes={mesCalendario}
                    onCambiarMes={setMesCalendario}
                    eventos={eventosCalendario}
                    diaSeleccionado={diaSeleccionado}
                    onSeleccionarDia={setDiaSeleccionado}
                    moneda={monedaGeneral}
                  />
                </div>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <div className="card-icon"><CalendarClock size={18} /></div>
                      <div>
                        <h3 className="card-title">Cobros del día</h3>
                        <p className="card-subtitle">{diaSeleccionado ? formatFechaLarga(diaSeleccionado) : 'Selecciona un día'}</p>
                      </div>
                    </div>
                  </div>
                  {cobrosDelDia.length === 0 ? (
                    <div className="empty-state" style={{ padding: '18px 12px' }}>
                      <p>Sin cobros para este día.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {cobrosDelDia.map((c) => (
                        <div key={c.clave} className="row-soft">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                            <button className="jf-link" onClick={() => onAbrirFicha?.(c.cotizacionId, 'cobros')} title="Ver ficha del viaje">
                              {c.cliente}
                            </button>
                            <strong className="mono">{formatearMonto(c.saldo, c.moneda)}</strong>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.concepto}</div>
                          <button className="btn btn-primary btn-sm" style={{ marginTop: '6px' }} onClick={() => abrirModalPago(c)}>
                            Registrar pago
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {gruposAgenda.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><HandCoins size={24} /></div>
                <h3>Sin cobros en este período</h3>
                <p>Probá con otro rango (semana/mes/todos) o quitá algún filtro.</p>
              </div>
            </div>
          ) : (
            gruposAgenda.map((grupo) => (
              <div className="card" key={grupo.fecha} style={{ marginBottom: '14px' }}>
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="card-icon"><CalendarDays size={18} /></div>
                    <div>
                      <h3 className="card-title">
                        {grupo.fecha === 'sin-fecha' ? 'Sin fecha' : formatFechaLarga(grupo.fecha)}
                      </h3>
                      <p className="card-subtitle">{grupo.cantidad} cobro(s) · a cobrar {formatearMonto(grupo.saldo, monedaGeneral)}</p>
                    </div>
                  </div>
                </div>
                <div className="jf-table-wrap">
                  <table className="jf-table">
                    <caption className="sr-only">Detalle financiero</caption>
                    <thead>
                      <tr>
                        <th scope="col">Cliente</th>
                        <th scope="col">Viaje / Destino</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Pax</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                        <th scope="col">Estado</th>
                        <th scope="col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map((c) => {
                        const sem = estadoSemaforo(c);
                        return (
                          <tr key={c.clave}>
                            <td>
                              <button className="jf-link" onClick={() => onAbrirFicha?.(c.cotizacionId, 'cobros')} title="Ver ficha del viaje">
                                {c.cliente}
                              </button>
                              <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.cotizacionId}</div>
                            </td>
                            <td style={{ maxWidth: '260px' }}>{c.concepto}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>{c.pax}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(c.montoTotal, c.moneda)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: c.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {formatearMonto(c.saldo, c.moneda)}
                            </td>
                            <td><span className={`badge ${sem.badge}`}>{sem.label}</span></td>
                            <td>
                              <button className="btn btn-primary btn-sm" onClick={() => abrirModalPago(c)}>
                                <CreditCard size={13} /> Cobrar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ---------------- VISTA CAJA POR CLIENTE ---------------- */}
      {vista === 'caja' && (
        <div className="card" style={{ marginBottom: '18px' }}>
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon"><Users size={18} /></div>
              <div>
                <h3 className="card-title">Caja por cliente</h3>
                <p className="card-subtitle">Venta, cobrado y saldo; abrí el historial para ver cada pago</p>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => abrirModalPago()}>
              <Plus size={15} /> Registrar cobro
            </button>
          </div>
          {balancePorCliente.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <h3>Sin clientes</h3>
              <p>Cargá cotizaciones para ver la caja por cliente.</p>
            </div>
          ) : (
            <div className="jf-table-wrap">
              <table className="jf-table">
                <caption className="sr-only">Detalle financiero</caption>
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Viajes</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Venta</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Cobrado</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {balancePorCliente.map((b) => (
                    <tr key={b.cliente}>
                      <td style={{ fontWeight: 600 }}>{b.cliente}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{b.viajes.length}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(b.ventas, monedaGeneral)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{formatearMonto(b.cobrado, monedaGeneral)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: b.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {formatearMonto(b.saldo, monedaGeneral)}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setClienteHistorial(b.cliente); setVista('historial'); }}
                        >
                          <ReceiptText size={13} /> Historial
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details style={{ marginTop: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Detalle por viaje</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {balancePorCliente.map((b) => (
                <div key={b.cliente} className="row-soft">
                  <strong>{b.cliente}</strong>
                  <div className="jf-table-wrap" style={{ marginTop: '8px' }}>
                    <table className="jf-table">
                      <caption className="sr-only">Detalle financiero</caption>
                      <thead>
                        <tr>
                          <th scope="col">Viaje</th>
                          <th scope="col">Fecha</th>
                          <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                          <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                          <th scope="col">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.viajes.map((v) => {
                          const sem = estadoSemaforo(v);
                          return (
                            <tr key={v.cotizacionId}>
                              <td>{v.concepto}</td>
                              <td>{v.fechaReferencia ? formatFechaLarga(v.fechaReferencia) : 'Sin fecha'}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(v.montoTotal, v.moneda)}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(v.saldo, v.moneda)}</td>
                              <td><span className={`badge ${sem.badge}`}>{sem.label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ---------------- VISTA HISTORIAL ---------------- */}
      {vista === 'historial' && (
        <div className="card" style={{ marginBottom: '18px' }}>
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon"><ReceiptText size={18} /></div>
              <div>
                <h3 className="card-title">Historial de pagos por cliente</h3>
                <p className="card-subtitle">
                  {gruposHistorial.length} comprobante(s)
                  {' · '}{Object.entries(totalesHistorial).map(([m, t]) => formatearMonto(t, m)).join(' + ') || 'sin pagos'}
                </p>
              </div>
            </div>
            <div style={{ minWidth: '220px' }}>
              <select className="select-field" value={clienteHistorial} onChange={(e) => setClienteHistorial(e.target.value)}>
                <option value="__todos__">Todos los clientes</option>
                {clientesUnicos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {gruposHistorial.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-state-icon"><ReceiptText size={22} /></div>
              <h3>Sin pagos registrados</h3>
              <p>Cuando anotes un cobro vas a ver acá el detalle de a qué se aplicó.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gruposHistorial.map((grupo) => (
                <div key={grupo.id} className="row-soft" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>{grupo.cliente}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {formatFechaLarga(grupo.fecha)} · {grupo.medio}
                        {grupo.numeroOperacion && ` · Nº ${grupo.numeroOperacion}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {grupo.enCaja && <span className="badge badge-success"><CheckCircle2 size={12} /> En caja</span>}
                      <button className="btn btn-danger btn-sm" onClick={() => eliminarGrupo(grupo)} title="Eliminar comprobante">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="jf-table-wrap" style={{ marginTop: '10px' }}>
                    <table className="jf-table">
                      <caption className="sr-only">Detalle financiero</caption>
                      <thead>
                        <tr>
                          <th scope="col">Concepto</th>
                          <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                          <th scope="col">Moneda</th>
                          <th scope="col" style={{ textAlign: 'right' }}>Equivalente imputado</th>
                          <th scope="col">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.pagos.map((pago) => {
                          const aplicaciones = pago.aplicaciones?.length
                            ? pago.aplicaciones
                            : [{ concepto: 'Pago general', monto: pago.monto, moneda: pago.moneda, equivalente: 0, descripcion: pago.nota }];
                          return aplicaciones.map((a, idx) => (
                            <tr key={`${pago.id}-${idx}`}>
                              <td>{a.concepto || 'Pago'}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(a.monto, a.moneda || pago.moneda)}</td>
                              <td>{a.moneda || pago.moneda}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>
                                {a.equivalente ? formatearMonto(a.equivalente, pago.moneda) : '—'}
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {a.descripcion || pago.nota || '—'}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                  {grupo.nota && <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nota: {grupo.nota}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- MODAL REGISTRO DE COBRO (con análisis) ---------------- */}
      {modalPago.abierto && (
        <RegistrarCobroModal
          key={modalPago.clave}
          cobro={modalPago.cobro}
          clienteInicial={filtros.cliente || clientesUnicos[0] || ''}
          clientesUnicos={clientesUnicos}
          cobros={cobros}
          pagosClientes={pagosClientes}
          cotizaciones={cotizaciones}
          onCerrar={() => setModalPago((prev) => ({ ...prev, abierto: false }))}
          onGuardar={registrarPagos}
        />
      )}

      <ConfirmDialog
        open={Boolean(grupoAEliminar)}
        title="Eliminar comprobante"
        message={`¿Eliminar el comprobante ${grupoAEliminar?.numeroOperacion ? `Nº ${grupoAEliminar.numeroOperacion}` : 'seleccionado'}?`}
        warning={`Se borrarán ${grupoAEliminar?.pagos?.length || 0} línea(s) de pago y el saldo de los viajes se recalculará.`}
        confirmLabel="Eliminar comprobante"
        onConfirm={confirmarEliminarGrupo}
        onCancel={() => setGrupoAEliminar(null)}
      />
    </div>
  );
}
