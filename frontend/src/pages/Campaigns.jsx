import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import CampaignCard from '../components/CampaignCard';
import CampaignForm from '../components/CampaignForm';
import { getCampaigns, deleteCampaign, classifyCampaigns } from '../api/client';
import { Plus, Target, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await getCampaigns();
      setCampaigns(res.data);
    } catch (err) {
      toast.error('Error al cargar campañas');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta campaña?')) return;
    try {
      await deleteCampaign(id);
      toast.success('Campaña eliminada');
      fetchCampaigns();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setEditingCampaign(null);
    setIsFormOpen(true);
  };

  const handleClassify = async () => {
    setIsClassifying(true);
    try {
      const res = await classifyCampaigns();
      toast.success(`Clasificación completada. ${res.data.matches} coincidencias encontradas.`);
      fetchCampaigns(); // Refresh to update clip counts
    } catch (err) {
      toast.error('Error en la clasificación automática');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleCampaignClick = (campaign) => {
    // Navigate to clips filtered by this campaign (to be implemented in router)
    toast.success(`Mostrando clips de ${campaign.name}`);
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.platform.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <Header 
        title="Campañas" 
        description="Gestiona tus requerimientos y deja que la IA asigne los mejores clips a cada campaña"
      />
      
      <div className="p-8 max-w-7xl mx-auto w-full flex-1">
        
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar campañas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={handleClassify}
              disabled={isClassifying || campaigns.length === 0}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors border border-gray-700"
            >
              {isClassifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4 text-brand-400" />}
              {isClassifying ? 'Clasificando...' : 'Auto-Clasificar Clips'}
            </button>
            <button 
              onClick={handleNew}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-900/20"
            >
              <Plus className="w-4 h-4" />
              Nueva Campaña
            </button>
          </div>
        </div>

        {/* Campaign Grid */}
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-900/50 rounded-xl border border-gray-800/50 border-dashed">
            <Target className="w-16 h-16 text-gray-700 mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">No hay campañas activas</h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Crea campañas definiendo requisitos (duración, palabras clave, plataforma) y la IA asignará automáticamente los clips generados que encajen mejor.
            </p>
            <button 
              onClick={handleNew}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors"
            >
              Crear mi primera campaña
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCampaigns.map(campaign => (
              <CampaignCard 
                key={campaign.id} 
                campaign={campaign} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClick={handleCampaignClick}
              />
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <CampaignForm 
          campaign={editingCampaign} 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false);
            fetchCampaigns();
          }}
        />
      )}
    </div>
  );
}
