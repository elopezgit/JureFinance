// RegistrarCobroModal.jsx — Alta de cobros de clientes con análisis en vivo.
//
// El formulario se apoya en dos funciones puras de `cobroService`:
//   · `construirPagosDesdeBorrador` genera exactamente lo que se va a guardar.
//   · `analizarRegistroCobro` simula esos pagos con la MISMA imputación que se
//     usa al guardar, para que la proyección y el resultado final coincidan.
// El panel derecho muestra deuda, progreso, impacto por viaje y alertas antes
// de confirmar, de modo que no se pueda cargar un pago "fantasma" sin querer.

import React, { useId, useMemo, useRef, useState } from 'react';
import {
  Info, CheckCircle2, TrendingUp, Wallet, ReceiptText, CreditCard,
  Plus, Trash2, AlertTriangle
} from 'lucide-react';
import {
  analizarRegistroCobro,
  imputarPagosPorViaje,
  serviciosPendientesDeCliente,
  serviciosDeCotizacion,
  MONEDAS_COBRO,
  MEDIOS_COBRO
} from '../../services/cobroService';
import { formatearMonto, hoyISO } from '../../services/calendarioService';
import { useModalA11y } from '../../hooks/useModalA11y';

const TIPOS_COBRO = [
  { value: 'general', label: 'A cuenta', icon: Wallet, hint: 'Se reparte entre sus viajes por fecha (FIFO)' },
  { value: 'paquete', label: 'Un viaje', icon: ReceiptText, hint: 'Una operación cubre esa cotización' },
  { value: 'servicios', label: 'Por servicios', icon: CreditCard, hint: 'Vuelo, hotel, traslados… en distintas monedas' }
];

const pagoVacio = () => ({
  cliente: '',
  tipo: 'general',
  cotizacionId: '',
  monto: '',
  moneda: 'USD',
  equivalente: '',
  fecha: hoyISO(),
  medio: 'Transferencia',
  numeroOperacion: '',
  nota: '',
  enCaja: true
});

function crearFormInicial(cobro, clienteInicial) {
  const base = pagoVacio();
  if (cobro) {
    return {
      ...base,
      cliente: cobro.cliente,
      tipo: 'paquete',
      cotizacionId: cobro.cotizacionId,
      monto: String(Math.round(Math.max(Number(cobro.saldo) || 0, 0) * 100) / 100),
      moneda: cobro.moneda || 'USD'
    };
  }
  return { ...base, cliente: clienteInicial || '' };
}

