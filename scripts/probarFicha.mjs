// Smoke test de la Ficha del Viaje: la abre desde el Historial, recorre sus
// pestañas y comprueba que muestre los datos, los cobros, los pagos y los
// documentos sin excepciones de JS.
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PUERTO_APP = 5174
const PUERTO_CDP = 9224
const URL_APP = `http://127.0.0.1:${PUERTO_APP}`
const PERFIL = join(RAIZ, '.tmp-ficha-profile')

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

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pendientes = new Map()
    this.excepciones = []
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

  async esperar(selector, timeoutMs = 20000) {
    const inicio = Date.now()
    while (Date.now() - inicio < timeoutMs) {
      const listo = await this.evaluar(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
      if (listo) return true
      await dormir(200)
    }
    return false
  }
}

const resultados = []
function chequear(nombre, cond, detalle = '') {
  resultados.push({ nombre, ok: Boolean(cond), detalle })
  console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${cond ? '' : '  ' + detalle}`)
}

let devServer = null
let chrome = null

try {
  devServer = await asegurarDevServer()
  try { rmSync(PERFIL, { recursive: true, force: true }) } catch {}

  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions',
    `--remote-debugging-port=${PUERTO_CDP}`,
    `--user-data-dir=${PERFIL}`, 'about:blank'
  ], { stdio: 'ignore' })

  await esperarDebugger()
  const res = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/new?${encodeURIComponent(URL_APP)}`, { method: 'PUT' })
  const pestania = await res.json()
  const ws = new WebSocket(pestania.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('No se pudo abrir WebSocket CDP')), { once: true })
  })
  const cdp = new CDP(ws)
  await cdp.enviar('Runtime.enable')
  await cdp.enviar('Page.enable')

  chequear('la app monta (espera por selector)', await cdp.esperar('.app-container'))
  await dormir(500)

  chequear('abre el Historial', await cdp.clickPorTexto('Historial de Cotizaciones'))
  await dormir(900)
  chequear('hay cotizaciones con botón Ver ficha', await cdp.evaluar(
    `[...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('Ver ficha'))`
  ))

  const abrio = await cdp.clickPorTexto('Ver ficha')
  await dormir(1000)
  chequear('se abre la Ficha del Viaje', abrio && await cdp.esperar('.jf-ficha'))
  const textoFicha = await cdp.texto()
  chequear(
    'muestra la franja de números',
    /venta al cliente/i.test(textoFicha) && /ganancia real/i.test(textoFicha) && /estado de cobro/i.test(textoFicha),
    JSON.stringify(textoFicha.slice(0, 260))
  )
  chequear('muestra la pestaña Datos', /Servicios del viaje/.test(textoFicha))

  chequear('abre la pestaña Cobros', await cdp.clickPorTexto('Cobros', '.jf-ficha button'))
  await dormir(500)
  const textoCobros = await cdp.texto()
  chequear('muestra la fecha de cobro', /Próxima fecha de cobro/.test(textoCobros))
  chequear('muestra el botón Cobrar', /Cobrar/.test(textoCobros))

  const abrioCobro = await cdp.clickPorTexto('Cobrar', '.jf-ficha button')
  await dormir(700)
  chequear('abre el modal de cobro ya precargado', abrioCobro && /Registrar cobro del cliente/.test(await cdp.texto()))
  const cerroCobro = await cdp.evaluar(`
    (() => {
      const botones = [...document.querySelectorAll('.modal-backdrop .modal-close-btn')];
      const ultimo = botones[botones.length - 1];
      if (!ultimo) return false;
      ultimo.click();
      return true;
    })()
  `)
  await dormir(400)
  const sigueAbierta = await cdp.evaluar(`Boolean(document.querySelector('.jf-ficha'))`)
  chequear('cierra el modal sin cerrar la ficha', cerroCobro && sigueAbierta)

  chequear('abre la pestaña Pagos a proveedores', await cdp.clickPorTexto('Pagos a proveedores', '.jf-ficha button'))
  await dormir(500)
  const textoPagos = await cdp.texto()
  chequear('muestra la explicación de pagos', /debe pagar a cada proveedor/.test(textoPagos))

  chequear('abre la pestaña Documentos', await cdp.clickPorTexto('Documentos', '.jf-ficha button'))
  await dormir(600)
  const textoDocs = await cdp.texto()
  chequear('muestra los documentos de Drive', /Documentos de/.test(textoDocs) && /Abrir carpeta en Drive/.test(textoDocs))

  chequear('abre Resumen interno', await cdp.clickPorTexto('Resumen interno', '.jf-ficha button'))
  await dormir(400)
  chequear('ofrece el resumen imprimible', /Abrir resumen imprimible/.test(await cdp.texto()))

  const cerro = await cdp.evaluar(`
    (() => {
      const btn = document.querySelector('.jf-ficha .modal-close-btn');
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `)
  await dormir(500)
  chequear('cierra y vuelve al módulo de origen', cerro && !(await cdp.esperar('.jf-ficha', 1000)))
  chequear('sin excepciones de JS', cdp.excepciones.length === 0, cdp.excepciones.join(' | '))

  const fallas = resultados.filter((r) => !r.ok)
  console.log(`\n${fallas.length === 0 ? 'TODO OK' : `FALLAS: ${fallas.length}`} (${resultados.length} chequeos)`)
  process.exitCode = fallas.length === 0 ? 0 : 1
} catch (error) {
  console.error('ERROR:', error.message)
  process.exitCode = 1
} finally {
  if (chrome) chrome.kill()
  await dormir(1200)
  if (devServer) devServer.kill()
  try { rmSync(PERFIL, { recursive: true, force: true }) } catch {}
}
