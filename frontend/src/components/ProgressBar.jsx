import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { getStatus } from '../api/client';

const STEPS = [
  { id: 'download', label: 'Descargando' },
  { id: 'transcribe', label: 'Transcribiendo' },
  { id: 'analyze', label: 'Analizando' },
  { id: 'cut', label: 'Cortando' },
  { id: 'export', label: 'Exportando' }
];

export default function ProgressBar({ jobId, onComplete }) {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getStatus(jobId);
        setStatus(res.data);
        setProgress(res.data.progress || 0);

        if (res.data.status === 'completed') {
          clearInterval(interval);
          onComplete(res.data.clips);
        } else if (res.data.status === 'error') {
          clearInterval(interval);
          // Handle error gracefully if needed
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  if (!jobId || !status) return null;

  const currentStepIndex = STEPS.findIndex(s => s.id === status.step);
  const safeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-white flex items-center gap-2">
          {status.status === 'completed' ? (
            <><Check className="w-5 h-5 text-green-500" /> ¡Proceso Completado!</>
          ) : (
            <><Loader2 className="w-5 h-5 animate-spin text-brand-500" /> Procesando Video...</>
          )}
        </h3>
        <span className="text-brand-400 font-bold">{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-3 mb-6 overflow-hidden relative">
        <div 
          className="bg-brand-600 h-3 rounded-full transition-all duration-500 relative"
          style={{ width: `${progress}%` }}
        >
          {status.status !== 'completed' && (
            <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < safeIndex || status.status === 'completed';
          const isCurrent = index === safeIndex && status.status !== 'completed';
          
          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors mb-2 z-10
                ${isCompleted ? 'bg-brand-600 text-white' : 
                  isCurrent ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' : 
                  'bg-gray-800 text-gray-500'}`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className={`text-xs text-center ${isCurrent || isCompleted ? 'text-gray-300' : 'text-gray-600'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
