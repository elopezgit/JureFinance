// StepDatosViaje.jsx - Paso 1: datos del viaje + proveedores con los que se trabaja.
import React from 'react';
import {
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Building2,
  Plane,
  Hotel,
  Car,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { tiposDeProveedor } from '../wizardUtils';

const ICONO_POR_TIPO = {
  aereo: Plane,
  hotel: Hotel,
  traslados: Car,
  asistencia: ShieldCheck,
  extra: Sparkles
};

const LABEL_POR_TIPO = {
  aereo: 'Aéreos',
  hotel: 'Hotel',
  traslados: 'Traslados',
  asistencia: 'Asistencia',
  extra: 'Extras'
};

export default function StepDatosViaje({
  cliente, setCliente,
  emailCliente, setEmailCliente,
  telefonoCliente, setTelefonoCliente,
  destino, setDestino,
  fechaViajeInicio, setFechaViajeInicio,
  fechaViajeFin, setFechaViajeFin,
  fechaCotizacion, setFechaCotizacion,
  pax, setPax,
  pasajeros = [], setPasajeros,
  moneda, setMoneda,
  estado, setEstado,
  notas, setNotas,
  operadoresList = [],
  proveedoresActivos = [],
  onToggleProveedor
}) {
  const paxCount = Math.max(1, Number(pax) || 1);

  const actualizarPasajero = (indice, valor) => {
    if (!setPasajeros) return;
    const siguiente = Array.from(
      { length: paxCount },
      (_, i) => pasajeros[i] || ''
    );
    siguiente[indice] = valor;
    setPasajeros(siguiente);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tarjeta de Datos Principales */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Users size={20} />
            </div>
            <div>
              <h3 className="card-title">Datos del Cliente & Viaje</h3>
              <span className="card-subtitle">Información general y parámetros de cotización</span>
            </div>
          </div>
          <div style={{ width: '160px' }}>
            <select
              className="select-field"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              title="Estado de la cotización"
            >
              <option value="Borrador">Borrador</option>
              <option value="Enviada">Enviada</option>
              <option value="Aceptada">Aceptada</option>
              <option value="Pagada">Pagada</option>
              <option value="Vencida">Vencida</option>
            </select>
          </div>
        </div>

        {/* Formulario ordenado con columnas simétricas y campos de altura idéntica (44px) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '18px' }}>
          {/* Fila 1: Cliente y Destino */}
          <div className="form-group" style={{ gridColumn: 'span 6' }}>
            <label className="form-label">
              <Users size={15} />
              <span>Nombre del Cliente (Titular)</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Juan Pérez"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 6' }}>
            <label className="form-label">
              <MapPin size={15} />
              <span>Destino / Ruta General</span>
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Tucumán / Cancún All Inclusive"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 2: Pasajeros, Moneda, Fechas de Viaje */}
          <div className="form-group" style={{ gridColumn: 'span 3' }}>
            <label className="form-label">
              <Users size={15} />
              <span>Pasajeros (Pax)</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <input
                type="number"
                min="1"
                className="input-field"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 3' }}>
            <label className="form-label">
              <DollarSign size={15} />
              <span>Moneda Base</span>
            </label>
            <select className="select-field" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              <option value="USD">USD (Dólares)</option>
              <option value="ARS">ARS (Pesos Argentinos)</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 3' }}>
            <label className="form-label">
              <Calendar size={15} />
              <span>Inicio de Viaje</span>
            </label>
            <div className="input-wrapper">
              <input
                type="date"
                className="input-field"
                value={fechaViajeInicio}
                onChange={(e) => setFechaViajeInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 3' }}>
            <label className="form-label">
              <Calendar size={15} />
              <span>Fin de Viaje</span>
            </label>
            <div className="input-wrapper">
              <input
                type="date"
                className="input-field"
                value={fechaViajeFin}
                onChange={(e) => setFechaViajeFin(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 3: Contactos y Fecha de Cotización */}
          <div className="form-group" style={{ gridColumn: 'span 4' }}>
            <label className="form-label">
              <Mail size={15} />
              <span>Email de Contacto</span>
            </label>
            <div className="input-wrapper">
              <input
                type="email"
                className="input-field"
                placeholder="cliente@correo.com"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 4' }}>
            <label className="form-label">
              <Phone size={15} />
              <span>Teléfono / WhatsApp</span>
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder="+54 9 11 1234-5678"
                value={telefonoCliente}
                onChange={(e) => setTelefonoCliente(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 4' }}>
            <label className="form-label">
              <FileText size={15} />
              <span>Fecha de Cotización</span>
            </label>
            <div className="input-wrapper">
              <input
                type="date"
                className="input-field"
                value={fechaCotizacion}
                onChange={(e) => setFechaCotizacion(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 4: Notas e Instrucciones */}
          <div className="form-group" style={{ gridColumn: 'span 12' }}>
            <label className="form-label">
              <FileText size={15} />
              <span>Notas Internas & Observaciones</span>
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Detalles particulares del pasajero, preferencias de hotel, números de pasaporte o solicitudes especiales..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Nombres de los pasajeros: opcional, pero permite auditar cada ticket */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon">
              <Users size={20} />
            </div>
            <div>
              <h3 className="card-title">Pasajeros del Viaje</h3>
              <span className="card-subtitle">
                Nombres para el detalle de tickets y la auditoría de pagos (opcional)
              </span>
            </div>
          </div>
          <span className="badge badge-info">{paxCount} PAX</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px'
          }}
        >
          {Array.from({ length: paxCount }, (_, indice) => (
            <div className="form-group" key={indice}>
              <label className="form-label">
                <Users size={14} />
                <span>
                  Pasajero {indice + 1}
                  {indice === 0 ? ' (titular)' : ''}
                </span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="input-field"
                  placeholder={indice === 0 ? cliente || 'Nombre y apellido' : 'Nombre y apellido'}
                  value={pasajeros[indice] || ''}
                  onChange={(e) => actualizarPasajero(indice, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '12px 0 0' }}>
          Si no completás los nombres, el reporte de flujo de caja usa el cliente titular y la
          cantidad de PAX. Los nombres cargados quedan guardados en la cotización.
        </p>
      </div>

      {/* Proveedores con los que trabajo */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)', color: 'var(--neon-cyan)' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="card-title">Proveedores Mayoristas Disponibles (TTOO)</h3>
              <span className="card-subtitle">
                Seleccioná los operadores con los que vas a cotizar y emitir en este viaje
              </span>
            </div>
          </div>
          <span className="badge badge-success">
            {proveedoresActivos.length} seleccionado{proveedoresActivos.length === 1 ? '' : 's'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px'
          }}
        >
          {operadoresList.map((operador) => {
            const activo = proveedoresActivos.includes(operador.id);
            const tipos = tiposDeProveedor(operador);

            return (
              <button
                type="button"
                key={operador.id}
                onClick={() => onToggleProveedor(operador.id)}
                style={{
                  textAlign: 'left',
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  background: activo
                    ? 'linear-gradient(135deg, rgba(0, 245, 212, 0.12) 0%, rgba(139, 92, 246, 0.2) 100%)'
                    : 'rgba(20, 13, 46, 0.75)',
                  border: activo
                    ? '1.5px solid var(--neon-cyan)'
                    : '1.5px solid var(--border)',
                  boxShadow: activo
                    ? '0 0 20px rgba(0, 245, 212, 0.25), inset 0 0 12px rgba(0, 245, 212, 0.08)'
                    : 'none',
                  transition: 'all var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: activo ? '2px solid var(--neon-cyan)' : '2px solid rgba(139, 92, 246, 0.4)',
                        background: activo ? 'var(--neon-cyan)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0c071e',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {activo && <CheckCircle2 size={16} strokeWidth={3} />}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: activo ? '#ffffff' : 'var(--text-secondary)' }}>
                      {operador.nombre}
                    </span>
                  </div>

                  <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                    {tipos.length} tipo{tipos.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tipos.map((tipo) => {
                    const Icono = ICONO_POR_TIPO[tipo] || Sparkles;
                    return (
                      <span
                        key={tipo}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(10, 6, 26, 0.6)',
                          border: '1px solid rgba(139, 92, 246, 0.25)',
                          color: activo ? 'var(--neon-cyan)' : 'var(--text-secondary)'
                        }}
                      >
                        <Icono size={12} />
                        {LABEL_POR_TIPO[tipo] || tipo}
                      </span>
                    );
                  })}
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {operador.descripcion}
                </p>
              </button>
            );
          })}
        </div>

        {proveedoresActivos.length === 0 && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: '0.86rem' }}>
            Seleccioná al menos un operador mayorista para asociar las tarifas y vencimientos de pago.
          </div>
        )}
      </div>
    </div>
  );
}
