// driveService.js - Bidirectional Google Drive Sync & Database Service for JureFinance
// Connected Root Folder: https://drive.google.com/drive/u/4/folders/19uQ5nKKN_tRw080ecqb-buUOQWqkhwka

import REAL_DRIVE_DATA from '../data/driveLiveRealData.json';
import { INITIAL_COTIZACIONES, INITIAL_OPERADORES } from '../data/initialData';

const STORAGE_KEY_FILES = 'jurefinance_drive_real_v7';
const STORAGE_KEY_CONFIG = 'jurefinance_drive_config_v5';
const STORAGE_KEY_TOKEN = 'jurefinance_drive_token_v5';
const STORAGE_KEY_DB = 'jurefinance_quotes_v1';
const STORAGE_KEY_CONFIG_MENSUAL = 'jurefinance_config_mensual_v1';
const STORAGE_KEY_PAGOS_TTOO = 'jurefinance_pagos_ttoo_v1';
const STORAGE_KEY_PAGOS_MANUALES = 'jurefinance_pagos_ttoo_manuales_v1';
const STORAGE_KEY_ARREGLOS_COBRO = 'jurefinance_arreglos_cobro_v1';

export const TARGET_ROOT_FOLDER_ID = '19uQ5nKKN_tRw080ecqb-buUOQWqkhwka';
export const TARGET_DRIVE_URL = 'https://drive.google.com/drive/u/4/folders/19uQ5nKKN_tRw080ecqb-buUOQWqkhwka';
// Conector v3.1 (lectura completa: archivos directos + todas las subcarpetas, precalculado)
export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzsGLKP8TefOl3ZjYyP0CXa07Hr5SRilSTk13NpYN7ywhO0q22XCxAvlOapCWNhOVA89w/exec';

// Despliegues antiguos del conector (v2). Si la URL guardada es una de estas, se migra automáticamente.
const LEGACY_APPS_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycbw-AgFsnlVwRmJqGBDaH_1Wr1VrE8JitwpFuyZPvsoH6rAMPcPRG0CSR1WuewvcCE661Q/exec'
];

/**
 * Migra una URL de conector guardada. Si es una versión antigua conocida, usa la nueva.
 */
function migrateAppsScriptUrl(url) {
  if (!url) return DEFAULT_APPS_SCRIPT_URL;
  const clean = String(url).trim();
  if (!clean) return DEFAULT_APPS_SCRIPT_URL;
  if (LEGACY_APPS_SCRIPT_URLS.includes(clean)) return DEFAULT_APPS_SCRIPT_URL;
  return clean;
}

// Configuración predeterminada con conexión permanente a Drive (juretravel.com)
const DEFAULT_CONFIG = {
  isConnected: true,
  rootFolderName: 'Árbol de Clientes (juretravel.com)',
  rootFolderId: TARGET_ROOT_FOLDER_ID,
  driveUrl: TARGET_DRIVE_URL,
  accountIndex: '4', // /u/4/
  appsScriptUrl: DEFAULT_APPS_SCRIPT_URL, // Siempre conectado con el Web App de Drive
  clientId: '', // Google Cloud OAuth Client ID
  apiKey: '',
  autoSyncEnabled: true,
  syncIntervalSeconds: 60,
  lastSyncedAt: new Date().toISOString(),
  // Estado real de la última sincronización (para mostrar en la interfaz sin fingir conexión)
  connectorVersion: '', // '3.1', '3.0', '2.x', 'rest-oauth', 'local'
  lastSyncMode: 'unknown', // 'apps-script' | 'rest-oauth' | 'local' | 'fallback'
  lastSyncOk: false,
  lastSyncMessage: '',
  lastTreeUpdatedAt: 0,
  supportsFastSync: false // true cuando el conector v3.1 (precalculado) está disponible
};

/**
 * Obtener configuración guardada
 */
export function getDriveConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...DEFAULT_CONFIG, 
        ...parsed, 
        appsScriptUrl: migrateAppsScriptUrl(parsed.appsScriptUrl)
      };
    }
  } catch (err) {
    console.error('Error al leer configuración de Drive', err);
  }
  return DEFAULT_CONFIG;
}

/**
 * Guardar configuración
 */
export function saveDriveConfig(newConfig) {
  try {
    const current = getDriveConfig();
    const updated = {
      ...current,
      ...newConfig,
      rootFolderId: TARGET_ROOT_FOLDER_ID,
      driveUrl: TARGET_DRIVE_URL,
      appsScriptUrl: newConfig.appsScriptUrl !== undefined ? migrateAppsScriptUrl(newConfig.appsScriptUrl) : current.appsScriptUrl,
      lastSyncedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error al guardar configuración de Drive', err);
    return newConfig;
  }
}

/**
 * Token de acceso OAuth2
 */
export function getStoredAccessToken() {
  try {
    const item = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!item) return null;
    const tokenData = JSON.parse(item);
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      return null;
    }
    return tokenData.accessToken;
  } catch (e) {
    return null;
  }
}

export function saveAccessToken(accessToken, expiresInSeconds = 3599) {
  const tokenData = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000
  };
  localStorage.setItem(STORAGE_KEY_TOKEN, JSON.stringify(tokenData));
}

export function clearAccessToken() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

/**
 * Iniciar sesión mediante Google Identity Services (GIS)
 */
export function initGoogleAuth(clientId, onTokenSuccess, onError) {
  if (typeof window === 'undefined') return;

  if (!window.google?.accounts?.oauth2) {
    if (onError) onError(new Error('Google Identity Services no está cargado aún en la página.'));
    return;
  }

  try {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.error) {
          if (onError) onError(response);
          return;
        }
        if (response.access_token) {
          saveAccessToken(response.access_token, response.expires_in || 3599);
          if (onTokenSuccess) onTokenSuccess(response.access_token);
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err) {
    if (onError) onError(err);
  }
}

/**
 * Obtener todos los clientes y carpetas (155 clientes reales desde Google Drive)
 */
