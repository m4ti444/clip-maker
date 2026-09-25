import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import VideoInput from '../components/VideoInput';
import ClipSettings from '../components/ClipSettings';
import ProgressBar from '../components/ProgressBar';
import ClipList from '../components/ClipList';
import ClipPreview from '../components/ClipPreview';
import { processVideo, getClips } from '../api/client';
import toast from 'react-hot-toast';

export default function Home() {
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  
  const [settings, setSettings] = useState({
    minDuration: 30,
    maxDuration: 60,
    clipCount: 5,
    addSubtitles: true,
    reframe: true,
    subtitleStyle: 'hormozi'
  });

  useEffect(() => {
    fetchClips();
  }, []);

  const fetchClips = async () => {
    try {
      const res = await getClips();
      setClips(res.data);
    } catch (err) {
      toast.error('Error al cargar los clips');
    }
  };

  const handleProcessVideo = async (inputData) => {
    setIsProcessing(true);
    setActiveJobId(null);
    
    try {
      let response;
      if (inputData.type === 'url') {
        response = await processVideo({ url: inputData.payload, settings });
      } else {
        inputData.payload.append('settings', JSON.stringify(settings));
        response = await processVideo(inputData.payload);
      }
      
      setActiveJobId(response.data.jobId);
      toast.success('Procesamiento iniciado');
    } catch (err) {
      toast.error('Error al iniciar el procesamiento');
      setIsProcessing(false);
    }
  };

  const handleProcessComplete = (newClips) => {
    setIsProcessing(false);
    setActiveJobId(null);
    if (newClips) {
      setClips(prev => [...newClips, ...prev]);
    } else {
      fetchClips();
    }
    toast.success('¡Video procesado con éxito!');
  };

  const handleClipUpdate = (updatedClip) => {
    setClips(prev => prev.map(c => c.id === updatedClip.id ? updatedClip : c));
    if (selectedClip && selectedClip.id === updatedClip.id) {
      setSelectedClip(updatedClip);
    }
  };

  const handleClipDelete = (id) => {
    setClips(prev => prev.filter(c => c.id !== id));
    if (selectedClip && selectedClip.id === id) {
      setSelectedClip(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <Header 
        title="Generador de Clips AI" 
        description="Transforma videos largos en clips virales optimizados para redes sociales"
      />
      
      <div className="p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column - Inputs */}
          <div className="xl:col-span-1 space-y-6">
            <VideoInput onSubmit={handleProcessVideo} isLoading={isProcessing} />
            <ClipSettings settings={settings} setSettings={setSettings} />
          </div>

          {/* Right Column - Results */}
          <div className="xl:col-span-2 space-y-6 flex flex-col">
            {activeJobId && (
              <ProgressBar jobId={activeJobId} onComplete={handleProcessComplete} />
            )}
            
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">Tus Clips</h3>
                <div className="flex gap-2">
                  <select className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-500">
                    <option>Más recientes</option>
                    <option>Mayor Score Viral</option>
                    <option>Mayor duración</option>
                  </select>
                </div>
              </div>
              
              <ClipList 
                clips={clips} 
                onPreview={setSelectedClip} 
                onTrim={setSelectedClip} 
                onDeleteSuccess={handleClipDelete}
              />
            </div>
          </div>
        </div>
      </div>

      {selectedClip && (
        <ClipPreview 
          clip={selectedClip} 
          onClose={() => setSelectedClip(null)} 
          onUpdate={handleClipUpdate}
        />
      )}
    </div>
  );
}
