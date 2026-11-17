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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import WizardNav from './WizardNav';
import StepDatosViaje from './steps/StepDatosViaje';
import StepServicios from './steps/StepServicios';
import StepResumenWizard from './steps/StepResumenWizard';
import QuotePreviewModal from '../QuotePreviewModal';
import {
  construirPasos,
  normalizarServicios,
  totalVentaItems,
  totalCostoItems,  costoCompraItem,
  ofertaCompraDe,
  sembrarPreciosVenta,
  formatoMoneda
} from './wizardUtils';
import './wizard.css';
import heroLayers from '../../../assets/hero.svg';
import { derivarPagosDesdeCotizaciones } from '../../../services/calendarioService';

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
  const [dniCliente, setDniCliente] = useState(initialQuote?.dniCliente || '');
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

  const [pasajerosDetalle, setPasajerosDetalle] = useState(() => {
    const cantidad = Math.max(1, Number(initialQuote?.pax) || 2);
    const existentes = Array.isArray(initialQuote?.pasajerosDetalle) ? initialQuote.pasajerosDetalle : [];
    return Array.from({ length: cantidad }, (_, i) => ({
      nombre: existentes[i]?.nombre || (Array.isArray(initialQuote?.pasajeros) ? initialQuote.pasajeros[i] || '' : ''),
      apellido: existentes[i]?.apellido || '',
      dni: existentes[i]?.dni || '',
      pasaporte: existentes[i]?.pasaporte || '',
      fechaNacimiento: existentes[i]?.fechaNacimiento || '',
      observaciones: existentes[i]?.observaciones || ''
    }));
  });
  const [moneda, setMoneda] = useState(initialQuote?.moneda || 'USD');
  const [estado, setEstado] = useState(initialQuote?.estado || 'Borrador');
  const [notas, setNotas] = useState(initialQuote?.notas || '');

  /* -------------------------------- Servicios -------------------------------- */
  const [items, setItems] = useState(() => {
    const base = normalizarServicios(initialQuote?.servicios, { pax: initialQuote?.pax || 2 });
    return sembrarPreciosVenta(base, initialQuote?.precioVentaTotalManual);
  });

  const [markupGlobalPct, setMarkupGlobalPct] = useState(
    Number(initialQuote?.markupGlobalPct) || 20
  );
  const [precioVentaPaquete, setPrecioVentaPaquete] = useState(
    Number(initialQuote?.precioVentaTotalManual) || 0
  );

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
  const totalVentaBase = totalVentaItems(items);
  const totalVenta = precioVentaPaquete > 0 ? precioVentaPaquete : totalVentaBase;
  const totalCosto = totalCostoItems(items);
  const gananciaRealTotal = totalVenta - totalCosto;
  const margenRealPct = totalVenta > 0 ? (gananciaRealTotal / totalVenta) * 100 : 0;
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
    setPasajeros((prev) => {
      const siguiente = Array.from({ length: cantidad }, (_, i) => prev[i] || '');
      return siguiente;
    });
    setPasajerosDetalle((prev) => {
      return Array.from({ length: cantidad }, (_, i) => prev[i] || {
        nombre: '',
        apellido: '',
        dni: '',
        pasaporte: '',
        fechaNacimiento: '',
        observaciones: ''
      });
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
    dniCliente,
    emailCliente,
    telefonoCliente,
    destino,
    fechaViajeInicio,
    fechaViajeFin,
    fechaCotizacion,
    pax: paxCount,
    pasajeros: pasajeros.map((p) => String(p || '').trim()).filter(Boolean),
    pasajerosDetalle,
    moneda,
    estado,
    notas,
    markupGlobalPct,
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

    const cotizacionGuardada = construirCotizacion();

    if (onSaveQuote) {
      onSaveQuote(cotizacionGuardada);
      setSaveSuccessMessage(true);
      setTimeout(() => setSaveSuccessMessage(false), 3000);

      try {
        const pagos = derivarPagosDesdeCotizaciones([cotizacionGuardada], configMensual);
        const primerPago = pagos.find((p) => p.fechaVencimiento);
        if (primerPago) {
          window.dispatchEvent(
            new CustomEvent('jf:toast', {
              detail: {
                message: `Cotizacion guardada. Obligacion de pago: ${primerPago.fechaVencimiento} por ${formatoMoneda(primerPago.moneda, primerPago.montoTotal)}`,
                type: 'success'
              }
            })
          );
        } else {
          window.dispatchEvent(
            new CustomEvent('jf:toast', { detail: { message: 'Cotizacion guardada.', type: 'success' } })
          );
        }
      } catch {
        window.dispatchEvent(
          new CustomEvent('jf:toast', { detail: { message: 'Cotizacion guardada.', type: 'success' } })
        );
      }
    }
  };

  const quoteForPreview = construirCotizacion();

  /* ------------------------------- Render ------------------------------------ */
  return (
    <div className="wizard-form-wrap">
      {pasoActual?.tipo === 'datos' && (
        <section className="jf-hero jf-hero--compact" aria-label="Cómo funciona el cotizador">
          <img className="jf-hero-art" src={heroLayers} alt="" />
          <div className="jf-hero-copy">
            <span className="jf-hero-eyebrow">Paso 1 de 3 · Datos del viaje</span>
            <h2 className="jf-hero-title">Primero, los números reales</h2>
            <p className="jf-hero-text">
              Cargá lo que se le vende al cliente y lo que cuesta con cada proveedor. El margen se calcula solo.
            </p>
          </div>
        </section>
      )}

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
              dniCliente, setDniCliente,
              emailCliente, setEmailCliente,
              telefonoCliente, setTelefonoCliente,
              destino, setDestino,
              fechaViajeInicio, setFechaViajeInicio,
              fechaViajeFin, setFechaViajeFin,
              fechaCotizacion, setFechaCotizacion,
              pax, setPax: handlePaxChange,
              pasajeros, setPasajeros,
              pasajerosDetalle, setPasajerosDetalle,
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
              fechaCotizacion,
              configMensual,
              pax: paxCount,
              moneda,
              items,
              totalVenta,
              totalCosto,
              totalNeto: totalCosto,
              markupGlobalPct,
              setMarkupGlobalPct,
              precioVentaPaquete,
              setPrecioVentaPaquete,
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
        <QuotePreviewModal
          quote={quoteForPreview}
          configMensual={configMensual}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
