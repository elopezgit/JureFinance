// CalendarioPagosView.jsx - Módulo 7: Calendario de Pagos a TTOOs
// Agrupa las obligaciones de pago (automáticas desde cotizaciones + manuales),
// las muestra en grilla mensual + agenda del día y permite registrar pagos parciales.

import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Info,
  CalendarClock,
  CheckCircle2,
  Trash2,
  CreditCard,
  Building2,
  ArrowDownCircle,
  Plane,
  Users
} from 'lucide-react';
import CalendarioMensual from '../Calendario/CalendarioMensual';
import FlujoCajaBCP from './FlujoCajaBCP';
import {
  construirAgendaPagos,
  liquidacionesPorProveedorYFecha,
  repartirPagoEnLiquidacion,
  formatearMonto,
  formatFechaLarga,
  etiquetaEstado,
  nivelTemporal,
  hoyISO,
  mesDeISO,
  nuevoId,
  totalesPorMoneda,
  claveLiquidacion,
  generarCSVFlujoCaja
} from '../../services/calendarioService';

const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro'];
const MONEDAS = ['USD', 'ARS', 'EUR', 'BRL'];

/* -------------------------------------------------------------------------- */
/* Modal: registrar pago (parcial) sobre una obligación                       */
/* -------------------------------------------------------------------------- */
function RegistrarPagoModal({ pago, onClose, onRegistrarPago, onEliminarPago }) {
  const [monto, setMonto] = useState(String(Math.max(pago.saldo, 0).toFixed(2)));
  const [fecha, setFecha] = useState(hoyISO());
  const [medio, setMedio] = useState('Transferencia');
  const [nota, setNota] = useState('');

  const montoNum = Number(monto) || 0;
  const saldoResultante = Math.max(pago.saldo - montoNum, 0);
  const puedeGuardar = montoNum > 0;

  const guardar = () => {
    if (!puedeGuardar) return;
    onRegistrarPago({
      id: nuevoId('PAGO'),
      clave: pago.clave,
      cotizacionId: pago.cotizacionId || '',
      proveedor: pago.proveedor || '',
      concepto: pago.concepto,
      cliente: pago.cliente,
      monto: montoNum,
      fecha,
      medio,
      nota,
      moneda: pago.moneda
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="card-title-group">
            <div className="card-icon">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="card-title">Registrar pago</h3>
              <p className="card-subtitle">{pago.proveedor || 'Proveedor'} · {pago.concepto}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Cerrar">
            ×
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel-inset" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Total</div>
              <strong className="mono">{formatearMonto(pago.montoTotal, pago.moneda)}</strong>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Pagado</div>
              <strong className="mono" style={{ color: 'var(--success)' }}>
                {formatearMonto(pago.pagado, pago.moneda)}
              </strong>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Saldo</div>
              <strong className="mono" style={{ color: pago.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatearMonto(Math.max(pago.saldo, 0), pago.moneda)}
              </strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Monto del pago</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field mono"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="input-field"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Medio</label>
              <select className="select-field" value={medio} onChange={(e) => setMedio(e.target.value)}>
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Nota (opcional)</label>
              <input
                className="input-field"
                placeholder="N° de comprobante, observaciones…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>
          </div>

          <div className="row-soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Saldo después de este pago
            </span>
            <strong className="mono" style={{ color: saldoResultante > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {formatearMonto(saldoResultante, pago.moneda)}
            </strong>
          </div>

          {pago.registros?.length > 0 && (
            <div>
              <div className="section-heading" style={{ fontSize: '0.82rem', marginBottom: '8px' }}>
                <CheckCircle2 size={14} /> Pagos registrados
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pago.registros.map((r) => (
                  <div
                    key={r.id}
                    className="row-soft"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}
                  >
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong className="mono">{formatearMonto(r.monto, pago.moneda)}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {' '}· {formatFechaLarga(r.fecha)} · {r.medio || '—'}
                        {r.nota ? ` · ${r.nota}` : ''}
                      </span>
                    </div>
                    <button
                      className="btn btn-danger btn-sm btn-icon-only"
                      onClick={() => onEliminarPago(r.id)}
                      title="Eliminar este pago"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={!puedeGuardar}>
            <CheckCircle2 size={16} />
            <span>Registrar pago</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal: nuevo pago manual a proveedor                                       */
/* -------------------------------------------------------------------------- */
function NuevoPagoManualModal({ proveedores, onClose, onCrear }) {
  const [form, setForm] = useState({
    proveedor: proveedores[0] || '',
    concepto: '',
    monto: '',
    moneda: 'USD',
    fechaVencimiento: hoyISO(),
    cliente: '',
    notas: ''
  });

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const puedeGuardar = form.concepto.trim() && Number(form.monto) > 0;

  const guardar = () => {
    if (!puedeGuardar) return;
    onCrear({
      id: nuevoId('MAN'),
      proveedor: form.proveedor.trim(),
      concepto: form.concepto.trim(),
      monto: Number(form.monto),
      moneda: form.moneda,
      fechaVencimiento: form.fechaVencimiento,
      cliente: form.cliente.trim(),
      notas: form.notas.trim()
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="card-title">Nuevo pago a proveedor</h3>
              <p className="card-subtitle">Factura o pago suelto, sin cotización asociada</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Cerrar">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Proveedor</label>
              <input
                className="input-field"
                list="jf-proveedores"
                placeholder="Aero, Price, Azabache…"
                value={form.proveedor}
                onChange={(e) => set('proveedor', e.target.value)}
              />
              <datalist id="jf-proveedores">
                {proveedores.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="form-label">Cliente / referencia (opcional)</label>
              <input
                className="input-field"
                placeholder="Nombre del cliente"
                value={form.cliente}
                onChange={(e) => set('cliente', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Concepto</label>
            <input
              className="input-field"
              placeholder="Ej.: Factura de hotel, servicio extra…"
              value={form.concepto}
              onChange={(e) => set('concepto', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Monto</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field mono"
                placeholder="0.00"
                value={form.monto}
                onChange={(e) => set('monto', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Moneda</label>
              <select className="select-field" value={form.moneda} onChange={(e) => set('moneda', e.target.value)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Vencimiento</label>
              <input
                type="date"
                className="input-field"
                value={form.fechaVencimiento}
                onChange={(e) => set('fechaVencimiento', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notas (opcional)</label>
            <input
              className="input-field"
              placeholder="Observaciones"
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={!puedeGuardar}>
            <Plus size={16} />
            <span>Agregar pago</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal: registrar pago consolidado de una liquidación (bloque del proveedor) */
/* -------------------------------------------------------------------------- */
function RegistrarPagoLiquidacionModal({ liquidacion, onClose, onRegistrarLote }) {
  const saldoTotal = Math.max(liquidacion.saldo, 0);
  const [monto, setMonto] = useState(String(saldoTotal.toFixed(2)));
  const [fecha, setFecha] = useState(hoyISO());
  const [medio, setMedio] = useState('Transferencia');
  const [nota, setNota] = useState('');

  const montoNum = Math.min(Number(monto) || 0, saldoTotal);
  const puedeGuardar = montoNum > 0;
  const afectadas = liquidacion.items.filter((p) => Math.max(p.saldo, 0) > 0.005);
  const saldoRestante = Math.max(saldoTotal - montoNum, 0);

  const guardar = () => {
    if (!puedeGuardar) return;
    const registros = repartirPagoEnLiquidacion(liquidacion, montoNum, { fecha, medio, nota });
    if (registros.length && onRegistrarLote) onRegistrarLote(registros);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="card-title">Pago consolidado · {liquidacion.proveedor}</h3>
              <p className="card-subtitle">
                {liquidacion.fechaVencimiento
                  ? `Vence ${formatFechaLarga(liquidacion.fechaVencimiento)}`
                  : 'Sin fecha de vencimiento'}
                {' · '}
                {liquidacion.cantidad} {liquidacion.cantidad === 1 ? 'obligación' : 'obligaciones'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Cerrar">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel-inset" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Total del bloque</div>
              <strong className="mono">{formatearMonto(liquidacion.montoTotal, liquidacion.moneda)}</strong>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Pagado</div>
              <strong className="mono" style={{ color: 'var(--success)' }}>
                {formatearMonto(liquidacion.pagado, liquidacion.moneda)}
              </strong>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: '4px' }}>Saldo</div>
              <strong className="mono" style={{ color: saldoTotal > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatearMonto(saldoTotal, liquidacion.moneda)}
              </strong>
            </div>
          </div>

          <div style={{ maxHeight: '170px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {liquidacion.items.map((p) => (
              <div
                key={p.clave}
                className="row-soft"
                style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}
              >
                <div style={{ fontSize: '0.8rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.concepto}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {p.cliente}{p.cotizacionId ? ` · ${p.cotizacionId}` : ''}
                  </div>
                  {Array.isArray(p.pasajeros) && p.pasajeros.length > 0 && (
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={p.pasajeros.join(', ')}
                    >
                      {p.pasajeros.join(', ')}
                    </div>
                  )}
                </div>
                <div className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                  <div>{formatearMonto(p.montoTotal, p.moneda)}</div>
                  {Math.max(p.saldo, 0) > 0.005 && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.74rem' }}>
                      saldo {formatearMonto(Math.max(p.saldo, 0), p.moneda)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Monto del pago</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={saldoTotal}
                className="input-field mono"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Podés pagar todo el bloque o un abono parcial.
              </span>
            </div>
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="input-field"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Medio</label>
              <select className="select-field" value={medio} onChange={(e) => setMedio(e.target.value)}>
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Nota (opcional)</label>
              <input
                className="input-field"
                placeholder="N° de comprobante, observaciones…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>
          </div>

          <div className="row-soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Se repartirá entre <strong>{afectadas.length}</strong> obligación(es), de la más antigua a la más nueva.
            </span>
            <strong className="mono" style={{ color: saldoRestante > 0 ? 'var(--warning)' : 'var(--success)' }}>
              Saldo tras el pago: {formatearMonto(saldoRestante, liquidacion.moneda)}
            </strong>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={!puedeGuardar}>
            <CheckCircle2 size={16} />
            <span>Registrar pago del bloque</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vista principal                                                            */
/* -------------------------------------------------------------------------- */
export default function CalendarioPagosView({
  cotizaciones = [],
  configMensual = [],
  operadoresList = [],
  pagosTTOO = [],
  pagosTTOOManuales = [],
  onRegistrarPago,
  onRegistrarPagosLote,
  onEliminarPago,
  onCrearPagoManual,
  onEliminarPagoManual,
  onCargarDemo
}) {
  const hoy = hoyISO();
  const [mes, setMes] = useState(mesDeISO(hoy));
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy);
  const [filtroProveedor, setFiltroProveedor] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagoActivo, setPagoActivo] = useState(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [vistaActual, setVistaActual] = useState('liquidaciones'); // 'liquidaciones' (BCP) | 'calendario' | 'obligaciones'
  const [liquidacionActiva, setLiquidacionActiva] = useState(null);
  const [verTodosLosMeses, setVerTodosLosMeses] = useState(false);
  const [moneda, setMoneda] = useState('todas');
  const [demoMsg, setDemoMsg] = useState('');

  // Carga los vuelos de ejemplo (emitidos en distintos bloques de pago BCP)
  const cargarDemo = () => {
    if (!onCargarDemo) return;
    const n = onCargarDemo();
    setDemoMsg(
      n > 0
        ? `Se cargaron ${n} vuelos de ejemplo emitidos en los 5 rangos BCP del mes.`
        : 'Los vuelos de ejemplo ya estaban cargados.'
    );
    window.setTimeout(() => setDemoMsg(''), 6000);
  };

  const agenda = useMemo(
    () => construirAgendaPagos({ cotizaciones, configMensual, pagosTTOOManuales, pagosTTOO }),
    [cotizaciones, configMensual, pagosTTOOManuales, pagosTTOO]
  );

  const cambiarMes = (nuevoMes) => {
    setVerTodosLosMeses(false);
    setMes(nuevoMes);
    setDiaSeleccionado((prev) => (mesDeISO(prev) === nuevoMes ? prev : `${nuevoMes}-01`));
  };

  const monedasDisponibles = useMemo(() => {
    const set = new Set();
    agenda.forEach((p) => set.add(p.moneda || 'USD'));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [agenda]);

  // Obligaciones del período y filtros activos (mes, proveedor y moneda).
  // Es la base del reporte de flujo de caja y de las métricas.
  const pagosPeriodo = useMemo(() => {
    return agenda.filter((p) => {
      if (
        !verTodosLosMeses &&
        p.fechaVencimiento &&
        mesDeISO(p.fechaVencimiento) !== mes
      ) {
        return false;
      }
      if (filtroProveedor !== 'todos' && p.proveedor !== filtroProveedor) return false;
      if (moneda !== 'todas' && (p.moneda || 'USD') !== moneda) return false;
      return true;
    });
  }, [agenda, mes, verTodosLosMeses, filtroProveedor, moneda]);

  const totalesPeriodo = useMemo(
    () => totalesPorMoneda(pagosPeriodo, hoy),
    [pagosPeriodo, hoy]
  );

  const liquidaciones = useMemo(
    () => liquidacionesPorProveedorYFecha(agenda, configMensual),
    [agenda, configMensual]
  );

  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones.filter((l) => {
      if (!verTodosLosMeses && l.fechaVencimiento && mesDeISO(l.fechaVencimiento) !== mes) {
        return false;
      }
      if (filtroProveedor !== 'todos' && l.proveedor !== filtroProveedor) return false;
      if (moneda !== 'todas' && l.moneda !== moneda) return false;
      return true;
    });
  }, [liquidaciones, filtroProveedor, verTodosLosMeses, mes, moneda]);

  const abrirPagoBloque = (pago) => {
    const clave = claveLiquidacion(pago);
    const liquidacion = liquidaciones.find((l) => l.clave === clave);
    if (liquidacion) setLiquidacionActiva(liquidacion);
  };

  const exportarCSV = () => {
    const csv = generarCSVFlujoCaja(pagosPeriodo);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `flujo-caja-bcp-${verTodosLosMeses ? 'todos-los-meses' : mes}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  const proveedores = useMemo(() => {
    const set = new Set();
    agenda.forEach((p) => p.proveedor && set.add(p.proveedor));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [agenda]);

  const proveedoresSugeridos = useMemo(() => {
    const base = (operadoresList || []).map((op) => op.nombre).filter(Boolean);
    const set = new Set([...base, ...proveedores]);
    return [...set];
  }, [operadoresList, proveedores]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return agenda.filter((p) => {
      if (filtroProveedor !== 'todos' && p.proveedor !== filtroProveedor) return false;
      if (filtroEstado === 'vencido') {
        if (p.estado === 'Pagado' || !p.fechaVencimiento || p.fechaVencimiento >= hoy) return false;
      } else if (filtroEstado === 'pendiente' && p.estado !== 'Pendiente') {
        return false;
      } else if (filtroEstado === 'parcial' && p.estado !== 'Parcial') {
        return false;
      } else if (filtroEstado === 'pagado' && p.estado !== 'Pagado') {
        return false;
      }
      if (q) {
        const texto = `${p.cliente} ${p.concepto} ${p.proveedor} ${p.cotizacionId}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [agenda, filtroProveedor, filtroEstado, busqueda, hoy]);

  // El calendario muestra una sola moneda por vez para no mezclar importes.
  // Si el reporte está en "todas", se usa la primera moneda disponible.
  const monedaCalendario =
    moneda === 'todas' ? monedasDisponibles[0] || 'USD' : moneda;

  const eventos = useMemo(
    () =>
      pagosPeriodo
        .filter(
          (p) => p.fechaVencimiento && (p.moneda || 'USD') === monedaCalendario
        )
        .map((p) => ({
          fecha: p.fechaVencimiento,
          monto: Math.max(p.saldo, 0),
          moneda: p.moneda,
          nivel: nivelTemporal(p, hoy)
        })),
    [pagosPeriodo, monedaCalendario, hoy]
  );

  const pagosDelDia = pagosPeriodo
    .filter(
      (p) =>
        p.fechaVencimiento === diaSeleccionado &&
        (p.moneda || 'USD') === monedaCalendario
    )
    .sort((a, b) => (a.proveedor || '').localeCompare(b.proveedor || ''));

  const sinFecha = pagosPeriodo.filter((p) => !p.fechaVencimiento);

  return (
    <div>
      {/* Encabezado del módulo */}
      <div className="view-header" style={{ marginBottom: '18px' }}>
        <div className="section-heading">
          <Wallet size={16} />
          <span>Módulo Financiero · Pagos a Proveedores (BCP)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onCargarDemo && (
            <button className="btn btn-secondary btn-sm" onClick={cargarDemo} style={{ gap: '6px' }}>
              <Plane size={15} color="var(--neon-cyan)" />
              <span>Cargar ejemplo (10 vuelos BCP)</span>
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setManualAbierto(true)}>
            <Plus size={15} />
            <span>Nuevo pago manual</span>
          </button>
        </div>
      </div>

      {demoMsg && (
        <div className="row-soft is-alert" style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Plane size={16} style={{ color: 'var(--neon-cyan)' }} />
          <span style={{ fontSize: '0.84rem' }}>{demoMsg}</span>
        </div>
      )}

      {/* Selector de vista: BCP / Flujo de Caja vs. Calendario vs. Obligaciones */}
      <div className="toolbar" style={{ gap: '8px', marginBottom: '18px' }}>
        <button
          className={vistaActual === 'liquidaciones' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          onClick={() => setVistaActual('liquidaciones')}
          style={{ gap: '6px' }}
        >
          <Building2 size={14} />
          <span>Flujo de Caja BCP & Liquidaciones</span>
        </button>
        <button
          className={vistaActual === 'calendario' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          onClick={() => setVistaActual('calendario')}
          style={{ gap: '6px' }}
        >
          <CalendarClock size={14} />
          <span>Calendario Mensual</span>
        </button>
        <button
          className={vistaActual === 'obligaciones' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          onClick={() => setVistaActual('obligaciones')}
          style={{ gap: '6px' }}
        >
          <Wallet size={14} />
          <span>Todas las Obligaciones</span>
        </button>
      </div>

      {/* Métricas del período: siempre separadas por moneda */}
      <div className="metrics-strip">
        {totalesPeriodo.length === 0 ? (
          <div className="metric-card">
            <div className="metric-label">
              A pagar en el período <CalendarClock size={15} />
            </div>
            <div className="metric-value">
              {formatearMonto(0, moneda === 'todas' ? 'USD' : moneda)}
            </div>
            <div className="metric-sub">Sin vencimientos para los filtros elegidos</div>
          </div>
        ) : (
          totalesPeriodo.map((t) => (
            <div
              key={t.moneda}
              className={
                t.saldoVencido > 0
                  ? 'metric-card highlight-warning'
                  : 'metric-card'
              }
            >
              <div className="metric-label">
                A pagar · {t.moneda} <CalendarClock size={15} />
              </div>
              <div className="metric-value">
                {formatearMonto(t.montoTotal, t.moneda)}
              </div>
              <div className="metric-sub">
                {t.cantidad} ticket(s) · {t.totalPax} PAX · saldo{' '}
                {formatearMonto(t.saldo, t.moneda)}
              </div>
            </div>
          ))
        )}

        {moneda !== 'todas' && totalesPeriodo[0] && (
          <>
            <div className="metric-card highlight-warning">
              <div className="metric-label">
                Vencido <ArrowDownCircle size={15} />
              </div>
              <div className="metric-value" style={{ color: 'var(--danger)' }}>
                {formatearMonto(totalesPeriodo[0].saldoVencido, moneda)}
              </div>
              <div className="metric-sub">
                {totalesPeriodo[0].vencidos} obligación(es) vencidas
              </div>
            </div>
            <div className="metric-card highlight-profit">
              <div className="metric-label">
                Pagado <CheckCircle2 size={15} />
              </div>
              <div className="metric-value" style={{ color: 'var(--success)' }}>
                {formatearMonto(totalesPeriodo[0].pagado, moneda)}
              </div>
              <div className="metric-sub">Pagos registrados en el período</div>
            </div>
          </>
        )}

        <div className="metric-card">
          <div className="metric-label">
            Tickets / PAX <Users size={15} />
          </div>
          <div className="metric-value">{pagosPeriodo.length}</div>
          <div className="metric-sub">
            {pagosPeriodo.reduce((acc, p) => acc + (Number(p.pax) || 1), 0)}{' '}
            pasajeros · {liquidacionesFiltradas.length} bloque(s)
          </div>
        </div>
      </div>

      {/* Ayuda */}
      <div className="panel-inset" style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
        <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Los pagos se generan <strong>automáticamente</strong> desde la oferta de compra de cada
          cotización (costo real y vencimiento según la Configuración Mensual) y podés sumar{' '}
          <strong>pagos manuales</strong>. Los servicios con costo 0 no generan obligación.
          Registrá abonos <strong>parciales</strong> y el sistema lleva el saldo de cada obligación.
          El reporte de flujo de caja agrupa por fecha de pago y permite exportar el detalle
          auditable a CSV.
        </p>
      </div>

      {vistaActual === 'calendario' && (
        <>
      {/* Calendario + agenda del día */}
      <div className="cal-layout" style={{ marginBottom: '18px' }}>
        <div className="card">
          <CalendarioMensual
            mes={mes}
            onCambiarMes={cambiarMes}
            eventos={eventos}
            diaSeleccionado={diaSeleccionado}
            onSeleccionarDia={setDiaSeleccionado}
            moneda={monedaCalendario}
          />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon">
                <CalendarClock size={18} />
              </div>
              <div>
                <h3 className="card-title">{formatFechaLarga(diaSeleccionado)}</h3>
                <p className="card-subtitle">
                  {pagosDelDia.length
                    ? `${pagosDelDia.length} ${pagosDelDia.length === 1 ? 'pago' : 'pagos'} para este día`
                    : 'Sin pagos para este día'}
                </p>
              </div>
            </div>
          </div>

          {pagosDelDia.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-state-icon">
                <CalendarClock size={22} />
              </div>
              <h3>Día sin vencimientos</h3>
              <p>Elegí otro día en el calendario para ver su agenda de pagos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pagosDelDia.map((p) => {
                const etiqueta = etiquetaEstado(p, hoy);
                return (
                  <div key={p.clave} className="row-soft">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{p.proveedor || 'Proveedor'}</strong>
                      <div style={{ textAlign: 'right' }}>
                        <strong className="mono">{formatearMonto(Math.max(p.saldo, 0), p.moneda)}</strong>
                        {(p.estado === 'Parcial' || p.estado === 'Pagado') && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            de {formatearMonto(p.montoTotal, p.moneda)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 6px' }}>
                      {p.concepto} · {p.cliente}
                      {p.cotizacionId ? ` · ${p.cotizacionId}` : ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge ${etiqueta.badge}`}>{etiqueta.texto}</span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPagoActivo(p)}
                        disabled={Math.max(p.saldo, 0) <= 0}
                      >
                        <CreditCard size={13} />
                        <span>Registrar pago</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Listado con filtros */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Wallet size={18} />
            </div>
            <div>
              <h3 className="card-title">Todas las obligaciones</h3>
              <p className="card-subtitle">
                {filtrados.length} de {agenda.length} · incluye pagos sin fecha
              </p>
            </div>
          </div>

          <div className="toolbar" style={{ gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                className="input-field"
                style={{ paddingLeft: '30px', minWidth: '190px' }}
                placeholder="Buscar cliente o concepto…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select
              className="select-field"
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
            >
              <option value="todos">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="select-field"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="vencido">Vencido</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>
        </div>

        {agenda.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Wallet size={24} />
            </div>
            <h3>Sin pagos a proveedores</h3>
            <p>
              Guardá una cotización con servicios activos o agregá un pago manual para
              empezar a ver tus cuentas a pagar.
            </p>
          </div>
        ) : (
          <div className="jf-table-wrap">
            <table className="jf-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Concepto</th>
                  <th>Cliente / Cotización</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Pagado</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const etiqueta = etiquetaEstado(p, hoy);
                  const abierto = Math.max(p.saldo, 0) > 0.005;
                  return (
                    <tr key={p.clave}>
                      <td>
                        <strong>{p.proveedor || '—'}</strong>
                        {p.origen === 'manual' && (
                          <span className="badge badge-info" style={{ marginLeft: '6px' }}>manual</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        <div style={{ fontWeight: 600 }}>{p.concepto}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {p.seccionLabel}
                          {p.estadoVuelo ? ` · ${p.estadoVuelo}` : ''}
                        </div>
                      </td>
                      <td>
                        <div>{p.cliente}</div>
                        {p.cotizacionId && (
                          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {p.cotizacionId}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={p.fechaVencimiento ? '' : 'badge badge-neutral'}>
                          {p.fechaVencimiento ? formatFechaLarga(p.fechaVencimiento) : 'Sin fecha'}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(p.montoTotal, p.moneda)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>
                        {formatearMonto(p.pagado, p.moneda)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatearMonto(Math.max(p.saldo, 0), p.moneda)}
                      </td>
                      <td>
                        <span className={`badge ${etiqueta.badge}`}>{etiqueta.texto}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setPagoActivo(p)}
                            disabled={!abierto}
                            title={abierto ? 'Registrar pago' : 'Ya está pago'}
                          >
                            <CreditCard size={13} />
                            <span>Pagar</span>
                          </button>
                          {p.origen === 'manual' && (
                            <button
                              className="btn btn-danger btn-sm btn-icon-only"
                              onClick={() => onEliminarPagoManual(p.manualId)}
                              title="Eliminar pago manual"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {sinFecha.length > 0 && (
          <div className="row-soft is-alert" style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Info size={16} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: '0.82rem' }}>
              Hay <strong>{sinFecha.length}</strong> obligación(es) sin fecha de vencimiento. Completá
              el vencimiento en la oferta o, si es un aéreo, configurá los bloques BCP del
              proveedor para el mes de emisión.
            </span>
          </div>
        )}
      </div>

        </>
      )}

      {vistaActual === 'liquidaciones' && (
        <>
          <FlujoCajaBCP
            pagos={pagosPeriodo}
            mes={mes}
            onCambiarMes={cambiarMes}
            verTodos={verTodosLosMeses}
            onToggleVerTodos={() => setVerTodosLosMeses((v) => !v)}
            moneda={moneda}
            onCambiarMoneda={setMoneda}
            monedas={monedasDisponibles}
            proveedores={proveedores}
            filtroProveedor={filtroProveedor}
            onCambiarProveedor={setFiltroProveedor}
            onPagar={setPagoActivo}
            onPagarBloque={abrirPagoBloque}
            onExportarCSV={exportarCSV}
            hoy={hoy}
          />

          <div className="card" style={{ marginTop: '18px' }}>
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="card-title">Liquidación por proveedor y fecha de pago</h3>
                <p className="card-subtitle">
                  Todo lo emitido en un bloque se paga junto en la fecha que fija el proveedor
                </p>
              </div>
            </div>
            <span className="badge badge-info">
              {liquidacionesFiltradas.length} {liquidacionesFiltradas.length === 1 ? 'bloque' : 'bloques'}
            </span>
          </div>

          {liquidacionesFiltradas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Building2 size={24} />
              </div>
              <h3>Sin liquidaciones</h3>
              <p>
                Guardá cotizaciones con servicios activos o cargá los bloques mensuales de cada
                proveedor para ver sus liquidaciones.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {liquidacionesFiltradas.map((liq) => {
                const etiqueta = etiquetaEstado(liq, hoy);
                const abierto = Math.max(liq.saldo, 0) > 0.005;
                return (
                  <div
                    key={liq.clave}
                    className="row-soft"
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{liq.proveedor}</strong>
                        <span className="badge badge-neutral">
                          {liq.fechaVencimiento ? `Vence ${formatFechaLarga(liq.fechaVencimiento)}` : 'Sin fecha'}
                        </span>
                        {liq.rangoCorto && (
                          <span className="badge badge-info" title={liq.rangoBCP}>
                            BCP {liq.rangoCorto}
                          </span>
                        )}
                        <span className={`badge ${etiqueta.badge}`}>{etiqueta.texto}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {liq.cantidad} {liq.cantidad === 1 ? 'obligación' : 'obligaciones'}
                      </span>
                    </div>

                    {liq.rangoBCP && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {liq.rangoBCP}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div>
                        <div className="metric-label">Total del bloque</div>
                        <strong className="mono">{formatearMonto(liq.montoTotal, liq.moneda)}</strong>
                      </div>
                      <div>
                        <div className="metric-label">Pagado</div>
                        <strong className="mono" style={{ color: 'var(--success)' }}>
                          {formatearMonto(liq.pagado, liq.moneda)}
                        </strong>
                      </div>
                      <div>
                        <div className="metric-label">Saldo</div>
                        <strong className="mono" style={{ color: abierto ? 'var(--danger)' : 'var(--success)' }}>
                          {formatearMonto(Math.max(liq.saldo, 0), liq.moneda)}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setLiquidacionActiva(liq)}
                        disabled={!abierto || !liq.esConsolidable}
                        title={
                          !liq.esConsolidable
                            ? 'Sin fecha de vencimiento: completá la configuración mensual del proveedor'
                            : abierto
                              ? 'Registrar pago del bloque'
                              : 'Ya está pago'
                        }
                      >
                        <CreditCard size={14} />
                        <span>Registrar pago del bloque</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </>
      )}

      {liquidacionActiva && (
        <RegistrarPagoLiquidacionModal
          liquidacion={liquidacionActiva}
          onClose={() => setLiquidacionActiva(null)}
          onRegistrarLote={onRegistrarPagosLote}
        />
      )}

      {pagoActivo && (
        <RegistrarPagoModal
          pago={pagoActivo}
          onClose={() => setPagoActivo(null)}
          onRegistrarPago={onRegistrarPago}
          onEliminarPago={onEliminarPago}
        />
      )}

      {manualAbierto && (
        <NuevoPagoManualModal
          proveedores={proveedoresSugeridos}
          onClose={() => setManualAbierto(false)}
          onCrear={onCrearPagoManual}
        />
      )}
    </div>
  );
}
