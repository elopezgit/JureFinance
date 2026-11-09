// DriveConfigModal.jsx - Google Drive Database Connection Configuration
import React, { useState } from 'react';
import {
  HardDrive,
  Link2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Shield,
  ExternalLink,
  Save,
  RefreshCw,
  Code2,
  Key
} from 'lucide-react';
import {
  TARGET_ROOT_FOLDER_ID,
  TARGET_DRIVE_URL,
  getDriveConfig,
  saveDriveConfig,
  syncBidirectionalWithDrive
} from '../../services/driveService';
import { APPS_SCRIPT_V3_SOURCE } from '../../services/appsScriptSource';

export default function DriveConfigModal({ onClose }) {
  const currentConfig = getDriveConfig();

  const [appsScriptUrl, setAppsScriptUrl] = useState(currentConfig.appsScriptUrl || '');
  const [clientId, setClientId] = useState(currentConfig.clientId || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTabMethod, setActiveTabMethod] = useState(currentConfig.appsScriptUrl ? 'script' : 'script'); // 'script' | 'oauth'

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Temporarily save current input to test
      saveDriveConfig({ appsScriptUrl, clientId });
      const res = await syncBidirectionalWithDrive();
      if (res.mode === 'apps-script' || res.mode === 'rest-oauth') {
        setTestResult({
          success: true,
          message: `¡Conexión bidireccional exitosa! Modo: ${res.mode === 'apps-script' ? 'Google Apps Script (Base de Datos en Vivo)' : 'OAuth REST'}. Se leyeron las carpetas de Drive.`
        });
      } else {
        setTestResult({
          success: false,
          message: 'Pega la URL de tu aplicación web de Google Apps Script para activar la conexión en vivo con Google Drive.'
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Error al contactar con Google Drive: ' + err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveDriveConfig({
      appsScriptUrl: appsScriptUrl.trim(),
      clientId: clientId.trim(),
      isConnected: true
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      if (onClose) onClose();
    }, 1200);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_V3_SOURCE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="card" style={{ maxWidth: '850px', margin: '0 auto', padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-card-border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <HardDrive size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Conectar Google Drive como Base de Datos Bidireccional
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Carpeta vinculada: <strong>{TARGET_ROOT_FOLDER_ID}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={TARGET_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            <ExternalLink size={13} />
            <span>Abrir Carpeta en Drive ↗</span>
          </a>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              title="Volver a la vista de Drive"
            >
              <span>Volver</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Drive Summary Banner */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--primary-soft)',
          border: '1px solid var(--primary-border)',
          marginBottom: '20px',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'var(--text-secondary)'
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--primary-light)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={16} /> Sincronización Casi Instantánea Activa
        </div>
        <p style={{ margin: 0 }}>
          La web revisa automáticamente cada 60 segundos (y cada vez que vuelves a la pestaña) si el árbol de Drive cambió.
          Con el conector <strong>v3.1</strong>, el escaneo se precalcula en segundo plano, por lo que la lectura es casi instantánea.
          También guarda tus cotizaciones en el archivo <code>jurefinance_db.json</code> dentro de tu carpeta de Drive.
        </p>
      </div>

      {/* Connection Method Selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTabMethod === 'script' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTabMethod('script')}
        >
          <Code2 size={15} />
          <span>Método 1: Google Apps Script (Recomendado - 1 minuto)</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTabMethod === 'oauth' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTabMethod('oauth')}
        >
          <Key size={15} />
          <span>Método 2: Google OAuth 2.0 (Google Cloud)</span>
        </button>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeTabMethod === 'script' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                URL de Aplicación Web de Google Apps Script
                <span className="form-label-hint">https://script.google.com/macros/s/.../exec</span>
              </label>
              <div className="input-wrapper">
                <span className="input-prefix">
                  <Link2 size={16} />
                </span>
                <input
                  type="url"
                  className="input-field input-with-prefix"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                />
              </div>
            </div>

            {/* Quick 4-step setup instructions */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                ¿Cómo activar la conexión en 1 minuto? (Sin costos ni verificaciones):
              </div>
              <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', margin: 0 }}>
                <li>
                  Abre <a href="https://script.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>script.google.com</a> con tu cuenta donde tienes la carpeta.
                </li>
                <li>
                  Copia el código que está guardado en tu proyecto en <code>google-apps-script/Code.gs</code> y pégalo en el editor de Google Apps Script.
                </li>
                <li>
                  Haz clic en <strong>Implementar &gt; Nueva implementación</strong> (Deploy &gt; New deployment). Selecciona tipo: <strong>"Aplicación web"</strong>, Ejecutar como: <strong>"Yo"</strong>, Acceso: <strong>"Cualquier usuario"</strong>.
                </li>
                <li>
                  Copia la <strong>URL de la aplicación web</strong> que te da Google y pégala en el campo de arriba.
                </li>
                <li>
                  <strong>Recomendado:</strong> en el editor de Apps Script, ejecuta una vez la función <code>setupTreeTrigger</code> para activar la reconstrucción automática del árbol en segundo plano (sincronización casi instantánea).
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Google OAuth 2.0 Client ID</label>
              <input
                type="text"
                className="input-field"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx.apps.googleusercontent.com"
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Configura en Google Cloud Console el origen autorizado: <code>http://localhost:5173</code>
              </span>
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: testResult.success ? 'var(--success-bg)' : 'var(--warning-bg)',
              border: `1px solid ${testResult.success ? 'var(--success-border)' : 'var(--warning-border)'}`,
              fontSize: '0.84rem',
              color: testResult.success ? 'var(--success)' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--bg-card-border)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            <RefreshCw size={14} className={isTesting ? 'spin-anim' : ''} />
            <span>{isTesting ? 'Probando conexión...' : 'Probar Conexión con Google Drive'}</span>
          </button>

          <button type="submit" className="btn btn-primary btn-sm">
            <Save size={15} />
            <span>{saveSuccess ? '¡Guardado!' : 'Guardar y Activar Sincronización'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
