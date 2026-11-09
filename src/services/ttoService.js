// ttoService.js - Lógica de la Configuración Mensual de TTOs
// Bloques de fechas de emisión → fecha límite de pago, por proveedor y por mes.

/**
 * Devuelve 'YYYY-MM' a partir de una fecha ISO ('YYYY-MM-DD') o Date.
 */
export function getMesFromFecha(fecha) {
  if (!fecha) return '';
  if (fecha instanceof Date) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }
  return String(fecha).slice(0, 7);
}

/**
 * Devuelve el día (1-31) de una fecha ISO.
 */
export function getDiaFromFecha(fecha) {
  if (!fecha) return 0;
  return parseInt(String(fecha).slice(8, 10), 10) || 0;
}

/**
 * Normaliza el nombre o id de un proveedor a una clave consistente.
 * 'Aero' → 'aero', 'Price' → 'price', 'Azabache' → 'azabache'.
 */
export function normalizeProveedorId(proveedor) {
  return String(proveedor || '').trim().toLowerCase();
}

/**
 * Obtiene la entrada de configuración de un proveedor para un mes dado.
 * @returns {{ mes, proveedorId, bloques } | null}
 */
export function getConfigMesProveedor(configMensual, proveedorId, mes) {
  const pid = normalizeProveedorId(proveedorId);
  if (!Array.isArray(configMensual)) return null;
  return (
    configMensual.find(
      (c) => c.mes === mes && normalizeProveedorId(c.proveedorId) === pid
    ) || null
  );
}

/**
 * Calcula la fecha límite de pago de un servicio emitido en `fechaEmision`,
 * buscando el bloque del mes que contiene ese día para el proveedor indicado.
 * @returns {string} fecha ISO 'YYYY-MM-DD' o '' si no hay coincidencia.
 */
export function getFechaPagoTTOO(configMensual, proveedorId, fechaEmision) {
  const bloque = getBloqueBCP(configMensual, proveedorId, fechaEmision);
  return bloque?.fechaPago || '';
}

/**
 * Obtiene el bloque BCP al que pertenece una fecha de emisión para un proveedor.
 * @returns {{ desde: number, hasta: number, fechaPago: string, rangoLabel: string, rangoCorto: string } | null}
 */
export function getBloqueBCP(configMensual, proveedorId, fechaEmision) {
  const mes = getMesFromFecha(fechaEmision);
  const dia = getDiaFromFecha(fechaEmision);
  if (!mes || !dia) return null;

  const cfg = getConfigMesProveedor(configMensual, proveedorId, mes);
  if (!cfg || !Array.isArray(cfg.bloques)) return null;

  const bloque = cfg.bloques.find(
    (b) => dia >= Number(b.desde) && dia <= Number(b.hasta)
  );
  if (!bloque) return null;

  const dStr = String(bloque.desde).padStart(2, '0');
  const hStr = String(bloque.hasta).padStart(2, '0');
  return {
    ...bloque,
    mes,
    proveedorId: normalizeProveedorId(proveedorId),
    rangoLabel: `Emisiones del ${dStr} al ${hStr} de ${formatMesLabel(mes)}`,
    rangoCorto: `${dStr}-${hStr}`
  };
}

/**
 * Busca TODOS los bloques BCP que vencen en una fecha dada. Un proveedor puede
 * consolidar varios rangos de emisión en la misma fecha de pago.
 * @returns {Array<{ desde, hasta, fechaPago, mes, proveedorId, rangoLabel, rangoCorto }>}
 */
