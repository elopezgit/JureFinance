// CotizadorView.jsx - Interactive Quotation Engine for Travel Agency (Wizard)
import React from 'react';
import CotizadorWizard from './Wizard/CotizadorWizard';

export default function CotizadorView({
  initialQuote,
  onSaveQuote,
  operadoresList = [],
  configMensual = []
}) {
  return (
    <CotizadorWizard
      initialQuote={initialQuote}
      onSaveQuote={onSaveQuote}
      operadoresList={operadoresList}
      configMensual={configMensual}
    />
  );
}