export function getAllClientFiles() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FILES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length >= 100) {
        let changed = false;
        // Merge real drive initial data if localStorage has empty files for known folders
        for (const [key, initialClient] of Object.entries(REAL_DRIVE_DATA)) {
          if (Array.isArray(initialClient.archivos) && initialClient.archivos.length > 0) {
            const currentFiles = parsed[key]?.archivos || parsed[key]?.todosLosArchivos || [];
            if (!parsed[key] || currentFiles.length === 0) {
              parsed[key] = {
                ...(parsed[key] || {}),
                ...initialClient
              };
              changed = true;
            }
          }
        }
        if (changed) {
          localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error al leer archivos de Drive', err);
  }
  localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(REAL_DRIVE_DATA));
  return REAL_DRIVE_DATA;
}

/**
 * Obtener archivos y subcarpetas reales de un cliente
 * Sin inventar archivos ni carpetas que no existen en Google Drive
 */
export function getFilesForClient(clientName) {
  const allFiles = getAllClientFiles();
  const normalizedKey = clientName?.trim().toUpperCase();

  let found = allFiles[normalizedKey];

  if (!found) {
    const foundKey = Object.keys(allFiles).find(
      (key) => key.includes(normalizedKey) || normalizedKey?.includes(key)
    );
    if (foundKey && allFiles[foundKey]) {
      found = allFiles[foundKey];
    }
  }

  if (!found) {
    return {
      cliente: normalizedKey || 'CLIENTE',
      driveFolderId: '',
      driveFolderUrl: TARGET_DRIVE_URL,
      archivos: [],
      todosLosArchivos: [],
      subcarpetas: []
    };
  }

  // Safe file extraction - avoid JavaScript [] truthy bug
  let files = [];
  if (Array.isArray(found.archivos) && found.archivos.length > 0) {
    files = found.archivos;
  } else if (Array.isArray(found.todosLosArchivos) && found.todosLosArchivos.length > 0) {
    files = found.todosLosArchivos;
  } else if (Array.isArray(found.directFiles) && found.directFiles.length > 0) {
    files = found.directFiles;
  } else {
    // Fallback to legacy carpetas structure
    const vFiles = found.carpetas?.viajeConcretado?.archivos || [];
    const dFiles = found.carpetas?.documentacionCliente?.archivos || [];
    files = [...vFiles, ...dFiles];
  }

  // Also include files inside subcarpetas if any
  const subfolders = found.subcarpetas || [];

  return {
    ...found,
    archivos: files,
    todosLosArchivos: files,
    subcarpetas: subfolders
  };
}

/**
 * Obtener contenido en vivo de una carpeta o subcarpeta por ID o nombre de cliente
 */
export async function fetchFolderContentLive(folderId, clientName = '') {
  const config = getDriveConfig();
  if (config.appsScriptUrl && (folderId || clientName)) {
    try {
      const params = new URLSearchParams({
        action: 'getFolderContent',
        folderId: folderId || '',
        clientName: clientName || '',
        nocache: Date.now().toString()
      });
      const url = `${config.appsScriptUrl}${config.appsScriptUrl.includes('?') ? '&' : '?'}${params.toString()}`;
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data && data.success && data.folder) {
          return { success: true, folder: data.folder, version: data.version || '2.0' };
        }
        if (data && !data.success && data.error) {
          const errMsg = String(data.error);
          const isUnrec = /acci[oó]n\s+no\s+reconocida/i.test(errMsg) || errMsg.toLowerCase().includes('no reconocida') || errMsg.toLowerCase().includes('unrecognized');
          return { success: false, error: errMsg, isActionUnrecognized: isUnrec };
        }
      } catch (e) {
        return { success: false, error: 'Respuesta inválida de Google Apps Script' };
      }
    } catch (err) {
      console.warn('Error fetching live folder content:', err);
      return { success: false, error: err.message };
    }
  }
  return null;
}

/**
 * Actualiza la memoria local con los datos en vivo obtenidos de Google Drive
 */
export function updateClientLiveCache(clientName, folderId, folderData) {
  const allFiles = getAllClientFiles();
  const normalizedKey = clientName?.trim().toUpperCase();
  if (!allFiles[normalizedKey]) {
    allFiles[normalizedKey] = {
      cliente: normalizedKey,
      driveFolderId: folderId,
      driveFolderUrl: folderData.url || `https://drive.google.com/drive/folders/${folderId}`,
      archivos: [],
      todosLosArchivos: [],
      subcarpetas: []
    };
  }

  const cData = allFiles[normalizedKey];
  const liveFiles = (Array.isArray(folderData.allFiles) && folderData.allFiles.length > 0)
    ? folderData.allFiles
    : (Array.isArray(folderData.archivos) && folderData.archivos.length > 0)
      ? folderData.archivos
      : (Array.isArray(folderData.directFiles) && folderData.directFiles.length > 0)
        ? folderData.directFiles
        : (folderData.files || []);

  if (cData.driveFolderId === folderId || !cData.driveFolderId || !folderId) {
    if (liveFiles.length > 0 || !cData.archivos || cData.archivos.length === 0) {
      cData.archivos = liveFiles;
      cData.todosLosArchivos = liveFiles;
    }
    if (folderData.subfolders || folderData.subcarpetas) {
      cData.subcarpetas = folderData.subfolders || folderData.subcarpetas;
    }
  } else {
    if (!cData.subcarpetas) cData.subcarpetas = [];
    const sub = cData.subcarpetas.find((s) => s.id === folderId);
    if (sub) {
      sub.archivos = liveFiles;
      sub.cantidadArchivos = liveFiles.length;
    }
  }

  localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
  return allFiles[normalizedKey];
}

/**
 * Crear subcarpeta dentro de cualquier carpeta en Google Drive
 */