export function getBloquesBCPPorVencimiento(
  configMensual,
  proveedorId,
  fechaVencimiento,
  mesFiltro
) {
  if (!fechaVencimiento || !Array.isArray(configMensual)) return [];
  const pid = normalizeProveedorId(proveedorId);

  // Primero busca en el mes indicado, o en cualquiera si no se pasa mes
  const configs = mesFiltro
    ? configMensual.filter(
        (c) => c.mes === mesFiltro && normalizeProveedorId(c.proveedorId) === pid
      )
    : configMensual.filter((c) => normalizeProveedorId(c.proveedorId) === pid);

  const resultados = [];
  configs.forEach((cfg) => {
    if (!Array.isArray(cfg.bloques)) return;
    cfg.bloques
      .filter((b) => b.fechaPago === fechaVencimiento)
      .forEach((bloque) => {
        const dStr = String(bloque.desde).padStart(2, '0');
        const hStr = String(bloque.hasta).padStart(2, '0');
        resultados.push({
          ...bloque,
          mes: cfg.mes,
          proveedorId: pid,
          rangoLabel: `Emisiones del ${dStr} al ${hStr} de ${formatMesLabel(cfg.mes)}`,
          rangoCorto: `${dStr}-${hStr}`
        });
      });
  });

  return resultados;
}

/**
 * Busca si una fecha de vencimiento dada corresponde a un bloque BCP del proveedor.
 * Devuelve el primero (compatibilidad); para varios bloques usar
 * `getBloquesBCPPorVencimiento`.
 */
export function getBloqueBCPPorVencimiento(
  configMensual,
  proveedorId,
  fechaVencimiento,
  mesFiltro
) {
  return (
    getBloquesBCPPorVencimiento(
      configMensual,
      proveedorId,
      fechaVencimiento,
      mesFiltro
    )[0] || null
  );
}

/**
 * Cantidad de días del mes 'YYYY-MM'.
 */
export function diasDelMes(mes) {
  if (!mes) return 0;
  const [anio, mm] = String(mes).split('-').map(Number);
  if (!anio || !mm || mm < 1 || mm > 12) return 0;
  return new Date(anio, mm, 0).getDate();
}

/**
 * Fecha ISO de un día del mes, recortada al último día real del mes.
 */
export function fechaDeMes(mes, dia) {
  const ultimo = diasDelMes(mes);
  if (!ultimo) return '';
  const d = Math.min(Math.max(Number(dia) || 1, 1), ultimo);
  return `${mes}-${String(d).padStart(2, '0')}`;
}

/**
 * Desplaza una fecha ISO una cantidad de meses, recortando el día al último
 * día del mes destino (31/01 + 1 mes → 28/02 o 29/02).
 */
export function shiftFechaISO(fechaISO, deltaMeses = 0) {
  if (!fechaISO) return '';
  const [anio, mm, dd] = String(fechaISO).split('-').map(Number);
  if (!anio || !mm || !dd) return '';
  const destino = new Date(anio, mm - 1 + Number(deltaMeses || 0), 1);
  return fechaDeMes(
    `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, '0')}`,
    dd
  );
}

/**
 * Diferencia en meses entre dos períodos 'YYYY-MM' (destino - origen).
 */
export function mesesEntre(desdeMes, hastaMes) {
  if (!desdeMes || !hastaMes) return 0;
  const [a1, m1] = desdeMes.split('-').map(Number);
  const [a2, m2] = hastaMes.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** Valida que un string sea una fecha ISO real ('2026-02-30' no lo es). */
export function esFechaISOValida(fechaISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || ''))) return false;
  const [anio, mm, dd] = fechaISO.split('-').map(Number);
  const fecha = new Date(anio, mm - 1, dd);
  return (
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mm - 1 &&
    fecha.getDate() === dd
  );
}

/** Comprime una lista de días [1,2,3,7,9] → "1-3, 7, 9". */
export function resumirDias(dias = []) {
  const numeros = [...new Set((dias || []).map(Number).filter((d) => d > 0))].sort(
    (a, b) => a - b
  );
  if (numeros.length === 0) return '';
  const partes = [];
  let inicio = numeros[0];
  let previo = numeros[0];

  for (let i = 1; i <= numeros.length; i++) {
    const actual = numeros[i];
    if (actual === previo + 1) {
      previo = actual;
      continue;
    }
    partes.push(inicio === previo ? `${inicio}` : `${inicio}-${previo}`);
    inicio = actual;
    previo = actual;
  }

  return partes.join(', ');
}

