// StepDatosViaje.jsx - Paso 1: datos del viaje.
import React, { useId } from 'react';
import { Users, MapPin, FileText } from 'lucide-react';

export default function StepDatosViaje({
  cliente, setCliente,
  dniCliente, setDniCliente,
  emailCliente, setEmailCliente,
  telefonoCliente, setTelefonoCliente,
  destino, setDestino,
  fechaViajeInicio, setFechaViajeInicio,
  fechaViajeFin, setFechaViajeFin,
  fechaCotizacion, setFechaCotizacion,
  pax, setPax,
  setPasajeros,
  pasajerosDetalle = [], setPasajerosDetalle,
  moneda, setMoneda,
  estado, setEstado,
  notas, setNotas
}) {
  const uid = useId();
  const paxCount = Math.max(1, Number(pax) || 1);

  const actualizarDetalle = (indice, campo, valor) => {
    const base = { nombre: '', apellido: '', dni: '', pasaporte: '', fechaNacimiento: '', observaciones: '' };
    const siguiente = Array.from({ length: paxCount }, (_, i) => ({ ...base, ...(pasajerosDetalle[i] || {}) }));
    siguiente[indice] = { ...siguiente[indice], [campo]: valor };
    if (setPasajerosDetalle) setPasajerosDetalle(siguiente);
    if (campo === 'nombre' && setPasajeros) {
      const nombres = Array.from({ length: paxCount }, (_, i) => (siguiente[i].nombre || ''));
      setPasajeros(nombres);
    }
  };

  // Asocia la etiqueta visible con su control para lectores de pantalla.
  const campo = (label, control, sufijo) => {
    const id = `${uid}-${sufijo}`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor={id} className="form-label" style={{ fontSize: '0.8rem' }}>{label}</label>
        {React.cloneElement(control, { id })}
      </div>
    );
  };

  const notaId = `${uid}-notas`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card glass-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon"><Users size={18} /></div>
            <div>
              <h3 className="card-title">Cliente</h3>
              <span className="card-subtitle">Datos del titular del viaje</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campo('Nombre del cliente *', <input type="text" className="input-field" placeholder="Ej: Juan Perez" value={cliente || ''} onChange={(e) => setCliente?.(e.target.value)} />, 'cliente')}
          {campo('DNI del cliente', <input type="text" className="input-field" placeholder="DNI" value={dniCliente || ''} onChange={(e) => setDniCliente?.(e.target.value)} />, 'dni-cliente')}
          {campo('Email de contacto', <input type="email" className="input-field" placeholder="cliente@correo.com" value={emailCliente || ''} onChange={(e) => setEmailCliente?.(e.target.value)} />, 'email')}
          {campo('Telefono / WhatsApp', <input type="text" className="input-field" placeholder="+54 9 11 1234-5678" value={telefonoCliente || ''} onChange={(e) => setTelefonoCliente?.(e.target.value)} />, 'telefono')}
        </div>
      </div>

      <div className="card glass-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon"><MapPin size={18} /></div>
            <div>
              <h3 className="card-title">Viaje</h3>
              <span className="card-subtitle">Destino, fechas y parametros</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campo('Destino / Ruta general', <input type="text" className="input-field" placeholder="Ej: Tucuman / Cancun All Inclusive" value={destino || ''} onChange={(e) => setDestino?.(e.target.value)} />, 'destino')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {campo('Pasajeros (Pax) *', <input type="number" min="1" className="input-field" value={pax} onChange={(e) => setPax?.(e.target.value)} />, 'pax')}
            {campo('Moneda base', (
              <select className="select-field" value={moneda} onChange={(e) => setMoneda?.(e.target.value)}>
                <option value="USD">USD (Dolares)</option>
                <option value="ARS">ARS (Pesos)</option>
              </select>
            ), 'moneda')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {campo('Inicio de viaje', <input type="date" className="input-field" value={fechaViajeInicio || ''} onChange={(e) => setFechaViajeInicio?.(e.target.value)} />, 'fecha-inicio')}
            {campo('Fin de viaje', <input type="date" className="input-field" value={fechaViajeFin || ''} onChange={(e) => setFechaViajeFin?.(e.target.value)} />, 'fecha-fin')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {campo('Fecha de cotizacion', <input type="date" className="input-field" value={fechaCotizacion || ''} onChange={(e) => setFechaCotizacion?.(e.target.value)} />, 'fecha-cotizacion')}
            {campo('Estado', (
              <select className="select-field" value={estado} onChange={(e) => setEstado?.(e.target.value)}>
                <option value="Borrador">Borrador</option>
                <option value="Enviada">Enviada</option>
                <option value="Aceptada">Aceptada</option>
                <option value="Pagada">Pagada</option>
                <option value="Vencida">Vencida</option>
              </select>
            ), 'estado')}
          </div>
        </div>
      </div>

      <div className="card glass-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon"><Users size={18} /></div>
            <div>
              <h3 className="card-title">Pasajeros del viaje</h3>
              <span className="card-subtitle">Datos reales para auditoria (opcional)</span>
            </div>
          </div>
          <span className="badge badge-info">{paxCount} PAX</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Array.from({ length: paxCount }, (_, i) => {
            const detalle = pasajerosDetalle[i] || {};
            const actualizar = (campoNombre, valor) => actualizarDetalle(i, campoNombre, valor);
            const id = (sufijo) => `${uid}-pax-${i}-${sufijo}`;
            return (
              <div key={i} className="row-soft" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                  Pasajero {i + 1}{i === 0 ? ' (titular)' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <div>
                    <label htmlFor={id('nombre')} className="form-label" style={{ fontSize: '0.72rem' }}>Nombre</label>
                    <input id={id('nombre')} type="text" className="input-field" style={{ height: '34px' }} value={detalle.nombre || ''} onChange={(e) => actualizar('nombre', e.target.value)} placeholder={i === 0 ? cliente || 'Nombre' : 'Nombre'} />
                  </div>
                  <div>
                    <label htmlFor={id('apellido')} className="form-label" style={{ fontSize: '0.72rem' }}>Apellido</label>
                    <input id={id('apellido')} type="text" className="input-field" style={{ height: '34px' }} value={detalle.apellido || ''} onChange={(e) => actualizar('apellido', e.target.value)} placeholder="Apellido" />
                  </div>
                  <div>
                    <label htmlFor={id('dni')} className="form-label" style={{ fontSize: '0.72rem' }}>DNI</label>
                    <input id={id('dni')} type="text" className="input-field" style={{ height: '34px' }} value={detalle.dni || ''} onChange={(e) => actualizar('dni', e.target.value)} placeholder="DNI" />
                  </div>
                  <div>
                    <label htmlFor={id('pasaporte')} className="form-label" style={{ fontSize: '0.72rem' }}>Pasaporte</label>
                    <input id={id('pasaporte')} type="text" className="input-field" style={{ height: '34px' }} value={detalle.pasaporte || ''} onChange={(e) => actualizar('pasaporte', e.target.value)} placeholder="Pasaporte" />
                  </div>
                  <div>
                    <label htmlFor={id('nacimiento')} className="form-label" style={{ fontSize: '0.72rem' }}>Fecha de nacimiento</label>
                    <input id={id('nacimiento')} type="date" className="input-field" style={{ height: '34px' }} value={detalle.fechaNacimiento || ''} onChange={(e) => actualizar('fechaNacimiento', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label htmlFor={id('observaciones')} className="form-label" style={{ fontSize: '0.72rem' }}>Observaciones (condiciones, etc.)</label>
                  <textarea id={id('observaciones')} className="input-field" rows={2} style={{ fontSize: '0.82rem' }} value={detalle.observaciones || ''} onChange={(e) => actualizar('observaciones', e.target.value)} placeholder="Alergias, condiciones medicas, preferencias..." />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card glass-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor={notaId} className="form-label" style={{ fontSize: '0.8rem' }}>
            <FileText size={14} />
            <span>Notas internas y observaciones</span>
          </label>
          <textarea
            id={notaId}
            className="input-field"
            rows={3}
            placeholder="Detalles particulares, preferencias, numeros de pasaporte..."
            value={notas || ''}
            onChange={(e) => setNotas?.(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
