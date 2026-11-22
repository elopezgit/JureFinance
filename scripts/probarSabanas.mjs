// Smoke test del cotizador por sabanas: carga dos sabanas, arma un set mixto,
// aplica el porcentaje, guarda y verifica la Comparación en la Ficha del Viaje.
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PUERTO_APP = 5174
const PUERTO_CDP = 9225
const URL_APP = `http://127.0.0.1:${PUERTO_APP}`
const PERFIL = join(RAIZ, '.tmp-sabanas-profile')

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

  async esperar(selector, timeoutMs = 20000) {
    const inicio = Date.now()
    while (Date.now() - inicio < timeoutMs) {
      const listo = await this.evaluar(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
      if (listo) return true
      await dormir(200)
    }
    return false
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

  async clickTestid(testid) {
    return this.evaluar(`
      (() => {
        const el = document.querySelector('[data-testid="${testid}"]');
        if (!el) return false;
        el.click();
        return true;
      })()
    `)
  }

  async clickOpcion(proveedor, tipo) {
    return this.evaluar(`
      (() => {
        const el = document.querySelector('[data-testid="sab-opcion"][data-proveedor="${proveedor}"][data-tipo="${tipo}"]');
        if (!el) return false;
        el.click();
        return true;
      })()
    `)
  }

  async setValor(testid, valor) {
    return this.evaluar(`
      (() => {
        const el = document.querySelector('[data-testid="${testid}"]');
        if (!el) return false;
        const proto = el.tagName === 'SELECT'
          ? HTMLSelectElement.prototype
          : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, ${JSON.stringify(String(valor))});
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
        return true;
      })()
    `)
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

  chequear('la app monta', await cdp.esperar('.app-container'))
  chequear('el cotizador arranca en el paso de sabanas', /Sabanas por proveedor/i.test(await cdp.texto()))
  chequear('carga el cliente', await cdp.setValor('sab-cliente', 'CLIENTE PRUEBA SABANAS'))
  await dormir(150)

  // Sabana de Aero: solo vuelo.
  chequear('agrega Aero', await cdp.clickTestid('sab-proveedor-aero'))
  await dormir(150)
  chequear('Aero solo ofrece agregar Vuelo', await cdp.clickTestid('sab-agregar-aero-aereo'))
  await dormir(150)
  chequear('carga el precio del vuelo en Aero', await cdp.setValor('sab-monto-aero-aereo', '1900'))
  await dormir(150)

  // Sabana de Azabache: vuelo + hotel + traslado.
  chequear('agrega Azabache', await cdp.clickTestid('sab-proveedor-azabache'))
  await dormir(150)
  for (const [tipo, monto] of [['aereo', '2200'], ['hotel', '1500'], ['traslados', '100']]) {
    const agrego = await cdp.clickTestid(`sab-agregar-azabache-${tipo}`)
    await dormir(150)
    const cargo = await cdp.setValor(`sab-monto-azabache-${tipo}`, monto)
    await dormir(150)
    chequear(`carga ${tipo} en Azabache`, agrego && cargo)
  }

  // Paso 2: set mixto (vuelo de Aero, resto de Azabache).
  chequear('pasa a "Armar mi set"', await cdp.clickTestid('sab-paso1-siguiente'))
  await dormir(500)
  const textoSet = await cdp.texto()
  chequear('muestra los precios de ambos proveedores', /Armar mi set/i.test(textoSet) && /2\.200/.test(textoSet) && /1\.900/.test(textoSet))
  chequear('el vuelo más bajo está marcado como pista', /menor precio/i.test(textoSet))
  chequear('elige el vuelo de Aero', await cdp.clickOpcion('aero', 'aereo'))
  await dormir(200)
  chequear('elige el hotel de Azabache', await cdp.clickOpcion('azabache', 'hotel'))
  await dormir(200)
  chequear('elige el traslado de Azabache', await cdp.clickOpcion('azabache', 'traslados'))
  await dormir(200)
  chequear('calcula el costo del set', /3\.500/.test(await cdp.texto()))

  // Paso 3: porcentaje sobre el costo.
  chequear('pasa al precio al cliente', await cdp.clickPorTexto('Precio al cliente', '.jf-sab-resumen button'))
  await dormir(500)
  const textoPrecio = await cdp.texto()
  chequear('el precio sugerido es 4.200 (3500 + 20%)', /4\.200/.test(textoPrecio), JSON.stringify(textoPrecio.slice(-260)))
  chequear('cambia el porcentaje a 10', await cdp.setValor('sab-markup', '10'))
  await dormir(300)
  chequear('recalcula en vivo a 3.850', /3\.850/.test(await cdp.texto()))

  // Paso 4: guardar.
  chequear('pasa al resumen', await cdp.clickPorTexto('Resumen y guardar', '.jf-sab-resumen button'))
  await dormir(400)
  chequear('guarda la cotización', await cdp.clickTestid('sab-guardar'))
  await dormir(700)

  // Verificación en Historial y Ficha.
  chequear('abre el Historial', await cdp.clickPorTexto('Historial de Cotizaciones'))
  await dormir(600)
  chequear('la cotización aparece en el Historial', /CLIENTE PRUEBA SABANAS/.test(await cdp.texto()))
  chequear('abre su ficha', await cdp.clickPorTexto('Ver ficha'))
  await dormir(700)
  chequear('abre la pestaña Comparación', await cdp.clickPorTexto('Comparación', '.jf-ficha button'))
  await dormir(400)
  const textoComparacion = await cdp.texto()
  chequear('la comparación muestra elegido y menor precio', /elegido/i.test(textoComparacion) && /menor precio/i.test(textoComparacion))
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
