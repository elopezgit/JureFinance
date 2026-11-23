// FichaViaje.jsx - Una sola pantalla con todo lo que el dueño necesita saber de
// un viaje: datos, cuánto le deben, cuándo paga a cada proveedor y los papeles
// guardados en Drive. Se abre desde cualquier módulo y al cerrar se vuelve al
// módulo de origen (es un overlay montado arriba de la vista activa).
import React, { useMemo, useRef, useState } from 'react';
import {
  Wallet,
  FileText,
  FolderOpen,
  Printer,
  CreditCard,
  Building2,
  TrendingUp,
  Upload,
  ExternalLink,
  MapPin,
  Users,
  CalendarDays,
  Plane,
  Hotel,
  Car,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  File as FileIcon
} from 'lucide-react';
import './ficha.css';
import QuotePreviewModal from '../Cotizador/QuotePreviewModal';
import RegistrarCobroModal from '../Cobranzas/RegistrarCobroModal';
import RegistrarPagoLiquidacionModal from '../Common/RegistrarPagoLiquidacionModal';
import ConfirmDialog from '../Common/ConfirmDialog';
import {
  normalizarServicios,
  generarDescripcionItinerario,
  SECCION_LABEL,
  totalCostoItems,
  totalVentaItems,
  precioVentaItem,
  costoCompraItem,
  costoBasePresupuestoItem,
  proveedorCompraItem,
  proveedorBasePresupuestoItem,
  ahorroArbitrajeItem
} from '../../services/serviciosService';
import {
  construirAgendaPagos,
  liquidacionesPorProveedorYFecha,
  formatearMonto,
  formatFechaLarga,
  diasHasta
} from '../../services/calendarioService';
import {
  derivarCobrosDesdeCotizaciones,
  imputarPagosPorViaje
} from '../../services/cobroService';
import { getFilesForClient, uploadFileToTargetFolder, TARGET_DRIVE_URL } from '../../services/driveService';

const ESTADOS = ['Borrador', 'Enviada', 'Aceptada', 'Pagada', 'Vencida'];

const TABS = [
  { id: 'datos', label: 'Datos', Icono: FileText },
  { id: 'cobros', label: 'Cobros', Icono: Wallet },
  { id: 'pagos', label: 'Pagos a proveedores', Icono: CreditCard },
  { id: 'comparacion', label: 'Comparación', Icono: Building2 },
  { id: 'documentos', label: 'Documentos', Icono: FolderOpen },
  { id: 'resumen', label: 'Resumen interno', Icono: Printer }
];

const ICONO_TIPO = {
  aereo: Plane,
  hotel: Hotel,
  traslados: Car,
  asistencia: ShieldCheck,
  extra: Sparkles
};

function tipoArchivo(archivo) {
  const tipo = String(archivo?.tipo || '').toLowerCase();
  const nombre = String(archivo?.nombre || '').toLowerCase();
  if (tipo === 'pdf' || nombre.endsWith('.pdf')) return 'pdf';
  if (['image', 'img', 'jpg', 'jpeg', 'png', 'webp'].includes(tipo) || /\.(jpg|jpeg|png|webp)$/.test(nombre)) return 'imagen';
  if (['excel', 'xls', 'xlsx'].includes(tipo) || /\.(xlsx|xls)$/.test(nombre)) return 'planilla';
  if (['docx', 'doc', 'word'].includes(tipo) || /\.(docx|doc)$/.test(nombre)) return 'texto';
  return 'otro';
}

const GRUPOS_ARCHIVOS = [
  { id: 'pdf', label: '📄 Pasajes & Vouchers (PDF)', Icono: FileText },
  { id: 'imagen', label: '🖼️ Fotos & DNI', Icono: ImageIcon },
  { id: 'planilla', label: '📊 Planillas', Icono: FileSpreadsheet },
  { id: 'texto', label: '📝 Textos', Icono: FileText },
  { id: 'otro', label: '📎 Otros archivos', Icono: FileIcon }
];

