import React, { useState } from 'react';
import { Key, Eye, EyeOff, Check, AlertCircle, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { validateCredentials } from '../api/client';
import { storeCredentials, clearCredentials } from '../utils/crypto';

export default function CredentialsModal({ onSuccess }) {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    if (newProvider === 'gemini') setModel('gemini-3.8-flash');
    else if (newProvider === 'openai') setModel('gpt-4o-mini');
    else if (newProvider === 'ollama') setModel('llama3.1');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const trimmedKey = apiKey.trim();
    if (provider !== 'ollama' && !trimmedKey) {
      setError('Por favor, ingresa una API Key');
      setIsLoading(false);
      return;
    }

    try {
      // Validate with backend
      await validateCredentials({
        provider,
        api_key: trimmedKey,
        model,
        ollama_url: ollamaUrl
      });

      // Save using encrypted storage
      await storeCredentials({
        provider,
        apiKey: trimmedKey,
        model,
        ollamaUrl
      });

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al validar credenciales. Por favor, verifica y vuelve a intentar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-brand-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-brand-900/20">
        <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex flex-col items-center text-center">
          <div className="bg-brand-600/20 p-3 rounded-full mb-4">
            <Key className="w-8 h-8 text-brand-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">🔑 Configura tu API de IA</h2>
          <p className="text-gray-400 text-sm">
            ClipEngine requiere un modelo de lenguaje para analizar y extraer los mejores momentos de tus videos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-3 text-sm text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Proveedor</label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors"
            >
              <option value="gemini">Google Gemini (Recomendado)</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>

          {provider !== 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-4 pr-12 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 font-mono text-sm"
                  placeholder="Pega tu API key aquí..."
                />
                <button 
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {provider === 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">URL de Ollama</label>
              <input
                type="url"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 font-mono text-sm"
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Modelo</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 font-mono text-sm"
            />
          </div>

          {provider !== 'ollama' && apiKey.trim() && apiKey.trim().length < 10 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3 text-sm text-yellow-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>La API Key parece ser demasiado corta. Verifica que sea correcta.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (provider !== 'ollama' && !apiKey.trim())}
            className="w-full mt-4 px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 shadow-lg shadow-brand-900/20"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {isLoading ? 'Verificando...' : 'Verificar y Guardar'}
          </button>
          <div className="text-center mt-2">
            <span className="text-xs text-gray-400">🔒 Tu API key se encripta localmente antes de guardarse</span>
          </div>
        </form>

        {provider !== 'ollama' && (
          <div className="p-4 bg-gray-950 border-t border-gray-800 text-center">
            <a 
              href={provider === 'gemini' ? 'https://aistudio.google.com/app/apikey' : 'https://platform.openai.com/api-keys'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1 inline-flex transition-colors"
            >
              Obtener API key gratis <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
