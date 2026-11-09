/**
 * Google Apps Script - JureFinance Drive Connector (Versión 3.0 - Universal & Resiliente)
 * Carpeta Raíz: https://drive.google.com/drive/u/4/folders/19uQ5nKKN_tRw080ecqb-buUOQWqkhwka
 * ID de Carpeta: 19uQ5nKKN_tRw080ecqb-buUOQWqkhwka
 */

var ROOT_FOLDER_ID = "19uQ5nKKN_tRw080ecqb-buUOQWqkhwka";
var DB_FILE_NAME = "jurefinance_db.json";

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "listAll";
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);

    // 0. Ping de diagnóstico para verificar versión
    if (action === "ping" || action === "version") {
      return respondJson({
        success: true,
        version: "3.0",
        message: "JureFinance Drive Connector v3.0 Activo y Conectado",
        rootFolderId: ROOT_FOLDER_ID,
        timestamp: new Date().toISOString()
      });
    }

    // 1. Obtener contenido específico de una carpeta o cliente (Ultra-rápido: < 1 seg)
    if (action === "getFolderContent" || action === "getFolder" || action === "getFiles" || action === "getClient") {
      var targetFolder = resolveFolder(root, params);
      var folderData = getFolderDetailsAndFiles(targetFolder);
      return respondJson({ success: true, folder: folderData, version: "3.0" });
    }

    // 2. Obtener base de datos de cotizaciones
    if (action === "getDb") {
      var dbFiles = root.getFilesByName(DB_FILE_NAME);
      if (dbFiles.hasNext()) {
        var content = dbFiles.next().getBlob().getDataAsString();
        return respondJson({ success: true, db: JSON.parse(content) });
      }
      return respondJson({ success: true, db: null });
    }

    // 3. Listar árbol de clientes completo con archivos directos y subcarpetas
    if (action === "listAll" || action === "listTree" || action === "listFolders") {
      var clientTree = scanClientFoldersComplete(root);
      var dbData = null;
      var dbFiles = root.getFilesByName(DB_FILE_NAME);
      if (dbFiles.hasNext()) {
        try {
          dbData = JSON.parse(dbFiles.next().getBlob().getDataAsString());
        } catch (err) {}
      }

      return respondJson({
        success: true,
        version: "3.0",
        rootFolderId: ROOT_FOLDER_ID,
        clientTree: clientTree,
        db: dbData,
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

    // Fallback para getFolderContent vía POST
    if (action === "getFolderContent" || action === "getFolder") {
      var targetFolder = resolveFolder(root, data);
      var folderData = getFolderDetailsAndFiles(targetFolder);
      return respondJson({ success: true, folder: folderData, version: "3.0" });
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
 * Escanea todas las carpetas de clientes extrayendo:
 * 1. Archivos directos en la carpeta del cliente (ej: SOL JURE)
 * 2. Cualquier subcarpeta y todos sus archivos
 */
function scanClientFoldersComplete(rootFolder) {
  var tree = {};
  var folders = rootFolder.getFolders();

  while (folders.hasNext()) {
    try {
      var folder = folders.next();
      var clientName = folder.getName().trim().toUpperCase();
      var allFiles = [];
      var directFiles = [];
      var subcarpetas = [];

      // 1. Archivos directos en la raíz de la carpeta del cliente
      var files = folder.getFiles();
      while (files.hasNext()) {
        try {
          var f = files.next();
          var fObj = formatFileObject(f, folder.getName());
          directFiles.push(fObj);
          allFiles.push(fObj);
        } catch (fErr) {}
      }

      // 2. Subcarpetas y todos sus archivos
      var subs = folder.getFolders();
      while (subs.hasNext()) {
        try {
          var sub = subs.next();
          var subFiles = [];
          var sf = sub.getFiles();
          while (sf.hasNext()) {
            try {
              var fileInSub = formatFileObject(sf.next(), sub.getName());
              subFiles.push(fileInSub);
              allFiles.push(fileInSub);
            } catch (sfErr) {}
          }

          subcarpetas.push({
            id: sub.getId(),
            nombre: sub.getName(),
            url: sub.getUrl(),
            archivos: subFiles,
            cantidadArchivos: subFiles.length
          });
        } catch (subErr) {}
      }

      // Organizar categorías para compatibilidad hacia atrás
      var viajeFiles = [];
      var docFiles = [];
      for (var i = 0; i < allFiles.length; i++) {
        var itm = allFiles[i];
        if (itm.categoria.indexOf("Voucher") !== -1 || itm.tipo === "pdf") {
          viajeFiles.push(itm);
        } else {
          docFiles.push(itm);
        }
      }

      tree[clientName] = {
        cliente: clientName,
        driveFolderId: folder.getId(),
        driveFolderUrl: folder.getUrl(),
        archivos: allFiles,
        todosLosArchivos: allFiles,
        directFiles: directFiles,
        subcarpetas: subcarpetas,
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
    } catch (folderErr) {
      // Ignorar carpeta con error de permiso y continuar con las siguientes
    }
  }

  return tree;
}

/**
 * Extrae archivos y subcarpetas de cualquier carpeta dada (llamada rápida al hacer clic en un cliente)
 */
function getFolderDetailsAndFiles(folder) {
  var directFiles = [];
  var allFiles = [];
  var subcarpetas = [];

  // 1. Archivos directos en esta carpeta
  var files = folder.getFiles();
  while (files.hasNext()) {
    try {
      var f = files.next();
      var fObj = formatFileObject(f, folder.getName());
      directFiles.push(fObj);
      allFiles.push(fObj);
    } catch (fErr) {}
  }

  // 2. Subcarpetas
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    try {
      var sub = subs.next();
      var subFiles = [];
      var sf = sub.getFiles();
      while (sf.hasNext()) {
        try {
          var fileInSub = formatFileObject(sf.next(), sub.getName());
          subFiles.push(fileInSub);
          allFiles.push(fileInSub);
        } catch (sfErr) {}
      }

      subcarpetas.push({
        id: sub.getId(),
        nombre: sub.getName(),
        url: sub.getUrl(),
        archivos: subFiles,
        cantidadArchivos: subFiles.length
      });
    } catch (subErr) {}
  }

  return {
    id: folder.getId(),
    nombre: folder.getName(),
    url: folder.getUrl(),
    files: directFiles,
    directFiles: directFiles,
    archivos: allFiles,
    todosLosArchivos: allFiles,
    subfolders: subcarpetas,
    subcarpetas: subcarpetas,
    allFiles: allFiles
  };
}

function formatFileObject(f, folderName) {
  var name = f.getName();
  var mime = f.getMimeType() || "";
  var lower = name.toLowerCase();

  var isPdf = mime.indexOf("pdf") !== -1 || lower.endsWith(".pdf");
  var isImg = mime.indexOf("image") !== -1 || lower.endsWith(".jpg") || lower.endsWith(".png") || lower.endsWith(".jpeg");
  var isXls = mime.indexOf("spreadsheet") !== -1 || mime.indexOf("excel") !== -1 || lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.indexOf("cálculo") !== -1 || lower.indexOf("calculo") !== -1;
  var isDoc = mime.indexOf("word") !== -1 || mime.indexOf("document") !== -1 || lower.endsWith(".docx") || lower.endsWith(".doc");

  var tipo = isPdf ? "pdf" : isImg ? "image" : isXls ? "excel" : isDoc ? "docx" : "file";
  var icono = isPdf ? "FileText" : isImg ? "Image" : isXls ? "FileSpreadsheet" : isDoc ? "FileText" : "File";

  var categoria = "General";
  if (lower.indexOf("voucher") !== -1 || lower.indexOf("pasaje") !== -1 || lower.indexOf("aereo") !== -1 || lower.indexOf("aéreo") !== -1 || lower.indexOf("vuelo") !== -1 || lower.indexOf("ticket") !== -1 || lower.indexOf("hotel") !== -1 || lower.indexOf("reserva") !== -1 || isPdf) {
    categoria = "Voucher / Pasaje";
  } else if (lower.indexOf("dni") !== -1 || lower.indexOf("pasaporte") !== -1 || lower.indexOf("identidad") !== -1 || lower.indexOf("visa") !== -1 || lower.indexOf("foto") !== -1 || isImg) {
    categoria = "Documentación / DNI";
  } else if (isXls) {
    categoria = "Planillas / Cotizaciones";
  }

  var sizeBytes = 0;
  try {
    sizeBytes = f.getSize();
  } catch (e) {}

  var sizeFormatted = "Doc Drive";
  if (sizeBytes > 0) {
    sizeFormatted = (sizeBytes / (1024 * 1024)).toFixed(1) + " MB";
    if (sizeFormatted === "0.0 MB") {
      sizeFormatted = (sizeBytes / 1024).toFixed(0) + " KB";
    }
  }

  return {
    id: f.getId(),
    driveFileId: f.getId(),
    nombre: name,
    tipo: tipo,
    mimeType: mime,
    tamanio: sizeFormatted,
    fechaModificacion: Utilities.formatDate(f.getLastUpdated(), "GMT-3", "yyyy-MM-dd"),
    categoria: categoria,
    carpetaPadre: folderName,
    urlDescarga: f.getUrl(),
    icono: icono
  };
}

function respondJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
