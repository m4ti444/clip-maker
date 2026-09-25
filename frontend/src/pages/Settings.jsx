import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getSettings, updateSettings, healthCheck, validateCredentials } from '../api/client';
import { Save, Server, Key, Cpu, Volume2, AlertCircle, Loader2, CheckCircle2, XCircle, RefreshCw, Shield, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMaskedKey, getCredentials, storeCredentials, clearCredentials } from '../utils/crypto';

export default function Settings() {
  const [settings, setSettings] = useState({
    llmProvider: 'gemini',
    apiKey: '',
    modelName: 'gemini-2.0-flash',
    ollamaUrl: 'http://localhost:11434',
    whisperModel: 'base',
    defaultMinDuration: 30,
    defaultMaxDuration: 60,
    defaultClipCount: 5
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    loadAllSettings();
    checkConnection();
  }, []);

  const loadAllSettings = async () => {
    // 1. Cargar credenciales desde localStorage (encriptado)
    const creds = await getCredentials();
    const masked = await getMaskedKey();
    setMaskedApiKey(masked);

    // 2. Cargar configuraciones del servidor
    let serverData = {};
    try {
      const res = await getSettings();
      if (res.data) serverData = res.data;
    } catch (e) {
      console.warn('Usando configuración local:', e);
    }

    setSettings(prev => ({
      ...prev,
      ...serverData,
      llmProvider: creds?.provider || prev.llmProvider,
      modelName: creds?.model || prev.modelName,
      apiKey: creds?.apiKey || '',
      ollamaUrl: creds?.ollamaUrl || prev.ollamaUrl
    }));
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      await healthCheck();
      setConnectionStatus('connected');
    } catch (err) {
      setConnectionStatus('error');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el proveedor, sugerir automáticamente el modelo recomendado
    if (name === 'llmProvider') {
      let defaultModel = 'gemini-2.0-flash';
      if (value === 'openai') defaultModel = 'gpt-4o-mini';
      if (value === 'ollama') defaultModel = 'llama3.1';
      
      setSettings(prev => ({
        ...prev,
        llmProvider: value,
        modelName: defaultModel
      }));
      return;
    }

    setSettings(prev => ({
      ...prev,
      [name]: ['defaultMinDuration', 'defaultMaxDuration', 'defaultClipCount'].includes(name) 
        ? parseInt(value) || 0
        : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Guardar credenciales de IA en localStorage (encriptadas)
      await storeCredentials({
        provider: settings.llmProvider,
        apiKey: settings.apiKey.trim(),
        model: settings.modelName.trim(),
        ollamaUrl: settings.ollamaUrl.trim()
      });

      // 2. Actualizar configuración en el servidor backend
      await updateSettings({
        whisper_model: settings.whisperModel,
        default_clip_min_duration: settings.defaultMinDuration,
        default_clip_max_duration: settings.defaultMaxDuration,
        default_clip_count: settings.defaultClipCount
      });

      // 3. Actualizar vista de clave enmascarada
      const newMasked = await getMaskedKey();
      setMaskedApiKey(newMasked);

      toast.success('¡Ajustes guardados y aplicados correctamente!');
    } catch (err) {
      console.error('Error al guardar ajustes:', err);
      toast.error('Error al guardar algunos ajustes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await validateCredentials({
        provider: settings.llmProvider,
        api_key: settings.apiKey.trim(),
        model: settings.modelName.trim(),
        ollama_url: settings.ollamaUrl.trim()
      });
      toast.success(`Conexión con ${settings.llmProvider.toUpperCase()} (${settings.modelName}) exitosa`);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Fallo en la conexión';
      toast.error(`Error: ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <Header 
        title="Ajustes del Sistema" 
        description="Configura los modelos de IA, claves y parámetros de ClipEngine"
      />
      
      <div className="p-8 max-w-4xl mx-auto w-full flex-1 overflow-y-auto">
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* AI Settings Section */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-medium text-white">Configuración del Modelo de IA</h3>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Estado servidor:</span>
                {connectionStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                {connectionStatus === 'connected' && (
                  <div className="flex items-center gap-1 text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-semibold">Activo</span>
                  </div>
                )}
                {connectionStatus === 'error' && (
                  <div className="flex items-center gap-1 text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20 text-xs">
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="font-semibold">Desconectado</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Proveedor de IA</label>
                  <select
                    name="llmProvider"
                    value={settings.llmProvider}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                  >
                    <option value="gemini">Google Gemini (Recomendado - Rápido y Gratis)</option>
                    <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    <option value="ollama">Ollama (100% Local / Sin Costo)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre del Modelo
                    <span className="text-xs text-gray-400 ml-2 font-normal">
                      {settings.llmProvider === 'gemini' && '(ej: gemini-2.0-flash o gemini-1.5-flash)'}
                      {settings.llmProvider === 'openai' && '(ej: gpt-4o-mini o gpt-4o)'}
                      {settings.llmProvider === 'ollama' && '(ej: llama3.1 o mistral)'}
                    </span>
                  </label>
                  <input
                    type="text"
                    name="modelName"
                    value={settings.modelName}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors font-mono text-sm"
                    placeholder="gemini-2.0-flash"
                  />
                </div>
              </div>

              {settings.llmProvider !== 'ollama' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-300">API Key</label>
                    {maskedApiKey && (
                      <span className="text-xs text-gray-400 font-mono">Actual: {maskedApiKey}</span>
                    )}
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showKey ? "text" : "password"}
                      name="apiKey"
                      value={settings.apiKey}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-24 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 font-mono text-sm"
                      placeholder={settings.llmProvider === 'gemini' ? 'Pega tu API Key de Google (AIzaSy...)' : 'sk-...'}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-violet-400 hover:text-violet-300 font-medium px-2 py-1 rounded"
                    >
                      {showKey ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
              )}

              {settings.llmProvider === 'ollama' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">URL de Ollama</label>
                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="url"
                      name="ollamaUrl"
                      value={settings.ollamaUrl}
                      onChange={handleChange}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 font-mono text-sm"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || (settings.llmProvider !== 'ollama' && !settings.apiKey)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                  {isTesting ? 'Probando...' : 'Probar Conexión con IA'}
                </button>
              </div>
            </div>
          </div>

          {/* Transcription Settings */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-medium text-white">Transcripción de Audio (Whisper)</h3>
            </div>
            
            <div className="p-6">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 mb-6">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-200">
                  <p className="font-medium text-blue-300 mb-1">Información de Whisper</p>
                  <p>La transcripción se ejecuta 100% en tu equipo. El modelo <strong>base</strong> o <strong>small</strong> ofrece el mejor equilibrio entre velocidad y precisión para español.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tamaño del Modelo Whisper</label>
                <select
                  name="whisperModel"
                  value={settings.whisperModel}
                  onChange={handleChange}
                  className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                >
                  <option value="tiny">Tiny (Ultrarrápido, menor precisión)</option>
                  <option value="base">Base (Recomendado - Rápido y equilibrado)</option>
                  <option value="small">Small (Alta precisión para español)</option>
                  <option value="medium">Medium (Máxima fidelidad, más lento)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Defaults Section */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center gap-3">
              <Save className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-medium text-white">Valores por Defecto para Clips</h3>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duración Mínima (segundos)</label>
                  <input
                    type="number"
                    name="defaultMinDuration"
                    value={settings.defaultMinDuration}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duración Máxima (segundos)</label>
                  <input
                    type="number"
                    name="defaultMaxDuration"
                    value={settings.defaultMaxDuration}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cantidad de Clips</label>
                  <input
                    type="number"
                    name="defaultClipCount"
                    value={settings.defaultClipCount}
                    onChange={handleChange}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Botón Guardar Cambios */}
          <div className="flex justify-end pt-4 pb-6">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-violet-900/30 text-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isLoading ? 'Guardando Ajustes...' : 'Guardar Todos los Ajustes'}
            </button>
          </div>
          
        </form>
        
        {/* Security Info Section */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-12 shadow-lg">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center gap-3">
            <Shield className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-medium text-white">Seguridad y Privacidad</h3>
          </div>
          <div className="p-6">
            <ul className="space-y-3 text-sm text-gray-300 mb-6">
              <li className="flex items-center gap-2">
                <span>🔐</span> Tu API Key se encripta con AES-256-GCM en este navegador.
              </li>
              <li className="flex items-center gap-2">
                <span>🚫</span> Tus credenciales nunca se guardan en el disco del servidor.
              </li>
              <li className="flex items-center gap-2">
                <span>🧹</span> Los videos descargados y procesados se eliminan automáticamente tras 24 horas.
              </li>
            </ul>
            <div className="pt-4 border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('¿Seguro que deseas borrar todas las claves y datos guardados en este navegador?')) {
                    clearCredentials();
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
                Borrar credenciales guardadas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
