import React from 'react';
import { Download, Trash2, Play, Scissors, TrendingUp, Target, Clock, AlertCircle } from 'lucide-react';
import { downloadClip, deleteClip } from '../api/client';
import toast from 'react-hot-toast';

export default function ClipList({ clips, onPreview, onTrim, onDeleteSuccess }) {
  
  const handleDownload = async (id, e) => {
    e.stopPropagation();
    try {
      const response = await downloadClip(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clip_${id}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error('Error al descargar el clip');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Seguro que quieres eliminar este clip?')) return;
    try {
      await deleteClip(id);
      toast.success('Clip eliminado');
      if (onDeleteSuccess) onDeleteSuccess(id);
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  if (!clips || clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-900/50 rounded-xl border border-gray-800/50 border-dashed">
        <Scissors className="w-16 h-16 text-gray-700 mb-4" />
        <h3 className="text-xl font-medium text-gray-300 mb-2">No hay clips generados</h3>
        <p className="text-gray-500 text-center max-w-md">
          Sube un video o pega un enlace para que nuestra IA comience a extraer los mejores momentos.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {clips.map(clip => (
        <div 
          key={clip.id} 
          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-brand-900/10 group cursor-pointer flex flex-col h-full"
          onClick={() => onPreview(clip)}
        >
          {/* Thumbnail area */}
          <div className="relative aspect-video bg-gray-950">
            {clip.thumbnail ? (
              <img src={clip.thumbnail} alt={clip.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800/50">
                <Play className="w-12 h-12 text-gray-600" />
              </div>
            )}
            
            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-brand-600 rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform">
                <Play className="w-6 h-6 text-white ml-1" />
              </div>
            </div>
            
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium text-white flex items-center gap-1.5 border border-gray-700/50">
                <Clock className="w-3 h-3 text-gray-400" />
                {clip.duration}s
              </div>
            </div>
            
            <div className="absolute top-3 right-3">
              <div className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-lg
                ${clip.viralityScore > 85 ? 'bg-green-500/90 text-white' : 
                  clip.viralityScore > 70 ? 'bg-yellow-500/90 text-white' : 
                  'bg-gray-700/90 text-gray-200'}`}
              >
                <TrendingUp className="w-3 h-3" />
                Score: {clip.viralityScore}
              </div>
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col">
            <h4 className="font-semibold text-gray-100 mb-2 line-clamp-2 leading-snug group-hover:text-brand-400 transition-colors">
              {clip.title}
            </h4>
            
            {clip.campaignMatch && (
              <div className="mb-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-500/10 text-brand-400 text-xs rounded border border-brand-500/20">
                  <Target className="w-3 h-3" />
                  {clip.campaignMatch}
                </span>
              </div>
            )}
            
            <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">
              {clip.transcriptPreview || "Sin transcripción disponible..."}
            </p>

            <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-800">
              <button 
                onClick={(e) => handleDownload(clip.id, e)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); onTrim(clip); }}
                className="p-2 bg-gray-800 hover:bg-brand-600/20 hover:text-brand-400 text-gray-400 rounded-lg transition-colors border border-transparent hover:border-brand-500/30"
                title="Ajustar cortes"
              >
                <Scissors className="w-4 h-4" />
              </button>
              
              <button 
                onClick={(e) => handleDelete(clip.id, e)}
                className="p-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 text-gray-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                title="Eliminar clip"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
