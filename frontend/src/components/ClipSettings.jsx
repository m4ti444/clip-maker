import React, { useState } from 'react';
import { Settings2, ChevronDown, ChevronRight } from 'lucide-react';

export default function ClipSettings({ settings, setSettings }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings2 className="w-5 h-5 text-gray-400" />
        <h3 className="text-lg font-medium text-white">Ajustes de Clips</h3>
      </div>

      <div className="space-y-6">
        {/* Min Duration */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <label className="text-gray-300">Duración mínima (segundos)</label>
            <span className="text-brand-400 font-medium">{settings.minDuration}s</span>
          </div>
          <input
            type="range"
            min="5"
            max="120"
            value={settings.minDuration}
            onChange={(e) => handleChange('minDuration', parseInt(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>

        {/* Max Duration */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <label className="text-gray-300">Duración máxima (segundos)</label>
            <span className="text-brand-400 font-medium">{settings.maxDuration}s</span>
          </div>
          <input
            type="range"
            min="15"
            max="180"
            value={settings.maxDuration}
            onChange={(e) => handleChange('maxDuration', parseInt(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>

        {/* Clip Count */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Cantidad de clips a generar</label>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.clipCount}
            onChange={(e) => handleChange('clipCount', parseInt(e.target.value))}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          />
        </div>

        {/* Toggles */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Añadir Subtítulos</label>
          <button
            onClick={() => handleChange('addSubtitles', !settings.addSubtitles)}
            className={`w-11 h-6 rounded-full transition-colors relative ${settings.addSubtitles ? 'bg-brand-600' : 'bg-gray-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${settings.addSubtitles ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Re-encuadre Vertical (9:16)</label>
          <button
            onClick={() => handleChange('reframe', !settings.reframe)}
            className={`w-11 h-6 rounded-full transition-colors relative ${settings.reframe ? 'bg-brand-600' : 'bg-gray-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${settings.reframe ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* Advanced Settings */}
        <div className="border-t border-gray-800 pt-4">
          <button 
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Ajustes Avanzados
          </button>
          
          {advancedOpen && (
            <div className="mt-4 animate-fade-in">
              <label className="block text-sm text-gray-300 mb-2">Estilo de Subtítulos</label>
              <select
                value={settings.subtitleStyle}
                onChange={(e) => handleChange('subtitleStyle', e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              >
                <option value="default">Por Defecto</option>
                <option value="hormozi">Estilo Hormozi (Dínamico)</option>
                <option value="minimal">Minimalista</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
