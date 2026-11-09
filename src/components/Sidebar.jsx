// Sidebar.jsx - Panel de navegación principal con secciones claras
import React from 'react';
import {
  Calculator,
  History,
  FolderOpen,
  Building2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Plane,
  HardDrive,
  CalendarClock,
  Wallet,
  HandCoins
} from 'lucide-react';

// Agrupación funcional de la navegación
const NAV_GROUPS = [
  {
    label: 'Operativa diaria',
    items: [
      { id: 'cotizador', label: 'Cotizador de Viajes', icon: Calculator },
      { id: 'historial', label: 'Historial de Cotizaciones', icon: History },
      { id: 'drive', label: 'Expedientes & Drive', icon: FolderOpen }
    ]
  },
  {
    label: 'Cobranzas y Pagos',
    items: [
      { id: 'pagosTTOO', label: 'Calendario de Pagos', icon: Wallet },
      { id: 'cobros', label: 'Calendario de Cobros', icon: HandCoins }
    ]
  },
  {
    label: 'Análisis',
    items: [
      { id: 'dashboard', label: 'Métricas & Ganancias', icon: BarChart3 }
    ]
  },
  {
    label: 'Configuración',
    items: [
      { id: 'configMensual', label: 'Configuración Mensual TTOs', icon: CalendarClock },
      { id: 'operadores', label: 'Proveedores TTOO', icon: Building2 }
    ]
  }
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  urgentesCount,
  driveConfig,
  pagosVencidosCount = 0
}) {
  const isConnected = driveConfig?.lastSyncOk !== false;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Cabecera de marca */}
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon-wrapper">
            <Plane size={20} />
          </div>
          {!isCollapsed && (
            <div className="brand-text">
              <span className="brand-title">JureFinance</span>
              <span className="brand-subtitle">Travel Suite</span>
            </div>
          )}
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navegación por secciones */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            {!isCollapsed && <div className="nav-section-label">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount =
                item.id === 'historial'
                  ? urgentesCount
                  : item.id === 'pagosTTOO'
                    ? pagosVencidosCount
                    : 0;
              const showBadge = badgeCount > 0;

              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="nav-item-icon">
                    <Icon size={18} />
                  </span>
                  {!isCollapsed && (
                    <>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                      {showBadge && <span className="nav-item-badge">{badgeCount}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* Pie: estado de conexión con Drive */}
      {!isCollapsed ? (
        <div className="sidebar-footer">
          <div
            className="drive-status-card"
            title="Estado de conexión con Google Drive"
          >
            <div className={`drive-status-dot ${isConnected ? '' : 'is-offline'}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HardDrive size={13} style={{ color: isConnected ? 'var(--neon-cyan)' : 'var(--warning)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>
                  {isConnected ? 'Google Drive conectado' : 'Drive sin conexión'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
              >
                {driveConfig?.rootFolderName || 'Carpeta de clientes'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="sidebar-footer" style={{ padding: '12px', alignItems: 'center' }}>
          <div
            title={isConnected ? 'Google Drive conectado' : 'Drive sin conexión'}
            style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <HardDrive size={18} style={{ color: isConnected ? 'var(--neon-cyan)' : 'var(--warning)' }} />
          </div>
        </div>
      )}
    </aside>
  );
}
