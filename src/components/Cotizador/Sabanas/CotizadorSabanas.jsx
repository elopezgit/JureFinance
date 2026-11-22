// CotizadorSabanas.jsx - Cotizador por sabanas de proveedores.
//
// El flujo del dueño es: cargar la sabana de cada TTOO (Aero solo vuelo), ver
// todos los precios juntos al momento de elegir, armar el set a mano mezclando
// proveedores, poner el precio final al cliente (fijo o %) y guardar.
//
// Produce EXACTAMENTE el modelo canónico (`servicios.items[].ofertas[]`,
// `ofertaCompraId`, `precioVentaTotalManual`) para que la Ficha del Viaje, los
// pagos a proveedores y los cobros sigan funcionando sin cambios.
import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Save,
  Printer,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Plane,
  Hotel,
  Car,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet
} from 'lucide-react';
import './sabanas.css';
import QuotePreviewModal from '../QuotePreviewModal';
import {
  TIPOS_SERVICIO,
  SECCION_LABEL,
  redondear,
  proveedorIdDe,
  nombreProveedorDe
} from '../../../services/serviciosService';
import { hoyISO } from '../../../services/calendarioService';

const PASOS = [
  { id: 'sabanas', label: '1. Sabanas por proveedor' },
  { id: 'set', label: '2. Armar mi set' },
  { id: 'precio', label: '3. Precio al cliente' },
  { id: 'guardar', label: '4. Resumen y guardar' }
];

const ICONO_TIPO = {
  aereo: Plane,
  hotel: Hotel,
  traslados: Car,
  asistencia: ShieldCheck,
  extra: Sparkles
};

const CONDICIONES = [
  { value: 'reembolsable', label: 'Reembolsable' },
  { value: 'no_reembolsable', label: 'No reembolsable' }
];

const IMPUESTOS = [
  { value: 'incluidos', label: 'Impuestos incluidos' },
  { value: 'neto', label: 'Neto (sin impuestos)' }
];

const ESTADOS = ['Borrador', 'Enviada', 'Aceptada', 'Pagada', 'Vencida'];