export default function FichaViaje({
  quote,
  tabInicial = 'datos',
  onClose,
  cotizaciones = [],
  configMensual = [],
  pagosTTOO = [],
  pagosClientes = [],
  onRegistrarCobrosClientesLote,
  onRegistrarPagosLote,
  onGuardarCotizacion,
  onEditarCotizacion
}) {
  const [tab, setTab] = useState(tabInicial);
  const [modalCobro, setModalCobro] = useState(false);
  const [liquidacionActiva, setLiquidacionActiva] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [confirmarPagada, setConfirmarPagada] = useState(false);
  const [, setRevisionDrive] = useState(0);
  const fileInputRef = useRef(null);

  const moneda = quote?.moneda || 'USD';
  const items = useMemo(
    () => normalizarServicios(quote?.servicios, { pax: quote?.pax }).filter((i) => i.activo),
    [quote]
  );
  const venta = Number(quote?.precioVentaTotalManual) > 0
    ? Number(quote.precioVentaTotalManual)
    : totalVentaItems(items);
  const costo = totalCostoItems(items);
  const ganancia = venta - costo;
  const margen = venta > 0 ? (ganancia / venta) * 100 : 0;

  // Cobros: deriva la deuda del viaje y le imputa los pagos registrados.
  const cobro = useMemo(() => {
    const derivados = quote ? derivarCobrosDesdeCotizaciones([quote]) : [];
    const imputados = imputarPagosPorViaje(derivados, pagosClientes);
    return imputados[0] || {
      montoTotal: venta,
      pagado: 0,
      saldo: venta,
      moneda,
      estado: 'Pendiente',
      aplicacionesPago: []
    };
  }, [quote, pagosClientes, venta, moneda]);

  const pagosDelViaje = useMemo(
    () => (pagosClientes || []).filter(
      (p) => p.cotizacionId === quote?.id || (p.aplicaciones || []).some((a) => a.cotizacionId === quote?.id)
    ),
    [pagosClientes, quote?.id]
  );

  // Pagos a proveedores: sólo las obligaciones automáticas de ESTE viaje.
  const liquidaciones = useMemo(() => {
    const agenda = construirAgendaPagos({
      cotizaciones: quote ? [quote] : [],
      configMensual,
      pagosTTOOManuales: [],
      pagosTTOO
    }).filter((p) => p.origen === 'auto');
    return liquidacionesPorProveedorYFecha(agenda, configMensual);
  }, [quote, configMensual, pagosTTOO]);

  const fechaCobro = quote?.fechaCobro || quote?.fechaCotizacion || '';
  const diasCobro = fechaCobro ? diasHasta(fechaCobro) : null;
  const textoVencimientoCobro = diasCobro === null
    ? 'Sin fecha de cobro'
    : diasCobro < 0
      ? `Vencida hace ${Math.abs(diasCobro)} día${Math.abs(diasCobro) === 1 ? '' : 's'}`
      : diasCobro === 0
        ? 'Vence hoy'
        : `Vence en ${diasCobro} día${diasCobro === 1 ? '' : 's'}`;

  // Documentos de Drive del cliente de este viaje. Se lee la caché en cada render
  // y un cambio de revisionDrive fuerza una nueva lectura después de subir un archivo.
  const clienteData = quote ? getFilesForClient(quote.cliente) : null;
  const archivos = clienteData?.archivos || clienteData?.todosLosArchivos || [];
  const gruposArchivos = { pdf: [], imagen: [], planilla: [], texto: [], otro: [] };
  archivos.forEach((archivo) => gruposArchivos[tipoArchivo(archivo)].push(archivo));
  const archivosPorTipo = gruposArchivos;

  if (!quote) return null;

  const guardarCampo = (cambios) => onGuardarCotizacion?.({ ...quote, ...cambios });

  const cambiarEstado = (nuevoEstado) => {
    if (nuevoEstado === 'Pagada' && Number(cobro.saldo) > 0.005) {
      setConfirmarPagada(true);
      return;
    }
    guardarCampo({ estado: nuevoEstado });
  };

  const subirArchivo = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    try {
      await uploadFileToTargetFolder(
        clienteData?.driveFolderId || '',
        quote.cliente,
        { nombre: archivo.nombre || archivo.name, categoria: 'Expediente' },
        archivo
      );
      setRevisionDrive((n) => n + 1);
    } catch (error) {
      console.error('No se pudo subir el archivo a Drive', error);
    }
    evento.target.value = '';
  };

  return (
    <div
      className="modal-backdrop jf-ficha-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="jf-ficha" role="dialog" aria-modal="true" aria-label={`Ficha del viaje de ${quote.cliente}`}>
        {/* ------------------------------ Cabecera ------------------------------ */}
        <header className="jf-ficha-header">
          <div className="jf-ficha-top">
            <div style={{ minWidth: 0 }}>
              <div className="jf-ficha-sub" style={{ marginBottom: 0 }}>
                <span className="mono">{quote.id}</span>
                <span>·</span>
                <span>Ficha del Viaje</span>
              </div>
              <h2 className="jf-ficha-titulo">
                {quote.cliente || 'Sin cliente'}
                {quote.destino && (
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 10 }}>
                    <MapPin size={14} style={{ verticalAlign: 'middle' }} /> {quote.destino}
                  </span>
                )}
              </h2>
              <div className="jf-ficha-sub">
                <span><CalendarDays size={13} /> {quote.fechaViajeInicio || '—'} → {quote.fechaViajeFin || '—'}</span>
                <span><Users size={13} /> {quote.pax || 1} pasajero(s)</span>
                <span className="mono">{moneda}</span>
                <select
                  className="select-field"
                  style={{ padding: '3px 8px', fontSize: '0.78rem', width: 'auto' }}
                  value={quote.estado || 'Borrador'}
                  onChange={(e) => cambiarEstado(e.target.value)}
                  aria-label="Estado de la cotización"
                >
                  {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>
                {Number(cobro.saldo) > 0.005 && diasCobro !== null && diasCobro < 0 && (
                  <span className="badge badge-danger">Cobro vencido</span>
                )}
              </div>
            </div>
            <div className="jf-ficha-acciones">
              <button className="btn btn-secondary btn-sm" onClick={() => setTab('documentos')}>
                <FolderOpen size={14} /> Ver documentos
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onEditarCotizacion?.(quote)}>
                Editar cotización
              </button>
              <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar ficha" title="Cerrar">✕</button>
            </div>
          </div>

          <div className="jf-ficha-tabs" role="tablist" aria-label="Secciones de la ficha">
            {TABS.map(({ id, label, Icono }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`btn ${tab === id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTab(id)}
              >
                <Icono size={14} /> {label}
              </button>
            ))}
          </div>
        </header>

        <div className="jf-ficha-body">
          {/* ------------------------- Franja de números ------------------------- */}
          <div className="jf-ficha-strip">
            <div className="metric-card">
              <div className="metric-label">Venta al cliente</div>
              <div className="metric-value">{formatearMonto(venta, moneda)}</div>
              <div className="metric-sub">Precio final del paquete</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Costo real</div>
              <div className="metric-value">{formatearMonto(costo, moneda)}</div>
              <div className="metric-sub">Lo que se paga a proveedores</div>
            </div>
            <div className="metric-card highlight-profit">
              <div className="metric-label"><TrendingUp size={14} /> Ganancia real</div>
              <div className="metric-value">{formatearMonto(ganancia, moneda)}</div>
              <div className="metric-sub">Margen {margen.toFixed(1)}%</div>
            </div>
            <div className={`metric-card ${Number(cobro.saldo) > 0.005 ? 'highlight-warning' : ''}`}>
              <div className="metric-label">Estado de cobro</div>
              <div className="metric-value" style={{ color: Number(cobro.saldo) > 0.005 ? 'var(--danger)' : 'var(--success)' }}>
                {Number(cobro.saldo) > 0.005 ? `Falta ${formatearMonto(cobro.saldo, moneda)}` : 'Cobrado'}
              </div>
              <div className="metric-sub">
                {formatearMonto(cobro.pagado, moneda)} de {formatearMonto(cobro.montoTotal, moneda)}
              </div>
            </div>
          </div>

          {/* -------------------------------- Datos ------------------------------- */}
          {tab === 'datos' && (
            <div className="jf-ficha-seccion">
              <div className="card">
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="card-icon"><Users size={18} /></div>
                    <div>
                      <h3 className="card-title">Datos del viaje</h3>
                      <p className="card-subtitle">Contacto y pasajeros</p>
                    </div>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div><div className="metric-label">Email</div><div>{quote.emailCliente || '—'}</div></div>
                  <div><div className="metric-label">Teléfono</div><div>{quote.telefonoCliente || '—'}</div></div>
                  <div><div className="metric-label">Cotizado el</div><div>{quote.fechaCotizacion || '—'}</div></div>
                  <div><div className="metric-label">Moneda</div><div>{moneda}</div></div>
                </div>
              </div>

              {Array.isArray(quote.pasajerosDetalle) && quote.pasajerosDetalle.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <div className="card-icon"><Users size={18} /></div>
                      <div><h3 className="card-title">Pasajeros</h3></div>
                    </div>
                  </div>
                  <div className="jf-table-wrap">
                    <table className="jf-table">
                      <thead>
                        <tr>
                          <th>Nombre</th><th>Apellido</th><th>DNI</th><th>Pasaporte</th><th>Nacimiento</th><th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.pasajerosDetalle.map((pasajero, indice) => (
                          <tr key={indice}>
                            <td>{pasajero.nombre || '—'}</td>
                            <td>{pasajero.apellido || '—'}</td>
                            <td>{pasajero.dni || '—'}</td>
                            <td>{pasajero.pasaporte || '—'}</td>
                            <td>{pasajero.fechaNacimiento || '—'}</td>
                            <td>{pasajero.observaciones || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="card-icon"><Plane size={18} /></div>
                    <div>
                      <h3 className="card-title">Servicios del viaje</h3>
                      <p className="card-subtitle">Lo que se le vendió al cliente y lo que realmente se compró</p>
                    </div>
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="empty-state">
                    <h3>Sin servicios</h3>
                    <p>Este viaje todavía no tiene servicios cargados.</p>
                  </div>
                ) : (
                  <div className="jf-table-wrap">
                    <table className="jf-table">
                      <thead>
                        <tr>
                          <th>Servicio</th>
                          <th>Itinerario / detalle</th>
                          <th style={{ textAlign: 'right' }}>Precio al cliente</th>
                          <th>Presupuesto (proveedor base)</th>
                          <th>Compra real</th>
                          <th>Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const Icono = ICONO_TIPO[item.tipo] || Sparkles;
                          const ahorro = ahorroArbitrajeItem(item);
                          const detalle = item.tipo === 'aereo'
                            ? generarDescripcionItinerario(item.tramos) || 'Sin itinerario cargado'
                            : item.detalles || '—';
                          return (
                            <tr key={item.id}>
                              <td>
                                <strong>{SECCION_LABEL[item.tipo] || item.tipo}</strong>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  <Icono size={12} style={{ verticalAlign: 'middle' }} /> {item.nombre || '—'}
                                </div>
                              </td>
                              <td style={{ maxWidth: '260px' }}>
                                {detalle}
                                {item.fechaEmision && (
                                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                    Emitido el {formatFechaLarga(item.fechaEmision)}
                                  </div>
                                )}
                              </td>
                              <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(precioVentaItem(item), moneda)}</td>
                              <td>
                                <div>{proveedorBasePresupuestoItem(item) || '—'}</div>
                                <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {formatearMonto(costoBasePresupuestoItem(item), moneda)}
                                </div>
                              </td>
                              <td>
                                <div><strong>{proveedorCompraItem(item) || '—'}</strong></div>
                                <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {formatearMonto(costoCompraItem(item), moneda)}
                                </div>
                              </td>
                              <td style={{ color: ahorro > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>
                                {ahorro > 0 ? `Ahorrás ${formatearMonto(ahorro, moneda)}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {quote.notas && (
                <div className="panel-inset">
                  <div className="metric-label">Notas del viaje</div>
                  <p className="jf-ficha-nota" style={{ marginBottom: 0 }}>{quote.notas}</p>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------- Cobros ------------------------------ */}
          {tab === 'cobros' && (
            <div className="jf-ficha-seccion">
              <div className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <div className="metric-label">Saldo a cobrar</div>
                      <div className="metric-value" style={{ color: Number(cobro.saldo) > 0.005 ? 'var(--danger)' : 'var(--success)' }}>
                        {formatearMonto(cobro.saldo, moneda)}
                      </div>
                      <div className="jf-ficha-nota">
                        de {formatearMonto(cobro.montoTotal, moneda)} · {formatearMonto(cobro.pagado, moneda)} cobrados
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setModalCobro(true)} disabled={Number(cobro.saldo) <= 0.005}>
                      <Wallet size={16} /> Cobrar
                    </button>
                  </div>

                  <div className="jf-ficha-progreso" aria-hidden="true">
                    <span style={{ width: `${cobro.montoTotal > 0 ? Math.min(100, (cobro.pagado / cobro.montoTotal) * 100) : 0}%` }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                    <label className="form-label" style={{ margin: 0 }} htmlFor="ficha-fecha-cobro">Próxima fecha de cobro</label>
                    <input
                      id="ficha-fecha-cobro"
                      type="date"
                      className="input-field"
                      style={{ width: '170px' }}
                      value={fechaCobro}
                      onChange={(e) => guardarCampo({ fechaCobro: e.target.value })}
                    />
                    <span className={`badge ${diasCobro !== null && diasCobro < 0 ? 'badge-danger' : 'badge-info'}`}>
                      {textoVencimientoCobro}
                    </span>
                    <span className="jf-ficha-nota" style={{ marginLeft: 'auto' }}>
                      Si cobrás a cuenta, el sistema lo reparte entre tus viajes por fecha.
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="card-icon"><CheckCircle2 size={18} /></div>
                    <div>
                      <h3 className="card-title">Cobros registrados</h3>
                      <p className="card-subtitle">{pagosDelViaje.length} registro(s) de pago</p>
                    </div>
                  </div>
                </div>
                {pagosDelViaje.length === 0 ? (
                  <div className="empty-state">
                    <h3>Todavía no hay cobros</h3>
                    <p>Registrá la seña o el pago del paquete cuando el cliente te pague.</p>
                  </div>
                ) : (
                  <div className="jf-table-wrap">
                    <table className="jf-table">
                      <thead>
                        <tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Nº de operación</th><th style={{ textAlign: 'right' }}>Monto</th><th>Nota</th></tr>
                      </thead>
                      <tbody>
                        {pagosDelViaje.map((pago) => (
                          <tr key={pago.id}>
                            <td>{pago.fecha || '—'}</td>
                            <td>{pago.cliente || '—'}</td>
                            <td>{pago.medio || '—'}</td>
                            <td className="mono">{pago.numeroOperacion || '—'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>{formatearMonto(pago.monto, pago.moneda)}</td>
                            <td>{pago.nota || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------------- Pagos a TTOOs ----------------------------- */}
          {tab === 'pagos' && (
            <div className="jf-ficha-seccion">
              <p className="jf-ficha-nota" style={{ margin: 0 }}>
                Acá figura lo que la agencia debe pagar a cada proveedor por este viaje. Los vuelos se
                liquidan por bloque: todo lo emitido en un rango de días se paga junto en la fecha que fija el proveedor.
              </p>

              {liquidaciones.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-state-icon"><CreditCard size={24} /></div>
                    <h3>Sin pagos a proveedores</h3>
                    <p>
                      Cargá la fecha de emisión de los vuelos (o los vencimientos de los servicios) para
                      ver cuándo hay que pagarle a cada proveedor.
                    </p>
                  </div>
                </div>
              ) : (
                liquidaciones.map((liq) => {
                  const saldoAbierto = Math.max(liq.saldo, 0) > 0.005;
                  return (
                    <div className="card" key={liq.clave}>
                      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1rem' }}>{liq.proveedor}</strong>
                          <span className="badge badge-info">
                            {liq.fechaVencimiento ? `Vence ${formatFechaLarga(liq.fechaVencimiento)}` : 'Sin fecha'}
                          </span>
                          {liq.rangoBSP && <span className="jf-ficha-nota">{liq.rangoBSP}</span>}
                          <span className="jf-ficha-nota" style={{ marginLeft: 'auto' }}>
                            {liq.cantidad} obligación(es)
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                          <div>
                            <div className="metric-label">Total del bloque</div>
                            <strong className="mono">{formatearMonto(liq.montoTotal, liq.moneda)}</strong>
                          </div>
                          <div>
                            <div className="metric-label">Pagado</div>
                            <strong className="mono" style={{ color: 'var(--success)' }}>{formatearMonto(liq.pagado, liq.moneda)}</strong>
                          </div>
                          <div>
                            <div className="metric-label">Saldo</div>
                            <strong className="mono" style={{ color: saldoAbierto ? 'var(--danger)' : 'var(--success)' }}>
                              {formatearMonto(Math.max(liq.saldo, 0), liq.moneda)}
                            </strong>
                          </div>
                        </div>

                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            Ver los {liq.items.length} ticket(s) del bloque
                          </summary>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                            {liq.items.map((ticket) => (
                              <div key={ticket.clave} className="row-soft" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ fontSize: '0.82rem' }}>
                                  <strong>{ticket.concepto}</strong>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    {ticket.cliente}
                                    {Array.isArray(ticket.pasajeros) && ticket.pasajeros.length > 0
                                      ? ` · ${ticket.pasajeros.join(', ')}` : ''}
                                    {ticket.fechaEmision ? ` · Emitido ${formatFechaLarga(ticket.fechaEmision)}` : ''}
                                  </div>
                                </div>
                                <div className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {formatearMonto(ticket.montoTotal, ticket.moneda)}
                                  {Math.max(ticket.saldo, 0) > 0.005 && (
                                    <div style={{ color: 'var(--danger)', fontSize: '0.74rem' }}>
                                      saldo {formatearMonto(ticket.saldo, ticket.moneda)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setLiquidacionActiva(liq)}
                            disabled={!saldoAbierto || !liq.esConsolidable}
                            title={!liq.esConsolidable ? 'Completá la fecha de emisión y la configuración del proveedor' : 'Registrar pago del bloque'}
                          >
                            <CreditCard size={14} /> Registrar pago del bloque
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ---------------------------- Comparación ----------------------------- */}
          {tab === 'comparacion' && (
            <div className="jf-ficha-seccion">
              <p className="jf-ficha-nota" style={{ margin: 0 }}>
                Las sabanas que cargaste y el set que armaste. Lo marcado en verde es lo que se compró.
              </p>
              {items.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <h3>Sin sabanas</h3>
                    <p>Este viaje todavía no tiene servicios cargados.</p>
                  </div>
                </div>
              ) : (
                items.map((item) => {
                  const ofertas = Array.isArray(item.ofertas) ? item.ofertas : [];
                  const menor = ofertas.length
                    ? Math.min(...ofertas.map((o) => Number(o.costo) || 0))
                    : 0;
                  const nota = quote.notasSeleccion?.[item.tipo];
                  return (
                    <div className="card" key={item.id}>
                      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="jf-ficha-seccion-titulo">
                          {SECCION_LABEL[item.tipo] || item.tipo}
                          {item.nombre && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}> · {item.nombre}</span>}
                        </div>
                        {ofertas.map((oferta) => {
                          const elegida = oferta.id === item.ofertaCompraId;
                          return (
                            <div
                              key={oferta.id}
                              className="row-soft"
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '10px',
                                background: elegida ? 'var(--success-bg)' : undefined,
                                borderColor: elegida ? 'var(--success)' : undefined
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong>{oferta.proveedor || 'Sin proveedor'}</strong>
                                {Number(oferta.costo) === menor && <span className="badge badge-info">menor precio</span>}
                                {elegida && <span className="badge badge-success">elegido</span>}
                                {oferta.politicaReembolso === 'No reembolsable' && (
                                  <span className="badge badge-warning">no reembolsable</span>
                                )}
                              </div>
                              <strong className="mono">
                                {formatearMonto(oferta.costo, moneda)}
                              </strong>
                            </div>
                          );
                        })}
                        {nota && <p className="jf-ficha-nota" style={{ margin: 0 }}>“{nota}”</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ----------------------------- Documentos ----------------------------- */}
          {tab === 'documentos' && (
            <div className="jf-ficha-seccion">
              <div className="card">
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="card-icon"><FolderOpen size={18} /></div>
                    <div>
                      <h3 className="card-title">Documentos de {quote.cliente || 'este cliente'}</h3>
                      <p className="card-subtitle">Vouchers, pasajes y documentación guardados en Google Drive</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={14} /> Subir archivo
                    </button>
                    <a
                      className="btn btn-outline btn-sm"
                      href={clienteData?.driveFolderUrl || TARGET_DRIVE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} /> Abrir carpeta en Drive
                    </a>
                  </div>
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={subirArchivo} />
                </div>
                <div className="card-body">
                  {archivos.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon"><FolderOpen size={24} /></div>
                      <h3>Todavía no hay papeles de este viaje</h3>
                      <p>Subí los vouchers, pasajes o fotos de DNI para tenerlos a mano desde acá.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={14} /> Subir primer archivo
                      </button>
                    </div>
                  ) : (
                    GRUPOS_ARCHIVOS.filter((grupo) => archivosPorTipo[grupo.id].length > 0).map((grupo) => (
                      <div key={grupo.id} style={{ marginBottom: '16px' }}>
                        <div className="jf-ficha-seccion-titulo" style={{ marginBottom: '8px' }}>
                          <grupo.Icono size={16} /> {grupo.label} ({archivosPorTipo[grupo.id].length})
                        </div>
                        <div className="jf-ficha-doc-grid">
                          {archivosPorTipo[grupo.id].map((archivo) => (
                            <div className="jf-ficha-doc" key={archivo.id || archivo.nombre}>
                              <div style={{ minWidth: 0 }}>
                                <div className="jf-ficha-doc-nombre" title={archivo.nombre}>{archivo.nombre}</div>
                                <div className="jf-ficha-doc-meta">
                                  {archivo.fechaModificacion || ''} {archivo.tamanio ? `· ${archivo.tamanio}` : ''}
                                </div>
                              </div>
                              <a
                                className="btn btn-secondary btn-sm"
                                href={archivo.urlDescarga && archivo.urlDescarga !== '#'
                                  ? archivo.urlDescarga
                                  : `https://drive.google.com/file/d/${archivo.driveFileId || archivo.id}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir archivo en Google Drive"
                              >
                                <ExternalLink size={14} /> Ver
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------- Resumen -------------------------------- */}
          {tab === 'resumen' && (
            <div className="jf-ficha-seccion">
              <div className="card">
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 className="card-title">Resumen interno de números</h3>
                    <p className="jf-ficha-nota">
                      Documento imprimible con lo que se le vendió al cliente, lo que costó en cada
                      proveedor y la ganancia real. Es de uso interno, no el presupuesto del cliente.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setMostrarResumen(true)}>
                    <Printer size={16} /> Abrir resumen imprimible
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --------------------------- Diálogos anidados --------------------------- */}
      {modalCobro && (
        <RegistrarCobroModal
          key={`cobro-${quote.id}-${pagosClientes.length}`}
          cobro={cobro}
          clienteInicial={quote.cliente}
          clientesUnicos={[...new Set(cotizaciones.map((q) => q.cliente).filter(Boolean))]}
          cobros={derivarCobrosDesdeCotizaciones(cotizaciones)}
          pagosClientes={pagosClientes}
          cotizaciones={cotizaciones}
          onCerrar={() => setModalCobro(false)}
          onGuardar={(pagos) => {
            onRegistrarCobrosClientesLote?.(pagos);
            setModalCobro(false);
          }}
        />
      )}

      {liquidacionActiva && (
        <RegistrarPagoLiquidacionModal
          liquidacion={liquidacionActiva}
          onClose={() => setLiquidacionActiva(null)}
          onRegistrarLote={onRegistrarPagosLote}
        />
      )}

      {mostrarResumen && (
        <QuotePreviewModal
          quote={quote}
          configMensual={configMensual}
          onClose={() => setMostrarResumen(false)}
        />
      )}

      <ConfirmDialog
        open={confirmarPagada}
        title="Marcar como Pagada"
        message={`El viaje todavía tiene ${formatearMonto(cobro.saldo, moneda)} por cobrar. Cambiar el estado no registra el cobro.`}
        warning="Si ya te pagaron, registrá el cobro para que el saldo quede en cero."
        confirmLabel="Marcar de todos modos"
        cancelLabel="Registrar cobro"
        onConfirm={() => {
          guardarCampo({ estado: 'Pagada' });
          setConfirmarPagada(false);
        }}
        onCancel={() => {
          setConfirmarPagada(false);
          setTab('cobros');
          setModalCobro(true);
        }}
      />
    </div>
  );
}