export async function createSubfolderInDrive(parentId, folderName, clientName = '') {
  const config = getDriveConfig();
  let folderId = `sub_${Date.now()}`;
  let folderUrl = TARGET_DRIVE_URL;

  if (config.appsScriptUrl) {
    const data = await callAppsScriptPost(config.appsScriptUrl, {
      action: 'createFolder',
      parentId: parentId,
      folderName: folderName.trim()
    });
    if (data && data.success) {
      folderId = data.folderId;
      folderUrl = data.folderUrl || folderUrl;
    }
  }

  const newSub = {
    id: folderId,
    nombre: folderName.trim(),
    url: folderUrl,
    archivos: [],
    cantidadArchivos: 0
  };

  const allFiles = getAllClientFiles();
  const normalizedKey = clientName?.trim().toUpperCase();
  if (normalizedKey && allFiles[normalizedKey]) {
    if (!allFiles[normalizedKey].subcarpetas) allFiles[normalizedKey].subcarpetas = [];
    allFiles[normalizedKey].subcarpetas.push(newSub);
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
  } else {
    for (const key of Object.keys(allFiles)) {
      if (allFiles[key].driveFolderId === parentId || allFiles[key].subcarpetas?.some(s => s.id === parentId)) {
        if (!allFiles[key].subcarpetas) allFiles[key].subcarpetas = [];
        allFiles[key].subcarpetas.push(newSub);
        localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
        break;
      }
    }
  }

  return newSub;
}

/**
 * Subir archivo directamente a un folderId específico en Google Drive
 */
export async function uploadFileToTargetFolder(targetFolderId, clientName, fileData, nativeFile = null) {
  const config = getDriveConfig();
  let driveFileId = null;
  let webViewLink = '#';

  if (config.appsScriptUrl && nativeFile) {
    try {
      const base64 = await fileToBase64(nativeFile);
      const data = await callAppsScriptPost(config.appsScriptUrl, {
        action: 'uploadFile',
        folderId: targetFolderId,
        clientName: clientName,
        fileName: nativeFile.name,
        mimeType: nativeFile.type || 'application/octet-stream',
        base64Content: base64
      });
      if (data && data.success) {
        driveFileId = data.fileId;
        webViewLink = data.fileUrl;
      }
    } catch (e) {
      console.warn('Error subiendo archivo vía Apps Script:', e);
    }
  }

  const newFile = {
    id: driveFileId || 'f-' + Date.now(),
    driveFileId: driveFileId,
    nombre: fileData.nombre || nativeFile?.name || 'Documento_Nuevo.pdf',
    tipo: fileData.tipo || (fileData.nombre?.endsWith('.pdf') ? 'pdf' : (fileData.nombre?.match(/\.(jpg|jpeg|png)$/i) ? 'image' : 'file')),
    tamanio: fileData.tamanio || (nativeFile ? (nativeFile.size / (1024 * 1024)).toFixed(1) + ' MB' : '1.2 MB'),
    fechaModificacion: new Date().toISOString().split('T')[0],
    categoria: fileData.categoria || 'General',
    urlDescarga: webViewLink !== '#' ? webViewLink : (fileData.urlDescarga || '#'),
    icono: fileData.tipo === 'image' ? 'Image' : 'FileText'
  };

  // Actualizar también en caché local
  const allFiles = getAllClientFiles();
  const normalizedKey = clientName?.trim().toUpperCase();
  if (allFiles[normalizedKey]) {
    const cData = allFiles[normalizedKey];
    if (!cData.todosLosArchivos) cData.todosLosArchivos = [];
    cData.todosLosArchivos.unshift(newFile);

    let subMatched = false;
    if (cData.subcarpetas) {
      const sub = cData.subcarpetas.find(s => s.id === targetFolderId || s.nombre === targetFolderId);
      if (sub) {
        if (!sub.archivos) sub.archivos = [];
        sub.archivos.unshift(newFile);
        sub.cantidadArchivos = sub.archivos.length;
        subMatched = true;
      }
    }
    if (!subMatched) {
      if (!cData.archivos) cData.archivos = [];
      cData.archivos.unshift(newFile);
    }

    if (newFile.categoria?.includes('Voucher') || newFile.tipo === 'pdf') {
      if (cData.carpetas?.viajeConcretado?.archivos) {
        cData.carpetas.viajeConcretado.archivos.unshift(newFile);
      }
    } else {
      if (cData.carpetas?.documentacionCliente?.archivos) {
        cData.carpetas.documentacionCliente.archivos.unshift(newFile);
      }
    }

    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
  }

  return newFile;
}

/* ==========================================================================
   BIDIRECTIONAL DATABASE SYNC ENGINE (WEB <-> DRIVE)
   ========================================================================== */

/**
 * Sincronización bidireccional completa:
 * - Lee cambios en Google Drive (si alguien subió un archivo o creó carpeta en Drive, se refleja en la web).
 * - Lee la base de datos de cotizaciones remota (jurefinance_db.json) y la sincroniza.
 */
