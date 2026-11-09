/**
 * Google Apps Script - JureFinance Drive Connector (Versión 3.1 - Sincronización Rápida Precalculada)
 * Carpeta Raíz: https://drive.google.com/drive/u/4/folders/19uQ5nKKN_tRw080ecqb-buUOQWqkhwka
 * ID de Carpeta: 19uQ5nKKN_tRw080ecqb-buUOQWqkhwka
 *
 * NOVEDADES v3.1 (para lectura CASI INSTANTÁNEA en la web):
 *  1. buildTreeFile(): escanea TODO el Drive y guarda el resultado en el archivo
 *     "jurefinance_tree.json" en la carpeta raíz. Es el trabajo pesado (una sola vez por ciclo).
 *  2. getTree: devuelve ese archivo ya precalculado (rápido, sin escanear).
 *  3. getTreeMeta: devuelve solo la fecha de actualización del árbol (ultra ligero, para sondeo).
 *  4. setupTreeTrigger(): instala un activador en segundo plano que reconstruye el árbol
 *     automáticamente. Ejecútala UNA VEZ desde el editor (o créala a mano en "Activadores").
 *  5. Escaneo recursivo completo (todas las subcarpetas, a cualquier profundidad) y uso del
 *     Servicio Avanzado de Drive cuando está disponible (mucho más rápido) con respaldo automático.
 */

