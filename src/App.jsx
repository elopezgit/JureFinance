// App.jsx - Main Application Controller for JureFinance
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import ConfirmDialog from './components/Common/ConfirmDialog';
import { STORAGE_KEY_QUOTES, STORAGE_KEY_OPERADORES, STORAGE_KEY_COBROS_CLIENTES, STORAGE_KEY_THEME } from './config/storage';

import { INITIAL_COTIZACIONES, INITIAL_OPERADORES, INITIAL_CONFIGURACION_MENSUAL } from './data/initialData';
import {
  getDriveConfig,
  saveDatabaseToDrive,
  syncBidirectionalWithDrive,
  getStoredMonthlyConfig,
  saveMonthlyConfigLocal,
  getStoredPagosTTOO,
  savePagosTTOOLocal,
  getStoredPagosManuales,
  savePagosManualesLocal,
  getStoredPagosClientes,
  savePagosClientesLocal
} from './services/driveService';
import { construirAgendaPagos, hoyISO } from './services/calendarioService';
import { normalizarServicios } from './services/serviciosService';


// Las claves viven en config/storage.js para que App y driveService no divergan.

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

  // Tema visual: claro por defecto, con opción manual persistida
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      console.error('Error loading theme', e);
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const themeTouchedRef = useRef(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Sólo persistimos cuando el usuario eligió un tema; si no, seguimos al
    // sistema operativo aunque cambie de claro a oscuro con el tiempo.
    if (!themeTouchedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch (e) {
      console.error('Error saving theme', e);
    }
  }, [theme]);

  // Escape cierra el modal más reciente, incluidos los diálogos antiguos que
  // aún no usan el hook useModalA11y directamente.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      const backdrops = document.querySelectorAll('.modal-backdrop');
      const ultimo = backdrops[backdrops.length - 1];
      if (!ultimo) return;
      const cerrar = ultimo.querySelector('.modal-close-btn, [aria-label^="Cerrar"]');
      if (cerrar) {
        event.preventDefault();
        cerrar.click();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Mejora: abrir el calendario nativo al hacer clic en campos de fecha
  useEffect(() => {
    const handler = (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && (el.type === 'date' || el.type === 'time')) {
        try {
          el.showPicker?.();
        } catch {
          // Algunos navegadores no soportan showPicker
        }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

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

  // Cobros del cliente (pagos parciales, solo por cliente)
  const [pagosClientes, setPagosClientes] = useState(() => {
    const stored = getStoredPagosClientes();
    if (Array.isArray(stored) && stored.length > 0) return stored;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COBROS_CLIENTES);
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error('Error loading client payments', e); }
    return [];
  });

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
  // Se inicializa con el primer cliente real de las cotizaciones guardadas,
  // nunca con un nombre de ejemplo quemado en el código.
  const [selectedClientForDrive, setSelectedClientForDrive] = useState(() => {
    const guardadas = Array.isArray(cotizaciones) ? cotizaciones : [];
    return guardadas.find((q) => q.cliente)?.cliente || '';
  });

  // Google Drive Config & Sync
  const [driveConfig, setDriveConfig] = useState(getDriveConfig());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [remoteChangeAlert, setRemoteChangeAlert] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      if (detail.message) showToast(detail.message, detail.type || 'info');
    };
    window.addEventListener('jf:toast', handler);
    return () => window.removeEventListener('jf:toast', handler);
  }, [showToast]);

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
      setSyncError('');

      if (res.hasChanges) {
        setRemoteChangeAlert(res.message);
        setTimeout(() => setRemoteChangeAlert(null), 6000);
      } else {
        showToast('Sincronización completada', 'success');
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
      if (res.db && Array.isArray(res.db.pagosClientes)) {
        setPagosClientes(res.db.pagosClientes);
        savePagosClientesLocal(res.db.pagosClientes);
        try { localStorage.setItem(STORAGE_KEY_COBROS_CLIENTES, JSON.stringify(res.db.pagosClientes)); } catch { /* caché no disponible */ }
      }
    } catch (err) {
      console.warn('Sync error:', err);
      setSyncError(err?.message || 'No se pudo sincronizar con Google Drive.');
    } finally {
      syncInFlightRef.current = false;
      if (!isSilent) setIsSyncingDrive(false);
    }
  }, [showToast]);

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
      pagosClientes,
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

  const handleEliminarPagoManual = (manualId) => {
    persistPagosManuales((pagosTTOOManuales || []).filter((m) => m.id !== manualId));
  };

  const persistPagosClientes = (updated) => {
    const siguiente = typeof updated === 'function' ? updated(pagosClientes || []) : updated;
    setPagosClientes(siguiente);
    try {
      localStorage.setItem(STORAGE_KEY_COBROS_CLIENTES, JSON.stringify(siguiente));
      savePagosClientesLocal(siguiente);
      persistDb({ pagosClientes: siguiente });
    } catch (e) {
      console.error('Error saving client payments', e);
    }
  };

  const handleRegistrarCobroCliente = (pago) => {
    persistPagosClientes([...(pagosClientes || []), pago]);
  };

  // Un comprobante puede generar varias líneas de pago (por servicio y moneda).
  // Se guardan todas juntas para mantener el historial agrupado por operación.
  const handleRegistrarCobrosClientesLote = (pagos = []) => {
    if (!Array.isArray(pagos) || pagos.length === 0) return;
    persistPagosClientes([...(pagosClientes || []), ...pagos]);
  };

  const handleEliminarCobroCliente = (pagoId) => {
    persistPagosClientes((actuales) => actuales.filter((p) => p.id !== pagoId));
  };

  // Calculate upcoming urgent TTOO deadlines count (< 3 days)
  const urgentesCount = useMemo(() => {
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
  }, [cotizaciones]);

  // Vencimientos de pago a proveedores ya vencidos (badge del menú)
  const pagosVencidosCount = useMemo(() => construirAgendaPagos({
    cotizaciones,
    configMensual,
    pagosTTOOManuales,
    pagosTTOO
  }).filter(
    (p) => p.estado !== 'Pagado' && p.fechaVencimiento && p.fechaVencimiento < hoyISO()
  ).length, [cotizaciones, configMensual, pagosTTOOManuales, pagosTTOO]);

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

  const [quoteToDelete, setQuoteToDelete] = useState(null);

  const confirmarEliminarQuote = () => {
    if (!quoteToDelete) return;
    const updated = cotizaciones.filter((q) => q.id !== quoteToDelete.id);
    persistQuotes(updated);
    if (editingQuote?.id === quoteToDelete.id) {
      setEditingQuote(buildEmptyQuote());
    }
    setQuoteToDelete(null);
  };

  const handleDeleteQuote = (quoteOrId) => {
    const quote = typeof quoteOrId === 'string'
      ? cotizaciones.find((q) => q.id === quoteOrId)
      : quoteOrId;
    if (quote) setQuoteToDelete(quote);
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
          theme={theme}
          onToggleTheme={() => {
            themeTouchedRef.current = true;
            setTheme((t) => (t === 'light' ? 'dark' : 'light'));
          }}
        />

        {/* Notificación de cambios detectados en Google Drive */}
        {remoteChangeAlert && (
          <div className="jf-alert jf-alert--success" role="status">
            <div className="jf-alert-content">
              <span className="badge badge-success">Actualización en vivo</span>
              <span>{remoteChangeAlert}</span>
            </div>
            <button
              onClick={() => setRemoteChangeAlert(null)}
              className="modal-close-btn"
              title="Cerrar"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* Aviso de estado de conexión con Google Drive */}
        {((driveConfig?.lastSyncOk === false && driveConfig?.lastSyncMessage) || syncError) && (
          <div className="jf-alert jf-alert--warning" role="alert">
            <div className="jf-alert-content">
              <span>⚠️</span>
              <span>{syncError || driveConfig.lastSyncMessage}</span>
            </div>
            <button
              onClick={() => performDriveSync(false)}
              disabled={isSyncingDrive}
              className="btn btn-secondary btn-sm"
            >
              {isSyncingDrive ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        )}

        {toast && (
          <div className={`jf-toast ${toast.type === 'success' ? 'jf-toast--success' : toast.type === 'error' ? 'jf-toast--error' : ''}`} role="status">
            {toast.message}
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
              pagosTTOO={pagosTTOO}
              pagosTTOOManuales={pagosTTOOManuales}
              pagosClientes={pagosClientes}
              onRegistrarPago={handleRegistrarPago}
              onRegistrarPagosLote={handleRegistrarPagosLote}
              onEliminarPago={handleEliminarPago}
              onEliminarPagoManual={handleEliminarPagoManual}
            />
          )}

          {activeTab === 'cobros' && (
            <CalendarioCobrosView
              cotizaciones={cotizaciones}
              onIrACotizador={handleNewQuote}
              pagosClientes={pagosClientes}
              onRegistrarCobroCliente={handleRegistrarCobroCliente}
              onRegistrarCobrosClientesLote={handleRegistrarCobrosClientesLote}
              onEliminarCobroCliente={handleEliminarCobroCliente}
            />
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

      <ConfirmDialog
        open={Boolean(quoteToDelete)}
        title="Eliminar cotización"
        message={`¿Eliminar la cotización de ${quoteToDelete?.cliente || 'este cliente'}?`}
        warning="La cotización se borrará de la caché local y de Google Drive. Los pagos ya registrados no se eliminan."
        confirmLabel="Eliminar cotización"
        onConfirm={confirmarEliminarQuote}
        onCancel={() => setQuoteToDelete(null)}
      />
    </div>
  );
}
