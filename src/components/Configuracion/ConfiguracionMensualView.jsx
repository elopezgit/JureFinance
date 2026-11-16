// ConfiguracionMensualView.jsx - Módulo 1: Configuración Mensual de TTOs (BCP)
// Los proveedores definen los bloques de fechas de emisión y su fecha límite de
// pago. Esta pantalla permite cargarlos a mano, generarlos por regla, copiarlos
// entre meses, aplicarlos a todos los proveedores y ver la cobertura del mes.
import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Trash2,
  Save,
  Copy,
  CopyPlus,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Wand2,
  Layers,
  CalendarDays,
  XCircle
} from 'lucide-react';
import {
  getMesActual,
  formatMesLabel,
  getBimestreDeMes,
  formatBimestreLabel,
  shiftMes,
  getConfigMesProveedor,
  normalizeProveedorId,
  validateBloques,
  generarBloquesDesdeRegla,
  desplazarBloquesAMes,
  mesesEntre,
  diasDelMes,
  fechaDeMes,
  resumirDias
} from '../../services/ttoService';
import { formatFechaLarga } from '../../services/calendarioService';
import { normalizarServicios } from '../../services/serviciosService';
import ConfirmDialog from '../Common/ConfirmDialog';
import { buildBloquesMes } from '../../data/initialData';

const PALETA = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#ef4444'];

