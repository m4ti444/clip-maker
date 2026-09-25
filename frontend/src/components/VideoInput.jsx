import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, Upload, Loader2, Play } from 'lucide-react';

export default function VideoInput({ onSubmit, isLoading }) {
  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'url' && url) {
      onSubmit({ type: 'url', payload: url });
    } else if (activeTab === 'upload' && file) {
      const formData = new FormData();
      formData.append('file', file);
      onSubmit({ type: 'upload', payload: formData });
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden transition-all duration-200 shadow-sm">
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('url')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'url' ? 'text-brand-400 border-b-2 border-brand-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
        >
          <Link className="w-4 h-4" />
          Enlace de Video
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'upload' ? 'text-brand-400 border-b-2 border-brand-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
        >
          <Upload className="w-4 h-4" />
          Subir Archivo
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'url' ? (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">URL del Video (YouTube, Twitch, etc.)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'}`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragActive ? 'text-brand-400' : 'text-gray-500'}`} />
              {file ? (
                <div>
                  <p className="text-brand-400 font-medium">{file.name}</p>
                  <p className="text-gray-500 text-sm mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-300 font-medium">Arrastra un video aquí, o haz clic para seleccionar</p>
                  <p className="text-gray-500 text-sm mt-2">MP4, MOV, MKV hasta 2GB</p>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading || (activeTab === 'url' && !url) || (activeTab === 'upload' && !file)}
          className="mt-6 w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {isLoading ? 'Procesando...' : 'Generar Clips'}
        </button>
      </div>
    </div>
  );
}
