// DriveView.jsx - Complete Google Drive Client Tree, Folder Navigation & CRUD Explorer
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Upload,
  ExternalLink,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Download,
  Eye,
  CheckCircle2,
  HardDrive,
  Edit2,
  X,
  ChevronRight,
  ArrowLeft,
  Filter,
  SlidersHorizontal,
  FolderTree,
  Calendar,
  Clock,
  Lock,
  ShieldCheck,
  Settings
} from 'lucide-react';
import {
  TARGET_ROOT_FOLDER_ID,
  TARGET_DRIVE_URL,
  getAllClientFiles,
  getFilesForClient,
  uploadFileToTargetFolder,
  deleteClientFile,
  renameClientFile,
  deleteClientFolder,
  createClientDriveFolder,
  createSubfolderInDrive,
  fetchLiveDriveTree,
  fetchFolderContentLive,
  updateClientLiveCache
} from '../../services/driveService';
import { APPS_SCRIPT_V3_SOURCE } from '../../services/appsScriptSource';

export default function DriveView({ selectedClientName = 'PELAO DAUD', driveConfig, onOpenConfig }) {
  // Client selection & search
  const [currentClient, setCurrentClient] = useState(selectedClientName || 'PELAO DAUD');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientFilterType, setClientFilterType] = useState('ALL'); // 'ALL' | 'WITH_FILES' | 'EMPTY'

  // Folder navigation state (Breadcrumbs stack: [{ id, name, url }])
  const [folderPath, setFolderPath] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);

  // File search & category filters
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [fileCategoryFilter, setFileCategoryFilter] = useState('TODOS'); // 'TODOS' | 'PDF' | 'EXCEL' | 'DOCX' | 'DOCUMENTOS'
  const [fileSortBy, setFileSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'NAME_ASC' | 'SIZE_DESC'

  // Modals & Actions state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [newClientInput, setNewClientInput] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState('Expediente');
  const [targetUploadFolderId, setTargetUploadFolderId] = useState('');
  const [selectedFileObj, setSelectedFileObj] = useState(null);
  const fileInputRef = useRef(null);

  // Rename modal
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Preview lightbox
  const [previewFile, setPreviewFile] = useState(null);

  // Script Help Modal state
  const [showScriptHelpModal, setShowScriptHelpModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);

  // Database of clients (155 real Google Drive folders)
  const [allClients, setAllClients] = useState(getAllClientFiles());

  // Reload clients on sync or change
  useEffect(() => {
    setAllClients(getAllClientFiles());
  }, [isSyncing]);

  // Current client normalized data (reflects exact Google Drive content)
  const clientData = useMemo(() => {
    return getFilesForClient(currentClient);
  }, [allClients, currentClient]);

  // When client changes, reset folder path to client root
  useEffect(() => {
    if (clientData) {
      setFolderPath([
        {
          id: clientData.driveFolderId || `root_${currentClient}`,
          name: currentClient,
          url: clientData.driveFolderUrl || TARGET_DRIVE_URL
        }
      ]);
    }
  }, [currentClient, clientData?.driveFolderId]);

  // Active folder in the breadcrumb stack
  const activeFolder = folderPath[folderPath.length - 1] || {
    id: clientData?.driveFolderId,
    name: currentClient,
    url: clientData?.driveFolderUrl
  };

  const isAtClientRoot = folderPath.length <= 1;

  // Estado real del conector de Google Drive (para no fingir conexión en vivo)
  const connectorStatus = useMemo(() => {
    const version = String(driveConfig?.connectorVersion || '');
    const ok = driveConfig?.lastSyncOk === true;
    const runningV3 = version.startsWith('3');
    if (ok && runningV3) {
      return {
        className: 'badge badge-success',
        text: `Google Drive en vivo · Conector v${version}`,
        title: 'Lectura completa: archivos directos y todas las subcarpetas'
      };
    }
    if (ok && !runningV3) {
      return {
        className: 'badge badge-warning',
        text: 'Conector desactualizado (v2) · lectura incompleta',
        title: 'Actualiza Code.gs a la v3.1 en Apps Script para leer archivos directos y subcarpetas'
      };
    }
    return {
      className: 'badge badge-warning',
      text: 'Sin conexión al conector · caché local',
      title: driveConfig?.lastSyncMessage || 'No se pudo contactar con el conector de Google Drive'
    };
  }, [driveConfig]);

  // Filter clients list for left panel
  const clientList = Object.keys(allClients);

  const filteredClients = useMemo(() => {
    return clientList.filter((cName) => {
      const matchesSearch = cName.toLowerCase().includes(clientSearchTerm.toLowerCase());
      if (!matchesSearch) return false;
      const c = allClients[cName] || getFilesForClient(cName);
      const count = (c?.todosLosArchivos?.length || 0) + (c?.archivos?.length || 0);
      if (clientFilterType === 'WITH_FILES') {
        return count > 0;
      }
      if (clientFilterType === 'EMPTY') {
        return count === 0;
      }
      return true;
    });
  }, [clientList, clientSearchTerm, clientFilterType, allClients]);

  // Subfolders in current level
  const currentSubfolders = useMemo(() => {
    if (isAtClientRoot) {
      return clientData?.subcarpetas || [];
    }
    const foundSub = clientData?.subcarpetas?.find((s) => s.id === activeFolder.id || s.nombre === activeFolder.name);
    return foundSub?.subcarpetas || [];
  }, [isAtClientRoot, clientData, activeFolder.id, activeFolder.name]);

  // Files in current level (genuine files from Google Drive)
  const currentFiles = useMemo(() => {
    if (isAtClientRoot) {
      return clientData?.archivos || clientData?.todosLosArchivos || [];
    }
    const foundSub = clientData?.subcarpetas?.find((s) => s.id === activeFolder.id || s.nombre === activeFolder.name);
    if (foundSub?.archivos && foundSub.archivos.length > 0) {
      return foundSub.archivos;
    }
    return [];
  }, [isAtClientRoot, clientData, activeFolder.id, activeFolder.name]);

  // Filter & sort files
  const filteredAndSortedFiles = useMemo(() => {
    let list = [...currentFiles];

    // Search filter
    if (fileSearchTerm.trim()) {
      const term = fileSearchTerm.toLowerCase();
      list = list.filter((f) =>
        f.nombre.toLowerCase().includes(term) ||
        (f.categoria && f.categoria.toLowerCase().includes(term))
      );
    }

    // Category filter matching real files
    if (fileCategoryFilter === 'PDF') {
      list = list.filter((f) =>
        f.tipo === 'pdf' || f.nombre.toLowerCase().endsWith('.pdf')
      );
    } else if (fileCategoryFilter === 'EXCEL') {
      list = list.filter((f) => {
        const lower = f.nombre.toLowerCase();
        return f.tipo === 'excel' || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.includes('libro') || lower.includes('cálculo') || lower.includes('calculo');
      });
    } else if (fileCategoryFilter === 'DOCX') {
      list = list.filter((f) => {
        const lower = f.nombre.toLowerCase();
        return f.tipo === 'docx' || lower.endsWith('.docx') || lower.endsWith('.doc') || lower.includes('documento') || lower.includes('aéreo') || lower.includes('aereo');
      });
    } else if (fileCategoryFilter === 'DOCUMENTOS') {
      list = list.filter((f) => {
        const lower = f.nombre.toLowerCase();
        return f.tipo === 'image' || lower.match(/\.(jpg|jpeg|png)$/i) || f.categoria?.includes('Documentación') || f.categoria?.includes('DNI') || f.categoria?.includes('Identificación');
      });
    }

    // Sort
    list.sort((a, b) => {
      if (fileSortBy === 'NAME_ASC') {
        return a.nombre.localeCompare(b.nombre);
      }
      if (fileSortBy === 'SIZE_DESC') {
        return (parseFloat(b.tamanio) || 0) - (parseFloat(a.tamanio) || 0);
      }
      // Default: DATE_DESC
      return new Date(b.fechaModificacion || 0) - new Date(a.fechaModificacion || 0);
    });

    return list;
  }, [currentFiles, fileSearchTerm, fileCategoryFilter, fileSortBy]);

  // Dynamic counts of clients with files and empty
  const clientCounts = useMemo(() => {
    let withFiles = 0;
    let empty = 0;
    clientList.forEach((cName) => {
      const c = allClients[cName] || getFilesForClient(cName);
      const count = (c?.todosLosArchivos?.length || 0) + (c?.archivos?.length || 0);
      if (count > 0) withFiles++;
      else empty++;
    });
    return { withFiles, empty };
  }, [clientList, allClients]);

  // Refresh current active folder directly from Google Drive
  const handleRefreshCurrentFolder = async () => {
    const targetId = activeFolder?.id || clientData?.driveFolderId;
    setFolderLoading(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetchFolderContentLive(targetId, currentClient);
      if (res && res.success && res.folder) {
        updateClientLiveCache(currentClient, targetId, res.folder);
        setAllClients(getAllClientFiles());
        const count = res.folder.allFiles?.length || res.folder.files?.length || 0;
        setSyncStatusMsg({
          success: true,
          text: `✓ Carpeta "${currentClient}" verificada en vivo desde Google Drive (${count} archivo(s) encontrados).`
        });
      } else if (res && res.isActionUnrecognized) {
        setSyncStatusMsg({
          success: false,
          needsScriptUpdate: true,
          text: 'Google Apps Script respondió con versión antigua (no reconoce getFolderContent). Presiona "Ver Instrucciones" para publicar la v3.0 en script.google.com.'
        });
      } else if (res && !res.success) {
        setSyncStatusMsg({
          success: false,
          text: `Aviso de Google Drive: ${res.error || 'No se pudo obtener el contenido en vivo'}`
        });
      } else {
        setSyncStatusMsg({
          success: true,
          text: `Carpeta "${currentClient}" conectada a Google Drive (${currentFiles.length} archivos disponibles).`
        });
      }
    } catch (e) {
      console.warn('Live fetch error:', e);
      setSyncStatusMsg({
        success: false,
        text: 'Error al consultar Google Drive: ' + e.message
      });
    } finally {
      setFolderLoading(false);
      setTimeout(() => setSyncStatusMsg(null), 8000);
    }
  };

  // Select client from left panel
  const handleSelectClient = (cName) => {
    setCurrentClient(cName);
    const cInfo = getFilesForClient(cName);
    const count = (cInfo?.todosLosArchivos?.length || 0) + (cInfo?.archivos?.length || 0);
    if (count === 0 && cInfo.driveFolderId) {
      // Background check if empty
      fetchFolderContentLive(cInfo.driveFolderId, cName).then((res) => {
        if (res && res.success && res.folder) {
          updateClientLiveCache(cName, cInfo.driveFolderId, res.folder);
          setAllClients(getAllClientFiles());
        }
      }).catch(() => {});
    }
  };

  // Navigate INTO a subfolder
  const handleEnterSubfolder = async (subfolder) => {
    setFolderLoading(true);
    setFolderPath((prev) => [
      ...prev,
      {
        id: subfolder.id,
        name: subfolder.nombre,
        url: subfolder.url || clientData.driveFolderUrl
      }
    ]);

    try {
      const res = await fetchFolderContentLive(subfolder.id, currentClient);
      if (res && res.success && res.folder) {
        updateClientLiveCache(currentClient, subfolder.id, res.folder);
        setAllClients(getAllClientFiles());
      }
    } catch (e) {
      console.warn('Live fetch error:', e);
    } finally {
      setFolderLoading(false);
    }
  };

  // Navigate TO a specific breadcrumb level
  const handleNavigateBreadcrumb = (index) => {
    setFolderPath((prev) => prev.slice(0, index + 1));
  };

  // Step UP one level
  const handleStepUp = () => {
    if (folderPath.length > 1) {
      setFolderPath((prev) => prev.slice(0, prev.length - 1));
    }
  };

  // Sync with Google Drive Live
  const handleLiveSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetchLiveDriveTree();
      setAllClients(getAllClientFiles());
      setSyncStatusMsg({
        success: res.success,
        text: res.message || 'Sincronizado con Google Drive exitosamente'
      });
    } catch (err) {
      setSyncStatusMsg({
        success: false,
        text: 'Error en sincronización: ' + err.message
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  // Handle native file selection
  const handleNativeFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileObj(file);
      setNewFileName(file.name);
      if (file.type.includes('image')) {
        setNewFileCategory('Documentación / DNI');
      } else {
        setNewFileCategory('Voucher / Pasaje');
      }
    }
  };

  // Handle file upload submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const destFolderId = targetUploadFolderId || activeFolder.id || clientData.driveFolderId;

    await uploadFileToTargetFolder(
      destFolderId,
      currentClient,
      {
        nombre: newFileName.trim(),
        tipo: selectedFileObj?.type?.includes('image') ? 'image' : 'pdf',
        tamanio: selectedFileObj ? (selectedFileObj.size / (1024 * 1024)).toFixed(1) + ' MB' : '1.2 MB',
        categoria: newFileCategory,
        urlDescarga: selectedFileObj && selectedFileObj.type.includes('image')
          ? URL.createObjectURL(selectedFileObj)
          : '#'
      },
      selectedFileObj
    );

    setNewFileName('');
    setSelectedFileObj(null);
    setShowUploadModal(false);
    setAllClients(getAllClientFiles());
  };

  // Create Subfolder
  const handleCreateSubfolder = async (e) => {
    e.preventDefault();
    if (!newSubfolderName.trim()) return;

    await createSubfolderInDrive(activeFolder.id || clientData.driveFolderId, newSubfolderName.trim(), currentClient);
    setNewSubfolderName('');
    setShowNewFolderModal(false);
    setAllClients(getAllClientFiles());
  };

  // Create New Client
  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientInput.trim()) return;

    const created = await createClientDriveFolder(newClientInput.trim(), TARGET_ROOT_FOLDER_ID);
    setAllClients(getAllClientFiles());
    setCurrentClient(created.cliente);
    setNewClientInput('');
    setShowNewClientModal(false);
  };

  // Delete File
  const handleDeleteFile = async (fileId) => {
    alert('Protección de Fuente Única activa: Los archivos existentes de Google Drive están protegidos contra eliminación para resguardar la información de la agencia.');
  };

  // Delete Client Folder
  const handleDeleteClientFolder = async (cName) => {
    alert(`Protección de Fuente Única activa: La carpeta de "${cName}" pertenece a Google Drive y está protegida contra eliminación.`);
  };

  // Rename File
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (renameTarget && renameValue.trim()) {
      await renameClientFile(currentClient, renameTarget.fileId, renameValue.trim());
      setAllClients(getAllClientFiles());
      setRenameTarget(null);
      setRenameValue('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner superior del expediente */}
      <div
        className="card"
        style={{
          padding: '18px 24px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span className={connectorStatus.className} title={connectorStatus.title}>
                <HardDrive size={13} /> {connectorStatus.text}
              </span>
              <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} color="var(--primary-light)" /> Fuente Única (Modo Seguro)
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Cuenta: <strong>juretravel.com</strong> • ID: <code>{TARGET_ROOT_FOLDER_ID}</code>
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderOpen size={24} color="var(--primary-light)" />
              Expediente Digital del Pasajero: {currentClient}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            {onOpenConfig && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenConfig}
                title="Configuración de conexión Google Drive y Google Apps Script"
                style={{ borderColor: 'var(--primary-border)' }}
              >
                <Settings size={14} color="var(--primary-light)" />
                <span>Configuración</span>
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowScriptHelpModal(true)}
              title="Ver instrucciones y copiar código de Google Apps Script v3.1"
              style={{ borderColor: 'var(--primary-border)' }}
            >
              <FolderTree size={14} color="var(--primary-light)" />
              <span>Conector v3.1</span>
            </button>

            <button className="btn btn-secondary btn-sm" onClick={handleLiveSync} disabled={isSyncing}>
              <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
              <span>{isSyncing ? 'Leyendo Drive...' : 'Sincronizar'}</span>
            </button>

            <a
              href={activeFolder?.url || clientData?.driveFolderUrl || TARGET_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              title="Abrir esta carpeta directamente en Google Drive en una nueva pestaña"
            >
              <ExternalLink size={14} />
              <span>Abrir en Google Drive ↗</span>
            </a>

            <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
              <Upload size={14} />
              <span>Subir Archivo</span>
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              background: syncStatusMsg.success ? 'var(--success-bg)' : 'var(--warning-bg)',
              border: `1px solid ${syncStatusMsg.success ? 'var(--success-border)' : 'var(--warning-border)'}`,
              fontSize: '0.82rem',
              color: syncStatusMsg.success ? 'var(--success)' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>{syncStatusMsg.text}</div>
            {syncStatusMsg.needsScriptUpdate && (
              <button
                className="btn btn-primary btn-sm"
                style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                onClick={() => setShowScriptHelpModal(true)}
              >
                Ver Instrucciones
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Client Tree (Left 3.5 cols) & File Explorer (Right 8.5 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '22px' }}>
        {/* ==========================================================================
            LEFT PANEL: CLIENT SEARCH & LIST (3.5 cols)
            ========================================================================== */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card" style={{ padding: '18px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header with New Client Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                  Clientes en Drive
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {filteredClients.length} de {clientList.length} clientes
                </span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowNewClientModal(true)}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                title="Crear nueva carpeta de cliente"
              >
                <Plus size={13} />
                <span>Nuevo Cliente</span>
              </button>
            </div>

            {/* Instant Real-Time Search Box */}
            <div className="input-wrapper" style={{ marginBottom: '10px' }}>
              <span className="input-prefix">
                <Search size={14} />
              </span>
              <input
                type="text"
                className="input-field input-with-prefix"
                style={{ fontSize: '0.84rem', padding: '8px 12px 8px 32px' }}
                placeholder="Buscar cliente por nombre..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
              />
              {clientSearchTerm && (
                <button
                  onClick={() => setClientSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filter Chips (Todos vs Con Archivos vs Vacías) */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button
                className={`btn btn-sm ${clientFilterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                onClick={() => setClientFilterType('ALL')}
              >
                Todos ({clientList.length})
              </button>
              <button
                className={`btn btn-sm ${clientFilterType === 'WITH_FILES' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                onClick={() => setClientFilterType('WITH_FILES')}
              >
                Con Archivos ({clientCounts.withFiles})
              </button>
              <button
                className={`btn btn-sm ${clientFilterType === 'EMPTY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                onClick={() => setClientFilterType('EMPTY')}
              >
                Vacías ({clientCounts.empty})
              </button>
            </div>

            {/* Client List (Scrollable) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                overflowY: 'auto',
                maxHeight: '680px',
                paddingRight: '4px'
              }}
            >
              {filteredClients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No se encontraron clientes para "{clientSearchTerm}".
                </div>
              ) : (
                filteredClients.map((cName) => {
                  const isSelected = cName === currentClient;
                  const cInfo = getFilesForClient(cName);
                  const fileCount = cInfo?.todosLosArchivos?.length || 0;

                  return (
                    <div
                      key={cName}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--primary-soft)' : 'transparent',
                        border: `1px solid ${isSelected ? 'var(--primary-border)' : 'transparent'}`,
                        padding: '4px 8px',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <button
                        onClick={() => handleSelectClient(cName)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.83rem',
                          flex: 1,
                          overflow: 'hidden',
                          padding: '6px 4px'
                        }}
                      >
                        <Folder size={16} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cName}
                        </span>
                        {fileCount > 0 && (
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '0.66rem', padding: '1px 6px', marginLeft: 'auto' }}
                          >
                            {fileCount}
                          </span>
                        )}
                      </button>

                      <a
                        href={cInfo?.driveFolderUrl || (cInfo?.driveFolderId ? `https://drive.google.com/drive/folders/${cInfo.driveFolderId}` : TARGET_DRIVE_URL)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          opacity: 0.6,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Abrir carpeta de ${cName} directamente en Google Drive ↗`}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ==========================================================================
            RIGHT PANEL: FOLDER BREADCRUMBS, FILTERS & FILES (8 cols)
            ========================================================================== */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Breadcrumb Navigation Bar */}
          <div
            className="card"
            style={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-surface-elevated)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {!isAtClientRoot && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleStepUp}
                  style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                  title="Subir un nivel de carpeta"
                >
                  <ArrowLeft size={13} />
                  <span>Volver</span>
                </button>
              )}

              {folderPath.map((crumb, idx) => {
                const isLast = idx === folderPath.length - 1;
                return (
                  <React.Fragment key={crumb.id || idx}>
                    <button
                      onClick={() => handleNavigateBreadcrumb(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: isLast ? 'default' : 'pointer',
                        color: isLast ? 'var(--text-main)' : 'var(--primary-light)',
                        fontWeight: isLast ? 800 : 600,
                        fontSize: '0.86rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        textDecoration: isLast ? 'none' : 'underline'
                      }}
                    >
                      {idx === 0 ? <FolderTree size={15} /> : <Folder size={15} />}
                      <span>{crumb.name}</span>
                    </button>
                    {!isLast && <ChevronRight size={14} color="var(--text-muted)" />}
                  </React.Fragment>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {filteredAndSortedFiles.length} archivo(s) • {currentSubfolders.length} subcarpeta(s)
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRefreshCurrentFolder}
                disabled={folderLoading}
                style={{ padding: '3px 9px', fontSize: '0.72rem' }}
                title="Consultar contenido en vivo de esta carpeta en Google Drive"
              >
                <RefreshCw size={12} className={folderLoading ? 'spin-anim' : ''} />
                <span>{folderLoading ? 'Consultando...' : 'Re-verificar'}</span>
              </button>
            </div>
          </div>

          {/* Search, Category Filters and Sorter Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {/* Search Files */}
            <div className="input-wrapper" style={{ maxWidth: '300px', width: '100%' }}>
              <span className="input-prefix">
                <Search size={14} />
              </span>
              <input
                type="text"
                className="input-field input-with-prefix"
                style={{ fontSize: '0.84rem', padding: '8px 12px 8px 32px' }}
                placeholder="Buscar archivos por nombre..."
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
              />
              {fileSearchTerm && (
                <button
                  onClick={() => setFileSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
              <button
                className={`btn btn-sm ${fileCategoryFilter === 'TODOS' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setFileCategoryFilter('TODOS')}
              >
                Todos ({currentFiles.length})
              </button>
              <button
                className={`btn btn-sm ${fileCategoryFilter === 'PDF' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setFileCategoryFilter('PDF')}
              >
                📄 Pasajes & Vouchers (PDF)
              </button>
              <button
                className={`btn btn-sm ${fileCategoryFilter === 'EXCEL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setFileCategoryFilter('EXCEL')}
              >
                📊 Planillas (Excel)
              </button>
              <button
                className={`btn btn-sm ${fileCategoryFilter === 'DOCX' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setFileCategoryFilter('DOCX')}
              >
                📝 Textos (Word)
              </button>
              <button
                className={`btn btn-sm ${fileCategoryFilter === 'DOCUMENTOS' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setFileCategoryFilter('DOCUMENTOS')}
              >
                🖼️ Fotos & DNI
              </button>
            </div>

            {/* Sorter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal size={14} color="var(--text-muted)" />
              <select
                className="select-field"
                style={{ fontSize: '0.76rem', padding: '6px 10px', width: '160px' }}
                value={fileSortBy}
                onChange={(e) => setFileSortBy(e.target.value)}
              >
                <option value="DATE_DESC">Más recientes primero</option>
                <option value="NAME_ASC">Nombre (A - Z)</option>
                <option value="SIZE_DESC">Mayor tamaño</option>
              </select>
            </div>
          </div>

          {/* Subfolder Cards (Only if real subfolders exist) */}
          {currentSubfolders.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  📁 {isAtClientRoot ? `Carpetas del Expediente de ${currentClient}` : `Subcarpetas en ${activeFolder.name}`} ({currentSubfolders.length}):
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 9px', fontSize: '0.72rem' }}
                  onClick={() => setShowNewFolderModal(true)}
                >
                  <FolderPlus size={13} />
                  <span>+ Nueva Subcarpeta</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
                {currentSubfolders.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => handleEnterSubfolder(sub)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--primary-soft)',
                      border: '1px solid var(--primary-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'transform var(--transition-fast), border-color var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'var(--primary-border)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <Folder size={20} color="var(--primary-light)" />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sub.nombre}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {sub.archivos?.length || 0} archivo(s) • Clic para explorar
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Header for Files */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              📄 {isAtClientRoot ? `Archivos de ${currentClient} en Google Drive` : `Archivos en ${activeFolder.name}`} ({filteredAndSortedFiles.length}):
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                onClick={handleRefreshCurrentFolder}
                disabled={folderLoading}
                title="Re-verificar archivos en Google Drive"
              >
                <RefreshCw size={12} className={folderLoading ? 'spin-anim' : ''} />
                <span>{folderLoading ? 'Leyendo...' : 'Re-verificar'}</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                onClick={() => setShowUploadModal(true)}
              >
                <Upload size={12} />
                <span>+ Subir Archivo</span>
              </button>
            </div>
          </div>

          {/* Loading indicator */}
          {folderLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-soft)',
                border: '1px solid var(--primary-border)',
                color: 'var(--primary)',
                fontSize: '0.86rem',
                marginBottom: '14px'
              }}
            >
              <RefreshCw size={16} className="spin-anim" />
              <span>Consultando archivos en vivo directamente desde Google Drive...</span>
            </div>
          )}

          {/* Files Grid or Empty State */}
          {filteredAndSortedFiles.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>📂</div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>
                {fileSearchTerm ? 'No se encontraron coincidencias' : 'Carpeta sin archivos detectados'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', maxWidth: '480px', margin: '0 auto 16px' }}>
                {fileSearchTerm
                  ? `No hay archivos que coincidan con "${fileSearchTerm}".`
                  : `La carpeta "${currentClient}" está conectada a Google Drive. Si recién cargaste archivos en Drive, presiona "Re-verificar en Drive" o abre la carpeta directamente.`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRefreshCurrentFolder}
                  disabled={folderLoading}
                >
                  <RefreshCw size={14} className={folderLoading ? 'spin-anim' : ''} />
                  <span>{folderLoading ? 'Consultando...' : 'Re-verificar en Drive'}</span>
                </button>
                <a
                  href={activeFolder.url || clientData.driveFolderUrl || TARGET_DRIVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} />
                  <span>Abrir Carpeta en Google Drive ↗</span>
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
                  <Upload size={14} />
                  <span>Subir Archivo Aquí</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {filteredAndSortedFiles.map((file) => {
                const lower = (file.nombre || '').toLowerCase();
                const isPdf = file.tipo === 'pdf' || lower.endsWith('.pdf');
                const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.includes('libro');
                const isWord = lower.endsWith('.docx') || lower.endsWith('.doc');
                const isImage = file.tipo === 'image' || lower.match(/\.(jpg|jpeg|png|webp)$/i);

                return (
                  <div
                    key={file.id}
                    className="card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      border: '1px solid var(--bg-card-border)'
                    }}
                  >
                    <div>
                      {/* Top icon & category */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            background: isPdf
                              ? 'var(--danger-bg)'
                              : isExcel
                              ? 'var(--success-bg)'
                              : isWord
                              ? 'var(--primary-soft)'
                              : isImage
                              ? 'rgba(168, 85, 247, 0.12)'
                              : 'var(--bg-inset)',
                            color: isPdf
                              ? 'var(--danger)'
                              : isExcel
                              ? 'var(--success)'
                              : isWord
                              ? 'var(--primary)'
                              : isImage
                              ? '#7c3aed'
                              : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {isPdf ? (
                            <FileText size={18} />
                          ) : isExcel ? (
                            <FileSpreadsheet size={18} />
                          ) : isWord ? (
                            <FileText size={18} />
                          ) : isImage ? (
                            <ImageIcon size={18} />
                          ) : (
                            <File size={18} />
                          )}
                        </div>
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                          {isPdf ? 'PDF / PASAJE' : isExcel ? 'EXCEL / COTI' : isWord ? 'WORD / DOC' : isImage ? 'IMAGEN / DNI' : (file.categoria || 'EXPEDIENTE')}
                        </span>
                      </div>

                      {/* File Name */}
                      <h4
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          lineHeight: 1.3,
                          marginBottom: '4px',
                          wordBreak: 'break-word',
                          color: 'var(--text-main)'
                        }}
                      >
                        {file.nombre}
                      </h4>

                      {/* Meta */}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                        <span>{file.tamanio || '0.1 MB'}</span>
                        <span>•</span>
                        <span>{file.fechaModificacion || 'En Drive'}</span>
                      </div>
                    </div>

                    {/* Image Thumbnail preview if available */}
                    {isImage && file.urlDescarga && file.urlDescarga !== '#' && (
                      <div
                        style={{
                          margin: '10px 0',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          height: '90px',
                          background: 'var(--bg-inset)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setPreviewFile(file)}
                      >
                        <img
                          src={file.urlDescarga}
                          alt={file.nombre}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                        />
                      </div>
                    )}

                    {/* Card Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--bg-card-border)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            if (isImage) {
                              setPreviewFile(file);
                            } else if (file.urlDescarga && file.urlDescarga !== '#') {
                              window.open(file.urlDescarga, '_blank');
                            } else {
                              setPreviewFile(file);
                            }
                          }}
                        >
                          <Eye size={13} />
                          <span>Ver</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <a
                          href={file.urlDescarga && file.urlDescarga !== '#' ? file.urlDescarga : TARGET_DRIVE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-icon-only"
                          style={{ width: '28px', height: '28px' }}
                          title="Abrir este archivo directamente en Google Drive ↗"
                        >
                          <ExternalLink size={13} />
                        </a>

                        <span
                          className="badge badge-neutral"
                          style={{
                            fontSize: '0.64rem',
                            padding: '3px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: 'var(--text-muted)'
                          }}
                          title="Archivo de Google Drive protegido (Fuente Única)"
                        >
                          <ShieldCheck size={11} color="var(--success)" />
                          Drive
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="var(--primary-light)" />
                Subir Archivo a: {activeFolder.name}
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleNativeFileChange}
                />

                <div
                  style={{
                    border: '2px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    padding: '22px',
                    textAlign: 'center',
                    background: 'var(--bg-subtle)',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={28} color="var(--primary)" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-main)' }}>
                    {selectedFileObj ? `Archivo: ${selectedFileObj.name}` : 'Selecciona un archivo de tu equipo'}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {selectedFileObj ? `${(selectedFileObj.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF, JPG, PNG de vouchers o pasaportes'}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Carpeta de Destino en el Expediente</label>
                  <select
                    className="select-field"
                    value={targetUploadFolderId || activeFolder.id}
                    onChange={(e) => setTargetUploadFolderId(e.target.value)}
                  >
                    <option value={activeFolder.id}>📁 {activeFolder.name} (Carpeta Actual)</option>
                    {clientData.subcarpetas?.map((sub) => (
                      <option key={sub.id} value={sub.id}>📁 {sub.nombre}</option>
                    ))}
                    <option value={clientData.driveFolderId}>📁 Raíz del Expediente ({currentClient})</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Archivo en Drive</label>
                  <input
                    type="text"
                    className="input-field"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="Ej: Voucher_Hotel_Princess.pdf"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    className="select-field"
                    value={newFileCategory}
                    onChange={(e) => setNewFileCategory(e.target.value)}
                  >
                    <option value="Voucher / Pasaje">📄 Voucher / Pasaje Aéreo</option>
                    <option value="Documentación / DNI">🖼️ Documentación Cliente (DNI / Pasaporte)</option>
                    <option value="General">📁 General / Otro Documento</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUploadModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Subir a Google Drive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Subfolder Modal */}
      {showNewFolderModal && (
        <div className="modal-backdrop" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={18} color="var(--primary-light)" />
                Nueva Subcarpeta en: {activeFolder.name}
              </h3>
              <button
                onClick={() => setShowNewFolderModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubfolder}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre de la Carpeta:</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Pasajes 2024, Vouchers Hotel..."
                    value={newSubfolderName}
                    onChange={(e) => setNewSubfolderName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewFolderModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Crear en Drive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Client Modal */}
      {showNewClientModal && (
        <div className="modal-backdrop" onClick={() => setShowNewClientModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Crear Carpeta de Cliente en Drive</h3>
              <button
                onClick={() => setShowNewClientModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateClient}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre del Cliente / Titular:</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: MARCOS VALDEZ"
                    value={newClientInput}
                    onChange={(e) => setNewClientInput(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewClientModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Crear Carpeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="modal-backdrop" onClick={() => setRenameTarget(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Renombrar Archivo</h3>
              <button
                onClick={() => setRenameTarget(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nuevo nombre:</label>
                  <input
                    type="text"
                    className="input-field"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRenameTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Guardar Nombre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {previewFile && (
        <div className="modal-backdrop" onClick={() => setPreviewFile(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '750px', background: 'var(--bg-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {previewFile.tipo === 'pdf' ? <FileText size={18} color="var(--danger)" /> : <ImageIcon size={18} color="var(--success)" />}
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{previewFile.nombre}</h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              {previewFile.tipo === 'image' && previewFile.urlDescarga && previewFile.urlDescarga !== '#' ? (
                <img
                  src={previewFile.urlDescarga}
                  alt={previewFile.nombre}
                  style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '8px', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    padding: '40px 20px',
                    borderRadius: '8px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <FileText size={48} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '6px' }}>{previewFile.nombre}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
                    Documento almacenado en la carpeta de <strong>{currentClient}</strong> en Google Drive.
                  </p>
                  <a
                    href={previewFile.urlDescarga !== '#' ? previewFile.urlDescarga : TARGET_DRIVE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    <ExternalLink size={14} />
                    <span>Abrir en Google Drive ↗</span>
                  </a>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                Tamaño: {previewFile.tamanio || '1.2 MB'} • Fecha: {previewFile.fechaModificacion}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewFile(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Help & Upgrade Modal */}
      {showScriptHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowScriptHelpModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderTree size={20} color="var(--primary-light)" />
                <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>
                  Conector Google Drive v3.1 (Apps Script)
                </h3>
              </div>
              <button
                onClick={() => setShowScriptHelpModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'var(--primary-soft)',
                  border: '1px solid var(--primary-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  fontSize: '0.86rem',
                  lineHeight: 1.5
                }}
              >
                <strong>¿Por qué algunas carpetas no mostraban archivos?</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
                  El script anterior de Google Apps Script solo leía 2 subcarpetas con nombres fijos. Clientes como <strong>SOL JURE</strong> tienen sus archivos directamente en la carpeta, por lo que el script viejo no los detectaba. La <strong>Versión 3.1</strong> lee exhaustivamente todos los archivos directos, subcarpetas (a cualquier profundidad), PDFs, Word y Google Sheets, y además precalcula el árbol en segundo plano para que la web lo lea <strong>casi al instante</strong>.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.92rem', marginBottom: '8px', color: 'var(--text-main)' }}>
                  📋 4 Pasos rápidos para activar la lectura completa:
                </h4>
                <ol style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: 1.8, margin: 0 }}>
                  <li>
                    Ingresa a tu editor en <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>script.google.com</a> con la cuenta <strong>juretravel.com</strong>.
                  </li>
                  <li>
                    Abre el archivo <code>Code.gs</code>, borra el contenido anterior y pega el <strong>Código v3.1</strong> (usa el botón de abajo para copiarlo).
                  </li>
                  <li>
                    Haz clic arriba en <strong>Implementar</strong> ➔ <strong>Administrar implementaciones</strong> ➔ ícono de lápiz <strong>Editar</strong> ➔ en Versión selecciona <strong>"Nueva versión"</strong> ➔ clic en <strong>Implementar</strong>.
                  </li>
                  <li>
                    <strong>Opcional pero recomendado:</strong> en el editor, selecciona la función <code>setupTreeTrigger</code> y pulsa <strong>Ejecutar</strong> una vez. Esto instala el activador que reconstruye el árbol de Drive automáticamente en segundo plano (sincronización casi instantánea). Si no lo haces, la primera lectura será más lenta.
                  </li>
                </ol>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(APPS_SCRIPT_V3_SOURCE);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 3000);
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>{copySuccess ? '¡Código Copiado al Portapapeles!' : 'Copiar Código Code.gs v3.1'}</span>
                </button>

                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} />
                  <span>Abrir Google Apps Script ↗</span>
                </a>
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                Archivo local: <code>google-apps-script/Code.gs</code>
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowScriptHelpModal(false)}>
                Entendido / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