var ROOT_FOLDER_ID = "19uQ5nKKN_tRw080ecqb-buUOQWqkhwka";
var DB_FILE_NAME = "jurefinance_db.json";
var TREE_FILE_NAME = "jurefinance_tree.json";
var CONNECTOR_VERSION = "3.1";
// Intervalo del activador en segundo plano. Valores permitidos: 1, 5, 10, 15 o 30 minutos.
var TRIGGER_MINUTES = 5;

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "listAll";
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);

    // 0. Ping de diagnóstico para verificar versión
    if (action === "ping" || action === "version") {
      return respondJson({
        success: true,
        version: CONNECTOR_VERSION,
        message: "JureFinance Drive Connector v" + CONNECTOR_VERSION + " Activo y Conectado",
        rootFolderId: ROOT_FOLDER_ID,
        timestamp: new Date().toISOString()
      });
    }

    // 1. Metadatos ligeros del árbol precalculado (para sondeo barato desde la web)
    if (action === "getTreeMeta") {
      return respondJson(getTreeMeta(root));
    }

    // 2. Árbol completo precalculado (LECTURA RÁPIDA: no escanea, solo lee el archivo)
    if (action === "getTree") {
      return respondJson(getTreeFromFile(root));
    }

    // 3. Reconstruir el árbol ahora mismo (forzar refresco)
    if (action === "refreshTree") {
      var rebuild = buildTreeFile();
      return respondJson({
        success: true,
        version: CONNECTOR_VERSION,
        rebuild: rebuild,
        meta: getTreeMeta(DriveApp.getFolderById(ROOT_FOLDER_ID))
      });
    }

    // 4. Obtener contenido específico de una carpeta o cliente (lectura en vivo de una carpeta)
    if (action === "getFolderContent" || action === "getFolder" || action === "getFiles" || action === "getClient") {
      var targetFolder = resolveFolder(root, params);
      var folderData = getFolderDetailsAndFiles(targetFolder);
      return respondJson({ success: true, folder: folderData, version: CONNECTOR_VERSION });
    }

    // 5. Obtener base de datos de cotizaciones
    if (action === "getDb") {
      return respondJson({ success: true, db: readDb(root) });
    }

    // 6. Listar árbol de clientes completo (compatibilidad: escanea en vivo, más lento)
    if (action === "listAll" || action === "listTree" || action === "listFolders") {
      var clientTree = scanClientFoldersComplete(root);
      return respondJson({
        success: true,
        version: CONNECTOR_VERSION,
        rootFolderId: ROOT_FOLDER_ID,
        clientTree: clientTree,
        db: readDb(root),
        timestamp: new Date().toISOString()
      });
    }

    return respondJson({ success: false, error: "Acción no reconocida: " + action });
  } catch (error) {
    return respondJson({ success: false, error: error.toString() });
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);

    // Reconstruir el árbol precalculado
    if (action === "refreshTree" || action === "buildTree") {
      var rebuild = buildTreeFile();
      return respondJson({ success: true, version: CONNECTOR_VERSION, rebuild: rebuild, meta: getTreeMeta(DriveApp.getFolderById(ROOT_FOLDER_ID)) });
    }

    // Fallback para getFolderContent vía POST
    if (action === "getFolderContent" || action === "getFolder") {
      var targetFolder = resolveFolder(root, data);
      var folderData = getFolderDetailsAndFiles(targetFolder);
      return respondJson({ success: true, folder: folderData, version: CONNECTOR_VERSION });
    }

    // 1. Guardar base de datos
    if (action === "saveDb") {
      var dbContent = JSON.stringify(data.db, null, 2);
      var dbFiles = root.getFilesByName(DB_FILE_NAME);
      if (dbFiles.hasNext()) {
        dbFiles.next().setContent(dbContent);
      } else {
        root.createFile(DB_FILE_NAME, dbContent, "application/json");
      }
      return respondJson({ success: true, message: "Base de datos guardada en Drive" });
    }

    // 2. Crear carpeta de cliente o subcarpeta
    if (action === "createFolder" || action === "createClientFolder") {
      var parentId = data.parentId || ROOT_FOLDER_ID;
      var folderName = (data.folderName || data.clientName || "Nueva Carpeta").trim();
      var parent = DriveApp.getFolderById(parentId);
      var newFolder = parent.createFolder(folderName);

      return respondJson({
        success: true,
        folderId: newFolder.getId(),
        folderName: newFolder.getName(),
        folderUrl: newFolder.getUrl()
      });
    }

    // 3. Subir archivo a cualquier carpeta o subcarpeta por ID
    if (action === "uploadFile") {
      var targetFolder = resolveFolder(root, data);
      var decoded = Utilities.base64Decode(data.base64Content);
      var blob = Utilities.newBlob(decoded, data.mimeType || "application/octet-stream", data.fileName);
      var newFile = targetFolder.createFile(blob);

      return respondJson({
        success: true,
        fileId: newFile.getId(),
        fileName: newFile.getName(),
        fileUrl: newFile.getUrl()
      });
    }

    // 4. Eliminar archivo o carpeta
    if (action === "deleteItem") {
      var id = data.itemId;
      try {
        DriveApp.getFileById(id).setTrashed(true);
        return respondJson({ success: true, message: "Archivo movido a papelera" });
      } catch (e1) {
        DriveApp.getFolderById(id).setTrashed(true);
        return respondJson({ success: true, message: "Carpeta movida a papelera" });
      }
    }

    // 5. Renombrar archivo o carpeta
    if (action === "renameItem") {
      try {
        DriveApp.getFileById(data.itemId).setName(data.newName);
      } catch (e1) {
        DriveApp.getFolderById(data.itemId).setName(data.newName);
      }
      return respondJson({ success: true, message: "Renombrado correctamente" });
    }

    return respondJson({ success: false, error: "Acción no reconocida en POST: " + action });
  } catch (error) {
    return respondJson({ success: false, error: error.toString() });
  }
}

/* ==========================================================================
   SINCRONIZACIÓN RÁPIDA PRECALCULADA
   ========================================================================== */

/**
 * Devuelve solo los metadatos del árbol precalculado (muy ligero).
 */
function getTreeMeta(root) {
  var files = root.getFilesByName(TREE_FILE_NAME);
  if (!files.hasNext()) {
    return { success: true, exists: false, updatedAt: 0, version: CONNECTOR_VERSION };
  }
  var f = files.next();
  return {
    success: true,
    exists: true,
    updatedAt: f.getLastUpdated().getTime(),
    size: f.getSize(),
    version: CONNECTOR_VERSION
  };
}

