// Header.jsx - Barra superior futurista con estilo Cyber-Fintech
import React from 'react';
import { Plus, AlertCircle, RefreshCw, Search, Bell, Settings, User } from 'lucide-react';

export default function Header({
  activeTab,
  onNewQuote,
  urgentesCount,
  onSyncDrive,
  isSyncingDrive
}) {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'cotizador':
        return {
          breadcrumb: 'COTIZADOR / VIAJES',
          title: 'Cotizador de Viajes',
          sub: 'Venta al cliente, costo real y margen neto'
        };
      case 'historial':
        return {
          breadcrumb: 'PROPUESTAS / REGISTRO',
          title: 'Historial de Cotizaciones',
          sub: 'Seguimiento de propuestas enviadas y vencimientos'
        };
      case 'drive':
        return {
          breadcrumb: 'EXPEDIENTES / GOOGLE DRIVE',
          title: 'Expedientes de Clientes',
          sub: 'Vouchers, pasajes y carpetas en Google Drive'
        };
      case 'operadores':
        return {
          breadcrumb: 'PROVEEDORES / MAYORISTAS',
          title: 'Proveedores TTOO',
          sub: 'Operadores mayoristas y condiciones comerciales'
        };
      case 'configMensual':
        return {
          breadcrumb: 'CONFIGURACIÓN / TTOOS',
          title: 'Configuración Mensual TTOs',
          sub: 'Bloques de emisión y vencimientos de pago'
        };
      case 'pagosTTOO':
        return {
          breadcrumb: 'COBRANZAS / PAGOS A TTOOS',
          title: 'Calendario de Pagos a TTOOs',
          sub: 'Cuentas a pagar a proveedores y saldos'
        };
      case 'cobros':
        return {
          breadcrumb: 'COBRANZAS / CLIENTES',
          title: 'Calendario de Cobros',
          sub: 'Cuentas a cobrar a clientes y saldos'
        };
      case 'dashboard':
        return {
          breadcrumb: 'DASHBOARD / MÉTRICAS',
          title: 'Métricas & Ganancias',
          sub: 'Ventas, márgenes y rentabilidad global'
        };
      case 'configDrive':
        return {
          breadcrumb: 'SISTEMA / CONEXIÓN DRIVE',
          title: 'Conexión con Google Drive',
          sub: 'Carpeta raíz y credenciales de acceso'
        };
      default:
        return {
          breadcrumb: 'JUREFINANCE / HOME',
          title: 'JureFinance Travel Suite',
          sub: 'Gestión integral de agencia de viajes'
        };
    }
  };

  const info = getTabTitle();

  return (
    <header className="top-header">
      {/* Título y Breadcrumb estilo futurista */}
      <div className="header-left">
        <div style={{ minWidth: 0 }}>
          <div className="header-breadcrumb">{info.breadcrumb}</div>
          <h1 className="header-title">{info.title}</h1>
        </div>
      </div>

      {/* Barra de búsqueda central en pastilla / pill */}
      <div className="header-search-pill" style={{ display: 'none' /* Oculto en móviles, visible en desktop */ }}>
        <div className="input-wrapper" style={{ position: 'relative' }}>
          <span className="input-prefix" style={{ left: '14px', color: 'var(--neon-cyan)' }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            className="input-field input-with-prefix"
            placeholder="Buscar en JureFinance..."
            style={{
              height: '38px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(17, 10, 40, 0.7)',
              fontSize: '0.84rem',
              borderColor: 'rgba(139, 92, 246, 0.25)'
            }}
          />
        </div>
      </div>

      {/* Acciones y Notificaciones */}
      <div className="header-right">
        {urgentesCount > 0 && (
          <div className="header-title-badge urgent-indicator">
            <AlertCircle size={15} />
            <span>
              <strong>{urgentesCount}</strong> {urgentesCount === 1 ? 'vencimiento próximo' : 'vencimientos próximos'}
            </span>
          </div>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={onSyncDrive}
          disabled={isSyncingDrive}
          title="Sincronizar expedientes con Google Drive"
        >
          <RefreshCw size={14} className={isSyncingDrive ? 'spin-anim' : ''} style={{ color: 'var(--neon-cyan)' }} />
          <span>{isSyncingDrive ? 'Sincronizando…' : 'Sincronizar'}</span>
        </button>

        {activeTab !== 'cotizador' && (
          <button className="btn btn-primary btn-sm" onClick={onNewQuote}>
            <Plus size={15} />
            <span>Nueva cotización</span>
          </button>
        )}

        {/* Avatar de usuario con anillo activo verde brillante */}
        <div className="header-avatar" title="Sesión activa: Jure Travel">
          <User size={18} color="#ffffff" />
          <div className="header-avatar-status" />
        </div>
      </div>
    </header>
  );
}
