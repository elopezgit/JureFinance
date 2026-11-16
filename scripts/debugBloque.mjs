import { buildConfiguracionMensual } from '../src/data/initialData.js';
import { getBloqueBCP } from '../src/services/ttoService.js';
const configNov = buildConfiguracionMensual(['2026-11']);
console.log('bloques aero:', JSON.stringify(configNov[0].bloques));
console.log('bloque 03/11:', JSON.stringify(getBloqueBCP(configNov, 'Aero', '2026-11-03')));