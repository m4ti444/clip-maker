import React, { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getStatus } from '../api/client';

const STEPS = [
  { id: 'download', label: 'Descarga' },
  { id: 'transcribe', label: 'Transcripción' },
  { id: 'analyze', label: 'Análisis IA' },
  { id: 'cut', label: 'Corte 9:16' },
  { id: 'export', label: 'Listo' }
];

export default function ProgressBar({ jobId, onComplete, onError }) {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(5);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;

    const pollStatus = async () => {
      try {
        const res = await getStatus(jobId);
        if (!isMounted) return;

        const data = res.data;
        setStatus(data);
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }

        if (data.status === 'done' || data.status === 'completed') {
          if (interval) clearInterval(interval);
          localStorage.removeItem('clipengine_active_job_id');
          if (onComplete) {
            onComplete(data.clips || []);
          }
        } else if (data.status === 'error') {
          if (interval) clearInterval(interval);
          localStorage.removeItem('clipengine_active_job_id');
          setErrorMsg(data.message || 'Ocurrió un error en el procesamiento');
          if (onError) {
            onError(data.message);
          }
        }
      } catch (err) {
        // Si el job ya no existe (404 por reinicio de servidor), limpiar estado inmediatamente
        if (err.response?.status === 404) {
          if (interval) clearInterval(interval);
          localStorage.removeItem('clipengine_active_job_id');
          if (onError) {
            onError('La tarea anterior finalizó o el servidor fue reiniciado.');
          }
          return;
        }
        console.error('Error al consultar estado:', err);
      }
    };

    // Consulta inmediata al cargar
    pollStatus();
    const interval = setInterval(pollStatus, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [jobId, onComplete, onError]);

  if (!jobId) return null;

  const currentStep = status?.step || 'download';
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const safeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isDone = status?.status === 'done' || status?.status === 'completed';
  const isError = status?.status === 'error' || !!errorMsg;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl transition-all">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-white flex items-center gap-2 text-base">
          {isError ? (
            <span className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 text-red-500" /> Error al procesar
            </span>
          ) : isDone ? (
            <span className="flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5 text-green-500" /> ¡Proceso Completado con Éxito!
            </span>
          ) : (
            <span className="flex items-center gap-2 text-violet-400">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" /> 
              Procesando Video...
            </span>
          )}
        </h3>
        <span className={`font-bold text-sm px-2.5 py-1 rounded-md ${
          isError ? 'bg-red-500/20 text-red-300' :
          isDone ? 'bg-green-500/20 text-green-300' : 
          'bg-violet-500/20 text-violet-300'
        }`}>
          {isError ? 'Falló' : `${Math.round(progress)}%`}
        </span>
      </div>

      {/* Mensaje de estado descriptivo */}
      <p className="text-sm text-gray-300 mb-4 flex items-center gap-2">
        {status?.message || 'Iniciando el procesamiento...'}
      </p>

      {/* Barra de progreso visual */}
      <div className="w-full bg-gray-800 rounded-full h-3 mb-6 overflow-hidden relative">
        <div 
          className={`h-3 rounded-full transition-all duration-500 relative ${
            isError ? 'bg-red-500' :
            isDone ? 'bg-green-500' : 
            'bg-violet-600'
          }`}
          style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
        >
          {!isDone && !isError && (
            <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse" />
          )}
        </div>
      </div>

      {/* Pasos secuenciales */}
      <div className="flex justify-between items-center gap-1">
        {STEPS.map((step, index) => {
          const isCompletedStep = index < safeIndex || isDone;
          const isCurrentStep = index === safeIndex && !isDone && !isError;
          
          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors mb-1.5
                ${isCompletedStep ? 'bg-green-600 text-white' : 
                  isCurrentStep ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' : 
                  isError && index === safeIndex ? 'bg-red-600 text-white' :
                  'bg-gray-800 text-gray-500'}`}
              >
                {isCompletedStep ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <span className={`text-[11px] font-medium text-center truncate max-w-full ${
                isCurrentStep ? 'text-violet-300 font-semibold' : 
                isCompletedStep ? 'text-gray-300' : 
                'text-gray-600'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {isError && (
        <div className="mt-4 p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-xs text-red-200 flex justify-between items-center">
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
