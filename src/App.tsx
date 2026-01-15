
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import VideoGenerator from './components/VideoGenerator';
import HelpPage from './components/HelpPage';
import CharacterManager from './components/CharacterManager';

export type Tab = 'create' | 'play' | 'edit' | 'animate' | 'help' | 'characters';

export interface ImageForEditing {
  url: string;
  base64: string;
  mimeType: string;
}

export interface CharacterState {
  id: string;
  name: string;
  isActive: boolean;
  images: ImageForEditing[];
  // New fields for generated characters
  age?: string;
  gender?: string;
  hair?: string;
  eyes?: string;
  vibe?: string;
  notes?: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [imageToEdit, setImageToEdit] = useState<ImageForEditing | null>(null);
  const [imageToAnimate, setImageToAnimate] = useState<ImageForEditing | null>(null);
  const [characters, setCharacters] = useState<CharacterState[]>(() => {
    const saved = localStorage.getItem('painter-characters');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('painter-characters', JSON.stringify(characters));
  }, [characters]);

  const handleStartEditing = (image: ImageForEditing) => {
    setImageToEdit(image);
    setActiveTab('edit');
  };

  const handleStartAnimating = (image: ImageForEditing) => {
    setImageToAnimate(image);
    setActiveTab('animate');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'create':
      case 'play':
        return (
          <ImageGenerator 
            mode={activeTab === 'create' ? 'create' : 'play'}
            characters={characters} 
            setCharacters={setCharacters} 
            onStartEditing={handleStartEditing} 
            onStartAnimating={handleStartAnimating} 
          />
        );
      case 'edit':
        return <ImageEditor imageToEdit={imageToEdit} onEditingComplete={() => setImageToEdit(null)} />;
      case 'animate':
        return <VideoGenerator imageToAnimate={imageToAnimate} onAnimationComplete={() => setImageToAnimate(null)} />;
      case 'help':
        return <HelpPage />;
      case 'characters':
        return (
          <CharacterManager 
            savedCharacters={characters.map(c => ({
              id: c.id,
              name: c.name,
              age: c.age || '',
              gender: c.gender || '',
              hair: c.hair || '',
              eyes: c.eyes || '',
              vibe: c.vibe || '',
              notes: c.notes || '',
              imageUrl: c.images[0]?.url || ''
            }))}
            onSave={(newChar) => {
              const charState: CharacterState = {
                id: newChar.id,
                name: newChar.name,
                isActive: true,
                images: [{ url: newChar.imageUrl, base64: '', mimeType: 'image/png' }],
                age: newChar.age,
                gender: newChar.gender,
                hair: newChar.hair,
                eyes: newChar.eyes,
                vibe: newChar.vibe,
                notes: newChar.notes
              };
              setCharacters(prev => [...prev, charState]);
            }}
            onDelete={(id) => {
              setCharacters(prev => prev.filter(c => c.id !== id));
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#fffcf9] min-h-screen font-sans text-stone-600 selection:bg-rose-100">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center p-12 text-stone-300 text-xs tracking-widest">
        <p>QUIET ATELIER &copy; 2025</p>
      </footer>
    </div>
  );
};

export default App;