/**
 * Analiza la cobertura de un mes y devuelve advertencias (no errores):
 * días sin bloque, rangos que exceden el mes, pagos anteriores al cierre y
 * bloques que comparten fecha de pago.
 */
export function validarCoberturaMes(bloques, mes) {
  const ultimo = diasDelMes(mes);
  const warnings = [];
  const diasSinCobertura = [];
  if (!ultimo) {
    return { warnings: ['Mes inválido.'], diasSinCobertura, diasDelMes: 0 };
  }

  const validos = (Array.isArray(bloques) ? bloques : [])
    .map((b) => ({
      desde: Number(b?.desde),
      hasta: Number(b?.hasta),
      fechaPago: b?.fechaPago || ''
    }))
    .filter(
      (b) =>
        Number.isFinite(b.desde) &&
        Number.isFinite(b.hasta) &&
        b.desde >= 1 &&
        b.hasta >= b.desde
    );

  const cubiertos = new Set();
  validos.forEach((b) => {
    const hasta = Math.min(b.hasta, ultimo);
    for (let d = b.desde; d <= hasta; d++) cubiertos.add(d);
  });

  for (let d = 1; d <= ultimo; d++) {
    if (!cubiertos.has(d)) diasSinCobertura.push(d);
  }

  if (diasSinCobertura.length > 0) {
    warnings.push(
      `Quedan ${diasSinCobertura.length} día(s) sin bloque: ${resumirDias(
        diasSinCobertura
      )}. Las emisiones de esos días quedarían sin fecha de pago.`
    );
  }

  const pagosPorFecha = new Map();

  validos.forEach((b, i) => {
    if (b.hasta > ultimo) {
      warnings.push(
        `El bloque ${i + 1} (${b.desde}-${b.hasta}) excede el último día de ${formatMesLabel(
          mes
        )} (${ultimo}); se tomará hasta el día ${ultimo}.`
      );
    }

    if (!b.fechaPago || !esFechaISOValida(b.fechaPago)) return;

    const cierre = fechaDeMes(mes, Math.min(b.hasta, ultimo));
    if (b.fechaPago < cierre) {
      warnings.push(
        `Bloque ${i + 1}: la fecha de pago (${b.fechaPago}) es anterior al cierre del rango (${cierre}).`
      );
    }
    if (b.fechaPago < `${mes}-01`) {
      warnings.push(
        `Bloque ${i + 1}: la fecha de pago (${b.fechaPago}) pertenece a un mes anterior.`
      );
    }

    if (!pagosPorFecha.has(b.fechaPago)) pagosPorFecha.set(b.fechaPago, []);
    pagosPorFecha.get(b.fechaPago).push(i + 1);
  });

  pagosPorFecha.forEach((indices, fecha) => {
    if (indices.length > 1) {
      warnings.push(
        `Los bloques ${indices.join(', ')} comparten la fecha de pago ${fecha}; se liquidarán juntos.`
      );
    }
  });

  return { warnings, diasSinCobertura, diasDelMes: ultimo };
}

/**
 * Valida un conjunto de bloques:
 * - días entre 1 y 31, y 'desde' <= 'hasta'
 * - sin solapamientos
 * - fecha de pago informada y válida
 * - si se pasa `mes`, agrega advertencias de cobertura y fechas.
 * @returns {{ ok: boolean, errors: string[], warnings: string[], diasSinCobertura: number[] }}
 */
