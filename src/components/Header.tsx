
import React from 'react';
import type { Tab } from '../App';

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: Tab; label: string; icon: React.ReactElement }[] = [
    { id: 'create', label: '描く', icon: <PaintBrushIcon /> },
    { id: 'play', label: '遊ぶ', icon: <GameIcon /> },
    { id: 'edit', label: '直す', icon: <WandIcon /> },
    { id: 'animate', label: '動かす', icon: <FilmIcon /> },
  ];

  return (
    <header className="sticky top-4 z-20 mx-auto max-w-fit">
      <div className="bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-full px-2 py-2 border border-white/50">
        <nav className="flex items-center space-x-1">
          <div className="flex items-center px-3 pr-4 border-r border-stone-100 mr-1">
             <span className="text-xl mr-2">🎨</span>
             <span className="font-bold text-stone-700 hidden sm:inline">アトリエ</span>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ease-out ${
                activeTab === tab.id
                  ? 'bg-rose-100 text-rose-600 shadow-inner'
                  : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};

const PaintBrushIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
);

const GameIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const WandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5l-2.293 2.293a1 1 0 000 1.414l4.586 4.586a1 1 0 001.414 0l2.293-2.293m-8.586 0L2 22m10.5-11.5L15 6.5m-3 3l-1.5-1.5" />
    </svg>
);

const FilmIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
);

export default Header;
