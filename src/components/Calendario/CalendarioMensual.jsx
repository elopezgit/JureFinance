// CalendarioMensual.jsx - Grilla mensual reutilizable (M6 y M7)
// Muestra los eventos agrupados por día, con semáforo por nivel temporal y
// permite seleccionar un día para ver su agenda.

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMesLabel, shiftMes } from '../../services/ttoService';
import { hoyISO, mesDeISO, formatearMonto } from '../../services/calendarioService';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarioMensual({
  mes,
  onCambiarMes,
  eventos = [],
  diaSeleccionado,
  onSeleccionarDia,
  moneda = 'USD'
}) {
  const hoy = hoyISO();
  const mesActual = mesDeISO(hoy);

  const [anio, mesNum] = mes.split('-').map(Number);
  const offset = (new Date(anio, mesNum - 1, 1).getDay() + 6) % 7; // lunes primero
  const diasDelMes = new Date(anio, mesNum, 0).getDate();

  // Agrupar eventos por fecha
  const porDia = {};
  (eventos || []).forEach((ev) => {
    if (!ev.fecha) return;
    if (!porDia[ev.fecha]) porDia[ev.fecha] = [];
    porDia[ev.fecha].push(ev);
  });

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasDelMes; d++) {
    celdas.push(`${mes}-${String(d).padStart(2, '0')}`);
  }
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <div>
      <div className="cal-header">
        <div className="cal-header-left">
          <button
            className="btn btn-secondary btn-sm btn-icon-only"
            onClick={() => onCambiarMes(shiftMes(mes, -1))}
            title="Mes anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <strong className="cal-title">{formatMesLabel(mes)}</strong>
          <button
            className="btn btn-secondary btn-sm btn-icon-only"
            onClick={() => onCambiarMes(shiftMes(mes, 1))}
            title="Mes siguiente"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {mes !== mesActual && (
          <button className="btn btn-outline btn-sm" onClick={() => onCambiarMes(mesActual)}>
            Ir al mes actual
          </button>
        )}
      </div>

      <div className="cal-weekdays">
        {DIAS_SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {celdas.map((fechaISO, idx) => {
          if (!fechaISO) {
            return <div key={`v-${idx}`} className="cal-cell is-empty" aria-hidden="true" />;
          }

          const evs = porDia[fechaISO] || [];
          const total = evs.reduce((acc, e) => acc + (Number(e.monto) || 0), 0);
          const niveles = [...new Set(evs.map((e) => e.nivel || 'futuro'))];
          const esHoy = fechaISO === hoy;
          const seleccionado = fechaISO === diaSeleccionado;
          const diaNum = Number(fechaISO.slice(8, 10));

          return (
            <div
              key={fechaISO}
              role="button"
              tabIndex={0}
              className={`cal-cell ${esHoy ? 'is-today' : ''} ${
                seleccionado ? 'is-selected' : ''
              } ${evs.length ? 'has-events' : ''}`}
              onClick={() => onSeleccionarDia(fechaISO)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSeleccionarDia(fechaISO);
                }
              }}
            >
              <div className="cal-day-top">
                <span className="cal-day-num">{diaNum}</span>
                {evs.length > 0 && <span className="cal-day-count">{evs.length}</span>}
              </div>
              {evs.length > 0 && (
                <>
                  <div className="cal-dots">
                    {niveles.slice(0, 4).map((nivel) => (
                      <span key={nivel} className={`cal-dot nivel-${nivel}`} />
                    ))}
                  </div>
                  <span className="cal-day-amount">{formatearMonto(total, moneda)}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        <span className="cal-legend-item">
          <span className="cal-dot nivel-vencido" /> Vencido
        </span>
        <span className="cal-legend-item">
          <span className="cal-dot nivel-hoy" /> Vence hoy
        </span>
        <span className="cal-legend-item">
          <span className="cal-dot nivel-proximo" /> Próximos 7 días
        </span>
        <span className="cal-legend-item">
          <span className="cal-dot nivel-pagado" /> Pagado
        </span>
      </div>
    </div>
  );
}
