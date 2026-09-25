import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Scissors, Target, Settings as SettingsIcon, Film } from 'lucide-react';

import Home from './pages/Home';
import Campaigns from './pages/Campaigns';
import Settings from './pages/Settings';
import CredentialsModal from './components/CredentialsModal';
import { hasCredentials as checkHasCredentials } from './utils/crypto';

export default function App() {
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    if (checkHasCredentials()) {
      setHasCredentials(true);
    }
  }, []);

  return (
    <>
      {!hasCredentials && <CredentialsModal onSuccess={() => setHasCredentials(true)} />}
      <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151'
          }
        }}
      />
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-900/50 flex flex-col transition-all">
        <div className="p-6 flex items-center gap-3 border-b border-gray-800">
          <div className="bg-brand-600 p-2 rounded-lg">
            <Film className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            ClipEngine
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`
            }
          >
            <Scissors className="w-5 h-5" />
            <span className="font-medium">Inicio</span>
          </NavLink>
          
          <NavLink 
            to="/campaigns" 
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`
            }
          >
            <Target className="w-5 h-5" />
            <span className="font-medium">Campañas</span>
          </NavLink>
          
          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`
            }
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="font-medium">Ajustes</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
    </>
  );
}