/** 'aero' → 'Aero' */
function nombreProveedor(id) {
  const texto = String(id || '').trim();
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function ConfiguracionMensualView({
  configMensual = [],
  onSaveConfig,
  operadoresList = [],
  cotizaciones = []
}) {
  const [mes, setMes] = useState(getMesActual());
  const [proveedorId, setProveedorId] = useState(() =>
    normalizeProveedorId(operadoresList[0]?.id || 'aero')
  );
  const [bloques, setBloques] = useState([]);
  const [errors, setErrors] = useState([]);
  const [confirmacion, setConfirmacion] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [regla, setRegla] = useState({
    diasPorBloque: '5',
    diaPago: '20',
    offsetMesPago: '0'
  });

  // Proveedores: los del directorio + los que ya tienen configuración + los
  // que aparecen en cotizaciones (para que un proveedor nuevo sea configurable).
  const proveedores = useMemo(() => {
    const mapa = new Map();
    const agregar = (id, nombre) => {
      const pid = normalizeProveedorId(id);
      if (!pid) return;
      if (!mapa.has(pid)) {
        mapa.set(pid, { id: pid, nombre: nombre || nombreProveedor(pid) });
      }
    };

    (operadoresList || []).forEach((op) => agregar(op.id, op.nombre));
    (configMensual || []).forEach((cfg) => agregar(cfg.proveedorId, cfg.proveedorNombre));

    (cotizaciones || []).forEach((quote) => {
      if (!quote) return;
      normalizarServicios(quote.servicios, { pax: quote.pax }).forEach((item) => {
        agregar(item.proveedorId, item.proveedor);
        (item.ofertas || []).forEach((oferta) =>
          agregar(oferta.proveedorId, oferta.proveedor)
        );
      });
    });

    if (mapa.size === 0) mapa.set('aero', { id: 'aero', nombre: 'Aero' });
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [operadoresList, configMensual, cotizaciones]);

  const ultimoDia = diasDelMes(mes);
  const mesActual = getMesActual();
  const pidActual = normalizeProveedorId(proveedorId);

  // Cargar los bloques del mes/proveedor seleccionados durante el render
  // (patrón recomendado por React para evitar renders en cascada).
  const editorKey = `${mes}|${pidActual}`;
  const [loadedKey, setLoadedKey] = useState(null);
  if (loadedKey !== editorKey) {
    const cfg = getConfigMesProveedor(configMensual, pidActual, mes);
    setLoadedKey(editorKey);
    setBloques(cfg ? cfg.bloques.map((b) => ({ ...b })) : []);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg('');
  }

  const validacion = useMemo(() => validateBloques(bloques, mes), [bloques, mes]);

  // Mapa día → índice de bloque para la vista previa de cobertura.
  const bloquePorDia = useMemo(() => {
    const mapa = {};
    bloques.forEach((b, idx) => {
      const desde = Number(b.desde);
      const hasta = Math.min(Number(b.hasta), ultimoDia);
      if (!desde || !hasta || hasta < desde) return;
      for (let d = Math.max(desde, 1); d <= hasta; d++) mapa[d] = idx;
    });
    return mapa;
  }, [bloques, ultimoDia]);

  const configuradosEsteMes = configMensual
    .filter((c) => c.mes === mes && c.bloques?.length)
    .map((c) => normalizeProveedorId(c.proveedorId));

  const updateBloque = (idx, field, value) => {
    setBloques((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b))
    );
    setSuccessMsg('');
  };

  const addBloque = () => {
    setBloques((prev) => {
      const ultimo = prev[prev.length - 1];
      const desde = ultimo ? Math.min(Number(ultimo.hasta) + 1, ultimoDia) : 1;
      const hasta = Math.min(desde + 4, ultimoDia);
      return [
        ...prev,
        {
          desde: Number.isFinite(desde) ? desde : '',
          hasta: Number.isFinite(hasta) ? hasta : '',
          fechaPago: ultimo?.fechaPago || fechaDeMes(mes, 20)
        }
      ];
    });
    setSuccessMsg('');
  };

  const removeBloque = (idx) => {
    setBloques((prev) => prev.filter((_, i) => i !== idx));
    setSuccessMsg('');
  };

  const handleGenerate = () => {
    const generados = generarBloquesDesdeRegla({
      mes,
      diasPorBloque: Number(regla.diasPorBloque) || 5,
      diaPago: Number(regla.diaPago) || 20,
      offsetMesPago: Number(regla.offsetMesPago) || 0
    });
    setBloques(generados);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(
      `Se generaron ${generados.length} bloques para ${formatMesLabel(mes)}. Revisá las fechas y guardá.`
    );
  };

  const handlePlantillaEstandar = () => {
    const plantilla = buildBloquesMes(mes);
    setBloques(plantilla);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(
      `Se cargó la plantilla oficial de umbrales de ${formatMesLabel(mes)} (4 bloques: 01-07, 08-15, 16-22, 23-fin). Revisá las fechas y guardá.`
    );
  };

  /**
   * Renueva / guarda de una sola vez los 2 meses del bimestre activo (ej. Noviembre + Diciembre)
   * con la tabla oficial de 4 umbrales de emisión de Aero (Cuenta Corriente).
   */
  const ejecutarRenovarBimestre = () => {
    const [m1, m2] = getBimestreDeMes(mes);
    const b1 = buildBloquesMes(m1);
    const b2 = buildBloquesMes(m2);

    const others = configMensual.filter(
      (c) =>
        !(
          (c.mes === m1 || c.mes === m2) &&
          normalizeProveedorId(c.proveedorId) === pidActual
        )
    );

    const updated = [
      ...others,
      { mes: m1, proveedorId: pidActual, bloques: b1 },
      { mes: m2, proveedorId: pidActual, bloques: b2 }
    ].sort((a, b) =>
      a.mes === b.mes
        ? String(a.proveedorId || '').localeCompare(String(b.proveedorId || ''))
        : String(a.mes || '').localeCompare(String(b.mes || ''))
    );

    if (onSaveConfig) onSaveConfig(updated);
    setBloques(mes === m2 ? b2 : b1);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(
      `Se renovó el bimestre completo (${formatBimestreLabel(mes)}) para ${proveedorActivo} con los 4 umbrales oficiales (01-07, 08-15, 16-22, 23-fin).`
    );
  };

  const handleRenovarBimestreAero = () => setConfirmacion({
    titulo: 'Renovar bimestre',
    mensaje: `¿Renovar la configuración de ${proveedorActivo} para ${formatBimestreLabel(mes)}?`,
    warning: 'Se reemplazarán los bloques de ambos meses con los 4 umbrales oficiales (01-07, 08-15, 16-22, 23-fin).',
    etiqueta: 'Renovar bimestre',
    accion: ejecutarRenovarBimestre
  });

  const handleCopyPrevMonth = () => {
    const prevMes = shiftMes(mes, -1);
    const prev = getConfigMesProveedor(configMensual, pidActual, prevMes);
    if (!prev || !prev.bloques?.length) {
      setErrors([`No hay configuración cargada para ${formatMesLabel(prevMes)}.`]);
      setSuccessMsg('');
      return;
    }
    const delta = mesesEntre(prevMes, mes);
    setBloques(desplazarBloquesAMes(prev.bloques, delta));
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(
      `Bloques copiados de ${formatMesLabel(prevMes)} con las fechas de pago desplazadas. Revisá y guardá.`
    );
  };

  /** Guarda una entrada concreta (mes + proveedor) sin pisar el resto. */
  const guardarEntrada = (targetMes, targetProveedor, targetBloques, mensaje) => {
    const targetPid = normalizeProveedorId(targetProveedor);
    const others = configMensual.filter(
      (c) => !(c.mes === targetMes && normalizeProveedorId(c.proveedorId) === targetPid)
    );
    const entrada = {
      mes: targetMes,
      proveedorId: targetPid,
      bloques: [...targetBloques]
        .sort((a, b) => Number(a.desde) - Number(b.desde))
        .map((b) => ({
          desde: Number(b.desde),
          hasta: Number(b.hasta),
          fechaPago: b.fechaPago
        }))
    };
    const updated = [...others, entrada].sort((a, b) =>
      a.mes === b.mes
        ? String(a.proveedorId || '').localeCompare(String(b.proveedorId || ''))
        : String(a.mes || '').localeCompare(String(b.mes || ''))
    );
    if (onSaveConfig) onSaveConfig(updated);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(mensaje);
  };

  const handleSave = () => {
    const validation = validateBloques(bloques, mes);
    if (!validation.ok) {
      setErrors(validation.errors);
      setWarnings(validation.warnings);
      setSuccessMsg('');
      return;
    }
    guardarEntrada(
      mes,
      pidActual,
      bloques,
      `Configuración de ${formatMesLabel(mes)} guardada correctamente.`
    );
  };

  const handleCopyNextMonth = () => {
    const targetMes = shiftMes(mes, 1);
    const targetBloques = desplazarBloquesAMes(bloques, 1);
    const validation = validateBloques(targetBloques, targetMes);
    if (!validation.ok) {
      setErrors(validation.errors);
      setWarnings(validation.warnings);
      setSuccessMsg('');
      return;
    }
    guardarEntrada(
      targetMes,
      pidActual,
      targetBloques,
      `Configuración copiada a ${formatMesLabel(targetMes)} con las fechas desplazadas.`
    );
  };

  const ejecutarApplyAllProviders = () => {
    const validation = validateBloques(bloques, mes);
    if (!validation.ok) {
      setErrors(validation.errors);
      setWarnings(validation.warnings);
      setSuccessMsg('');
      return;
    }

    const ids = new Set(proveedores.map((p) => normalizeProveedorId(p.id)));
    const others = configMensual.filter(
      (c) => !(c.mes === mes && ids.has(normalizeProveedorId(c.proveedorId)))
    );
    const nuevas = proveedores.map((p) => ({
      mes,
      proveedorId: normalizeProveedorId(p.id),
      bloques: [...bloques]
        .sort((a, b) => Number(a.desde) - Number(b.desde))
        .map((b) => ({
          desde: Number(b.desde),
          hasta: Number(b.hasta),
          fechaPago: b.fechaPago
        }))
    }));
    const updated = [...others, ...nuevas].sort((a, b) =>
      a.mes === b.mes
        ? String(a.proveedorId || '').localeCompare(String(b.proveedorId || ''))
        : String(a.mes || '').localeCompare(String(b.mes || ''))
    );

    if (onSaveConfig) onSaveConfig(updated);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(
      `Configuración aplicada a ${proveedores.length} proveedores de ${formatMesLabel(mes)}.`
    );
  };

  const handleApplyAllProviders = () => setConfirmacion({
    titulo: 'Aplicar a todos los proveedores',
    mensaje: `¿Aplicar los bloques de ${formatMesLabel(mes)} a los ${proveedores.length} proveedores?`,
    warning: 'Se sobrescribirá la configuración de ese mes para todos los proveedores.',
    etiqueta: 'Aplicar a todos',
    accion: ejecutarApplyAllProviders
  });

  const ejecutarDelete = () => {
    const updated = configMensual.filter(
      (c) => !(c.mes === mes && normalizeProveedorId(c.proveedorId) === pidActual)
    );
    if (onSaveConfig) onSaveConfig(updated);
    setBloques([]);
    setErrors([]);
    setWarnings([]);
    setSuccessMsg(`Configuración de ${formatMesLabel(mes)} eliminada.`);
  };

  const handleDelete = () => setConfirmacion({
    titulo: 'Eliminar configuración',
    mensaje: `¿Eliminar la configuración de ${proveedorActivo} para ${formatMesLabel(mes)}?`,
    warning: 'Las fechas de pago de ese proveedor y mes volverán a derivarse de la plantilla por defecto.',
    etiqueta: 'Eliminar configuración',
    accion: ejecutarDelete
  });

  const proveedorActivo =
    proveedores.find((p) => normalizeProveedorId(p.id) === pidActual)?.nombre ||
    nombreProveedor(pidActual);

  const diasSinCobertura = validacion.diasSinCobertura || [];
  const diasCubiertos = ultimoDia - diasSinCobertura.length;
  const [mesBim1, mesBim2] = getBimestreDeMes(mes);
  const cfgBim1 = getConfigMesProveedor(configMensual, pidActual, mesBim1);
  const cfgBim2 = getConfigMesProveedor(configMensual, pidActual, mesBim2);
  const advertenciasVisibles = useMemo(
    () => [...new Set([...(warnings || []), ...(validacion.warnings || [])])],
    [warnings, validacion.warnings]
  );

  return (
    <div style={{ maxWidth: '1180px' }}>
      <div className="view-header" style={{ marginBottom: '18px' }}>
        <div
          className="section-heading"
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}
        >
          <CalendarClock size={15} />
          Umbrales de Vencimiento Aéreos (Aero Cuenta Corriente · Renovación cada 2 Meses)
        </div>
      </div>

      {/* Ayuda del módulo */}
      <div className="panel-inset" style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
        <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          <div>
            <strong>Aero (#TurismoConfiable · Vencimiento Aéreos):</strong> define los{' '}
            <strong>umbrales de fechas de emisión</strong> (01 al 07, 08 al 15, 16 al 22 y 23 al fin de mes) y su{' '}
            <strong>fecha de vencimiento de pago</strong>. Esta configuración{' '}
            <strong style={{ color: 'var(--neon-cyan)' }}>se renueva cada 2 meses (bimestralmente)</strong>.
          </div>
          <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            *Estas fechas aplican únicamente para clientes con <strong>cuenta corriente</strong>. Se cobrarán intereses para pagos{' '}
            <strong>fuera de término</strong> tanto para liquidaciones en pesos como en dólares.
          </div>
        </div>
      </div>

      {/* Tarjeta Bimestral: Vista de los 2 meses juntos (Renovación cada 2 meses) */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 className="card-title">
                Vigencia Bimestral (Cada 2 Meses) · {formatBimestreLabel(mes)} · {proveedorActivo}
              </h3>
              <p className="card-subtitle">
                Vista completa de los 2 meses del bimestre activo (Emisión → Vencimiento)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handleRenovarBimestreAero}>
              <CalendarDays size={14} />
              <span>Renovar Bimestre Oficial ({formatBimestreLabel(mes)})</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {[
            { m: mesBim1, cfg: cfgBim1 },
            { m: mesBim2, cfg: cfgBim2 }
          ].map(({ m, cfg }) => {
            const esMesSeleccionado = m === mes;
            const listaBloques = cfg?.bloques?.length ? cfg.bloques : buildBloquesMes(m);
            const estaGuardado = Boolean(cfg?.bloques?.length);
            return (
              <div
                key={m}
                onClick={() => setMes(m)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMes(m);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={esMesSeleccionado}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: esMesSeleccionado ? 'var(--bg-subtle)' : 'var(--bg-inset)',
                  border: `1px solid ${esMesSeleccionado ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    {formatMesLabel(m).toUpperCase()}
                  </strong>
                  <span className={`badge ${estaGuardado ? 'badge-success' : 'badge-warning'}`}>
                    {estaGuardado ? 'Configurado' : 'Plantilla sugerida'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    paddingBottom: '6px',
                    marginBottom: '6px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase'
                  }}
                >
                  <span>Emisión</span>
                  <span style={{ textAlign: 'right' }}>Vencimiento</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {listaBloques.map((b, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <span>
                        <strong>
                          {String(b.desde).padStart(2, '0')} al {String(b.hasta).padStart(2, '0')}
                        </strong>{' '}
                        {formatMesLabel(m).split(' ')[0]}
                      </span>
                      <strong className="mono" style={{ color: 'var(--neon-cyan)' }}>
                        {b.fechaPago ? formatFechaLarga(b.fechaPago) : '—'}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selector de mes y proveedor */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <CalendarClock size={18} />
            </div>
            <div>
              <h3 className="card-title">Mes y proveedor a configurar</h3>
              <p className="card-subtitle">Cada proveedor tiene su propio calendario BCP</p>
            </div>
          </div>

          <div className="toolbar" style={{ gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMes(shiftMes(mes, -1))}
              title="Mes anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <div style={{ minWidth: '170px', textAlign: 'center' }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>
                {formatMesLabel(mes)}
              </strong>
              {mes !== mesActual && (
                <div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '4px' }}
                    onClick={() => setMes(mesActual)}
                  >
                    Ir al mes actual
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMes(shiftMes(mes, 1))}
              title="Mes siguiente"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
          {proveedores.map((op) => {
            const id = normalizeProveedorId(op.id);
            const activo = id === pidActual;
            const tieneConfig = configuradosEsteMes.includes(id);
            return (
              <button
                key={op.id}
                onClick={() => setProveedorId(op.id)}
                className={activo ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                {op.nombre}
                {tieneConfig && (
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: activo ? '#fff' : 'var(--success)',
                      display: 'inline-block',
                      marginLeft: '2px'
                    }}
                    title="Configurado para este mes"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generador por regla */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Wand2 size={18} />
            </div>
            <div>
              <h3 className="card-title">Generar el mes con una regla</h3>
              <p className="card-subtitle">
                Crea todos los bloques desde el día 1 hasta el último día del mes
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            alignItems: 'end'
          }}
        >
          <div>
            <label className="form-label">Días por bloque</label>
            <input
              type="number"
              min="1"
              max="31"
              className="input-field"
              value={regla.diasPorBloque}
              onChange={(e) => setRegla((r) => ({ ...r, diasPorBloque: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Día de pago</label>
            <input
              type="number"
              min="1"
              max="31"
              className="input-field"
              value={regla.diaPago}
              onChange={(e) => setRegla((r) => ({ ...r, diaPago: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Mes del pago</label>
            <select
              className="select-field"
              value={regla.offsetMesPago}
              onChange={(e) => setRegla((r) => ({ ...r, offsetMesPago: e.target.value }))}
            >
              <option value="0">Mismo mes</option>
              <option value="1">Mes siguiente</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleGenerate}>
            <Wand2 size={16} />
            <span>Generar bloques</span>
          </button>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePlantillaEstandar}>
            <CalendarDays size={14} />
            <span>Usar umbrales oficiales Aero (4 bloques: 01-07, 08-15, 16-22, 23-fin)</span>
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleRenovarBimestreAero}>
            <CalendarDays size={14} />
            <span>Renovar los 2 meses del bimestre ({formatBimestreLabel(mes)})</span>
          </button>
        </div>

        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '10px 0 0' }}>
          Umbrales oficiales Aero (renovación cada 2 meses): 01 al 07 → vence el 13/14 · 08 al 15 → vence el 19/21 · 16 al 22 → vence el 27/30 · 23 al fin de mes → vence el 04/07 del mes siguiente.
        </p>
      </div>

      {/* Editor de bloques */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 className="card-title">Bloques de emisión · {proveedorActivo}</h3>
              <p className="card-subtitle">
                Rango de días de emisión → fecha límite de pago ({formatMesLabel(mes)})
              </p>
            </div>
          </div>

          <div className="toolbar" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyPrevMonth}>
              <Copy size={14} />
              <span>Copiar mes anterior</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCopyNextMonth}
              disabled={bloques.length === 0}
              title="Guarda una copia en el mes siguiente con las fechas desplazadas"
            >
              <CopyPlus size={14} />
              <span>Copiar al mes siguiente</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleApplyAllProviders}
              disabled={bloques.length === 0}
              title="Aplica estos mismos bloques a todos los proveedores del mes"
            >
              <Layers size={14} />
              <span>Aplicar a todos</span>
            </button>
            <button className="btn btn-outline btn-sm" onClick={addBloque}>
              <Plus size={14} />
              <span>Agregar bloque</span>
            </button>
          </div>
        </div>

        {bloques.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <CalendarClock size={24} />
            </div>
            <h3>Sin bloques cargados</h3>
            <p>
              Este proveedor todavía no tiene bloques de emisión para {formatMesLabel(mes)}.
              Generá el mes con una regla, copiá el mes anterior o agregá el primero a mano.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 110px 220px 1fr 40px',
                gap: '12px',
                padding: '0 4px',
                fontSize: '0.74rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--neon-cyan)',
                fontWeight: 700
              }}
            >
              <span>Día desde</span>
              <span>Día hasta</span>
              <span>Fecha límite de pago</span>
              <span>Vista del rango</span>
              <span></span>
            </div>

            {bloques.map((b, idx) => {
              const desde = String(b.desde ?? '').padStart(2, '0');
              const hasta = String(b.hasta ?? '').padStart(2, '0');
              const color = PALETA[idx % PALETA.length];
              return (
                <div
                  key={idx}
                  className="row-soft"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 110px 220px 1fr 40px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${color}`
                  }}
                >
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="input-field"
                    style={{ textAlign: 'center', fontWeight: 700 }}
                    placeholder="1"
                    value={b.desde}
                    onChange={(e) => updateBloque(idx, 'desde', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="input-field"
                    style={{ textAlign: 'center', fontWeight: 700 }}
                    placeholder="5"
                    value={b.hasta}
                    onChange={(e) => updateBloque(idx, 'hasta', e.target.value)}
                  />
                  <input
                    type="date"
                    className="input-field"
                    value={b.fechaPago || ''}
                    onChange={(e) => updateBloque(idx, 'fechaPago', e.target.value)}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: 600 }}>
                      Emisiones del {desde} al {hasta}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {b.fechaPago
                        ? `Paga ${formatFechaLarga(b.fechaPago)}`
                        : 'Falta la fecha de pago'}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm btn-icon-only"
                    onClick={() => removeBloque(idx)}
                    title="Eliminar bloque"
                    style={{
                      width: '36px',
                      height: '36px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Cobertura del mes */}
        {bloques.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '10px'
              }}
            >
              <div className="section-heading" style={{ fontSize: '0.82rem' }}>
                <CalendarDays size={15} />
                Cobertura de {formatMesLabel(mes)}
              </div>
              <span
                className={`badge ${
                  diasSinCobertura.length === 0 ? 'badge-success' : 'badge-warning'
                }`}
              >
                {diasCubiertos} de {ultimoDia} días cubiertos
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {Array.from({ length: ultimoDia }, (_, i) => i + 1).map((dia) => {
                const idx = bloquePorDia[dia];
                const bloque = idx === undefined ? null : bloques[idx];
                const color = idx === undefined ? null : PALETA[idx % PALETA.length];
                return (
                  <span
                    key={dia}
                    title={
                      bloque
                        ? `Día ${dia}: bloque ${bloque.desde}-${bloque.hasta} · paga ${bloque.fechaPago || 'sin fecha'}`
                        : `Día ${dia}: sin bloque BCP`
                    }
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: color ? '#fff' : 'var(--danger)',
                      background: color || 'rgba(239, 68, 68, 0.12)',
                      border: color ? 'none' : '1px dashed var(--danger)'
                    }}
                  >
                    {dia}
                  </span>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '10px',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)'
              }}
            >
              {bloques.map((b, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '3px',
                      background: PALETA[idx % PALETA.length]
                    }}
                  />
                  {String(b.desde).padStart(2, '0')}-{String(b.hasta).padStart(2, '0')} →{' '}
                  {b.fechaPago ? formatFechaLarga(b.fechaPago) : 'sin fecha'}
                </span>
              ))}
            </div>

            {diasSinCobertura.length > 0 && (
              <div
                className="row-soft is-alert"
                style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}
              >
                <XCircle size={16} style={{ color: 'var(--danger)' }} />
                <span style={{ fontSize: '0.82rem' }}>
                  Días sin bloque: <strong>{resumirDias(diasSinCobertura)}</strong>. Las emisiones
                  de esos días quedarían sin fecha de pago.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Mensajes */}
        {errors.length > 0 && (
          <div
            className="row-soft is-alert"
            style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '0.84rem' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Revisá la configuración:</strong>
              <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {advertenciasVisibles.length > 0 && (
          <div
            className="row-soft is-alert"
            style={{
              marginTop: '16px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              background: 'var(--warning-bg)',
              borderColor: 'var(--warning-border)'
            }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '0.84rem' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Advertencias:</strong>
              <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                {advertenciasVisibles.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {successMsg && (
          <div
            className="row-soft"
            style={{
              marginTop: '16px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              background: 'var(--success-bg)',
              borderColor: 'var(--success-border)'
            }}
          >
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>{successMsg}</span>
          </div>
        )}

        <div
          style={{
            marginTop: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={!configuradosEsteMes.includes(pidActual)}
          >
            <Trash2 size={14} />
            <span>Eliminar configuración del mes</span>
          </button>

          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            <span>Guardar configuración</span>
          </button>
        </div>
      </div>

      {/* Resumen del mes: qué proveedores ya están configurados */}
      <div className="card" style={{ marginTop: '18px' }}>
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h3 className="card-title">Estado del mes · {formatMesLabel(mes)}</h3>
              <p className="card-subtitle">Proveedores con bloques configurados</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {proveedores.map((op) => {
            const cfg = getConfigMesProveedor(configMensual, op.id, mes);
            const ok = cfg && cfg.bloques?.length > 0;
            return (
              <span
                key={op.id}
                className={ok ? 'badge badge-success' : 'badge badge-neutral'}
                style={{ textTransform: 'none' }}
              >
                {op.nombre}: {ok ? `${cfg.bloques.length} bloque(s)` : 'sin configurar'}
              </span>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmacion)}
        title={confirmacion?.titulo || 'Confirmar acción'}
        message={confirmacion?.mensaje || ''}
        warning={confirmacion?.warning}
        confirmLabel={confirmacion?.etiqueta || 'Confirmar'}
        onConfirm={() => {
          confirmacion?.accion?.();
          setConfirmacion(null);
        }}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
