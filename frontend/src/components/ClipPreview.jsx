import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Scissors, Play, Pause, Save } from 'lucide-react';
import { downloadClip, trimClip } from '../api/client';
import toast from 'react-hot-toast';

export default function ClipPreview({ clip, onClose, onUpdate }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(clip.duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Reset values if clip changes (though modal usually unmounts)
    setTrimStart(0);
    setTrimEnd(clip.duration);
  }, [clip]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (isTrimming && time >= trimEnd) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = trimStart;
      }
    }
  };

  const handleSaveTrim = async () => {
    setIsSaving(true);
    try {
      const res = await trimClip(clip.id, { start: trimStart, end: trimEnd });
      toast.success('Clip ajustado correctamente');
      if (onUpdate) onUpdate(res.data);
      setIsTrimming(false);
    } catch (err) {
      toast.error('Error al guardar ajuste');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await downloadClip(clip.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clip_${clip.id}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error('Error al descargar el clip');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gray-900 w-full max-w-5xl rounded-2xl border border-gray-700 shadow-2xl flex flex-col md:flex-row overflow-hidden animate-fade-in max-h-[90vh]">
        
        {/* Video Area */}
        <div className="relative flex-1 bg-black flex flex-col">
          <div className="relative flex-1 flex items-center justify-center min-h-[300px]">
            <video 
              ref={videoRef}
              src={clip.url} 
              className="w-full max-h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />
            
            {/* Play/Pause Overlay */}
            {!isPlaying && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                onClick={togglePlay}
              >
                <div className="bg-brand-600/90 text-white rounded-full p-4 backdrop-blur-sm hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 ml-1" />
                </div>
              </div>
            )}
          </div>
          
          {/* Custom Controls / Trimmer */}
          <div className="bg-gray-950 p-4 border-t border-gray-800">
            {isTrimming ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>{trimStart.toFixed(1)}s</span>
                  <span>{trimEnd.toFixed(1)}s</span>
                </div>
                
                {/* Visual Trimmer Slider (simplified) */}
                <div className="relative h-12 bg-gray-800 rounded-lg overflow-hidden flex items-center px-4">
                   <input 
                    type="range" 
                    min="0" 
                    max={clip.duration} 
                    step="0.1"
                    value={trimStart}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val < trimEnd - 1) {
                        setTrimStart(val);
                        if(videoRef.current) videoRef.current.currentTime = val;
                      }
                    }}
                    className="absolute w-full left-0 z-10 opacity-0 cursor-ew-resize h-full"
                  />
                  <input 
                    type="range" 
                    min="0" 
                    max={clip.duration} 
                    step="0.1"
                    value={trimEnd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > trimStart + 1) setTrimEnd(val);
                    }}
                    className="absolute w-full left-0 z-20 opacity-0 cursor-ew-resize h-full"
                  />
                  
                  {/* Visual representation */}
                  <div className="absolute inset-y-0 bg-gray-900 left-0" style={{ width: `${(trimStart / clip.duration) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-brand-600/30 border-y-2 border-brand-500" style={{ left: `${(trimStart / clip.duration) * 100}%`, right: `${100 - (trimEnd / clip.duration) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-gray-900 right-0" style={{ width: `${100 - (trimEnd / clip.duration) * 100}%` }} />
                  
                  {/* Current time indicator */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30" style={{ left: `${(currentTime / clip.duration) * 100}%` }} />
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsTrimming(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
                  <button 
                    onClick={handleSaveTrim} 
                    disabled={isSaving}
                    className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Guardando...' : 'Guardar Corte'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-gray-300 hover:text-white focus:outline-none">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-500" 
                    style={{ width: `${(currentTime / clip.duration) * 100}%` }} 
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {Math.floor(currentTime)}s / {clip.duration}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="w-full md:w-80 lg:w-96 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-y-auto">
          <div className="p-4 flex justify-between items-start border-b border-gray-800">
            <h3 className="font-semibold text-lg text-white leading-tight pr-4">{clip.title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-full p-1.5 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-6 flex-1">
            
            {/* Stats row */}
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-950 rounded-lg border border-gray-800 p-3 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Score Viral</div>
                <div className={`text-xl font-bold ${clip.viralityScore > 85 ? 'text-green-400' : clip.viralityScore > 70 ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {clip.viralityScore}/100
                </div>
              </div>
              <div className="flex-1 bg-gray-950 rounded-lg border border-gray-800 p-3 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Duración</div>
                <div className="text-xl font-bold text-gray-200">
                  {clip.duration}s
                </div>
              </div>
            </div>

            {/* Campaign Match */}
            {clip.campaignMatch && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Campaña Recomendada</h4>
                <div className="bg-brand-900/20 border border-brand-500/30 rounded-lg p-3">
                  <span className="text-brand-400 font-medium">{clip.campaignMatch}</span>
                  <p className="text-xs text-gray-400 mt-1">Este clip encaja perfectamente con los requerimientos de la campaña.</p>
                </div>
              </div>
            )}

            {/* Transcript */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Transcripción</h4>
              <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 text-sm text-gray-300 h-48 overflow-y-auto leading-relaxed">
                {clip.transcript || clip.transcriptPreview || "Transcripción no disponible."}
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-md grid grid-cols-2 gap-3">
            <button 
              onClick={() => setIsTrimming(!isTrimming)}
              className={`py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition-colors border
                ${isTrimming ? 'bg-gray-800 text-white border-gray-700' : 'bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white'}`}
            >
              <Scissors className="w-4 h-4" />
              Recortar
            </button>
            <button 
              onClick={handleDownload}
              className="py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition-colors shadow-lg shadow-brand-900/20"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