export async function syncBidirectionalWithDrive() {
  const config = getDriveConfig();
  const token = getStoredAccessToken();
  const oldTree = getAllClientFiles();
  const lastTreeUpdatedAt = config.lastTreeUpdatedAt || 0;

  // MODO 1: Google Apps Script Web App (Conector v3.1 precalculado)
  if (config.appsScriptUrl) {
    const urlsToTry = buildCandidateUrls(config.appsScriptUrl);
    let lastErrorMsg = null;
    let authIssue = false;

    for (const rawUrl of urlsToTry) {
      // 1.a Sondeo ligero: ¿cambió el árbol precalculado desde la última vez?
      let meta = null;
      try {
        meta = await applicationsScriptFetch(rawUrl, 'getTreeMeta');
      } catch (e) {
        if (e.isAuthIssue) {
          authIssue = true;
          lastErrorMsg = e.message;
        }
      }

      if (
        meta && meta.success && meta.exists && meta.updatedAt &&
        meta.updatedAt === lastTreeUpdatedAt &&
        Object.keys(oldTree).length > 100
      ) {
        saveDriveConfig({
          lastSyncMode: 'apps-script',
          lastSyncOk: true,
          connectorVersion: meta.version || config.connectorVersion || '',
          lastSyncMessage: 'Sin cambios en Google Drive',
          supportsFastSync: true
        });
        return {
          success: true,
          mode: 'apps-script',
          isV3: true,
          hasChanges: false,
          changes: { hasChanges: false, addedClients: 0, addedFiles: 0, description: '' },
          clientTree: oldTree,
          treeUpdatedAt: meta.updatedAt,
          message: 'Conectado a Google Drive (sin cambios)'
        };
      }

      // 1.b Traer el árbol: getTree (precalculado, rápido) con respaldo a listTree/listAll
      const actionsToTry = ['getTree', 'listTree', 'listAll'];
      for (const action of actionsToTry) {
        let data = null;
        try {
          data = await applicationsScriptFetch(rawUrl, action);
        } catch (e) {
          if (e.isAuthIssue) authIssue = true;
          lastErrorMsg = e.message;
          continue;
        }

        if (data && data.success && data.clientTree) {
          const remoteVersion = String(data.version || '');
          const isV3 = remoteVersion.startsWith('3') || Boolean(Object.values(data.clientTree)[0]?.directFiles);

          const normalizedTree = normalizeClientTree(data.clientTree, oldTree, isV3);
          const changes = detectTreeChanges(oldTree, normalizedTree);

          localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(normalizedTree));

          // Sincronizar cotizaciones si existen en el JSON de Drive
          if (data.db && Array.isArray(data.db.cotizaciones)) {
            localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(data.db.cotizaciones));
          }

          // Sincronizar la configuración mensual de TTOs si viene en el JSON de Drive
          if (data.db && Array.isArray(data.db.configuracionMensual)) {
            localStorage.setItem(STORAGE_KEY_CONFIG_MENSUAL, JSON.stringify(data.db.configuracionMensual));
          }

          // Sincronizar pagos a proveedores y arreglos de cobro
          if (data.db && Array.isArray(data.db.pagosTTOO)) {
            localStorage.setItem(STORAGE_KEY_PAGOS_TTOO, JSON.stringify(data.db.pagosTTOO));
          }
          if (data.db && Array.isArray(data.db.pagosTTOOManuales)) {
            localStorage.setItem(STORAGE_KEY_PAGOS_MANUALES, JSON.stringify(data.db.pagosTTOOManuales));
          }
          if (data.db && Array.isArray(data.db.arreglosCobro)) {
            localStorage.setItem(STORAGE_KEY_ARREGLOS_COBRO, JSON.stringify(data.db.arreglosCobro));
          }

          const updatedAtMs = data.updatedAtMs || (meta && meta.updatedAt) || Date.now();

          let syncMessage = changes.hasChanges
            ? `¡Cambios detectados en Google Drive! ${changes.description}`
            : `Conectado a Google Drive en vivo (${Object.keys(normalizedTree).length} carpetas sincronizadas)`;
          if (!isV3) {
            syncMessage += ' • Conector desactualizado: actualiza Code.gs a la v3.1 en Apps Script para leer todas las subcarpetas.';
          }

          saveDriveConfig({
            lastSyncMode: 'apps-script',
            lastSyncOk: true,
            connectorVersion: remoteVersion || (isV3 ? '3.0' : '2.x'),
            lastTreeUpdatedAt: updatedAtMs,
            lastSyncMessage: syncMessage,
            supportsFastSync: (meta && meta.success === true) || data.source === 'precomputed'
          });

          return {
            success: true,
            mode: 'apps-script',
            isV3: isV3,
            message: syncMessage,
            hasChanges: changes.hasChanges,
            changes: changes,
            clientTree: normalizedTree,
            db: data.db,
            treeUpdatedAt: updatedAtMs
          };
        }

        if (data && data.success === false) {
          const errMsg = String(data.error || 'Error del conector de Google Drive');
          const isUnrecognized = /no reconocida|unrecognized/i.test(errMsg);
          lastErrorMsg = errMsg;
          if (isUnrecognized) {
            continue; // Probar la siguiente acción disponible
          }
          break; // Error real: no insistir con otras acciones
        }
      }
    }

    if (lastErrorMsg || authIssue) {
      const msg = authIssue
        ? 'No se pudo acceder al conector de Apps Script. Verifica que la implementación tenga acceso "Cualquier usuario".'
        : lastErrorMsg || 'No se pudo conectar con el conector de Google Drive.';
      saveDriveConfig({ lastSyncMode: 'fallback', lastSyncOk: false, lastSyncMessage: msg });
      return {
        success: false,
        mode: 'apps-script-notice',
        message: msg,
        hasChanges: false,
        clientTree: oldTree
      };
    }
  }

  // MODO 2: Google Drive REST API v3 (con OAuth Access Token)
  if (token) {
    try {
      const res = await fetchLiveDriveTreeRest(TARGET_ROOT_FOLDER_ID, token);
      if (res.connected) {
        const changes = detectTreeChanges(oldTree, res.data);
        const msg = changes.hasChanges
          ? `¡Cambios detectados en Google Drive! ${changes.description}`
          : 'Sincronizado con Google Drive vía API v3';
        saveDriveConfig({
          lastSyncMode: 'rest-oauth',
          lastSyncOk: true,
          connectorVersion: 'rest-oauth',
          lastTreeUpdatedAt: Date.now(),
          lastSyncMessage: msg
        });
        return {
          success: true,
          mode: 'rest-oauth',
          message: msg,
          hasChanges: changes.hasChanges,
          changes: changes,
          clientTree: res.data
        };
      }
    } catch (err) {
      console.warn('Error sincronizando con Google Drive REST API:', err);
    }
  }

  // MODO 3: Sin conexión real -> caché local (estado honesto, sin fingir éxito)
  const localMsg = 'Sin conexión con el conector de Google Drive. Mostrando la última lectura guardada en este equipo.';
  saveDriveConfig({ lastSyncMode: 'local', lastSyncOk: false, lastSyncMessage: localMsg });
  return {
    success: false,
    mode: 'local-fallback',
    message: localMsg,
    hasChanges: false,
    clientTree: oldTree
  };
}

