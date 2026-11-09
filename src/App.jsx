// App.jsx - Main Application Controller for JureFinance
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CotizadorView from './components/Cotizador/CotizadorView';
import HistorialView from './components/Historial/HistorialView';
import DriveView from './components/DriveViewer/DriveView';
import OperadoresView from './components/Operadores/OperadoresView';
import DashboardView from './components/Dashboard/DashboardView';
import DriveConfigModal from './components/Configuracion/DriveConfigModal';
import ConfiguracionMensualView from './components/Configuracion/ConfiguracionMensualView';
import CalendarioPagosView from './components/Cobranzas/CalendarioPagosView';
import CalendarioCobrosView from './components/Cobranzas/CalendarioCobrosView';

import { INITIAL_COTIZACIONES, INITIAL_OPERADORES, INITIAL_CONFIGURACION_MENSUAL, buildConfiguracionMensual } from './data/initialData';
import { mergeDemoVuelos, contarDemoFaltantes } from './data/demoVuelos';
import {
  getDriveConfig,
  saveDatabaseToDrive,
  syncBidirectionalWithDrive,
  getStoredMonthlyConfig,
  saveMonthlyConfigLocal,
  getStoredPagosTTOO,
  savePagosTTOOLocal,
  getStoredPagosManuales,
  savePagosManualesLocal
} from './services/driveService';
import { construirAgendaPagos, hoyISO } from './services/calendarioService';
import { normalizarServicios } from './services/serviciosService';
import { getMesActual } from './services/ttoService';

const STORAGE_KEY_QUOTES = 'jurefinance_quotes_v1';
const STORAGE_KEY_OPERADORES = 'jurefinance_operadores_v1';

