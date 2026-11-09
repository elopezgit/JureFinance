// OperadoresView.jsx - Tour Operators (TTOO) Management Directory
import React, { useState } from 'react';
import { Building2, Plus, Plane, Hotel, ShieldCheck, Car, Clock, Mail, ExternalLink, Edit2 } from 'lucide-react';
import { INITIAL_OPERADORES } from '../../data/initialData';
import { normalizarServicios } from '../../services/serviciosService';

export default function OperadoresView({
  cotizaciones = [],
  operadoresList = null,
  onAgregarOperador
}) {
  const [operadoresLocales, setOperadoresLocales] = useState(INITIAL_OPERADORES);
  const operadores = Array.isArray(operadoresList) ? operadoresList : operadoresLocales;
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newCategoria, setNewCategoria] = useState('Multiservicio');
  const [newPrestaciones, setNewPrestaciones] = useState(['Hotel']);
  const [newDescripcion, setNewDescripcion] = useState('');
  const [newContacto, setNewContacto] = useState('');

  // Count active quotes per operator
  const getQuotesCountForOperator = (operatorName) => {
    const objetivo = String(operatorName || '').trim().toLowerCase();
    return cotizaciones.filter((q) => {
      const items = normalizarServicios(q.servicios, { pax: q.pax });
      return items.some((item) => {
        if (!item.activo) return false;
        const coincide = (nombre, id) =>
          String(nombre || '').trim().toLowerCase() === objetivo || String(id || '') === objetivo;
        // Cuenta tanto si el operador cotizó como si terminó siendo el de compra.
        if (coincide(item.proveedor, item.proveedorId)) return true;
        return (item.ofertas || []).some((oferta) => coincide(oferta.proveedor, oferta.proveedorId));
      });
    }).length;
  };

  const handleAddOperator = (e) => {
    e.preventDefault();
    if (!newNombre.trim()) return;

    const baseId =
      newNombre
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'proveedor';

    let id = baseId;
    let sufijo = 2;
    while (operadores.some((op) => op.id === id)) {
      id = `${baseId}-${sufijo}`;
      sufijo += 1;
    }

    const newOp = {
      id,
      nombre: newNombre.trim(),
      categoria: newCategoria,
      prestaciones: newPrestaciones,
      descripcion: newDescripcion || 'Operador turístico registrado',
      tiempoEsperaPromedio: 'Hasta fecha límite pactada en la reserva',
      contacto: newContacto || 'contacto@operador.com',
      badgeColor: 'badge-info'
    };

    if (onAgregarOperador) {
      onAgregarOperador(newOp);
    } else {
      setOperadoresLocales((prev) => [...prev, newOp]);
    }
    setNewNombre('');
    setNewDescripcion('');
    setNewContacto('');
    setShowAddModal(false);
  };

  const togglePrestacion = (p) => {
    if (newPrestaciones.includes(p)) {
      setNewPrestaciones(newPrestaciones.filter((item) => item !== p));
    } else {
      setNewPrestaciones([...newPrestaciones, p]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={22} color="var(--primary-light)" />
              Directorio de Tour Operadores (TTOO)
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Proveedores mayoristas de prestaciones turísticas y políticas de pago.
            </p>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            <span>Agregar Proveedor TTOO</span>
          </button>
        </div>
      </div>

      {/* Operators Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {operadores.map((op) => {
          const quotesCount = getQuotesCountForOperator(op.nombre);

          return (
            <div
              key={op.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '22px',
                borderTop: '3px solid var(--primary)'
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem'
                      }}
                    >
                      {op.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{op.nombre}</h3>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                        {op.categoria}
                      </span>
                    </div>
                  </div>

                  <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                    {quotesCount} {quotesCount === 1 ? 'cotización' : 'cotizaciones'}
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '16px' }}>
                  {op.descripcion}
                </p>

                {/* Prestaciones ofrecidas */}
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Prestaciones que cubre:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {op.prestaciones.map((p) => (
                      <span
                        key={p}
                        className="badge badge-neutral"
                        style={{ fontSize: '0.74rem' }}
                      >
                        {p === 'Aéreos' && <Plane size={12} color="var(--primary-light)" />}
                        {p === 'Hotel' && <Hotel size={12} color="var(--warning)" />}
                        {p === 'Asistencia al Viajero' && <ShieldCheck size={12} color="var(--success)" />}
                        {p === 'Traslados' && <Car size={12} color="var(--accent)" />}
                        <span>{p}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Terms & Payment policies */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <Clock size={13} color="var(--warning)" />
                    <strong>Política de Vencimiento de Pago:</strong>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {op.tiempoEsperaPromedio}
                  </p>
                </div>
              </div>

              {/* Footer with contact */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--bg-card-border)',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} />
                  <span>{op.contacto}</span>
                </div>
                <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>TTOO Activo</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Operator Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Registrar Nuevo Proveedor (TTOO)</h3>
            </div>
            <form onSubmit={handleAddOperator}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Operador (TTOO)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Logan Travel, Juliá Tours..."
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Prestaciones que provee</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Aéreos', 'Hotel', 'Traslados', 'Asistencia al Viajero'].map((prestacion) => {
                      const isChecked = newPrestaciones.includes(prestacion);
                      return (
                        <button
                          key={prestacion}
                          type="button"
                          className={`btn btn-sm ${isChecked ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => togglePrestacion(prestacion)}
                        >
                          {prestacion}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción / Especialidad</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Mayorista especialista en vuelos chárter y hoteles en Brasil"
                    value={newDescripcion}
                    onChange={(e) => setNewDescripcion(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email de Operaciones / Reservas</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="reservas@ttoo.com"
                    value={newContacto}
                    onChange={(e) => setNewContacto(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Guardar Operador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