/**
 * Devuelve el árbol completo ya precalculado. Si no existe, lo construye una vez.
 */
function getTreeFromFile(root) {
  var files = root.getFilesByName(TREE_FILE_NAME);
  if (!files.hasNext()) {
    buildTreeFile();
    files = root.getFilesByName(TREE_FILE_NAME);
    if (!files.hasNext()) {
      return { success: false, error: "No se pudo generar el árbol de Drive." };
    }
  }
  var f = files.next();
  var parsed = {};
  try {
    parsed = JSON.parse(f.getBlob().getDataAsString());
  } catch (parseErr) {
    return { success: false, error: "El árbol precalculado está dañado. Usa action=refreshTree." };
  }
  return {
    success: true,
    version: parsed.version || CONNECTOR_VERSION,
    source: "precomputed",
    updatedAt: parsed.updatedAt || "",
    updatedAtMs: f.getLastUpdated().getTime(),
    rootFolderId: ROOT_FOLDER_ID,
    clientTree: parsed.clientTree || {},
    db: readDb(root)
  };
}

/**
 * Escanea TODO el Drive y guarda el resultado en "jurefinance_tree.json".
 * Este es el trabajo pesado; se ejecuta en segundo plano con el activador.
 */
function buildTreeFile() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    return { ok: false, skipped: true, reason: "Otra actualización en curso" };
  }
  try {
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var clientTree = scanClientFoldersComplete(root);
    var payload = {
      version: CONNECTOR_VERSION,
      updatedAt: new Date().toISOString(),
      count: Object.keys(clientTree).length,
      clientTree: clientTree
    };
    var json = JSON.stringify(payload);
    var existing = root.getFilesByName(TREE_FILE_NAME);
    if (existing.hasNext()) {
      existing.next().setContent(json);
    } else {
      root.createFile(TREE_FILE_NAME, json, "application/json");
    }
    return { ok: true, updatedAt: payload.updatedAt, clientCount: payload.count, bytes: json.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Instala el activador en segundo plano que reconstruye el árbol automáticamente.
 * Ejecuta esta función UNA VEZ desde el editor de Apps Script.
 * (También puedes crearlo a mano en el menú "Activadores".)
 */
function setupTreeTrigger() {
  var allowed = [1, 5, 10, 15, 30];
  var minutes = allowed.indexOf(TRIGGER_MINUTES) !== -1 ? TRIGGER_MINUTES : 5;

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildTreeFile") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("buildTreeFile").timeBased().everyMinutes(minutes).create();

  // Construir de inmediato la primera vez para que la web ya tenga datos.
  var first = buildTreeFile();

  return { ok: true, intervalMinutes: minutes, firstBuild: first };
}

function readDb(root) {
  try {
    var dbFiles = root.getFilesByName(DB_FILE_NAME);
    if (dbFiles.hasNext()) {
      return JSON.parse(dbFiles.next().getBlob().getDataAsString());
    }
  } catch (e) {}
  return null;
}

/* ==========================================================================
   RESOLUCIÓN Y ESCANEO DE CARPETAS
   ========================================================================== */

/**
 * Resuelve una carpeta por folderId, id, clientName o nombre
 */
function resolveFolder(root, params) {
  var targetFolderId = params.folderId || params.id;
  if (targetFolderId && targetFolderId !== ROOT_FOLDER_ID) {
    try {
      return DriveApp.getFolderById(targetFolderId);
    } catch (e) {}
  }

  var cName = (params.clientName || params.client || params.cliente || params.folderName || "").trim();
  if (cName) {
    var directMatches = root.getFoldersByName(cName);
    if (directMatches.hasNext()) {
      return directMatches.next();
    }
    // Búsqueda insensible a mayúsculas/minúsculas
    var allFolders = root.getFolders();
    var upperTarget = cName.toUpperCase();
    while (allFolders.hasNext()) {
      var f = allFolders.next();
      if (f.getName().trim().toUpperCase() === upperTarget) {
        return f;
      }
    }
  }

  return root;
}

/**
 * Escanea todas las carpetas de clientes de la raíz.
 */
function scanClientFoldersComplete(rootFolder) {
  var tree = {};
  var folders = rootFolder.getFolders();

  while (folders.hasNext()) {
    try {
      var folder = folders.next();
      var clientName = folder.getName().trim().toUpperCase();
      var scanned = scanFolderComplete(folder);
      tree[clientName] = buildClientNode(clientName, folder, scanned);
    } catch (folderErr) {
      // Ignorar carpeta con error y continuar con las siguientes
    }
  }

  return tree;
}

/**
 * Escanea una carpeta de forma RECURSIVA (todas las subcarpetas a cualquier profundidad).
 * Usa el Servicio Avanzado de Drive si está disponible (más rápido); si no, DriveApp.
 */
function scanFolderComplete(folder) {
  if (driveApiAvailable()) {
    try {
      var viaApi = scanFolderWithApi(folder.getId());
      if (viaApi) {
        return viaApi;
      }
    } catch (apiErr) {
      // Si falla el servicio avanzado, continuar con DriveApp
    }
  }
  return scanFolderWithDriveApp(folder);
}

/**
 * Escaneo recursivo usando DriveApp (siempre disponible).
 */
function scanFolderWithDriveApp(folder) {
  var directFiles = [];
  var subcarpetas = [];
  var allFiles = [];

  var files = folder.getFiles();
  while (files.hasNext()) {
    try {
      var f = files.next();
      var fObj = formatFileObject(f, folder.getName());
      directFiles.push(fObj);
      allFiles.push(fObj);
    } catch (fErr) {}
  }

  var subs = folder.getFolders();
  while (subs.hasNext()) {
    try {
      var sub = subs.next();
      var subScan = scanFolderWithDriveApp(sub);
      subcarpetas.push({
        id: sub.getId(),
        nombre: sub.getName(),
        url: sub.getUrl(),
        archivos: subScan.allFiles,
        subcarpetas: subScan.subcarpetas,
        cantidadArchivos: subScan.allFiles.length
      });
      allFiles = allFiles.concat(subScan.allFiles);
    } catch (subErr) {}
  }

  return { directFiles: directFiles, subcarpetas: subcarpetas, allFiles: allFiles };
}

/**
 * ¿Está disponible el Servicio Avanzado de Drive?
 */
function driveApiAvailable() {
  try {
    return typeof Drive !== "undefined" && Drive.Files && typeof Drive.Files.list === "function";
  } catch (e) {
    return false;
  }
}

/**
 * Lista los hijos de una carpeta usando el Servicio Avanzado de Drive.
 * Soporta tanto la versión 2 como la versión 3 del servicio.
 */
function driveListChildren(folderId, foldersOnly) {
  var mimeFilter = foldersOnly ? " and mimeType = 'application/vnd.google-apps.folder'" : "";
  var q = "'" + folderId + "' in parents and trashed = false" + mimeFilter;
  var out = [];
  var i;

  // Primero intentar con la API v2 (items/title)
  try {
    var token = null;
    do {
      var res = Drive.Files.list({
        q: q,
        maxResults: 1000,
        pageToken: token,
        fields: "nextPageToken,items(id,title,mimeType,fileSize,modifiedDate,alternateLink)"
      });
      var items = res.items || [];
      for (i = 0; i < items.length; i++) {
        out.push({
          id: items[i].id,
          name: items[i].title,
          mime: items[i].mimeType,
          size: items[i].fileSize,
          modified: items[i].modifiedDate,
          link: items[i].alternateLink
        });
      }
      token = res.nextPageToken;
    } while (token);
    return out;
  } catch (e2) {
    // Si falla, intentar con la API v3 (files/name)
    out = [];
    var token3 = null;
    do {
      var res3 = Drive.Files.list({
        q: q,
        pageSize: 1000,
        pageToken: token3,
        fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)"
      });
      var files3 = res3.files || [];
      for (i = 0; i < files3.length; i++) {
        out.push({
          id: files3[i].id,
          name: files3[i].name,
          mime: files3[i].mimeType,
          size: files3[i].size,
          modified: files3[i].modifiedTime,
          link: files3[i].webViewLink
        });
      }
      token3 = res3.nextPageToken;
    } while (token3);
    return out;
  }
}

/**
 * Escaneo recursivo usando el Servicio Avanzado de Drive (rápido).
 */
function scanFolderWithApi(folderId) {
  var children = driveListChildren(folderId, false);
  var directFiles = [];
  var subcarpetas = [];
  var allFiles = [];

  for (var i = 0; i < children.length; i++) {
    var ch = children[i];
    if (ch.mime === "application/vnd.google-apps.folder") {
      var subScan = scanFolderWithApi(ch.id);
      subcarpetas.push({
        id: ch.id,
        nombre: ch.name,
        url: ch.link,
        archivos: subScan.allFiles,
        subcarpetas: subScan.subcarpetas,
        cantidadArchivos: subScan.allFiles.length
      });
      allFiles = allFiles.concat(subScan.allFiles);
    } else {
      var fObj = formatApiFile(ch);
      directFiles.push(fObj);
      allFiles.push(fObj);
    }
  }

  return { directFiles: directFiles, subcarpetas: subcarpetas, allFiles: allFiles };
}

/**
 * Construye el nodo final de un cliente a partir de su escaneo.
 */
function buildClientNode(clientName, folder, scanned) {
  var allFiles = scanned.allFiles || [];
  var viajeFiles = [];
  var docFiles = [];

  for (var i = 0; i < allFiles.length; i++) {
    var itm = allFiles[i];
    if ((itm.categoria && itm.categoria.indexOf("Voucher") !== -1) || itm.tipo === "pdf") {
      viajeFiles.push(itm);
    } else {
      docFiles.push(itm);
    }
  }

  return {
    cliente: clientName,
    driveFolderId: folder.getId(),
    driveFolderUrl: folder.getUrl(),
    archivos: allFiles,
    todosLosArchivos: allFiles,
    directFiles: scanned.directFiles || [],
    subcarpetas: scanned.subcarpetas || [],
    carpetas: {
      viajeConcretado: {
        nombre: "Viaje Concretado (Vouchers & Pasajes)",
        archivos: viajeFiles
      },
      documentacionCliente: {
        nombre: "Documentación Cliente (DNI & Pasaportes)",
        archivos: docFiles
      }
    }
  };
}

/**
 * Extrae archivos y subcarpetas de cualquier carpeta dada (lectura en vivo de una carpeta).
 */
function getFolderDetailsAndFiles(folder) {
  var scanned = scanFolderComplete(folder);

  return {
    id: folder.getId(),
    nombre: folder.getName(),
    url: folder.getUrl(),
    files: scanned.directFiles,
    directFiles: scanned.directFiles,
    archivos: scanned.allFiles,
    todosLosArchivos: scanned.allFiles,
    subfolders: scanned.subcarpetas,
    subcarpetas: scanned.subcarpetas,
    allFiles: scanned.allFiles
  };
}

/* ==========================================================================
   CLASIFICACIÓN Y FORMATEO DE ARCHIVOS
   ========================================================================== */

function classifyFile(lower, isPdf, isImg, isXls) {
  if (lower.indexOf("voucher") !== -1 || lower.indexOf("pasaje") !== -1 || lower.indexOf("aereo") !== -1 || lower.indexOf("aéreo") !== -1 || lower.indexOf("vuelo") !== -1 || lower.indexOf("ticket") !== -1 || lower.indexOf("hotel") !== -1 || lower.indexOf("reserva") !== -1 || isPdf) {
    return "Voucher / Pasaje";
  }
  if (lower.indexOf("dni") !== -1 || lower.indexOf("pasaporte") !== -1 || lower.indexOf("identidad") !== -1 || lower.indexOf("visa") !== -1 || lower.indexOf("foto") !== -1 || isImg) {
    return "Documentación / DNI";
  }
  if (isXls) {
    return "Planillas / Cotizaciones";
  }
  return "General";
}

function fileFlags(name, mime) {
  var lower = (name || "").toLowerCase();
  var m = mime || "";
  var isPdf = m.indexOf("pdf") !== -1 || lower.endsWith(".pdf");
  var isImg = m.indexOf("image") !== -1 || lower.endsWith(".jpg") || lower.endsWith(".png") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
  var isXls = m.indexOf("spreadsheet") !== -1 || m.indexOf("excel") !== -1 || lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.indexOf("cálculo") !== -1 || lower.indexOf("calculo") !== -1;
  var isDoc = m.indexOf("word") !== -1 || m.indexOf("document") !== -1 || lower.endsWith(".docx") || lower.endsWith(".doc");
  return { lower: lower, isPdf: isPdf, isImg: isImg, isXls: isXls, isDoc: isDoc };
}

function tipoFromFlags(flags) {
  return flags.isPdf ? "pdf" : flags.isImg ? "image" : flags.isXls ? "excel" : flags.isDoc ? "docx" : "file";
}

function iconoFromTipo(tipo) {
  return tipo === "pdf" ? "FileText" : tipo === "image" ? "Image" : tipo === "excel" ? "FileSpreadsheet" : tipo === "docx" ? "FileText" : "File";
}

/**
 * Formatea un archivo de DriveApp.
 */
function formatFileObject(f, folderName) {
  var name = f.getName();
  var mime = f.getMimeType() || "";
  var flags = fileFlags(name, mime);
  var tipo = tipoFromFlags(flags);

  var sizeBytes = 0;
  try {
    sizeBytes = f.getSize();
  } catch (e) {}

  return {
    id: f.getId(),
    driveFileId: f.getId(),
    nombre: name,
    tipo: tipo,
    mimeType: mime,
    tamanio: formatSize(sizeBytes),
    fechaModificacion: Utilities.formatDate(f.getLastUpdated(), "GMT-3", "yyyy-MM-dd"),
    categoria: classifyFile(flags.lower, flags.isPdf, flags.isImg, flags.isXls),
    carpetaPadre: folderName,
    urlDescarga: f.getUrl(),
    icono: iconoFromTipo(tipo)
  };
}

/**
 * Formatea un archivo proveniente del Servicio Avanzado de Drive.
 */
function formatApiFile(ch) {
  var name = ch.name || "(sin nombre)";
  var mime = ch.mime || "";
  var flags = fileFlags(name, mime);
  var tipo = tipoFromFlags(flags);
  var sizeBytes = parseInt(ch.size, 10) || 0;

  var fecha = "";
  try {
    fecha = ch.modified ? Utilities.formatDate(new Date(ch.modified), "GMT-3", "yyyy-MM-dd") : "";
  } catch (e) {}
  if (!fecha) {
    fecha = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  }

  return {
    id: ch.id,
    driveFileId: ch.id,
    nombre: name,
    tipo: tipo,
    mimeType: mime,
    tamanio: formatSize(sizeBytes),
    fechaModificacion: fecha,
    categoria: classifyFile(flags.lower, flags.isPdf, flags.isImg, flags.isXls),
    carpetaPadre: "",
    urlDescarga: ch.link || ("https://drive.google.com/file/d/" + ch.id + "/view"),
    icono: iconoFromTipo(tipo)
  };
}

function formatSize(sizeBytes) {
  if (!sizeBytes || sizeBytes <= 0) {
    return "Doc Drive";
  }
  var mb = (sizeBytes / (1024 * 1024)).toFixed(1);
  if (mb === "0.0") {
    return (sizeBytes / 1024).toFixed(0) + " KB";
  }
  return mb + " MB";
}

function respondJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
