# Guía de despliegue — Conector JureFinance v3.1 (sincronización casi instantánea)

Esta guía explica cómo actualizar el conector de Google Apps Script a la **versión 3.1**.
Con ella, la web lee el árbol de Drive **casi al instante** y detecta archivos directos y
subcarpetas a cualquier profundidad.

> La web ya funciona con el conector v3.0 actual, pero **cada lectura tarda ~3 minutos**.
> Con la v3.1 el trabajo pesado se hace en segundo plano y la web solo lee un archivo ya listo.

---

## ¿Qué hace la versión 3.1?

1. **`buildTreeFile()`**: escanea *todo* el Drive y guarda el resultado en el archivo
   `jurefinance_tree.json` dentro de la carpeta raíz. Es el trabajo pesado (una vez por ciclo).
2. **`getTree`**: devuelve ese archivo ya precalculado (lectura rápida, sin escanear).
3. **`getTreeMeta`**: devuelve solo la fecha de actualización (ultra ligero; la web lo usa para
   saber si algo cambió antes de descargar el árbol completo).
4. **`setupTreeTrigger()`**: instala un activador en segundo plano que reconstruye el árbol
   automáticamente (por defecto, cada **5 minutos**).
5. **Escaneo recursivo completo** (todas las subcarpetas) y uso del **Servicio Avanzado de Drive**
   cuando está disponible (mucho más rápido), con respaldo automático a DriveApp.

---

## Pasos

### 1. Abrir el editor
Entra en <https://script.google.com> con la cuenta **juretravel.com** y abre el proyecto
del conector (el que ya está implementado).

### 2. Pegar el código nuevo
- Abre el archivo `Code.gs`.
- Borra todo el contenido.
- Pega el contenido de `google-apps-script/Code.gs` de este repositorio
  (o usa el botón **“Copiar Código Code.gs v3.1”** dentro de la web, en *Configuración de Drive*).
- Guarda (`Ctrl + S`).

### 3. Publicar una nueva versión
- Arriba a la derecha: **Implementar** ➔ **Administrar implementaciones**.
- En la implementación existente, haz clic en el **lápiz (Editar)** ✏️.
- En **Versión**, selecciona **“Nueva versión”**.
- En **Quién tiene acceso**, elige **“Cualquier usuario”**.
- Clic en **Implementar**.
- **Importante:** la URL `/exec` **no cambia**. No hace falta tocar nada en la web.

### 4. Activar el activador automático (recomendado)
- En el editor, en el selector de funciones (arriba), elige **`setupTreeTrigger`**.
- Pulsa **Ejecutar** ▶️ (una sola vez).
- La primera vez te pedirá autorizar permisos de Drive: acéptalos.
- Esto hace dos cosas: construye el árbol por primera vez (puede tardar) e instala el activador
  para que se reconstruya solo cada 5 minutos.

> Si prefieres no usar el activador, la web seguirá funcionando: la primera llamada a `getTree`
> construye el archivo y a partir de ahí las lecturas son rápidas. Pero el árbol solo se
> refrescará cuando alguien lo pida, no automáticamente.

### 5. (Opcional) Escaneo ultrarrápido con el Servicio Avanzado de Drive
El código detecta automáticamente si el **Servicio Avanzado de Drive** está activo. Si lo activas,
el escaneo pasa de ~3 minutos a unos pocos segundos:
- En el editor: **Servicios** ➕ (barra lateral izquierda).
- Busca **Drive API**, elige la versión disponible y añádela.
- Guarda. No hay que cambiar nada en el código.

Si no lo activas, el conector funciona igual usando DriveApp (solo más lento en segundo plano).

---

## Ajustar la frecuencia del activador

En `Code.gs`, arriba del todo:

```js
var TRIGGER_MINUTES = 5; // valores permitidos: 1, 5, 10, 15 o 30
```

- Cambia el valor y vuelve a ejecutar `setupTreeTrigger` para aplicarlo.
- **1** = actualización casi en tiempo real (consume más cuota diaria de Apps Script).
- **5** = valor recomendado para juretravel.com.
- **15/30** = si notas que se agota la cuota.

> La web, además, refresca la carpeta que estás viendo en vivo (acción `getFolderContent`), así que
> el contenido del cliente abierto siempre está al día aunque el árbol global tarde unos minutos.

---

## Comprobar que funcionó

En el navegador, abre esta URL (tu URL `/exec` del conector) cambiando `ACTION`:

| URL | Qué debe devolver |
| --- | --- |
| `.../exec?action=ping` | `"version":"3.1"` |
| `.../exec?action=getTreeMeta` | `{"success":true,"exists":true,"updatedAt":...}` |
| `.../exec?action=getTree` | `{"success":true,"source":"precomputed",...}` (rápido) |

Si `getTreeMeta` responde `"Acción no reconocida"`, es que aún no se ha publicado la v3.1 (revisa el paso 3).

---

## Cuota de Apps Script

Apps Script limita el tiempo total de ejecución de los activadores al día. Para cuentas de
Google Workspace (juretravel.com) el límite es holgado, pero si lo superas verás errores en
**Ejecuciones**. En ese caso, sube `TRIGGER_MINUTES` a 10, 15 o 30 y vuelve a ejecutar
`setupTreeTrigger`.

---

## Resumen del flujo

```
Activador (cada 5 min)
      └─> buildTreeFile()  ──> escribe jurefinance_tree.json (trabajo pesado, 1 vez)
                                        │
Web (cada 60 s)                         │
      ├─> getTreeMeta()  ──> "¿cambió?" ┘ (respuesta diminuta)
      └─> getTree()      ──> solo si cambió (lectura rápida del archivo)
```
