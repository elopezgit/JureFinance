// CotizadorView.jsx - Punto de entrada del cotizador.
// El flujo por sabanas reemplaza al wizard por servicios: se carga la sabana de
// cada proveedor, se arma el set a mano y se define el precio al cliente.
import React from 'react';
import CotizadorSabanas from './Sabanas/CotizadorSabanas';

export default function CotizadorView({
  initialQuote,
  onSaveQuote,
  operadoresList = [],
  configMensual = []
}) {
  return (
    <CotizadorSabanas
      initialQuote={initialQuote}
      onSaveQuote={onSaveQuote}
      operadoresList={operadoresList}
      configMensual={configMensual}
    />
  );
}
