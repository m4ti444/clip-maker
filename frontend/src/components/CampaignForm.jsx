import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { createCampaign, updateCampaign } from '../api/client';
import toast from 'react-hot-toast';

export default function CampaignForm({ campaign, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    platform: 'Whop',
    requirements: '',
    keywords: '',
    minDuration: 15,
    maxDuration: 60,
    active: true
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (campaign) {
      setFormData({
        ...campaign,
        keywords: Array.isArray(campaign.keywords) ? campaign.keywords.join(', ') : campaign.keywords || ''
      });
    }
  }, [campaign]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const dataToSubmit = {
        ...formData,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
        minDuration: parseInt(formData.minDuration),
        maxDuration: parseInt(formData.maxDuration)
      };

      if (campaign?.id) {
        await updateCampaign(campaign.id, dataToSubmit);
        toast.success('Campaña actualizada');
      } else {
        await createCampaign(dataToSubmit);
        toast.success('Campaña creada');
      }
      onSuccess();
    } catch (err) {
      toast.error('Error al guardar la campaña');
    } finally {
      setIsLoading(false);
    }
  };

  const PLATFORMS = ['Whop', 'Pearpop', 'Kick', 'Twitch', 'YouTube', 'TikTok', 'Instagram', 'Otro'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gray-900 w-full max-w-2xl rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-white">{campaign ? 'Editar Campaña' : 'Nueva Campaña'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="campaign-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre</label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                  placeholder="Ej. Promoción Whop Octubre"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Plataforma</label>
                <select
                  name="platform"
                  value={formData.platform}
                  onChange={handleChange}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción y Objetivo</label>
              <textarea
                required
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
                placeholder="¿Qué busca esta campaña? Ej. Atraer usuarios a registrarse en la plataforma..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Requisitos del Clip (Prompt para IA)</label>
              <textarea
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                rows={3}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none font-mono text-sm text-brand-300"
                placeholder="Instrucciones para la IA: El clip debe mencionar ganancias, mostrar prueba social, tener un gancho fuerte en los primeros 3 segundos..."
              />
              <p className="text-xs text-gray-500 mt-1">Estas instrucciones se enviarán al LLM para evaluar y buscar clips que encajen.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Palabras Clave (separadas por coma)</label>
              <input
                type="text"
                name="keywords"
                value={formData.keywords}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                placeholder="ingresos, crypto, trading, comunidad..."
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Duración Mínima (s)</label>
                <input
                  type="number"
                  name="minDuration"
                  value={formData.minDuration}
                  onChange={handleChange}
                  min="5"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Duración Máxima (s)</label>
                <input
                  type="number"
                  name="maxDuration"
                  value={formData.maxDuration}
                  onChange={handleChange}
                  min="10"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="active"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-brand-500 focus:ring-brand-500/50 focus:ring-offset-gray-900"
              />
              <label htmlFor="active" className="text-sm font-medium text-gray-300">Campaña Activa</label>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            form="campaign-form"
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-brand-900/20"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Guardando...' : 'Guardar Campaña'}
          </button>
        </div>
      </div>
    </div>
  );
}