export function validateBloques(bloques, mes) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(bloques) || bloques.length === 0) {
    return {
      ok: false,
      errors: ['Agregá al menos un bloque de emisión.'],
      warnings,
      diasSinCobertura: mes ? Array.from({ length: diasDelMes(mes) }, (_, i) => i + 1) : []
    };
  }

  const ordenados = [...bloques].sort((a, b) => Number(a.desde) - Number(b.desde));

  ordenados.forEach((b, i) => {
    const desde = Number(b.desde);
    const hasta = Number(b.hasta);
    if (!desde || !hasta || desde < 1 || hasta > 31) {
      errors.push(`Bloque ${i + 1}: los días deben estar entre 1 y 31.`);
    } else if (desde > hasta) {
      errors.push(`Bloque ${i + 1}: el día "desde" no puede ser mayor que "hasta".`);
    }
    if (!b.fechaPago) {
      errors.push(`Bloque ${i + 1}: falta la fecha límite de pago.`);
    } else if (!esFechaISOValida(b.fechaPago)) {
      errors.push(`Bloque ${i + 1}: la fecha de pago no es una fecha válida.`);
    }
  });

  for (let i = 1; i < ordenados.length; i++) {
    const prev = ordenados[i - 1];
    const curr = ordenados[i];
    if (Number(curr.desde) <= Number(prev.hasta)) {
      errors.push(
        `Los bloques se superponen: ${prev.desde}-${prev.hasta} y ${curr.desde}-${curr.hasta}.`
      );
    }
  }

  let diasSinCobertura = [];
  if (mes) {
    const cobertura = validarCoberturaMes(bloques, mes);
    warnings.push(...cobertura.warnings);
    diasSinCobertura = cobertura.diasSinCobertura;
  }

  return { ok: errors.length === 0, errors, warnings, diasSinCobertura };
}

/**
 * Genera los bloques de un mes completo a partir de una regla simple:
 * rangos de N días y una fecha de pago (día + desplazamiento de mes).
 *
 * Ejemplo: mes 2026-11, diasPorBloque 5, diaPago 20, offsetMesPago 0
 * → 1-5, 6-10, 11-15, 16-20, 21-25, 26-30, todos con pago el 20/11.
 */
export function generarBloquesDesdeRegla({
  mes,
  diasPorBloque = 5,
  diaPago = 20,
  offsetMesPago = 0,
  desde = 1
} = {}) {
  const ultimo = diasDelMes(mes);
  if (!ultimo) return [];

  const tamano = Math.max(1, Math.floor(Number(diasPorBloque) || 5));
  const inicio = Math.min(Math.max(Number(desde) || 1, 1), ultimo);
  const mesPago = shiftMes(mes, Number(offsetMesPago) || 0);
  const fechaPago = fechaDeMes(mesPago, diaPago);
  const bloques = [];

  for (let dia = inicio; dia <= ultimo; dia += tamano) {
    bloques.push({
      desde: dia,
      hasta: Math.min(dia + tamano - 1, ultimo),
      fechaPago
    });
  }

  return bloques;
}

/**
 * Copia bloques a otro mes desplazando sus fechas de pago.
 * Se usa para "copiar mes anterior/siguiente" sin arrastrar fechas viejas.
 */
export function desplazarBloquesAMes(bloques, deltaMeses = 0) {
  return (Array.isArray(bloques) ? bloques : []).map((b) => ({
    ...b,
    fechaPago: shiftFechaISO(b.fechaPago, deltaMeses)
  }));
}

/**
 * Devuelve una etiqueta legible de un mes 'YYYY-MM' → 'Noviembre 2026'.
 */
export function formatMesLabel(mes) {
  if (!mes) return '';
  const [anio, mm] = mes.split('-');
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const idx = parseInt(mm, 10) - 1;
  return `${meses[idx] || mm} ${anio}`;
}

/**
 * Desplaza un mes 'YYYY-MM' en `delta` meses (positivo o negativo).
 */
export function shiftMes(mes, delta) {
  const [anio, mm] = mes.split('-').map(Number);
  const d = new Date(anio, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Mes en curso en formato 'YYYY-MM'.
 */
export function getMesActual() {
  return getMesFromFecha(new Date());
}
