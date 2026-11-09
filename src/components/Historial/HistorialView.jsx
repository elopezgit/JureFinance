// HistorialView.jsx - List & Management of Trip Quotes
import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  MapPin,
  Calendar,
  FolderOpen
} from 'lucide-react';
import { normalizarServicios, totalNetoItems, SECCION_LABEL } from '../../services/serviciosService';

export default function HistorialView({
  cotizaciones = [],
  onEditQuote,
  onDeleteQuote,
  onDuplicateQuote,
  onOpenClientDrive
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Filter quotes
  const filteredQuotes = cotizaciones.filter((q) => {
    const matchesSearch =
      q.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.destino.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'TODOS' || q.estado === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate deadline urgency badge
  const getUrgencyBadge = (quote) => {
    const dates = [];
    normalizarServicios(quote.servicios, { pax: quote.pax }).forEach((item) => {
      if (!item.activo || !item.vencimientoTTOO) return;
      dates.push({
        label: `${SECCION_LABEL[item.tipo] || item.tipo} (${item.proveedor || 'Sin proveedor'})`,
        date: item.vencimientoTTOO
      });
    });

    if (dates.length === 0) return null;
    dates.sort((a, b) => new Date(a.date) - new Date(b.date));
    const earliest = dates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(earliest.date);
    const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="badge badge-danger">Vencido {earliest.date}</span>;
    }
    if (diffDays <= 2) {
      return (
        <span className="badge badge-danger urgent-indicator" title={earliest.label}>
          ¡Vence en {diffDays === 0 ? 'HOY' : `${diffDays}d`}!
        </span>
      );
    }
    if (diffDays <= 7) {
      return <span className="badge badge-warning">Vence en {diffDays}d</span>;
    }
    return <span className="badge badge-neutral">Vence {earliest.date}</span>;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Aceptada':
      case 'Pagada':
        return <span className="badge badge-success">{status}</span>;
      case 'Enviada':
        return <span className="badge badge-info">{status}</span>;
      case 'Vencida':
        return <span className="badge badge-danger">{status}</span>;
      default:
        return <span className="badge badge-neutral">{status || 'Borrador'}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filter Toolbar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div className="input-wrapper" style={{ flex: 1 }}>
              <span className="input-prefix">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="input-field input-with-prefix"
                placeholder="Buscar por cliente, destino o ID de cotización..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} color="var(--text-secondary)" />
              <select
                className="select-field"
                style={{ minWidth: '185px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="TODOS">Todos los estados</option>
                <option value="Borrador">Borrador</option>
                <option value="Enviada">Enviada</option>
                <option value="Aceptada">Aceptada</option>
                <option value="Pagada">Pagada</option>
                <option value="Vencida">Vencida</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Mostrando <strong>{filteredQuotes.length}</strong> de {cotizaciones.length} cotizaciones
          </div>
        </div>
      </div>

      {/* Quotes Cards / Table View */}
      {filteredQuotes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={24} />
            </div>
            <h3>No se encontraron cotizaciones</h3>
            <p>Prueba ajustando los términos de búsqueda o el filtro de estado.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredQuotes.map((q) => {
            // Net & Profit calculations for row
            const tn = totalNetoItems(normalizarServicios(q.servicios, { pax: q.pax }));

            const ventaTotal = Number(q.precioVentaTotalManual) || 0;
            const ganancia = ventaTotal - tn;
            const margen = ventaTotal > 0 ? (ganancia / ventaTotal) * 100 : 0;

            return (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: '20px 24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'transform var(--transition-fast)'
                }}
              >
                {/* Client & ID Info (4 cols) */}
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary-light)' }}>
                      {q.id}
                    </span>
                    {getStatusBadge(q.estado)}
                    {getUrgencyBadge(q)}
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 4px' }}>
                    {q.cliente}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <MapPin size={14} color="var(--primary-light)" />
                    <span>{q.destino}</span>
                  </div>
                </div>

                {/* Dates & Pax Info (3 cols) */}
                <div style={{ gridColumn: 'span 3', borderLeft: '1px solid var(--bg-card-border)', paddingLeft: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                    <Calendar size={14} color="var(--text-secondary)" />
                    <span>
                      {q.fechaViajeInicio} al {q.fechaViajeFin}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Users size={14} />
                    <span>
                      {q.pax} {q.pax === 1 ? 'Pasajero' : 'Pasajeros'}
                    </span>
                    <span style={{ margin: '0 4px' }}>•</span>
                    <span>Cotizado: {q.fechaCotizacion}</span>
                  </div>
                </div>

                {/* Financial Summary (3 cols) */}
                <div style={{ gridColumn: 'span 3', borderLeft: '1px solid var(--bg-card-border)', paddingLeft: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Venta Total:
                    </span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {q.moneda || 'USD'} ${ventaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    <span>Costo real: ${tn.toFixed(2)}</span>
                    <span style={{ color: ganancia >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                      Ganancia: +${ganancia.toFixed(2)} ({margen.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Actions (2 cols) */}
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-icon-only"
                    onClick={() => onOpenClientDrive(q.cliente)}
                    title={`Abrir carpeta de Google Drive para ${q.cliente}`}
                  >
                    <FolderOpen size={16} color="var(--primary-light)" />
                  </button>

                  <button
                    className="btn btn-secondary btn-icon-only"
                    onClick={() => onDuplicateQuote(q)}
                    title="Duplicar cotización"
                  >
                    <Copy size={16} />
                  </button>

                  <button
                    className="btn btn-primary btn-icon-only"
                    onClick={() => onEditQuote(q)}
                    title="Editar cotización en el calculador"
                  >
                    <Edit size={16} />
                  </button>

                  <button
                    className="btn btn-danger btn-icon-only"
                    onClick={() => onDeleteQuote(q.id)}
                    title="Eliminar cotización"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
