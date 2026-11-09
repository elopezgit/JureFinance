// CotizadorWizard.jsx - Wizard principal para cotizaciones.
//
// El wizard tiene tres pasos:
//   1. Datos del viaje y proveedores con los que se trabaja.
//   2. Servicios: precio de venta al cliente + ofertas de compra de cada
//      proveedor (costo real, vencimiento y cuál se compra).
//   3. Resumen: venta, costo, ganancia real y guardado.
//
// El presupuesto que se le entrega al cliente se arma fuera de la app con la
// herramienta del proveedor. JureFinance registra los números reales.
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Wallet, Receipt } from 'lucide-react';
import WizardNav from './WizardNav';
import StepDatosViaje from './steps/StepDatosViaje';
import StepServicios from './steps/StepServicios';
import StepResumenWizard from './steps/StepResumenWizard';
import QuotePreviewModal from '../QuotePreviewModal';
import {
  construirPasos,
  normalizarServicios,
  totalVentaItems,
  totalCostoItems,
  totalGananciaItems,
  margenVentaItems,
  costoCompraItem,
  ofertaCompraDe,
  sembrarPreciosVenta,
  formatoMoneda
} from './wizardUtils';
import './wizard.css';

export default function CotizadorWizard({
  initialQuote,
  onSaveQuote,
  operadoresList = [],
  configMensual = []
}) {
  /* ----------------------------- Datos del viaje ----------------------------- */
  const [quoteId] = useState(
    initialQuote?.id || `COT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [cliente, setCliente] = useState(initialQuote?.cliente || '');
  const [emailCliente, setEmailCliente] = useState(initialQuote?.emailCliente || '');
  const [telefonoCliente, setTelefonoCliente] = useState(initialQuote?.telefonoCliente || '');
  const [destino, setDestino] = useState(initialQuote?.destino || '');
  const [fechaViajeInicio, setFechaViajeInicio] = useState(initialQuote?.fechaViajeInicio || '');
  const [fechaViajeFin, setFechaViajeFin] = useState(initialQuote?.fechaViajeFin || '');
  const [fechaCotizacion, setFechaCotizacion] = useState(
    initialQuote?.fechaCotizacion || new Date().toISOString().split('T')[0]
  );
  const [pax, setPax] = useState(initialQuote?.pax || 2);
  // Nombres de los pasajeros para poder auditar cada ticket en el flujo de caja.
  // Es opcional: si queda vacío, el reporte usa el cliente titular + cantidad.
  const [pasajeros, setPasajeros] = useState(() => {
    const cantidad = Math.max(1, Number(initialQuote?.pax) || 2);
    const existentes = Array.isArray(initialQuote?.pasajeros) ? initialQuote.pasajeros : [];
    return Array.from({ length: cantidad }, (_, i) => existentes[i] || '');
  });
  const [moneda, setMoneda] = useState(initialQuote?.moneda || 'USD');
  const [estado, setEstado] = useState(initialQuote?.estado || 'Borrador');
  const [notas, setNotas] = useState(initialQuote?.notas || '');

  /* -------------------------------- Servicios -------------------------------- */
  const [items, setItems] = useState(() => {
    const base = normalizarServicios(initialQuote?.servicios, { pax: initialQuote?.pax || 2 });
    return sembrarPreciosVenta(base, initialQuote?.precioVentaTotalManual);
  });

  const [proveedoresActivos, setProveedoresActivos] = useState(() => {
    if (Array.isArray(initialQuote?.servicios?.proveedores)) {
      return initialQuote.servicios.proveedores;
    }
    // Cotizaciones anteriores no guardaban la selección: se deduce de las
    // ofertas cargadas (o, en el modelo viejo, del proveedor de cada línea).
    const ids = normalizarServicios(initialQuote?.servicios, { pax: initialQuote?.pax || 2 })
      .flatMap((item) => (item.ofertas || []).map((oferta) => oferta.proveedorId))
      .filter(Boolean);
    return [...new Set(ids)];
  });

  /* --------------------------------- Interfaz -------------------------------- */
  const [currentStepId, setCurrentStepId] = useState('datos');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [validationError, setValidationError] = useState('');

  const paxCount = Math.max(1, Number(pax) || 1);

  /* ---------------------------------- Pasos ---------------------------------- */
  const pasos = useMemo(() => construirPasos(), []);

  const currentIndex = Math.max(
    0,
    pasos.findIndex((paso) => paso.id === currentStepId)
  );
  const pasoActual = pasos[currentIndex];

  /* ------------------------------- Totales ----------------------------------- */
  const totalVenta = totalVentaItems(items);
  const totalCosto = totalCostoItems(items);
  const gananciaRealTotal = totalGananciaItems(items);
  const margenRealPct = margenVentaItems(items);
  const totalOptimo = totalVenta;

  /* --------------------------- Operaciones sobre líneas ---------------------- */
  const eliminarItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const alternarItem = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, activo: !item.activo } : item))
    );
  };

  const alternarProveedor = (proveedorId) => {
    setProveedoresActivos((prev) =>
      prev.includes(proveedorId)
        ? prev.filter((id) => id !== proveedorId)
        : [...prev, proveedorId]
    );
  };

  /* ------------------------------ Pax y precios ------------------------------ */
  const handlePaxChange = (valor) => {
    const cantidad = Math.max(1, parseInt(valor, 10) || 1);
    setPax(cantidad);
    // Mantiene un campo de nombre por pasajero sin borrar los ya cargados.
    setPasajeros((prev) => {
      const siguiente = Array.from({ length: cantidad }, (_, i) => prev[i] || '');
      return siguiente;
    });
  };

  /* -------------------------------- Navegación ------------------------------- */
  /** Valida el paso actual antes de avanzar. Devuelve '' si está todo bien. */
  const validarPaso = (paso) => {
    if (paso.tipo === 'datos') {
      if (!cliente.trim()) return 'Ingresá el nombre del cliente para continuar.';
      if (paxCount < 1) return 'La cantidad de pasajeros debe ser al menos 1.';
      if (fechaViajeInicio && fechaViajeFin && fechaViajeFin < fechaViajeInicio) {
        return 'La fecha de fin del viaje no puede ser anterior a la de inicio.';
      }
      return '';
    }

    if (paso.tipo === 'servicios') {
      const activos = items.filter((item) => item.activo);
      const sinProveedor = activos.find(
        (item) => costoCompraItem(item) > 0 && !ofertaCompraDe(item)?.proveedor
      );
      if (sinProveedor) {
        return `Elegí el proveedor de compra del servicio “${sinProveedor.nombre || sinProveedor.tipo}”.`;
      }
      return '';
    }

    return '';
  };

  const handleNext = () => {
    const error = validarPaso(pasoActual);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError('');
    if (currentIndex < pasos.length - 1) {
      setCompletedSteps((prev) => [...new Set([...prev, pasoActual.id])]);
      setCurrentStepId(pasos[currentIndex + 1].id);
    }
  };

  const handleStepChange = (stepId) => {
    setValidationError('');
    setCurrentStepId(stepId);
  };

  const handlePrev = () => {
    setValidationError('');
    if (currentIndex > 0) {
      setCurrentStepId(pasos[currentIndex - 1].id);
    }
  };

  /* --------------------------------- Guardado -------------------------------- */
  const construirServicios = () => ({
    proveedores: proveedoresActivos,
    items
  });

  const construirCotizacion = () => ({
    id: quoteId,
    cliente,
    emailCliente,
    telefonoCliente,
    destino,
    fechaViajeInicio,
    fechaViajeFin,
    fechaCotizacion,
    pax: paxCount,
    pasajeros: pasajeros.map((p) => String(p || '').trim()).filter(Boolean),
    moneda,
    estado,
    notas,
    servicios: construirServicios(),
    // Totales: venta = lo que paga el cliente; costo = lo que paga la agencia.
    totalNeto: totalCosto,
    totalVenta,
    totalOptimo,
    precioVentaRedondeadoXPax: totalVenta / paxCount,
    precioVentaTotalManual: totalVenta,
    gananciaRealTotal,
    margenRealPct
  });

  const handleSave = () => {
    if (!cliente.trim()) {
      setValidationError('Ingresá el nombre del cliente antes de guardar.');
      setCurrentStepId('datos');
      return;
    }
    setValidationError('');

    if (onSaveQuote) {
      onSaveQuote(construirCotizacion());
      setSaveSuccessMessage(true);
      setTimeout(() => setSaveSuccessMessage(false), 3000);
    }
  };

  const quoteForPreview = construirCotizacion();

  /* ------------------------------- Render ------------------------------------ */
  return (
    <div className="wizard-form-wrap">
      <div className="card" style={{ padding: '18px 24px', background: 'linear-gradient(180deg, rgba(26, 17, 58, 0.95) 0%, rgba(18, 12, 42, 0.95) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-success" style={{ gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-cyan)', boxShadow: '0 0 6px var(--neon-cyan)' }} />
                Cotizador Wizard
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {quoteId}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px', letterSpacing: '-0.02em', color: '#ffffff' }}>
              {cliente ? `Cotización para ${cliente}` : 'Nueva Cotización'}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 10, 38, 0.7)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                textAlign: 'right',
                minWidth: '120px'
              }}
            >
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontWeight: 700 }}>
                <Receipt size={12} color="var(--neon-cyan)" /> Venta
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: '2px' }}>
                {formatoMoneda(moneda, totalVenta)}
              </div>
            </div>

            <div
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 10, 38, 0.7)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                textAlign: 'right',
                minWidth: '120px'
              }}
            >
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontWeight: 700 }}>
                <Wallet size={12} color="var(--primary-light)" /> Costo Real
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#cbd5e1', marginTop: '2px' }}>
                {formatoMoneda(moneda, totalCosto)}
              </div>
            </div>

            <div
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                background: gananciaRealTotal >= 0 ? 'rgba(0, 245, 212, 0.12)' : 'rgba(255, 42, 133, 0.12)',
                border: `1.5px solid ${gananciaRealTotal >= 0 ? 'rgba(0, 245, 212, 0.45)' : 'rgba(255, 42, 133, 0.45)'}`,
                boxShadow: `0 0 16px ${gananciaRealTotal >= 0 ? 'rgba(0, 245, 212, 0.25)' : 'rgba(255, 42, 133, 0.25)'}`,
                textAlign: 'right',
                minWidth: '130px'
              }}
            >
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: gananciaRealTotal >= 0 ? 'var(--neon-cyan)' : 'var(--neon-pink)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontWeight: 800 }}>
                <TrendingUp size={12} /> Ganancia Neta
              </div>
              <div
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: gananciaRealTotal >= 0 ? 'var(--neon-cyan)' : 'var(--neon-pink)',
                  marginTop: '2px'
                }}
              >
                {formatoMoneda(moneda, gananciaRealTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <WizardNav
        steps={pasos}
        currentStepId={pasoActual?.id}
        onStepChange={handleStepChange}
        completedSteps={completedSteps}
      />

      {validationError && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.88rem',
            fontWeight: 600
          }}
        >
          {validationError}
        </div>
      )}

      <div className="wizard-content">
        {pasoActual?.tipo === 'datos' && (
          <StepDatosViaje
            {...{
              cliente, setCliente,
              emailCliente, setEmailCliente,
              telefonoCliente, setTelefonoCliente,
              destino, setDestino,
              fechaViajeInicio, setFechaViajeInicio,
              fechaViajeFin, setFechaViajeFin,
              fechaCotizacion, setFechaCotizacion,
              pax, setPax: handlePaxChange,
              pasajeros, setPasajeros,
              moneda, setMoneda,
              estado, setEstado,
              notas, setNotas
            }}
            operadoresList={operadoresList}
            proveedoresActivos={proveedoresActivos}
            onToggleProveedor={alternarProveedor}
          />
        )}

        {pasoActual?.tipo === 'servicios' && (
          <StepServicios
            items={items}
            setItems={setItems}
            operadoresList={operadoresList}
            proveedoresActivos={proveedoresActivos}
            pax={paxCount}
            moneda={moneda}
            fechaCotizacion={fechaCotizacion}
            configMensual={configMensual}
          />
        )}

        {pasoActual?.tipo === 'resumen' && (
          <StepResumenWizard
            {...{
              cliente,
              destino,
              fechaViajeInicio,
              fechaViajeFin,
              pax: paxCount,
              moneda,
              items,
              totalVenta,
              totalCosto,
              gananciaRealTotal,
              margenRealPct,
              onToggleItem: alternarItem,
              onQuitarItem: eliminarItem,
              onSave: handleSave,
              onPreview: () => setShowPreviewModal(true),
              saveSuccessMessage
            }}
          />
        )}
      </div>

      <div className="wizard-footer">
        <div className="wizard-footer-left">
          {currentIndex > 0 && (
            <button className="btn btn-secondary" onClick={handlePrev}>
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </button>
          )}
        </div>
        <div className="wizard-footer-right">
          {pasoActual?.tipo !== 'resumen' && (
            <button className="btn btn-primary" onClick={handleNext}>
              <span>Siguiente</span>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {showPreviewModal && (
        <QuotePreviewModal quote={quoteForPreview} onClose={() => setShowPreviewModal(false)} />
      )}
    </div>
  );
}