/* ==========================================================================
   HELPERS DE SINCRONIZACIÓN
   ========================================================================== */

function buildCandidateUrls(url) {
  const list = [url];
  const alt = url.replace('/a/macros/juretravel.com/s/', '/macros/s/');
  if (alt !== url) list.push(alt);
  return list;
}

/**
 * Petición GET a Google Apps Script, con detección de errores de permisos.
 */
async function applicationsScriptFetch(rawUrl, action) {
  const u = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}action=${action}&nocache=${Date.now()}`;
  let res;
  try {
    res = await fetch(u, { redirect: 'follow' });
  } catch (netErr) {
    const err = new Error('No se pudo contactar con Google Apps Script (problema de red).');
    err.cause = netErr;
    throw err;
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    if (text.includes('admin_policy_enforced')) {
      const err = new Error('Google Workspace: en Apps Script abre "Implementar > Administrar implementaciones" y en "Quién tiene acceso" selecciona "Cualquier usuario".');
      err.isAuthIssue = true;
      throw err;
    }
    if (text.includes('accounts.google.com') || text.includes('iniciaste sesión') || text.includes('No tienes autorización') || text.includes('403')) {
      const err = new Error('Acceso al conector pendiente: selecciona "Quién tiene acceso: Cualquier usuario" en la implementación de Apps Script.');
      err.isAuthIssue = true;
      throw err;
    }
    const err = new Error('El conector respondió algo distinto a JSON. Vuelve a implementar el Code.gs v3.1 en Apps Script.');
    err.raw = text.slice(0, 200);
    throw err;
  }
}

function inferFileType(nombre) {
  const lower = (nombre || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return 'image';
  if (/\.(xlsx|xls)$/.test(lower) || lower.includes('cálculo') || lower.includes('calculo')) return 'excel';
  if (/\.(docx|doc)$/.test(lower)) return 'docx';
  return 'file';
}

function normalizeFileEntry(f) {
  const fid = f.driveFileId || f.id || `f-${f.nombre}`;
  const tipo = f.tipo || inferFileType(f.nombre);
  return {
    id: fid,
    driveFileId: f.driveFileId || f.id || fid,
    nombre: f.nombre,
    tipo: tipo,
    tamanio: f.tamanio || '0.1 MB',
    fechaModificacion: f.fechaModificacion || new Date().toISOString().split('T')[0],
    categoria: f.categoria || 'Expediente',
    urlDescarga: f.urlDescarga || `https://drive.google.com/file/d/${fid}/view?usp=drivesdk`,
    icono: f.icono || (tipo === 'pdf' ? 'FileText' : tipo === 'image' ? 'Image' : tipo === 'excel' ? 'FileSpreadsheet' : 'File')
  };
}

function collectSubFiles(subcarpetas, acc) {
  if (!Array.isArray(subcarpetas)) return acc;
  subcarpetas.forEach((sub) => {
    if (Array.isArray(sub.archivos)) acc.push(...sub.archivos);
    if (Array.isArray(sub.subcarpetas)) collectSubFiles(sub.subcarpetas, acc);
  });
  return acc;
}

/**
 * Normaliza el árbol remoto al formato interno de la web.
 * - Si el conector es v3+, el remoto es la fuente autoritativa.
 * - Si es un conector antiguo (v2), fusiona con los archivos locales para NO perder datos.
 */
function normalizeClientTree(rawTree, oldTree, isV3) {
  const normalizedTree = {};

  for (const [name, client] of Object.entries(rawTree)) {
    const cName = String(name).trim().toUpperCase();
    const vFiles = client.carpetas?.viajeConcretado?.archivos || [];
    const dFiles = client.carpetas?.documentacionCliente?.archivos || [];
    const directFiles = client.directFiles || client.files || [];
    const rawFiles = client.archivos || client.todosLosArchivos || [];

    // Extraer también de cualquier subcarpeta (recursivo)
    const subFiles = [];
    collectSubFiles(client.subcarpetas, subFiles);

    const fileMap = new Map();
    const addFile = (f) => {
      if (f && (f.driveFileId || f.id || f.nombre)) {
        const entry = normalizeFileEntry(f);
        fileMap.set(entry.id, entry);
      }
    };

    [...directFiles, ...rawFiles, ...vFiles, ...dFiles, ...subFiles].forEach(addFile);

    // PROTECCIÓN ANTI-DEGRADACIÓN: con conector antiguo, conservar archivos locales que no ve.
    if (!isV3) {
      const localFiles = oldTree[cName]?.archivos || oldTree[cName]?.todosLosArchivos || [];
      localFiles.forEach(addFile);
    }

    let fileList = Array.from(fileMap.values());

    // PROTECCIÓN ANTI-SOBREESCRITURA: si el remoto devolvió 0 archivos pero localmente teníamos, conservarlos.
    if (fileList.length === 0) {
      const oldKnownFiles = oldTree[cName]?.archivos || oldTree[cName]?.todosLosArchivos || [];
      const initialKnownFiles = REAL_DRIVE_DATA[cName]?.archivos || [];
      if (oldKnownFiles.length > 0) {
        fileList = oldKnownFiles;
      } else if (initialKnownFiles.length > 0) {
        fileList = initialKnownFiles;
      }
    }

    let subcarpetas = (Array.isArray(client.subcarpetas) && client.subcarpetas.length > 0)
      ? client.subcarpetas
      : null;
    if (!subcarpetas && !isV3) {
      subcarpetas = oldTree[cName]?.subcarpetas || [];
    }

    normalizedTree[cName] = {
      cliente: cName,
      driveFolderId: client.driveFolderId || oldTree[cName]?.driveFolderId || '',
      driveFolderUrl: client.driveFolderUrl || oldTree[cName]?.driveFolderUrl || `https://drive.google.com/drive/folders/${client.driveFolderId || ''}`,
      archivos: fileList,
      todosLosArchivos: fileList,
      directFiles: fileList,
      subcarpetas: subcarpetas || []
    };
  }

  // Conservar clientes locales que el conector antiguo no reportó (solo si NO es v3)
  if (!isV3) {
    for (const [cName, localClient] of Object.entries(oldTree)) {
      if (!normalizedTree[cName]) {
        normalizedTree[cName] = localClient;
      }
    }
  }

  return normalizedTree;
}

