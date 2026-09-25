import React from 'react';

export default function Header({ title, description }) {
  return (
    <header className="px-8 py-6 border-b border-gray-800 bg-gray-900/30 backdrop-blur-sm sticky top-0 z-10">
      <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
      {description && <p className="text-gray-400">{description}</p>}
    </header>
  );
}