const COLOR_ALERTA = {
  danger: { color: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-border)', Icon: AlertTriangle },
  warning: { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', Icon: AlertTriangle },
  info: { color: 'var(--primary)', bg: 'var(--bg-subtle)', border: 'var(--border)', Icon: Info },
  ok: { color: 'var(--success)', bg: 'var(--bg-subtle)', border: 'var(--border)', Icon: CheckCircle2 }
};

export default function RegistrarCobroModal({
  cobro = null,
  clienteInicial = '',
  clientesUnicos = [],
  cobros = [],
  pagosClientes = [],
  cotizaciones = [],
  onCerrar,
  onGuardar
}) {
  // El componente se monta con una `key` nueva cada vez que se abre (lo hace la
  // vista), así que estos estados iniciales ya traen el cobro/viaje correcto y
  // no hace falta sincronizar con un effect.
  const uid = useId();
  const rootRef = useRef(null);
  const titleId = `${uid}-titulo`;
  useModalA11y(true, onCerrar, rootRef);

  const [form, setForm] = useState(() => crearFormInicial(cobro, clienteInicial));
  const [lineas, setLineas] = useState([]);
  const [servicioElegido, setServicioElegido] = useState('');

  const cobrosImputados = useMemo(
    () => imputarPagosPorViaje(cobros, pagosClientes),
    [cobros, pagosClientes]
  );
  const viajesDelCliente = useMemo(
    () => cobrosImputados.filter((c) => c.cliente === form.cliente),
    [cobrosImputados, form.cliente]
  );
  const monedaDelViaje = useMemo(
    () => viajesDelCliente.find((c) => c.cotizacionId === form.cotizacionId)?.moneda
      || viajesDelCliente[0]?.moneda
      || 'USD',
    [viajesDelCliente, form.cotizacionId]
  );

  const serviciosDisponibles = useMemo(() => {
    if (!form.cliente) return [];
    if (form.tipo === 'paquete') {
      const quote = cotizaciones.find((q) => q.id === form.cotizacionId);
      return quote ? serviciosDeCotizacion(quote) : [];
    }
    return serviciosPendientesDeCliente(cotizaciones, form.cliente);
  }, [cotizaciones, form.cliente, form.cotizacionId, form.tipo]);

  const borrador = useMemo(() => ({ ...form, lineasServicio: lineas }), [form, lineas]);
  const analisis = useMemo(
    () => analizarRegistroCobro(borrador, { cobros, pagosClientes, cotizaciones }),
    [borrador, cobros, pagosClientes, cotizaciones]
  );
  const totalesLineas = useMemo(
    () => lineas.reduce((acc, l) => {
      const moneda = l.moneda || 'USD';
      acc[moneda] = (acc[moneda] || 0) + (Number(l.monto) || 0);
      return acc;
    }, {}),
    [lineas]
  );

  const cambiarForm = (campo, valor) => {
    setForm((prev) => {
      const next = { ...prev, [campo]: valor };
      if (campo === 'cliente') next.cotizacionId = '';
      if (campo === 'cotizacionId' && prev.tipo === 'paquete') {
        const viaje = viajesDelCliente.find((c) => c.cotizacionId === valor);
        if (viaje) next.moneda = viaje.moneda || 'USD';
      }
      return next;
    });
  };

  const agregarServicio = () => {
    const servicio = serviciosDisponibles.find((s) => `${s.cotizacionId}::${s.itemId}` === servicioElegido);
    if (!servicio) return;
    const yaAgregado = lineas.some((l) => l.cotizacionId === servicio.cotizacionId && l.itemId === servicio.itemId);
    if (yaAgregado) return;
    setLineas((prev) => [
      ...prev,
      {
        key: `${servicio.cotizacionId}::${servicio.itemId}`,
        cotizacionId: servicio.cotizacionId,
        itemId: servicio.itemId,
        concepto: servicio.concepto,
        monto: String(servicio.monto),
        moneda: servicio.moneda,
        equivalente: '',
        descripcion: ''
      }
    ]);
    setServicioElegido('');
  };

  const actualizarLinea = (key, campo, valor) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  };

  const guardar = () => {
    if (!analisis.listoParaGuardar || analisis.pagos.length === 0) return;
    // Se usan los pagos YA construidos por el análisis: idénticos al preview.
    onGuardar(analisis.pagos);
    onCerrar();
  };

  const { resumenCliente } = analisis;
  const progreso = resumenCliente.total > 0
    ? Math.min(100, (resumenCliente.pagado / resumenCliente.total) * 100)
    : 0;
  const montoValido = form.tipo === 'servicios'
    ? lineas.some((l) => Number(l.monto) > 0)
    : Number(form.monto) > 0;
  const puedeGuardar = Boolean(form.cliente) && montoValido && analisis.listoParaGuardar;

  return (
    <div className="modal-backdrop" onClick={onCerrar}>
      <div
        ref={rootRef}
        className="modal-content jf-cobro-modal"
        style={{ maxWidth: '980px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="card-title-group">
            <div className="card-icon"><CreditCard size={18} /></div>
            <div>
              <h3 id={titleId} className="card-title">Registrar cobro del cliente</h3>
              <p className="card-subtitle">Anotá el pago y mirá en vivo cómo se imputa a cada viaje</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onCerrar} title="Cerrar" aria-label="Cerrar registro de cobro">×</button>
        </div>

        <div className="modal-body jf-cobro-body">
          {/* -------------------- Formulario -------------------- */}
          <div className="jf-cobro-form">
            <div>
              <label htmlFor={`${uid}-cliente`} className="form-label">Cliente</label>
              <select id={`${uid}-cliente`} className="select-field" value={form.cliente} onChange={(e) => cambiarForm('cliente', e.target.value)}>
                <option value="">Seleccionar cliente...</option>
                {clientesUnicos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '6px' }}>¿Qué cubre este pago?</label>
              <div className="jf-cobro-tipos">
                {TIPOS_COBRO.map((tipo) => {
                  const Icon = tipo.icon;
                  const activo = form.tipo === tipo.value;
                  return (
                    <button
                      key={tipo.value}
                      type="button"
                      className={`btn ${activo ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '8px' }}
                      onClick={() => { cambiarForm('tipo', tipo.value); setLineas([]); }}
                    >
                      <Icon size={14} />
                      <span>
                        <strong style={{ display: 'block' }}>{tipo.label}</strong>
                        <small style={{ display: 'block', fontWeight: 400, opacity: 0.8 }}>{tipo.hint}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.tipo === 'paquete' && (
              <div>
                <label htmlFor={`${uid}-viaje`} className="form-label">Viaje que cubre el pago</label>
                <select id={`${uid}-viaje`} className="select-field" value={form.cotizacionId} onChange={(e) => cambiarForm('cotizacionId', e.target.value)}>
                  <option value="">Seleccionar viaje...</option>
                  {viajesDelCliente.map((c) => (
                    <option key={c.cotizacionId} value={c.cotizacionId}>
                      {c.concepto} — saldo {formatearMonto(c.saldo, c.moneda)}
                    </option>
                  ))}
                </select>
                {form.cotizacionId && (
                  <div className="jf-cobro-chips">
                    <span className="badge badge-info">Total {formatearMonto(viajesDelCliente.find((c) => c.cotizacionId === form.cotizacionId)?.montoTotal || 0, monedaDelViaje)}</span>
                    <span className="badge badge-info">Pendiente {formatearMonto(viajesDelCliente.find((c) => c.cotizacionId === form.cotizacionId)?.saldo || 0, monedaDelViaje)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="jf-cobro-grid">
              <div>
                <label htmlFor={`${uid}-operacion`} className="form-label">Nº de operación / comprobante</label>
                <input
                  id={`${uid}-operacion`}
                  className="input-field"
                  value={form.numeroOperacion}
                  onChange={(e) => cambiarForm('numeroOperacion', e.target.value)}
                  placeholder="Ej. 0000123456"
                />
              </div>
              <div>
                <label htmlFor={`${uid}-fecha`} className="form-label">Fecha del pago</label>
                <input id={`${uid}-fecha`} type="date" className="input-field" value={form.fecha} onChange={(e) => cambiarForm('fecha', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-medio`} className="form-label">Medio</label>
                <select id={`${uid}-medio`} className="select-field" value={form.medio} onChange={(e) => cambiarForm('medio', e.target.value)}>
                  {MEDIOS_COBRO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {form.tipo !== 'servicios' ? (
              <div className="jf-cobro-grid">
                <div>
                  <label htmlFor={`${uid}-monto`} className="form-label">Monto pagado</label>
                  <input
                    type="number" step="0.01" min="0"
                    id={`${uid}-monto`}
                    className={`input-field ${Number(form.monto) > 0 && analisis.nivel === 'danger' ? 'jf-cobro-invalid' : ''}`}
                    value={form.monto}
                    onChange={(e) => cambiarForm('monto', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-moneda`} className="form-label">Moneda</label>
                  <select id={`${uid}-moneda`} className="select-field" value={form.moneda} onChange={(e) => cambiarForm('moneda', e.target.value)}>
                    {MONEDAS_COBRO.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {form.moneda !== monedaDelViaje && (
                  <div>
                    <label htmlFor={`${uid}-equivalente`} className="form-label">Equivalente en {monedaDelViaje}</label>
                    <input
                      type="number" step="0.01" min="0"
                      id={`${uid}-equivalente`}
                      className="input-field"
                      value={form.equivalente}
                      onChange={(e) => cambiarForm('equivalente', e.target.value)}
                      placeholder="Para imputar al saldo"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="panel-inset">
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Agregar servicio</label>
                    <select
                      className="select-field"
                      value={servicioElegido}
                      onChange={(e) => setServicioElegido(e.target.value)}
                      disabled={!form.cliente}
                    >
                      <option value="">Elegir vuelo, hotel, traslado…</option>
                      {serviciosDisponibles.map((s) => (
                        <option key={`${s.cotizacionId}::${s.itemId}`} value={`${s.cotizacionId}::${s.itemId}`}>
                          {s.concepto} — {formatearMonto(s.monto, s.moneda)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={agregarServicio} disabled={!servicioElegido}>
                    <Plus size={14} /> Agregar
                  </button>
                </div>

                {lineas.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                    Agregá una línea por cada parte del pago (por ejemplo vuelo en USD y hotel en ARS).
                  </p>
                ) : (
                  <>
                    <div className="jf-table-wrap">
                      <table className="jf-table">
                        <caption className="sr-only">Servicios imputados al cobro con su monto y moneda</caption>
                        <thead>
                          <tr>
                            <th scope="col">Servicio</th>
                            <th scope="col" style={{ width: '110px' }}>Monto</th>
                            <th scope="col" style={{ width: '90px' }}>Moneda</th>
                            <th scope="col" style={{ width: '120px' }}>Equiv.</th>
                            <th scope="col"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map((l) => (
                            <tr key={l.key}>
                              <td style={{ fontSize: '0.85rem' }}>{l.concepto}</td>
                              <td>
                                <input type="number" step="0.01" min="0" className="input-field" value={l.monto} onChange={(e) => actualizarLinea(l.key, 'monto', e.target.value)} />
                              </td>
                              <td>
                                <select className="select-field" value={l.moneda} onChange={(e) => actualizarLinea(l.key, 'moneda', e.target.value)}>
                                  {MONEDAS_COBRO.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </td>
                              <td>
                                <input type="number" step="0.01" min="0" className="input-field" value={l.equivalente} onChange={(e) => actualizarLinea(l.key, 'equivalente', e.target.value)} placeholder="opcional" />
                              </td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))} title="Quitar línea" aria-label={`Quitar línea de ${l.concepto}`}>
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="jf-cobro-chips">
                      {Object.entries(totalesLineas).map(([moneda, total]) => (
                        <span key={moneda} className="badge badge-info">Total {moneda}: {formatearMonto(total, moneda)}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <label className="form-label">Nota / observación</label>
              <textarea
                className="input-field"
                rows="2"
                value={form.nota}
                onChange={(e) => cambiarForm('nota', e.target.value)}
                placeholder="Ej. Pagó señal de aéreos, falta hotel…"
              />
            </div>

            <label className="jf-cobro-check">
              <input type="checkbox" checked={form.enCaja} onChange={(e) => cambiarForm('enCaja', e.target.checked)} />
              Poner en caja (marcar como ingresado)
            </label>
          </div>

          {/* -------------------- Panel de análisis -------------------- */}
          <aside className="jf-cobro-analisis">
            <div className="jf-cobro-analisis-titulo">
              <TrendingUp size={16} />
              <strong>Análisis del cobro</strong>
              <span className={`jf-cobro-punto nivel-${analisis.nivel}`} />
            </div>

            <div className="panel-inset">
              <div className="jf-cobro-label">Situación del cliente · {resumenCliente.moneda}</div>
              <div className="jf-cobro-saldos">
                <div>
                  <span>Venta</span>
                  <strong className="mono">{formatearMonto(resumenCliente.total, resumenCliente.moneda)}</strong>
                </div>
                <div>
                  <span>Cobrado</span>
                  <strong className="mono" style={{ color: 'var(--success)' }}>{formatearMonto(resumenCliente.pagado, resumenCliente.moneda)}</strong>
                </div>
                <div>
                  <span>Saldo</span>
                  <strong className="mono" style={{ color: resumenCliente.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatearMonto(resumenCliente.saldo, resumenCliente.moneda)}
                  </strong>
                </div>
              </div>
              <div className="jf-cobro-barra" title={`${progreso.toFixed(0)}% cobrado`}>
                <div className="jf-cobro-barra-fill" style={{ width: `${progreso}%` }} />
              </div>
              <div className="jf-cobro-label" style={{ marginTop: 6 }}>{progreso.toFixed(0)}% de la venta cobrada</div>
            </div>

            <div className="panel-inset">
              <div className="jf-cobro-label">Proyección de este cobro</div>
              {analisis.impacto.length === 0 ? (
                <p className="jf-cobro-vacio">
                  Todavía no hay una imputación proyectada. Completá cliente, tipo y monto.
                </p>
              ) : (
                <>
                  <div className="jf-cobro-impactos">
                    {analisis.impacto.map((v) => (
                      <div key={v.cotizacionId} className="jf-cobro-impacto">
                        <div className="jf-cobro-impacto-head">
                          <strong>{v.concepto}</strong>
                          <span className="mono" style={{ color: 'var(--success)' }}>+{formatearMonto(v.delta, v.moneda)}</span>
                        </div>
                        <div className="jf-cobro-impacto-detalle">
                          {formatearMonto(v.saldo, v.moneda)} → <strong>{formatearMonto(v.saldoProyectado, v.moneda)}</strong> pendiente
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="jf-cobro-total">
                    <span>Se imputará a saldos</span>
                    <strong className="mono">{formatearMonto(analisis.totalImputado, resumenCliente.moneda)}</strong>
                  </div>
                </>
              )}
            </div>

            {analisis.advertencias.length > 0 ? (
              <div className="jf-cobro-alertas">
                {analisis.advertencias.map((a, idx) => {
                  const estilo = COLOR_ALERTA[a.nivel] || COLOR_ALERTA.info;
                  const Icon = estilo.Icon;
                  return (
                    <div
                      key={`${a.nivel}-${idx}`}
                      className="jf-cobro-alerta"
                      style={{ color: estilo.color, background: estilo.bg, borderColor: estilo.border }}
                    >
                      <Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{a.texto}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="jf-cobro-alerta" style={{ color: 'var(--success)', background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>Todo consistente: el pago se imputará sin excedentes.</span>
              </div>
            )}
          </aside>
        </div>

        <div className="modal-footer">
          <div className="jf-cobro-footer-resumen">
            {analisis.pagos.length > 0 && (
              <>
                <span>
                  Se registran{' '}
                  <strong className="mono">
                    {Object.entries(
                      analisis.pagos.reduce((acc, p) => {
                        const moneda = p.moneda || 'USD';
                        acc[moneda] = (acc[moneda] || 0) + (Number(p.monto) || 0);
                        return acc;
                      }, {})
                    ).map(([moneda, total]) => formatearMonto(total, moneda)).join(' + ')}
                  </strong>
                </span>
                <span>·</span>
                <span>Se imputan <strong className="mono" style={{ color: 'var(--success)' }}>{formatearMonto(analisis.totalImputado, resumenCliente.moneda)}</strong></span>
              </>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={!puedeGuardar} onClick={guardar}>
            <CreditCard size={13} /> Registrar cobro
          </button>
        </div>
      </div>
    </div>
  );
}
