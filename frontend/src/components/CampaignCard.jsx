import React from 'react';
import { Target, Tag, Clock, Film, Edit, Trash2 } from 'lucide-react';

export default function CampaignCard({ campaign, onEdit, onDelete, onClick }) {
  const getPlatformColor = (platform) => {
    switch (platform.toLowerCase()) {
      case 'whop': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'pearpop': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'kick': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'twitch': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'youtube': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  return (
    <div 
      className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-brand-500/50 transition-colors cursor-pointer group flex flex-col"
      onClick={() => onClick(campaign)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${campaign.active ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <h3 className="font-semibold text-lg text-white group-hover:text-brand-400 transition-colors">{campaign.name}</h3>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPlatformColor(campaign.platform)}`}>
            {campaign.platform}
          </span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(campaign); }}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(campaign.id); }}
            className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-red-500/20 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-1">
        {campaign.description}
      </p>

      <div className="space-y-3 mt-auto border-t border-gray-800 pt-4">
        {campaign.keywords && campaign.keywords.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Tag className="w-4 h-4 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {campaign.keywords.slice(0, 3).map((kw, i) => (
                <span key={i} className="bg-gray-950 px-2 py-0.5 rounded border border-gray-800 text-xs text-gray-300">
                  {kw}
                </span>
              ))}
              {campaign.keywords.length > 3 && (
                <span className="text-xs text-gray-500">+{campaign.keywords.length - 3}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{campaign.minDuration}s - {campaign.maxDuration}s</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Film className="w-4 h-4" />
            <span>{campaign.clipCount || 0} clips</span>
          </div>
        </div>
      </div>
    </div>
  );
}
