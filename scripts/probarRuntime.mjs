// Smoke test de runtime del módulo BCP (y de la navegación principal).
//
// Levanta el dev server si hace falta, abre la app en Chrome headless vía CDP,
// recorre todos los módulos y verifica que rendericen sin excepciones de JS.
// También ejercita las acciones nuevas: cargar vuelos de ejemplo, generar
// bloques BCP y el reporte de flujo de caja.
//
// Uso: npm run test:runtime
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PUERTO_APP = 5174
const PUERTO_CDP = 9223
const URL_APP = `http://127.0.0.1:${PUERTO_APP}`
const PERFIL = join(RAIZ, '.tmp-runtime-profile')

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function estaArriba(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

async function asegurarDevServer() {
  if (await estaArriba(URL_APP)) return null
  const vite = spawn(
    process.execPath,
    [join(RAIZ, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(PUERTO_APP), '--strictPort'],
    { cwd: RAIZ, stdio: 'ignore' }
  )
  for (let i = 0; i < 80; i++) {
    if (await estaArriba(URL_APP)) return vite
    await dormir(250)
  }
  vite.kill()
  throw new Error('El dev server no arrancó')
}

async function esperarDebugger() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`)
      if (res.ok) return await res.json()
    } catch {}
    await dormir(250)
  }
  throw new Error('Chrome no expuso el puerto de depuración')
}

async function nuevaPestania(url) {
  const res = await fetch(
    `http://127.0.0.1:${PUERTO_CDP}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' }
  )
  if (!res.ok) throw new Error('No se pudo crear la pestaña: ' + res.status)
  return res.json()
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pendientes = new Map()
    this.excepciones = []
    this.consola = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pendientes.has(msg.id)) {
        const { resolve, reject } = this.pendientes.get(msg.id)
        this.pendientes.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
        return
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails
        this.excepciones.push(d.exception?.description || d.text || 'excepción sin detalle')
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consola.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
      }
      // Acepta los confirm() de la UI para poder probar acciones destructivas.
      if (msg.method === 'Page.javascriptDialogOpening') {
        this.enviar('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
      }
    })
  }

  enviar(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pendientes.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluar(expresion) {
    const r = await this.enviar('Runtime.evaluate', {
      expression: expresion,
      awaitPromise: true,
      returnByValue: true
    })
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    }
    return r.result?.value
  }

  async texto() {
    return (await this.evaluar('document.body.innerText')) || ''
  }

  async clickPorTexto(texto, selector = 'button') {
    return this.evaluar(`
      (() => {
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((x) => (x.textContent || '').toLowerCase().includes(${JSON.stringify(String(texto).toLowerCase())}));
        if (el) el.click();
        return Boolean(el);
      })()
    `)
  }

  async clickPorTitle(title) {
    return this.evaluar(`
      (() => {
        const el = [...document.querySelectorAll('button')]
          .find((x) => (x.title || '').toLowerCase().includes(${JSON.stringify(String(title).toLowerCase())}));
        if (el) el.click();
        return Boolean(el);
      })()
    `)
  }
}

async function conectar(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('No se pudo abrir el WebSocket CDP')), { once: true })
  })
  const cdp = new CDP(ws)
  await cdp.enviar('Runtime.enable')
  await cdp.enviar('Page.enable')
  return cdp
}

