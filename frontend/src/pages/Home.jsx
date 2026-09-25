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
        const payload = {
          url: inputData.payload,
          min_duration: Number(settings.minDuration) || 30,
          max_duration: Number(settings.maxDuration) || 60,
          clip_count: Number(settings.clipCount) || 5,
          add_subtitles: Boolean(settings.addSubtitles),
          reframe_vertical: Boolean(settings.reframe),
          subtitle_style: settings.subtitleStyle || 'hormozi'
        };
        response = await processVideo(payload);
      } else {
        const formData = inputData.payload;
        formData.append('min_duration', Number(settings.minDuration) || 30);
        formData.append('max_duration', Number(settings.maxDuration) || 60);
        formData.append('clip_count', Number(settings.clipCount) || 5);
        formData.append('add_subtitles', Boolean(settings.addSubtitles));
        formData.append('reframe_vertical', Boolean(settings.reframe));
        formData.append('subtitle_style', settings.subtitleStyle || 'hormozi');
        response = await processVideo(formData);
      }
      
      const jobId = response.data?.job_id || response.data?.jobId;
      if (jobId) {
        setActiveJobId(jobId);
        toast.success('Procesamiento iniciado');
      } else {
        throw new Error('No se recibió ID de tarea del servidor');
      }
    } catch (err) {
      console.error('Error al iniciar el procesamiento:', err);
      const msg = err.response?.data?.detail || err.message || 'Error al iniciar el procesamiento';
      toast.error(msg);
      setIsProcessing(false);
    }
  };

  const handleProcessError = (errMsg) => {
    setIsProcessing(false);
    toast.error(errMsg || 'Error durante la generación de clips');
  };

  const handleProcessComplete = (newClips) => {
    setIsProcessing(false);
    setActiveJobId(null);
    if (newClips && newClips.length > 0) {
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
              <ProgressBar 
                jobId={activeJobId} 
                onComplete={handleProcessComplete} 
                onError={handleProcessError} 
              />
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