// Cotización en blanco: el cotizador debe nacer vacío (sin datos de ejemplo)
// Los servicios se modelan como LÍNEAS por proveedor (ver serviciosService).
function buildEmptyQuote() {
  return {
    id: `COT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    cliente: '',
    emailCliente: '',
    telefonoCliente: '',
    destino: '',
    fechaViajeInicio: '',
    fechaViajeFin: '',
    fechaCotizacion: new Date().toISOString().split('T')[0],
    pax: 1,
    moneda: 'USD',
    estado: 'Borrador',
    comisionOptimaPct: 20,
    servicios: {
      proveedores: [],
      items: []
    },
    totalNeto: 0,
    totalVenta: 0,
    precioVentaRedondeadoXPax: 0,
    precioVentaTotalManual: 0,
    gananciaRealTotal: 0,
    margenRealPct: 0,
    notas: ''
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('cotizador');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Quotes state with persistence
  const [cotizaciones, setCotizaciones] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUOTES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading quotes from localStorage', e);
    }
    return INITIAL_COTIZACIONES;
  });

  // Current quote loaded in the calculator (empieza en blanco)
  const [editingQuote, setEditingQuote] = useState(() => buildEmptyQuote());

  // Calendario de Pagos a TTOOs: pagos realizados (overlay) y pagos manuales
  const [pagosTTOO, setPagosTTOO] = useState(() => getStoredPagosTTOO());
  const [pagosTTOOManuales, setPagosTTOOManuales] = useState(() => getStoredPagosManuales());

  // Configuración Mensual de TTOs (bloques de emisión → fecha de pago)
  const [configMensual, setConfigMensual] = useState(() => {
    const stored = getStoredMonthlyConfig();
    if (Array.isArray(stored)) return stored;
    return INITIAL_CONFIGURACION_MENSUAL;
  });

  // Directorio de proveedores (TTOO). Se persiste localmente para que un
  // proveedor nuevo esté disponible en el cotizador y en la configuración BCP.
  const [operadores, setOperadores] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OPERADORES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading operadores from localStorage', e);
    }
    return INITIAL_OPERADORES;
  });

  // Selected client for Drive view
  const [selectedClientForDrive, setSelectedClientForDrive] = useState('PELAO DAUD');

  // Google Drive Config & Sync
  const [driveConfig, setDriveConfig] = useState(getDriveConfig());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [remoteChangeAlert, setRemoteChangeAlert] = useState(null);

  // Background Bidirectional Polling & Window Focus sync
  const syncInFlightRef = useRef(false);

  const performDriveSync = useCallback(async (isSilent = false) => {
    // Evitar peticiones solapadas (el conector puede tardar en el primer arranque)
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    if (!isSilent) setIsSyncingDrive(true);
    try {
      const res = await syncBidirectionalWithDrive();
      setDriveConfig(getDriveConfig());

      if (res.hasChanges) {
        setRemoteChangeAlert(res.message);
        setTimeout(() => setRemoteChangeAlert(null), 6000);
      }

      // Si vinieron cotizaciones actualizadas de la base de datos de Drive
      if (res.db && Array.isArray(res.db.cotizaciones)) {
        setCotizaciones(res.db.cotizaciones);
      }

      // Si vino la configuración mensual de TTOs desde Drive
      if (res.db && Array.isArray(res.db.configuracionMensual)) {
        setConfigMensual(res.db.configuracionMensual);
        saveMonthlyConfigLocal(res.db.configuracionMensual);
      }

      // Si vinieron pagos a proveedores desde Drive
      if (res.db && Array.isArray(res.db.pagosTTOO)) {
        setPagosTTOO(res.db.pagosTTOO);
        savePagosTTOOLocal(res.db.pagosTTOO);
      }
      if (res.db && Array.isArray(res.db.pagosTTOOManuales)) {
        setPagosTTOOManuales(res.db.pagosTTOOManuales);
        savePagosManualesLocal(res.db.pagosTTOOManuales);
      }
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      syncInFlightRef.current = false;
      if (!isSilent) setIsSyncingDrive(false);
    }
  }, []);

  // Periodic Auto-Sync Timer + Window Focus
  // Con el conector v3.1 (soporte de precalculado) el sondeo es barato: cada 60 s.
  // Con un conector antiguo (escaneo completo de ~3 min) se espacia a 5 min para no saturar.
  const syncIntervalMs = driveConfig?.supportsFastSync ? 60000 : 300000;

  useEffect(() => {
    // Initial sync
    performDriveSync(true);

    const interval = setInterval(() => {
      performDriveSync(true);
    }, syncIntervalMs);

    const handleFocus = () => {
      performDriveSync(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [performDriveSync, syncIntervalMs]);

  // Persistir el directorio de proveedores en localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OPERADORES, JSON.stringify(operadores));
    } catch (e) {
      console.error('Error saving operadores', e);
    }
  }, [operadores]);

  const handleAgregarOperador = (nuevo) => {
    if (!nuevo) return;
    setOperadores((prev) =>
      prev.some((op) => op.id === nuevo.id) ? prev : [...prev, nuevo]
    );
  };

  // Respaldar la base completa (cotizaciones + config + pagos) en Google Drive
  const persistDb = (overrides = {}) => {
    saveDatabaseToDrive({
      cotizaciones,
      configuracionMensual: configMensual,
      pagosTTOO,
      pagosTTOOManuales,
      ...overrides
    });
  };

  // Save quotes locally and push database to Google Drive
  const persistQuotes = (updatedQuotes) => {
    setCotizaciones(updatedQuotes);
    try {
      localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(updatedQuotes));
      // Respaldar base de datos completa en Google Drive
      persistDb({ cotizaciones: updatedQuotes });
    } catch (e) {
      console.error('Error saving quotes', e);
    }
  };

  // Save monthly TTO configuration locally and push to Google Drive
  const persistConfigMensual = (updated) => {
    setConfigMensual(updated);
    try {
      saveMonthlyConfigLocal(updated);
      persistDb({ configuracionMensual: updated });
    } catch (e) {
      console.error('Error saving monthly config', e);
    }
  };

  // Pagos a proveedores: overlay de pagos realizados
  const persistPagosTTOO = (updated) => {
    setPagosTTOO(updated);
    try {
      savePagosTTOOLocal(updated);
      persistDb({ pagosTTOO: updated });
    } catch (e) {
      console.error('Error saving supplier payments', e);
    }
  };

  // Pagos a proveedores cargados a mano
  const persistPagosManuales = (updated) => {
    setPagosTTOOManuales(updated);
    try {
      savePagosManualesLocal(updated);
      persistDb({ pagosTTOOManuales: updated });
    } catch (e) {
      console.error('Error saving manual payments', e);
    }
  };

  const handleRegistrarPago = (registro) => {
    persistPagosTTOO([...(pagosTTOO || []), registro]);
  };

  // Pago consolidado de una liquidación: se guardan todos los registros repartidos de una vez
  const handleRegistrarPagosLote = (registros) => {
    if (!Array.isArray(registros) || registros.length === 0) return;
    persistPagosTTOO([...(pagosTTOO || []), ...registros]);
  };

  const handleEliminarPago = (pagoId) => {
    persistPagosTTOO((pagosTTOO || []).filter((r) => r.id !== pagoId));
  };

  const handleCrearPagoManual = (manual) => {
    persistPagosManuales([...(pagosTTOOManuales || []), manual]);
  };

  const handleEliminarPagoManual = (manualId) => {
    persistPagosManuales((pagosTTOOManuales || []).filter((m) => m.id !== manualId));
  };

  // Carga los 10 vuelos de ejemplo (ya emitidos en distintos bloques de pago)
  // sin pisar ni duplicar los datos existentes. Devuelve cuántos agregó.
  const handleCargarDemoVuelos = () => {
    const faltantes = contarDemoFaltantes(cotizaciones);
    const cotizacionesActualizadas = mergeDemoVuelos(cotizaciones);

    // Asegurar la Configuración Mensual del mes en curso (para que las fechas de
    // pago de los vuelos de ejemplo se calculen a partir de la emisión).
    const mesActual = getMesActual();
    const faltanConfig = buildConfiguracionMensual([mesActual]).filter(
      (cfg) =>
        !(configMensual || []).some(
          (c) =>
            c.mes === cfg.mes &&
            String(c.proveedorId).toLowerCase() === String(cfg.proveedorId).toLowerCase()
        )
    );
    const configActualizada =
      faltanConfig.length > 0 ? [...(configMensual || []), ...faltanConfig] : configMensual;

    setCotizaciones(cotizacionesActualizadas);
    setConfigMensual(configActualizada);
    try {
      localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(cotizacionesActualizadas));
      saveMonthlyConfigLocal(configActualizada);
      persistDb({
        cotizaciones: cotizacionesActualizadas,
        configuracionMensual: configActualizada
      });
    } catch (e) {
      console.error('Error cargando los vuelos de ejemplo', e);
    }

    return faltantes;
  };

  // Calculate upcoming urgent TTOO deadlines count (< 3 days)
  const calculateUrgentesCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;

    cotizaciones.forEach((q) => {
      const items = normalizarServicios(q.servicios, { pax: q.pax });
      items.forEach((item) => {
        if (!item.activo || !item.vencimientoTTOO) return;
        const d = new Date(item.vencimientoTTOO);
        const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          count++;
        }
      });
    });

    return count;
  };

  const urgentesCount = calculateUrgentesCount();

  // Vencimientos de pago a proveedores ya vencidos (badge del menú)
  const pagosVencidosCount = construirAgendaPagos({
    cotizaciones,
    configMensual,
    pagosTTOOManuales,
    pagosTTOO
  }).filter(
    (p) => p.estado !== 'Pagado' && p.fechaVencimiento && p.fechaVencimiento < hoyISO()
  ).length;

  // Handlers
  const handleSaveQuote = (savedQuote) => {
    const existsIndex = cotizaciones.findIndex((q) => q.id === savedQuote.id);
    let updated;
    if (existsIndex >= 0) {
      updated = [...cotizaciones];
      updated[existsIndex] = savedQuote;
    } else {
      updated = [savedQuote, ...cotizaciones];
    }
    persistQuotes(updated);
    setEditingQuote(savedQuote);
  };

  const handleEditQuote = (quoteToEdit) => {
    setEditingQuote(quoteToEdit);
    setActiveTab('cotizador');
  };

  const handleDeleteQuote = (quoteId) => {
    if (window.confirm('¿Seguro que deseas eliminar esta cotización?')) {
      const updated = cotizaciones.filter((q) => q.id !== quoteId);
      persistQuotes(updated);
      if (editingQuote?.id === quoteId) {
        setEditingQuote(null);
      }
    }
  };

  const handleDuplicateQuote = (quoteToDup) => {
    const duplicated = {
      ...quoteToDup,
      id: `COT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      cliente: `${quoteToDup.cliente} (Copia)`,
      fechaCotizacion: new Date().toISOString().split('T')[0],
      estado: 'Borrador'
    };
    persistQuotes([duplicated, ...cotizaciones]);
    setEditingQuote(duplicated);
    setActiveTab('cotizador');
  };

  const handleOpenClientDrive = (clientName) => {
    setSelectedClientForDrive(clientName);
    setActiveTab('drive');
  };

  const handleNewQuote = () => {
    setEditingQuote(buildEmptyQuote());
    setActiveTab('cotizador');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        urgentesCount={urgentesCount}
        driveConfig={driveConfig}
        pagosVencidosCount={pagosVencidosCount}
      />

      {/* Main Content Area */}
      <div className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          activeTab={activeTab}
          onNewQuote={handleNewQuote}
          urgentesCount={urgentesCount}
          onSyncDrive={() => performDriveSync(false)}
          isSyncingDrive={isSyncingDrive}
        />

        {/* Notificación de cambios detectados en Google Drive */}
        {remoteChangeAlert && (
          <div
            style={{
              margin: '16px 34px 0',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              color: 'var(--text-main)',
              fontSize: '0.86rem',
              boxShadow: 'var(--shadow-sm)',
              animation: 'fadeIn 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-success">Actualización en vivo</span>
              <span>{remoteChangeAlert}</span>
            </div>
            <button
              onClick={() => setRemoteChangeAlert(null)}
              className="modal-close-btn"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        )}

        {/* Aviso de estado de conexión con Google Drive */}
        {driveConfig?.lastSyncOk === false && driveConfig?.lastSyncMessage && (
          <div
            style={{
              margin: '16px 34px 0',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              color: 'var(--warning)',
              fontSize: '0.84rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>⚠️</span>
              <span>{driveConfig.lastSyncMessage}</span>
            </div>
            <button
              onClick={() => performDriveSync(false)}
              disabled={isSyncingDrive}
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap' }}
            >
              {isSyncingDrive ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        )}

        <main className="page-body">
          {/* El cotizador se mantiene montado para no perder lo cargado al navegar por otros menús.
              La key fuerza el remount cuando se cambia de cotización (editar otra desde el Historial). */}
          <div style={{ display: activeTab === 'cotizador' ? 'block' : 'none' }}>
            <CotizadorView
              key={editingQuote?.id || 'nueva'}
              initialQuote={editingQuote}
              onSaveQuote={handleSaveQuote}
              operadoresList={operadores}
              configMensual={configMensual}
            />
          </div>

          {activeTab === 'historial' && (
            <HistorialView
              cotizaciones={cotizaciones}
              onEditQuote={handleEditQuote}
              onDeleteQuote={handleDeleteQuote}
              onDuplicateQuote={handleDuplicateQuote}
              onOpenClientDrive={handleOpenClientDrive}
            />
          )}

          {activeTab === 'drive' && (
            <DriveView
              selectedClientName={selectedClientForDrive}
              driveConfig={driveConfig}
              onOpenConfig={() => setActiveTab('configDrive')}
            />
          )}

          {activeTab === 'operadores' && (
            <OperadoresView
              cotizaciones={cotizaciones}
              operadoresList={operadores}
              onAgregarOperador={handleAgregarOperador}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              cotizaciones={cotizaciones}
              onNavigateToCotizador={handleNewQuote}
              onNavigateToDrive={() => setActiveTab('drive')}
            />
          )}

          {activeTab === 'pagosTTOO' && (
            <CalendarioPagosView
              cotizaciones={cotizaciones}
              configMensual={configMensual}
              operadoresList={operadores}
              pagosTTOO={pagosTTOO}
              pagosTTOOManuales={pagosTTOOManuales}
              onRegistrarPago={handleRegistrarPago}
              onRegistrarPagosLote={handleRegistrarPagosLote}
              onEliminarPago={handleEliminarPago}
              onCrearPagoManual={handleCrearPagoManual}
              onEliminarPagoManual={handleEliminarPagoManual}
              onCargarDemo={handleCargarDemoVuelos}
            />
          )}

          {activeTab === 'cobros' && (
            <CalendarioCobrosView cotizaciones={cotizaciones} onIrACotizador={handleNewQuote} />
          )}

          {activeTab === 'configMensual' && (
            <ConfiguracionMensualView
              configMensual={configMensual}
              onSaveConfig={persistConfigMensual}
              operadoresList={operadores}
              cotizaciones={cotizaciones}
            />
          )}

          {activeTab === 'configDrive' && (
            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '10px 0' }}>
              <DriveConfigModal onClose={() => setActiveTab('drive')} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