export const fetchLiveDriveTree = syncBidirectionalWithDrive;

/**
 * Helper para peticiones POST a Google Apps Script sin bloqueo CORS
 */
async function callAppsScriptPost(url, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: true, text };
    }
  } catch (err) {
    console.warn('Apps Script POST error:', err);
    return null;
  }
}

/**
 * Leer la configuración mensual de TTOs guardada localmente.
 * Devuelve null si no hay nada guardado (para poder sembrar el ejemplo).
 */
export function getStoredMonthlyConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_MENSUAL);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('No se pudo leer la configuración mensual local:', e);
  }
  return null;
}

/**
 * Guardar la configuración mensual de TTOs en localStorage.
 */
export function saveMonthlyConfigLocal(list) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG_MENSUAL, JSON.stringify(list || []));
  } catch (e) {
    console.warn('No se pudo guardar la configuración mensual local:', e);
  }
}

/**
 * Lecturas seguras de listas guardadas en localStorage (devuelven [] si no hay nada).
 */
function readStoredList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`No se pudo leer ${key}:`, e);
    return [];
  }
}

function writeStoredList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list || []));
  } catch (e) {
    console.warn(`No se pudo guardar ${key}:`, e);
  }
}

/** Pagos realizados a proveedores (overlay sobre los pagos derivados). */
export function getStoredPagosTTOO() {
  return readStoredList(STORAGE_KEY_PAGOS_TTOO);
}
export function savePagosTTOOLocal(list) {
  writeStoredList(STORAGE_KEY_PAGOS_TTOO, list);
}

/** Pagos a proveedores cargados a mano. */
export function getStoredPagosManuales() {
  return readStoredList(STORAGE_KEY_PAGOS_MANUALES);
}
export function savePagosManualesLocal(list) {
  writeStoredList(STORAGE_KEY_PAGOS_MANUALES, list);
}

/** Arreglos de cobro con el cliente (M5/M6). */
export function getStoredArreglosCobro() {
  return readStoredList(STORAGE_KEY_ARREGLOS_COBRO);
}
export function saveArreglosCobroLocal(list) {
  writeStoredList(STORAGE_KEY_ARREGLOS_COBRO, list);
}

/**
 * Guardar toda la Base de Datos directamente en Google Drive
 * Crea o actualiza 'jurefinance_db.json' en la raíz 19uQ5nKKN_tRw080ecqb-buUOQWqkhwka
 *
 * Acepta tanto un array de cotizaciones (formato legacy) como un objeto
 * { cotizaciones, configuracionMensual, ... } para respaldar todo el sistema.
 */
export async function saveDatabaseToDrive(input) {
  const config = getDriveConfig();
  const token = getStoredAccessToken();

  const isLegacyArray = Array.isArray(input);
  const cotizaciones = isLegacyArray ? input : (input?.cotizaciones || []);
  const configuracionMensual = isLegacyArray
    ? (getStoredMonthlyConfig() || [])
    : (input?.configuracionMensual || getStoredMonthlyConfig() || []);
  const pagosTTOO = isLegacyArray
    ? getStoredPagosTTOO()
    : (input?.pagosTTOO || getStoredPagosTTOO());
  const pagosTTOOManuales = isLegacyArray
    ? getStoredPagosManuales()
    : (input?.pagosTTOOManuales || getStoredPagosManuales());
  const arreglosCobro = isLegacyArray
    ? getStoredArreglosCobro()
    : (input?.arreglosCobro || getStoredArreglosCobro());

  const dbPayload = {
    cotizaciones,
    configuracionMensual,
    pagosTTOO,
    pagosTTOOManuales,
    arreglosCobro,
    lastUpdated: new Date().toISOString(),
    system: 'JureFinance Travel Agency Suite'
  };

  // 1. Vía Google Apps Script
  if (config.appsScriptUrl) {
    const data = await callAppsScriptPost(config.appsScriptUrl, {
      action: 'saveDb',
      db: dbPayload
    });
    if (data && data.success) {
      return { success: true, message: 'Cotizaciones respaldadas en Google Drive (jurefinance_db.json)' };
    }
  }

  // 2. Vía REST API v3
  if (token) {
    try {
      await saveDbFileInGoogleDriveRest(dbPayload, TARGET_ROOT_FOLDER_ID, token);
      return { success: true, message: 'Cotizaciones guardadas en Google Drive' };
    } catch (e) {
      console.warn('No se pudo guardar DB vía REST:', e);
    }
  }

  // Siempre se guarda en localStorage como base confiable
  localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(cotizaciones));
  return { success: true, message: 'Guardado localmente' };
}

/**
 * Comparador de diferencias para alertar cuando alguien hace cambios en Google Drive
 */
function detectTreeChanges(oldTree, newTree) {
  let addedClients = 0;
  let addedFiles = 0;

  const oldKeys = Object.keys(oldTree || {});
  const newKeys = Object.keys(newTree || {});

  const countFiles = (client) =>
    (client?.archivos?.length || client?.todosLosArchivos?.length || 0);

  newKeys.forEach((key) => {
    const newCount = countFiles(newTree[key]);
    if (!oldKeys.includes(key)) {
      addedClients++;
      addedFiles += newCount;
    } else {
      const oldCount = countFiles(oldTree[key]);
      if (newCount > oldCount) addedFiles += (newCount - oldCount);
    }
  });

  const hasChanges = addedClients > 0 || addedFiles > 0;
  let description = '';
  if (addedClients > 0) description += `${addedClients} cliente(s) nuevo(s). `;
  if (addedFiles > 0) description += `${addedFiles} archivo(s) nuevo(s).`;

  return { hasChanges, addedClients, addedFiles, description };
}