const resultados = []
function chequear(nombre, cond, detalle = '') {
  resultados.push({ nombre, ok: Boolean(cond), detalle })
  console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${cond ? '' : '  ' + detalle}`)
}

const MODULOS = [
  'Cotizador de Viajes',
  'Historial de Cotizaciones',
  'Expedientes & Drive',
  'Calendario de Pagos',
  'Calendario de Cobros',
  'Métricas & Ganancias',
  'Configuración Mensual TTOs',
  'Proveedores TTOO'
]

let devServer = null
let chrome = null

try {
  devServer = await asegurarDevServer()

  rmSync(PERFIL, { recursive: true, force: true })
  chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PUERTO_CDP}`,
    `--user-data-dir=${PERFIL}`,
    'about:blank'
  ], { stdio: 'ignore' })

  await esperarDebugger()
  const pestania = await nuevaPestania(URL_APP)
  const cdp = await conectar(pestania.webSocketDebuggerUrl)

  await dormir(4000)
  const inicio = await cdp.texto()
  chequear('la app monta el layout', /JureFinance/.test(inicio), inicio.slice(0, 200))
  chequear('el menú lateral está presente', /Calendario de Pagos/.test(inicio))

  // Recorre todos los módulos: cada uno debe renderizar sin excepciones.
  for (const modulo of MODULOS) {
    const clickeado = await cdp.clickPorTexto(modulo)
    await dormir(900)
    const texto = await cdp.texto()
    const excepcionesAntes = cdp.excepciones.length
    chequear(
      `módulo "${modulo}" renderiza`,
      clickeado && texto.length > 150 && excepcionesAntes === 0,
      excepcionesAntes ? cdp.excepciones.join(' | ') : `click=${clickeado} len=${texto.length}`
    )
  }

  // Módulo BCP: reporte de flujo de caja + carga de ejemplo.
  await cdp.clickPorTexto('Calendario de Pagos')
  await dormir(900)
  const pagos = await cdp.texto()
  chequear('abre el reporte de flujo de caja BCP', /flujo de caja por día de vencimiento/i.test(pagos))
  chequear('muestra el total general del período', /total general/i.test(pagos))
  chequear('separa los totales por moneda', /usd/i.test(pagos))

  const excepcionesAntesDemo = cdp.excepciones.length
  const clickDemo = await cdp.clickPorTexto('cargar ejemplo')
  await dormir(1500)
  chequear(
    'cargar vuelos de ejemplo no rompe',
    clickDemo && cdp.excepciones.length === excepcionesAntesDemo,
    cdp.excepciones.join(' | ')
  )

  // Configuración BCP: generar bloques por regla.
  await cdp.clickPorTexto('Configuración Mensual TTOs')
  await dormir(900)
  const configTexto = await cdp.texto()
  chequear('abre la configuración mensual BCP', /cobertura de/i.test(configTexto))
  chequear('muestra los bloques de emisión', /emisiones del/i.test(configTexto))

  const siguiente = await cdp.clickPorTitle('mes siguiente')
  await dormir(800)
  const configSiguiente = await cdp.texto()
  chequear('cambia de mes en la configuración', siguiente && configSiguiente !== configTexto)

  const excepcionesAntesGenerar = cdp.excepciones.length
  const clickGenerar = await cdp.clickPorTexto('generar bloques')
  await dormir(1200)
  const trasGenerar = await cdp.texto()
  chequear(
    'generar bloques por regla funciona',
    clickGenerar && cdp.excepciones.length === excepcionesAntesGenerar && /cobertura de/i.test(trasGenerar),
    cdp.excepciones.join(' | ')
  )

  // Vista de liquidaciones: registrar el pago consolidado de un bloque y
  // comprobar que se persista en localStorage (ejercita persistDb de App.jsx).
  await cdp.clickPorTexto('Calendario de Pagos')
  await dormir(900)
  const excepcionesAntesPago = cdp.excepciones.length
  const abrioPago = await cdp.clickPorTexto('pagar bloque')
  await dormir(700)
  const abrioModal = await cdp.evaluar(`Boolean(document.querySelector('.modal-content'))`)
  chequear('abre el pago consolidado del bloque', abrioPago && abrioModal)

  // El botón de confirmar vive dentro del modal; hay botones parecidos en la
  // tabla de fondo, así que se busca solo dentro del modal.
  const registrado = await cdp.evaluar(`
    (() => {
      const el = [...document.querySelectorAll('.modal-content button')]
        .find((x) => (x.textContent || '').toLowerCase().includes('registrar pago del bloque'));
      if (!el || el.disabled) return false;
      el.click();
      return true;
    })()
  `)
  await dormir(1200)
  const postPago = await cdp.evaluar(`
    (() => {
      try {
        const raw = localStorage.getItem('jurefinance_pagos_ttoo_v1');
        const lista = raw ? JSON.parse(raw) : [];
        return {
          modal: Boolean(document.querySelector('.modal-content')),
          pagos: Array.isArray(lista) ? lista.length : -1
        };
      } catch {
        return { modal: false, pagos: -2 };
      }
    })()
  `)
  chequear(
    'registra el pago del bloque sin romper',
    registrado && !postPago.modal && cdp.excepciones.length === excepcionesAntesPago,
    cdp.excepciones.join(' | ')
  )
  chequear('el pago queda persistido', postPago.pagos > 0, `registros=${postPago.pagos}`)

  chequear('sin excepciones de JS', cdp.excepciones.length === 0, cdp.excepciones.join(' | '))
  chequear('sin errores en consola', cdp.consola.length === 0, cdp.consola.join(' | '))

  const fallas = resultados.filter((r) => !r.ok)
  console.log(`\n${fallas.length === 0 ? 'TODO OK' : `FALLAS: ${fallas.length}`} (${resultados.length} chequeos)`)
  process.exitCode = fallas.length === 0 ? 0 : 1
} catch (error) {
  console.error('ERROR:', error.message)
  process.exitCode = 1
} finally {
  if (chrome) chrome.kill()
  await dormir(1200)
  try {
    rmSync(PERFIL, { recursive: true, force: true })
  } catch {
    // Windows puede mantener el perfil bloqueado unos segundos; no afecta la prueba.
  }
  if (devServer) devServer.kill()
}
