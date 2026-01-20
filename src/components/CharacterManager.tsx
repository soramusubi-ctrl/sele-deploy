import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import Button from './Button';
import Spinner from './Spinner';
import { compressImage, blobToBase64 } from '../utils/imageUtils';

type CharacterType = 'human' | 'animal' | 'creature' | 'object';

interface Character {
  id: string;
  type: CharacterType;  
  species?: string;      
  name: string;
  age: string;
  gender: string;
  hair: string;          
  eyes: string;
  vibe: string;
  notes: string;
  imageUrl: string;
}

interface CharacterManagerProps {
  savedCharacters: Character[];
  onSave: (character: Character) => void;
  onDelete: (id: string) => void;
}

const CharacterManager: React.FC<CharacterManagerProps> = ({ savedCharacters, onSave, onDelete }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [newChar, setNewChar] = useState({
  type: 'human' as CharacterType, 
  species: '',                      
  name: '',
  age: '',
  gender: '',
  hair: '',
  eyes: '',
  vibe: '',
  notes: ''
});

  const [previewUrl, setPreviewUrl] = useState('');

  const handleGeneratePreview = async () => {
    if (!newChar.name) return;
    setIsGenerating(true);
    try {
          const subject =
      newChar.type === 'human'
        ? `${newChar.name}, ${newChar.age} ${newChar.gender}`
        : newChar.type === 'animal'
          ? `${newChar.name} (a ${newChar.species || 'animal'})`
          : newChar.type === 'creature'
            ? `${newChar.name} (a ${newChar.species || 'fantasy creature'})`
            : `${newChar.name} (an object)`;

    const hairLabel =
      newChar.type === 'human' ? 'hair' :
      newChar.type === 'object' ? 'material/appearance' :
      'fur/coat';

    const prompt = `A high-quality character portrait of ${subject}.
Appearance: ${newChar.hair} ${hairLabel}, ${newChar.eyes} eyes.
Atmosphere: ${newChar.vibe}.
Special notes: ${newChar.notes}.
Style: Soft and beautiful modern anime style, slightly realistic with transparent and delicate coloring.
Luminous lighting, ethereal atmosphere, high detail, simple artistic background.`;

      if (base64Data) {
        // 生成された画像を圧縮して保存（ストレージ節約とAPI制限回避のため）
        const rawUrl = `data:image/png;base64,${base64Data}`;
        const compressedBlob = await compressImage(rawUrl, 1024, 0.8);
        const compressedBase64 = await blobToBase64(compressedBlob);
        setPreviewUrl(`data:image/webp;base64,${compressedBase64}`);
      }
    } catch (err) {
      console.error("Character generation failed", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!newChar.name || !previewUrl) return;
    onSave({
      id: Date.now().toString(),
      ...newChar,
      imageUrl: previewUrl
    });
    setNewChar({ name: '', age: '', gender: '', hair: '', eyes: '', vibe: '', notes: '' });
    setPreviewUrl('');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-stone-700">キャラクター設定</h2>
        <p className="text-stone-400 text-sm italic">あなたの物語を彩る、大切な登場人物たち</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8">
        {/* Input Form */}
<div>
  <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">種別</label>
  <select
    value={newChar.type}
    onChange={(e) => setNewChar({ ...newChar, type: e.target.value as CharacterType })}
    className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none border border-transparent focus:border-rose-100"
  >
    <option value="human">人</option>
    <option value="animal">動物</option>
    <option value="creature">架空生物</option>
    <option value="object">モノ</option>
  </select>
</div>

{(newChar.type === 'animal' || newChar.type === 'creature') && (
  <div>
    <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">種族</label>
    <input
      value={newChar.species}
      onChange={(e) => setNewChar({ ...newChar, species: e.target.value })}
      className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none border border-transparent focus:border-rose-100"
      placeholder="例: 猫、柴犬、狐、ドラゴン"
    />
  </div>
)}

        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-50 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">名前</label>
              <input 
                value={newChar.name} 
                onChange={e => setNewChar({...newChar, name: e.target.value})}
                className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none border border-transparent focus:border-rose-100"
                placeholder="例: エレン"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">年代</label>
                <input 
                  value={newChar.age} 
                  onChange={e => setNewChar({...newChar, age: e.target.value})}
                  className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none"
                  placeholder="例: 10代後半"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">性別</label>
                <input 
                  value={newChar.gender} 
                  onChange={e => setNewChar({...newChar, gender: e.target.value})}
                  className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none"
                  placeholder="例: 女性"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">髪型・髪色</label>
              <input 
                value={newChar.hair} 
                onChange={e => setNewChar({...newChar, hair: e.target.value})}
                className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none"
                placeholder="例: 銀色のロングヘア"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">目の色</label>
              <input 
                value={newChar.eyes} 
                onChange={e => setNewChar({...newChar, eyes: e.target.value})}
                className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none"
                placeholder="例: 碧眼"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">雰囲気</label>
              <input 
                value={newChar.vibe} 
                onChange={e => setNewChar({...newChar, vibe: e.target.value})}
                className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none"
                placeholder="例: 儚げで神秘的"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">特記事項</label>
              <textarea 
                value={newChar.notes} 
                onChange={e => setNewChar({...newChar, notes: e.target.value})}
                className="w-full bg-stone-50 rounded-xl p-3 text-[14px] outline-none h-20 resize-none"
                placeholder="例: 丸眼鏡をかけている"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleGeneratePreview} 
              disabled={isGenerating || !newChar.name}
              className="w-full py-4 bg-rose-400 text-white rounded-full font-bold shadow-md hover:bg-rose-500 transition-all flex items-center justify-center space-x-2"
            >
              {isGenerating ? <Spinner size="sm" /> : <span>姿を描き起こす</span>}
            </Button>
          </div>
        </div>

        {/* Preview & Saved List */}
        <div className="space-y-6">
          {/* Preview Card */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-50 flex flex-col items-center justify-center min-h-[300px]">
            {previewUrl ? (
              <div className="space-y-4 w-full text-center">
                <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-rose-50 shadow-inner">
                  <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                </div>
                <p className="text-stone-400 text-xs italic">この姿でよろしいですか？</p>
                <Button 
                  onClick={handleSave} 
                  disabled={savedCharacters.length >= 5}
                  className="px-8 py-2 bg-stone-700 text-white rounded-full text-sm font-bold hover:bg-stone-800 transition-all"
                >
                  {savedCharacters.length >= 5 ? '登録上限です' : 'このキャラを保存する'}
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <div className="w-24 h-24 mx-auto bg-stone-50 rounded-full flex items-center justify-center text-stone-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-stone-300 text-sm">設定を入力して姿を描き起こしてください</p>
              </div>
            )}
          </div>

          {/* Saved Characters List */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4">登録済みのキャラクター ({savedCharacters.length}/5)</h3>
            <div className="grid grid-cols-1 gap-3">
              {savedCharacters.map(char => (
                <div key={char.id} className="bg-white rounded-3xl p-3 shadow-sm border border-stone-50 flex items-center justify-between group">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-rose-50">
                      <img src={char.imageUrl} className="w-full h-full object-cover" alt={char.name} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-700">{char.name}</h4>
                      <p className="text-[10px] text-stone-400">{char.age} / {char.gender}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDelete(char.id)}
                    className="p-2 text-stone-200 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {savedCharacters.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-stone-100 rounded-[2.5rem]">
                  <p className="text-stone-300 text-xs italic">まだ誰も登録されていません</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterManager;