/* ==========================================================================
   CRUD OPERATIONS (CREATE, READ, UPDATE, DELETE)
   ========================================================================== */

/**
 * Crear Carpeta de Cliente (CRUD Create)
 */
export async function createClientDriveFolder(clientName, driveParentId = TARGET_ROOT_FOLDER_ID) {
  const normalizedKey = clientName.trim().toUpperCase();
  const allFiles = getAllClientFiles();
  const config = getDriveConfig();
  const token = getStoredAccessToken();

  let driveFolderId = null;
  let driveFolderUrl = null;

  // 1. Si está conectado Apps Script
  if (config.appsScriptUrl) {
    const data = await callAppsScriptPost(config.appsScriptUrl, {
      action: 'createClientFolder',
      clientName: normalizedKey
    });
    if (data && data.success) {
      driveFolderId = data.folderId;
      driveFolderUrl = data.folderUrl;
    }
  }
  // 2. Si está conectado REST API
  else if (token) {
    try {
      const folderRes = await createFolderInGoogleDrive(normalizedKey, driveParentId, token);
      driveFolderId = folderRes.id;
      driveFolderUrl = `https://drive.google.com/drive/u/4/folders/${driveFolderId}`;
      await createFolderInGoogleDrive('Viaje Concretado (Vouchers & Pasajes)', driveFolderId, token);
      await createFolderInGoogleDrive('Documentación Cliente (DNI & Pasaportes)', driveFolderId, token);
    } catch (e) {
      console.warn('Error creando en Google Drive REST:', e);
    }
  }

  const newClientFolder = {
    cliente: normalizedKey,
    driveFolderId: driveFolderId || `folder_${Date.now()}`,
    driveFolderUrl: driveFolderUrl || `${TARGET_DRIVE_URL}?q=${encodeURIComponent(normalizedKey)}`,
    carpetas: {
      viajeConcretado: {
        nombre: 'Viaje Concretado (Vouchers & Pasajes)',
        archivos: []
      },
      documentacionCliente: {
        nombre: 'Documentación Cliente (DNI & Pasaportes)',
        archivos: []
      }
    }
  };

  allFiles[normalizedKey] = newClientFolder;
  localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
  return newClientFolder;
}

/**
 * Subir Archivo a Carpeta de Cliente (CRUD Create File)
 */
export async function uploadFileToClient(clientName, folderType, fileData, nativeFile = null) {
  const allFiles = getAllClientFiles();
  const normalizedKey = clientName.trim().toUpperCase();
  const config = getDriveConfig();
  const token = getStoredAccessToken();

  if (!allFiles[normalizedKey]) {
    await createClientDriveFolder(normalizedKey);
  }

  const clientData = allFiles[normalizedKey];
  const targetFolder = clientData.carpetas[folderType];

  let driveFileId = null;
  let webViewLink = '#';

  // 1. Subida real con Google Apps Script (Base64)
  if (config.appsScriptUrl && nativeFile) {
    try {
      const base64 = await fileToBase64(nativeFile);
      const data = await callAppsScriptPost(config.appsScriptUrl, {
        action: 'uploadFile',
        clientName: normalizedKey,
        folderType: folderType,
        fileName: nativeFile.name,
        mimeType: nativeFile.type || 'application/pdf',
        base64Content: base64
      });
      if (data && data.success) {
        driveFileId = data.fileId;
        webViewLink = data.fileUrl;
      }
    } catch (e) {
      console.warn('Error subiendo archivo vía Apps Script:', e);
    }
  }
  // 2. Subida real con Google Drive REST API (Multipart)
  else if (token && nativeFile && targetFolder?.id) {
    try {
      const uploadRes = await uploadFileToGoogleDrive(nativeFile, targetFolder.id, token);
      driveFileId = uploadRes.id;
      webViewLink = uploadRes.webViewLink || uploadRes.webContentLink || `https://drive.google.com/file/d/${driveFileId}/view`;
    } catch (err) {
      console.warn('Error subiendo archivo vía REST:', err);
    }
  }

  const newFile = {
    id: driveFileId || 'f-' + Date.now(),
    driveFileId: driveFileId,
    nombre: fileData.nombre || nativeFile?.name || 'Documento_Nuevo.pdf',
    tipo: fileData.tipo || (fileData.nombre?.endsWith('.pdf') ? 'pdf' : 'image'),
    tamanio: fileData.tamanio || (nativeFile ? (nativeFile.size / (1024 * 1024)).toFixed(1) + ' MB' : '1.2 MB'),
    fechaModificacion: new Date().toISOString().split('T')[0],
    categoria: fileData.categoria || (folderType === 'viajeConcretado' ? 'Voucher' : 'Identificación'),
    urlDescarga: webViewLink !== '#' ? webViewLink : fileData.urlDescarga || '#',
    icono: fileData.tipo === 'image' ? 'Image' : 'FileText'
  };

  targetFolder.archivos.unshift(newFile);
  localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
  return newFile;
}

/**
 * Eliminar Archivo (CRUD Delete File)
 * Protegido: Los archivos existentes de Google Drive están protegidos contra eliminación (Fuente Única).
 */