const nuevoId = (prefijo) => `${prefijo}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

function lineaVacia(tipo = 'aereo') {
  return {
    id: nuevoId('lin'),
    ofertaId: nuevoId('of'),
    tipo,
    descripcion: '',
    monto: '',
    vigencia: '',
    condicion: 'reembolsable',
    impuestos: 'incluidos',
    vencimientoPago: '',
    fechaEmision: '',
    fechaReserva: ''
  };
}

function sabanaVacia(proveedorId, proveedor) {
  return {
    id: nuevoId('sab'),
    proveedorId,
    proveedor,
    lineas: []
  };
}

/** Tipos que puede cargar un proveedor: Aero sólo vuelo, el resto todo. */
function tiposPermitidos(proveedorId) {
  return proveedorIdDe(proveedorId) === 'aero' ? ['aereo'] : TIPOS_SERVICIO;
}

/** Sabanas guardadas en la cotización; si es vieja, las reconstruye de las ofertas. */
function sabanasDesdeQuote(quote) {
  if (Array.isArray(quote?.sabanas) && quote.sabanas.length > 0) return quote.sabanas;
  const items = Array.isArray(quote?.servicios?.items) ? quote.servicios.items : [];
  const porProveedor = new Map();
  items.forEach((item) => {
    (item.ofertas || []).forEach((oferta) => {
      const pid = proveedorIdDe(oferta.proveedorId || oferta.proveedor);
      if (!pid) return;
      if (!porProveedor.has(pid)) {
        porProveedor.set(pid, sabanaVacia(pid, oferta.proveedor || nombreProveedorDe(pid)));
      }
      porProveedor.get(pid).lineas.push({
        ...lineaVacia(item.tipo || 'extra'),
        descripcion: item.nombre || '',
        monto: Number(oferta.costo) || 0,
        vencimientoPago: oferta.vencimientoTTOO || '',
        fechaEmision: item.fechaEmision || '',
        fechaReserva: item.fechaReserva || ''
      });
    });
  });
  return [...porProveedor.values()];
}

function seleccionDesdeQuote(quote, sabanas) {
  if (quote?.setSeleccion && typeof quote.setSeleccion === 'object') return quote.setSeleccion;
  const items = Array.isArray(quote?.servicios?.items) ? quote.servicios.items : [];
  const seleccion = {};
  items.filter((i) => i.activo !== false).forEach((item) => {
    const oferta = (item.ofertas || []).find((o) => o.id === item.ofertaCompraId);
    if (!oferta) return;
    const pid = proveedorIdDe(oferta.proveedorId || oferta.proveedor);
    const sabana = sabanas.find((s) => s.proveedorId === pid);
    const linea = sabana?.lineas.find((l) => l.tipo === item.tipo);
    if (linea) seleccion[item.tipo] = linea.id;
  });
  return seleccion;
}

export default function CotizadorSabanas({
  initialQuote,
  onSaveQuote,
  operadoresList = [],
  configMensual = []
}) {
  const hoy = hoyISO();
  const [paso, setPaso] = useState(0);

  const [cliente, setCliente] = useState(initialQuote?.cliente || '');
  const [destino, setDestino] = useState(initialQuote?.destino || '');
  const [fechaViajeInicio, setFechaViajeInicio] = useState(initialQuote?.fechaViajeInicio || '');
  const [fechaViajeFin, setFechaViajeFin] = useState(initialQuote?.fechaViajeFin || '');
  const [pax, setPax] = useState(initialQuote?.pax || 1);
  const [estado, setEstado] = useState(initialQuote?.estado || 'Borrador');
  const [notas, setNotas] = useState(initialQuote?.notas || '');
  const [pasajeros, setPasajeros] = useState(
    Array.isArray(initialQuote?.pasajeros) ? initialQuote.pasajeros.join(', ') : ''
  );

  const [sabanas, setSabanas] = useState(() => sabanasDesdeQuote(initialQuote));
  const [seleccion, setSeleccion] = useState(() => seleccionDesdeQuote(initialQuote, sabanasDesdeQuote(initialQuote)));
  const [notasSeleccion, setNotasSeleccion] = useState(initialQuote?.notasSeleccion || {});

  const [modoVenta, setModoVenta] = useState(initialQuote?.modoVenta || 'porcentaje');
  const [markupPct, setMarkupPct] = useState(initialQuote?.markupGlobalPct ?? 20);
  const [precioFijo, setPrecioFijo] = useState(String(initialQuote?.precioVentaTotalManual || ''));
  const [error, setError] = useState('');
  const [mostrarResumen, setMostrarResumen] = useState(false);

  const quoteId = initialQuote?.id || `COT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const todasLasLineas = useMemo(
    () => sabanas.flatMap((s) => s.lineas.map((l) => ({ linea: l, sabana: s }))),
    [sabanas]
  );

  const tiposConPrecios = useMemo(() => {
    const presentes = new Set(todasLasLineas.map((x) => x.linea.tipo));
    return TIPOS_SERVICIO.filter((tipo) => presentes.has(tipo));
  }, [todasLasLineas]);

  const lineasDelTipo = (tipo) =>
    todasLasLineas.filter((x) => x.linea.tipo === tipo && Number(x.linea.monto) > 0);

  const encontrarLinea = (lineaId) => todasLasLineas.find((x) => x.linea.id === lineaId);

  const setElegidas = [];
  tiposConPrecios.forEach((tipo) => {
    const elegida = encontrarLinea(seleccion[tipo]);
    if (elegida) setElegidas.push({ tipo, ...elegida });
  });

  const costoSet = redondear(setElegidas.reduce((acc, x) => acc + (Number(x.linea.monto) || 0), 0));

  // Referencia: la opción más cara de cada servicio (la sabana que se usó como base).
  const costoReferencia = redondear(
    tiposConPrecios.reduce((acc, tipo) => {
      const montos = lineasDelTipo(tipo).map((x) => Number(x.linea.monto) || 0);
      return acc + (montos.length ? Math.max(...montos) : 0);
    }, 0)
  );
  const ahorro = redondear(Math.max(0, costoReferencia - costoSet));

  const ventaSugerida = redondear(costoSet * (1 + (Number(markupPct) || 0) / 100));
  const ventaFinal = redondear(modoVenta === 'fijo' ? Number(precioFijo) || 0 : ventaSugerida);
  const ganancia = redondear(ventaFinal - costoSet);
  const margen = ventaFinal > 0 ? redondear((ganancia / ventaFinal) * 100) : 0;

  /* ------------------------- Operaciones sobre sabanas ------------------------ */

  const agregarSabana = (proveedorId) => {
    const pid = proveedorIdDe(proveedorId);
    if (!pid || sabanas.some((s) => s.proveedorId === pid)) return;
    const operador = operadoresList.find((op) => proveedorIdDe(op.id) === pid);
    const proveedor = operador?.nombre || nombreProveedorDe(pid);
    setSabanas((prev) => [...prev, sabanaVacia(pid, proveedor)]);
  };

  const quitarSabana = (id) => {
    setSabanas((prev) => prev.filter((s) => s.id !== id));
    setSeleccion({});
  };

  const agregarLinea = (sabanaId, tipo) => {
    setSabanas((prev) =>
      prev.map((s) => (s.id === sabanaId ? { ...s, lineas: [...s.lineas, lineaVacia(tipo)] } : s))
    );
  };

  const cambiarLinea = (sabanaId, lineaId, campo, valor) => {
    setSabanas((prev) =>
      prev.map((s) =>
        s.id === sabanaId
          ? { ...s, lineas: s.lineas.map((l) => (l.id === lineaId ? { ...l, [campo]: valor } : l)) }
          : s
      )
    );
  };

  const quitarLinea = (sabanaId, lineaId) => {
    setSabanas((prev) =>
      prev.map((s) =>
        s.id === sabanaId ? { ...s, lineas: s.lineas.filter((l) => l.id !== lineaId) } : s
      )
    );
    setSeleccion((prev) => {
      const copia = { ...prev };
      Object.keys(copia).forEach((tipo) => {
        if (copia[tipo] === lineaId) delete copia[tipo];
      });
      return copia;
    });
  };

  /* --------------------------------- Guardar --------------------------------- */

  const construirQuote = () => {
    const items = setElegidas.map(({ tipo, linea }) => {
      const ofertasDelTipo = lineasDelTipo(tipo).map(({ linea: l, sabana: s }) => ({
        id: l.ofertaId,
        proveedorId: s.proveedorId,
        proveedor: s.proveedor,
        costo: redondear(Number(l.monto) || 0),
        vencimientoTTOO: l.vencimientoPago || '',
        politicaReembolso: l.condicion === 'no_reembolsable' ? 'No reembolsable' : 'Reembolsable',
        esBasePresupuesto: false
      }));
      return {
        id: `srv-${tipo}-${quoteId}`,
        tipo,
        activo: true,
        nombre: linea.descripcion?.trim() || SECCION_LABEL[tipo] || tipo,
        detalles: linea.descripcion || '',
        precioVenta: 0,
        ofertas: ofertasDelTipo,
        ofertaCompraId: linea.ofertaId,
        estadoVuelo: tipo === 'aereo' ? (linea.fechaEmision ? 'Emitido' : 'SinReservar') : undefined,
        estadoReserva: tipo !== 'aereo' ? 'Reservado' : undefined,
        fechaEmision: linea.fechaEmision || '',
        fechaReserva: linea.fechaReserva || '',
        reglaVencimiento: tipo === 'aereo' ? 'bcp' : 'semanaAntesViaje',
        tramos: []
      };
    });

    // Repartimos el precio global entre las líneas para que TODOS los módulos
    // (Ficha, Historial, Resumen interno) sumen exactamente lo mismo.
    let restante = ventaFinal;
    items.forEach((item, indice) => {
      if (indice === items.length - 1) {
        item.precioVenta = redondear(restante);
      } else {
        const costoItem = Number(item.ofertas.find((o) => o.id === item.ofertaCompraId)?.costo) || 0;
        const parte = costoSet > 0 ? redondear((ventaFinal * costoItem) / costoSet) : redondear(ventaFinal / items.length);
        item.precioVenta = parte;
        restante = redondear(restante - parte);
      }
    });

    const paxNum = Math.max(1, Number(pax) || 1);
    return {
      id: quoteId,
      cliente: cliente.trim() || 'Sin cliente',
      emailCliente: initialQuote?.emailCliente || '',
      telefonoCliente: initialQuote?.telefonoCliente || '',
      destino,
      fechaViajeInicio,
      fechaViajeFin,
      fechaCotizacion: initialQuote?.fechaCotizacion || hoy,
      fechaCobro: initialQuote?.fechaCobro || hoy,
      pax: paxNum,
      pasajeros: pasajeros.split(',').map((p) => p.trim()).filter(Boolean),
      pasajerosDetalle: initialQuote?.pasajerosDetalle || [],
      moneda: 'USD',
      estado,
      notas,
      sabanas,
      setSeleccion: seleccion,
      notasSeleccion,
      modoVenta,
      markupGlobalPct: Number(markupPct) || 0,
      servicios: {
        proveedores: sabanas.map((s) => s.proveedorId),
        items
      },
      totalNeto: costoSet,
      totalVenta: ventaFinal,
      totalOptimo: ventaFinal,
      precioVentaRedondeadoXPax: redondear(ventaFinal / paxNum),
      precioVentaTotalManual: ventaFinal,
      gananciaRealTotal: ganancia,
      margenRealPct: margen,
      comisionOptimaPct: Number(markupPct) || 0
    };
  };

  const siguiente = () => {
    setError('');
    if (paso === 0) {
      if (!cliente.trim()) return setError('Ingresá el nombre del cliente.');
      const conLineas = sabanas.filter((s) => s.lineas.length > 0);
      if (conLineas.length === 0) return setError('Cargá al menos un precio en una sabana.');
    }
    if (paso === 1 && setElegidas.length === 0) {
      return setError('Elegí de qué proveedor comprás cada servicio.');
    }
    if (paso === 2 && modoVenta === 'fijo' && !(Number(precioFijo) > 0)) {
      return setError('Ingresá el precio de venta al cliente.');
    }
    setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  };

  const guardar = () => {
    onSaveQuote?.(construirQuote());
  };

  /* --------------------------------- Render ---------------------------------- */

  return (
    <div className="jf-sab-wizard">
      <div className="jf-sab-pasos">
        {PASOS.map((p, indice) => (
          <button
            key={p.id}
            className={`jf-sab-paso-btn ${paso === indice ? 'activo' : ''}`}
            onClick={() => indice < paso && setPaso(indice)}
            disabled={indice > paso}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="jf-alert jf-alert--warning" role="alert">
          <div className="jf-alert-content"><AlertTriangle size={16} /> {error}</div>
        </div>
      )}

      {/* ---------------------------- Paso 1: sabanas --------------------------- */}
      {paso === 0 && (
        <>
          <div className="card jf-sab-card">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon"><Users size={18} /></div>
                <div>
                  <h3 className="card-title">Datos del viaje</h3>
                  <p className="card-subtitle">Todo se carga en dólares, como lo trabajamos siempre</p>
                </div>
              </div>
            </div>
            <div className="jf-sab-grid">
              <div>
                <label className="form-label">Cliente</label>
                <input data-testid="sab-cliente" className="input-field" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div>
                <label className="form-label">Destino</label>
                <input className="input-field" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ej. Cancún" />
              </div>
              <div>
                <label className="form-label">Inicio del viaje</label>
                <input type="date" className="input-field" value={fechaViajeInicio} onChange={(e) => setFechaViajeInicio(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Fin del viaje</label>
                <input type="date" className="input-field" value={fechaViajeFin} onChange={(e) => setFechaViajeFin(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Pasajeros</label>
                <input type="number" min="1" className="input-field" value={pax} onChange={(e) => setPax(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Estado</label>
                <select className="select-field" value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <label className="form-label">Pasajeros (nombres, separados por coma)</label>
              <input className="input-field" value={pasajeros} onChange={(e) => setPasajeros(e.target.value)} placeholder="Marta Gómez, Juan Pérez" />
            </div>
            <div style={{ marginTop: '12px' }}>
              <label className="form-label">Notas del viaje (opcional)</label>
              <textarea
                className="input-field"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones internas del viaje"
              />
            </div>
          </div>

          <div className="card jf-sab-card">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon"><Building2 size={18} /></div>
                <div>
                  <h3 className="card-title">Sabanas por proveedor</h3>
                  <p className="card-subtitle">Aero solo carga vuelo. Los demás pueden cargar vuelo, hotel, traslado, asistencia y excursiones.</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {operadoresList.map((op) => {
                const pid = proveedorIdDe(op.id);
                const agregado = sabanas.some((s) => s.proveedorId === pid);
                return (
                  <button
                    key={op.id}
                    data-testid={`sab-proveedor-${pid}`}
                    className={`btn ${agregado ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                    disabled={agregado}
                    onClick={() => agregarSabana(op.id)}
                  >
                    <Plus size={13} /> {op.nombre}
                    {pid === 'aero' && <span className="badge badge-neutral" style={{ marginLeft: 4 }}>solo vuelo</span>}
                  </button>
                );
              })}
            </div>

            {sabanas.length === 0 && (
              <div className="empty-state">
                <h3>Todavía no hay sabanas</h3>
                <p>Tocá un proveedor arriba para empezar a cargar sus precios.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {sabanas.map((sabana) => {
                const permitidos = tiposPermitidos(sabana.proveedorId);
                const tiposDisponibles = permitidos.filter(
                  (tipo) => !sabana.lineas.some((l) => l.tipo === tipo) || tipo === 'extra'
                );
                return (
                  <div className="panel-inset" key={sabana.id}>
                    <div className="jf-sab-linea-cab" style={{ marginBottom: '10px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{sabana.proveedor}</strong>
                      <button className="btn btn-danger btn-sm" onClick={() => quitarSabana(sabana.id)} title="Quitar proveedor">
                        <Trash2 size={13} /> Quitar
                      </button>
                    </div>

                    {sabana.lineas.length === 0 && (
                      <p className="jf-ficha-nota" style={{ margin: '0 0 10px' }}>
                        Cargá el precio de cada servicio que cotizó este proveedor.
                      </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sabana.lineas.map((linea) => {
                        const Icono = ICONO_TIPO[linea.tipo] || Sparkles;
                        return (
                          <div className="jf-sab-linea" key={linea.id}>
                            <div className="jf-sab-linea-cab">
                              <span className="jf-sab-linea-titulo">
                                <Icono size={14} style={{ verticalAlign: 'middle' }} /> {SECCION_LABEL[linea.tipo]}
                              </span>
                              <button className="btn btn-secondary btn-sm" onClick={() => quitarLinea(sabana.id, linea.id)} title="Quitar línea">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="jf-sab-grid">
                              <div>
                                <label className="form-label">Servicio</label>
                                <select
                                  className="select-field"
                                  value={linea.tipo}
                                  onChange={(e) => {
                                    cambiarLinea(sabana.id, linea.id, 'tipo', e.target.value);
                                    setSeleccion((prev) => {
                                      const copia = { ...prev };
                                      delete copia[linea.tipo];
                                      return copia;
                                    });
                                  }}
                                >
                                  {permitidos.map((tipo) => <option key={tipo} value={tipo}>{SECCION_LABEL[tipo]}</option>)}
                                </select>
                              </div>
                              <div style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Descripción</label>
                                <input
                                  className="input-field"
                                  value={linea.descripcion}
                                  onChange={(e) => cambiarLinea(sabana.id, linea.id, 'descripcion', e.target.value)}
                                  placeholder="Ej. Vuelo TUC → CUN, Hotel 5 noches…"
                                />
                              </div>
                              <div>
                                <label className="form-label">Precio total (USD)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  data-testid={`sab-monto-${sabana.proveedorId}-${linea.tipo}`}
                                  className="input-field mono"
                                  value={linea.monto}
                                  onChange={(e) => cambiarLinea(sabana.id, linea.id, 'monto', e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="form-label">Vigencia de la cotización</label>
                                <input
                                  type="date"
                                  className="input-field"
                                  value={linea.vigencia}
                                  onChange={(e) => cambiarLinea(sabana.id, linea.id, 'vigencia', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="form-label">Condición</label>
                                <select
                                  className="select-field"
                                  value={linea.condicion}
                                  onChange={(e) => cambiarLinea(sabana.id, linea.id, 'condicion', e.target.value)}
                                >
                                  {CONDICIONES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="form-label">Impuestos</label>
                                <select
                                  className="select-field"
                                  value={linea.impuestos}
                                  onChange={(e) => cambiarLinea(sabana.id, linea.id, 'impuestos', e.target.value)}
                                >
                                  {IMPUESTOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="form-label">Vencimiento de pago (opcional)</label>
                                <input
                                  type="date"
                                  className="input-field"
                                  value={linea.vencimientoPago}
                                  onChange={(e) => cambiarLinea(sabana.id, linea.id, 'vencimientoPago', e.target.value)}
                                />
                              </div>
                              {linea.tipo === 'aereo' ? (
                                <div>
                                  <label className="form-label">Fecha de emisión</label>
                                  <input
                                    type="date"
                                    className="input-field"
                                    value={linea.fechaEmision}
                                    onChange={(e) => cambiarLinea(sabana.id, linea.id, 'fechaEmision', e.target.value)}
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="form-label">Fecha de reserva</label>
                                  <input
                                    type="date"
                                    className="input-field"
                                    value={linea.fechaReserva}
                                    onChange={(e) => cambiarLinea(sabana.id, linea.id, 'fechaReserva', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {tiposDisponibles.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {tiposDisponibles.map((tipo) => (
                          <button
                            key={tipo}
                            data-testid={`sab-agregar-${sabana.proveedorId}-${tipo}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => agregarLinea(sabana.id, tipo)}
                          >
                            <Plus size={13} /> {SECCION_LABEL[tipo]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="jf-sab-resumen">
            <div className="metric-sub">Cuando termines de cargar las sabanas, pasá a armar el set.</div>
            <button data-testid="sab-paso1-siguiente" className="btn btn-primary" onClick={siguiente}>
              Armar mi set <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}

      {/* ------------------------------ Paso 2: set ----------------------------- */}
      {paso === 1 && (
        <>
          <div className="card jf-sab-card">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon"><CheckCircle2 size={18} /></div>
                <div>
                  <h3 className="card-title">Armar mi set</h3>
                  <p className="card-subtitle">Los precios de todos los proveedores están acá. Elegí línea por línea; nada se elige solo.</p>
                </div>
              </div>
            </div>

            {tiposConPrecios.length === 0 && (
              <div className="empty-state">
                <h3>No hay precios cargados</h3>
                <p>Volvé al paso 1 y cargá las sabanas.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {tiposConPrecios.map((tipo) => {
                const opciones = lineasDelTipo(tipo);
                const menor = Math.min(...opciones.map((x) => Number(x.linea.monto) || 0));
                const Icono = ICONO_TIPO[tipo] || Sparkles;
                return (
                  <div key={tipo}>
                    <div className="jf-ficha-seccion-titulo" style={{ marginBottom: '8px' }}>
                      <Icono size={16} /> {SECCION_LABEL[tipo]}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {opciones.map(({ linea, sabana }) => {
                        const elegida = seleccion[tipo] === linea.id;
                        const avisos = [];
                        if (linea.vigencia && linea.vigencia < hoy) avisos.push('cotización vencida');
                        if (linea.condicion === 'no_reembolsable') avisos.push('no reembolsable');
                        if (linea.impuestos === 'neto') avisos.push('sin impuestos');
                        return (
                          <div
                            key={linea.id}
                            data-testid="sab-opcion"
                            data-proveedor={sabana.proveedorId}
                            data-tipo={linea.tipo}
                            className={`jf-sab-opcion ${elegida ? 'elegida' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSeleccion((prev) => ({ ...prev, [tipo]: linea.id }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSeleccion((prev) => ({ ...prev, [tipo]: linea.id }));
                              }
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong>{sabana.proveedor}</strong>
                                {Number(linea.monto) === menor && <span className="badge badge-info">menor precio</span>}
                                {elegida && <span className="badge badge-success">elegido</span>}
                              </div>
                              {linea.descripcion && (
                                <div className="jf-ficha-nota">{linea.descripcion}</div>
                              )}
                              {avisos.length > 0 && (
                                <div className="jf-sab-avisos">
                                  {avisos.map((aviso) => (
                                    <span key={aviso} className="badge badge-warning">{aviso}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="jf-sab-opcion-precio">US$ {Number(linea.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        );
                      })}
                    </div>
                    <input
                      className="input-field"
                      style={{ marginTop: '8px' }}
                      value={notasSeleccion[tipo] || ''}
                      onChange={(e) => setNotasSeleccion((prev) => ({ ...prev, [tipo]: e.target.value }))}
                      placeholder="Nota opcional: por qué elegiste este proveedor"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="jf-sab-resumen">
            <div>
              <div className="metric-label">Costo de tu set</div>
              <div className="metric-value">US$ {costoSet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              <div className="metric-sub">
                {setElegidas.length} servicio(s) · ahorro US$ {ahorro.toLocaleString('es-AR', { minimumFractionDigits: 2 })} vs. la opción más cara
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setPaso(0)}><ArrowLeft size={15} /> Sabanas</button>
              <button className="btn btn-primary" onClick={siguiente}>Precio al cliente <ArrowRight size={15} /></button>
            </div>
          </div>
        </>
      )}

      {/* ----------------------------- Paso 3: precio --------------------------- */}
      {paso === 2 && (
        <>
          <div className="card jf-sab-card">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon"><Wallet size={18} /></div>
                <div>
                  <h3 className="card-title">Precio al cliente</h3>
                  <p className="card-subtitle">Elegí un número fijo o un porcentaje sobre el costo de tu set</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                className={`btn ${modoVenta === 'porcentaje' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setModoVenta('porcentaje')}
              >
                <TrendingUp size={14} /> Por porcentaje
              </button>
              <button
                className={`btn ${modoVenta === 'fijo' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setModoVenta('fijo')}
              >
                Número fijo
              </button>
            </div>

            {modoVenta === 'porcentaje' ? (
              <div>
                <label className="form-label">Porcentaje de ganancia sobre el costo</label>
                <input
                  type="number"
                  step="0.01"
                  data-testid="sab-markup"
                  className="input-field"
                  style={{ maxWidth: '220px' }}
                  value={markupPct}
                  onChange={(e) => setMarkupPct(e.target.value)}
                />
                <p className="jf-ficha-nota">
                  Venta = costo × (1 + {Number(markupPct) || 0} / 100). Cambia el número y se recalcula en vivo.
                </p>
              </div>
            ) : (
              <div>
                <label className="form-label">Precio final que le pasás al cliente (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  style={{ maxWidth: '260px' }}
                  value={precioFijo}
                  onChange={(e) => setPrecioFijo(e.target.value)}
                  placeholder="0.00"
                />
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: '8px' }}
                  onClick={() => setPrecioFijo(String(ventaSugerida))}
                >
                  Usar el sugerido por porcentaje
                </button>
              </div>
            )}

            <div className="jf-ficha-strip" style={{ marginTop: '20px' }}>
              <div className="metric-card">
                <div className="metric-label">Costo de tu set</div>
                <div className="metric-value">US$ {costoSet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Precio de venta</div>
                <div className="metric-value">US$ {ventaFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="metric-card highlight-profit">
                <div className="metric-label">Ganancia</div>
                <div className="metric-value">US$ {ganancia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Margen</div>
                <div className="metric-value">{margen.toFixed(1)}%</div>
                <div className="metric-sub">US$ {(ventaFinal / Math.max(1, Number(pax) || 1)).toFixed(2)} por pasajero</div>
              </div>
            </div>
          </div>

          <div className="jf-sab-resumen">
            <div className="metric-sub">Revisá el precio antes de seguir.</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setPaso(1)}><ArrowLeft size={15} /> Mi set</button>
              <button className="btn btn-primary" onClick={siguiente}>Resumen y guardar <ArrowRight size={15} /></button>
            </div>
          </div>
        </>
      )}

      {/* ---------------------------- Paso 4: guardar ---------------------------- */}
      {paso === 3 && (
        <>
          <div className="card jf-sab-card">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-icon"><Save size={18} /></div>
                <div>
                  <h3 className="card-title">Resumen del viaje</h3>
                  <p className="card-subtitle">{cliente || 'Sin cliente'} · {destino || 'Sin destino'} · {pax} pasajero(s)</p>
                </div>
              </div>
            </div>

            <div className="jf-ficha-strip">
              <div className="metric-card"><div className="metric-label">Venta al cliente</div><div className="metric-value">US$ {ventaFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div></div>
              <div className="metric-card"><div className="metric-label">Costo real</div><div className="metric-value">US$ {costoSet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div></div>
              <div className="metric-card highlight-profit"><div className="metric-label">Ganancia real</div><div className="metric-value">US$ {ganancia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div></div>
              <div className="metric-card"><div className="metric-label">Margen</div><div className="metric-value">{margen.toFixed(1)}%</div></div>
            </div>

            <div style={{ marginTop: '18px' }}>
              <div className="jf-ficha-seccion-titulo" style={{ marginBottom: '8px' }}>Tu set</div>
              {setElegidas.map(({ tipo, linea, sabana }) => (
                <div className="jf-sab-set-linea" key={tipo}>
                  <div>
                    <strong>{SECCION_LABEL[tipo]}</strong> · {sabana.proveedor}
                    {linea.descripcion && <div className="jf-ficha-nota">{linea.descripcion}</div>}
                    {notasSeleccion[tipo] && <div className="jf-ficha-nota">“{notasSeleccion[tipo]}”</div>}
                  </div>
                  <strong className="mono">US$ {Number(linea.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </div>
              ))}
            </div>

            {notas && (
              <div className="panel-inset" style={{ marginTop: '16px' }}>
                <div className="metric-label">Notas del viaje</div>
                <p className="jf-ficha-nota" style={{ margin: 0 }}>{notas}</p>
              </div>
            )}
          </div>

          <div className="jf-sab-resumen">
            <button className="btn btn-secondary" onClick={() => setPaso(2)}><ArrowLeft size={15} /> Precio</button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setMostrarResumen(true)}><Printer size={15} /> Resumen imprimible</button>
              <button data-testid="sab-guardar" className="btn btn-primary" onClick={guardar}><Save size={15} /> Guardar cotización</button>
            </div>
          </div>
        </>
      )}

      {mostrarResumen && (
        <QuotePreviewModal
          quote={construirQuote()}
          configMensual={configMensual}
          onClose={() => setMostrarResumen(false)}
        />
      )}
    </div>
  );
}
