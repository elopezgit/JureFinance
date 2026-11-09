// WizardNav.jsx - Navegación horizontal del wizard.
// Los pasos llegan calculados desde CotizadorWizard (dependen de los
// proveedores tildados en el paso 1).
import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import './wizard.css';

export default function WizardNav({ steps = [], currentStepId, onStepChange, completedSteps = [] }) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <div className="wizard-nav">
      <div className="wizard-nav-container">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = completedSteps.includes(step.id) || index < currentIndex;
          const isClickable = isCompleted || isActive;

          return (
            <React.Fragment key={step.id}>
              <button
                className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => isClickable && onStepChange(step.id)}
                disabled={!isClickable}
              >
                <div className="wizard-step-circle">
                  {isCompleted && !isActive ? <Check size={16} /> : <span>{index + 1}</span>}
                </div>
                <div className="wizard-step-info">
                  <span className="wizard-step-label">{step.label}</span>
                  <span className="wizard-step-short">{step.short}</span>
                </div>
              </button>
              {index < steps.length - 1 && <ChevronRight size={18} className="wizard-step-arrow" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