export async function deleteClientFile(clientName, param2, param3) {
  const allFiles = getAllClientFiles();
  const normalizedKey = clientName?.trim().toUpperCase();
  const fileId = param3 || param2;

  if (allFiles[normalizedKey]) {
    const cData = allFiles[normalizedKey];
    const target = (cData.todosLosArchivos || []).find((x) => x.id === fileId);

    // Protección estricta: Google Drive es la fuente única hoy
    if (target?.driveFileId) {
      console.warn(`Protección de fuente única: El archivo "${target.nombre}" proviene de Google Drive y está protegido contra eliminación.`);
      return false;
    }

    if (cData.todosLosArchivos) {
      cData.todosLosArchivos = cData.todosLosArchivos.filter((x) => x.id !== fileId);
    }
    if (cData.archivos) {
      cData.archivos = cData.archivos.filter((x) => x.id !== fileId);
    }
    if (cData.subcarpetas) {
      cData.subcarpetas.forEach((sub) => {
        if (sub.archivos) {
          sub.archivos = sub.archivos.filter((x) => x.id !== fileId);
          sub.cantidadArchivos = sub.archivos.length;
        }
      });
    }

    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
    return true;
  }
  return false;
}

/**
 * Renombrar Archivo (CRUD Update)
 */
export async function renameClientFile(clientName, param2, param3, param4) {
  const allFiles = getAllClientFiles();
  const normalizedKey = clientName?.trim().toUpperCase();
  const fileId = param4 !== undefined ? param3 : param2;
  const newName = param4 !== undefined ? param4 : param3;
  const config = getDriveConfig();
  const token = getStoredAccessToken();

  if (allFiles[normalizedKey] && fileId && newName) {
    const cData = allFiles[normalizedKey];
    let driveFileId = null;

    const renameInList = (list) => {
      if (!list) return;
      const f = list.find((x) => x.id === fileId);
      if (f) {
        f.nombre = newName.trim();
        if (f.driveFileId) driveFileId = f.driveFileId;
      }
    };

    renameInList(cData.todosLosArchivos);
    renameInList(cData.archivos);
    if (cData.subcarpetas) {
      cData.subcarpetas.forEach((sub) => renameInList(sub.archivos));
    }

    if (config.appsScriptUrl && driveFileId) {
      callAppsScriptPost(config.appsScriptUrl, { action: 'renameItem', itemId: driveFileId, newName: newName.trim() });
    } else if (token && driveFileId) {
      try {
        await renameGoogleDriveItem(driveFileId, newName.trim(), token);
      } catch (e) {}
    }

    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(allFiles));
    return true;
  }
  return false;
}

/**
 * Eliminar Carpeta de Cliente (CRUD Delete Folder)
 * Protegido: Las carpetas de Google Drive son la fuente única y están protegidas contra eliminación.
 */
export async function deleteClientFolder(clientName) {
  console.warn(`Protección de fuente única: La carpeta "${clientName}" pertenece a Google Drive y no puede ser eliminada desde la web.`);
  return false;
}

/* ==========================================================================
   GOOGLE DRIVE REST HELPERS
   ========================================================================== */

async function fetchLiveDriveTreeRest(rootFolderId, token) {
  const query = encodeURIComponent(`'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Google API status ${res.status}`);

  const { files: clientFolders } = await res.json();
  const liveTree = {};

  for (const folder of clientFolders) {
    const clientName = folder.name.toUpperCase();
    const subQuery = encodeURIComponent(`'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const subRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${subQuery}&fields=files(id,name)&pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const { files: subfolders } = await subRes.json();

    const viajeFolder = subfolders.find((f) => f.name.toLowerCase().includes('viaje') || f.name.toLowerCase().includes('voucher'));
    const docFolder = subfolders.find((f) => f.name.toLowerCase().includes('doc') || f.name.toLowerCase().includes('dni') || f.name.toLowerCase().includes('pasaporte'));

    let viajeFiles = [];
    if (viajeFolder) {
      const fRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${viajeFolder.id}' in parents and trashed = false`)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await fRes.json();
      viajeFiles = (data.files || []).map(mapDriveFile);
    }

    let docFiles = [];
    if (docFolder) {
      const fRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${docFolder.id}' in parents and trashed = false`)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await fRes.json();
      docFiles = (data.files || []).map(mapDriveFile);
    }

    liveTree[clientName] = {
      cliente: clientName,
      driveFolderId: folder.id,
      driveFolderUrl: folder.webViewLink || `https://drive.google.com/drive/u/4/folders/${folder.id}`,
      carpetas: {
        viajeConcretado: {
          id: viajeFolder?.id,
          nombre: viajeFolder?.name || 'Viaje Concretado (Vouchers & Pasajes)',
          archivos: viajeFiles
        },
        documentacionCliente: {
          id: docFolder?.id,
          nombre: docFolder?.name || 'Documentación Cliente (DNI & Pasaportes)',
          archivos: docFiles
        }
      }
    };
  }

  localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(liveTree));
  return { connected: true, data: liveTree };
}

function mapDriveFile(file) {
  const isPdf = file.mimeType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const isImg = file.mimeType.includes('image') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.png');
  return {
    id: file.id,
    driveFileId: file.id,
    nombre: file.name,
    tipo: isPdf ? 'pdf' : isImg ? 'image' : 'file',
    tamanio: file.size ? (parseInt(file.size) / (1024 * 1024)).toFixed(1) + ' MB' : '1.0 MB',
    fechaModificacion: file.modifiedTime ? file.modifiedTime.split('T')[0] : new Date().toISOString().split('T')[0],
    categoria: isPdf ? 'Voucher' : 'Identificación',
    urlDescarga: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    icono: isPdf ? 'FileText' : 'Image'
  };
}

async function saveDbFileInGoogleDriveRest(dbPayload, parentId, accessToken) {
  const metadata = { name: 'jurefinance_db.json', parents: [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(dbPayload, null, 2)], { type: 'application/json' }));

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
}

export async function createFolderInGoogleDrive(name, parentId, accessToken) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  });
  return res.json();
}

export async function uploadFileToGoogleDrive(file, parentId, accessToken) {
  const metadata = { name: file.name, parents: [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
  return res.json();
}

export async function deleteGoogleDriveItem(fileId, accessToken) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

export async function renameGoogleDriveItem(fileId, newName, accessToken) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}
