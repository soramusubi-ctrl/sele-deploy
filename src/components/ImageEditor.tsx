
import React, { useState, useMemo, useEffect } from 'react';
import { editImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { checkRateLimit, getRemainingCount } from '../utils/rateLimiter';
import Card from './Card';
import Button from './Button';
import Spinner from './Spinner';
import type { ImageForEditing } from '../App';

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const DiamondIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
);

// One-click edit icons
const SmileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const HandWaveIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5c0-.828.672-1.5 1.5-1.5h.01c.828 0 1.5.672 1.5 1.5V14m-3-2.5h3M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002-2v-1a2 2 0 012-2h1.945M19 12h-1.055M12 4.5v.01" />
    </svg>
);

const TurnAroundIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-6-6m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
);

const TurnSideIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
         <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


const predefinedEdits = [
  {
    label: 'えがお',
    prompt: '被写体を自然な笑顔にしてください',
    icon: <SmileIcon />,
  },
  {
    label: 'びっくり',
    prompt: '被写体を驚いた表情にしてください',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
         <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
    {
    label: 'かなしみ',
    prompt: '被写体を悲しい表情にしてください',
    icon: (
         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" transform="scale(1, -1) translate(0, -24)" />
         </svg>
    ),
  },
  {
    label: 'てをふる',
    prompt: '被写体がこちらに手を振っているポーズにしてください',
    icon: <HandWaveIcon/>,
  },
  {
    label: 'うしろ',
    prompt: '被写体を後ろ向きにしてください',
    icon: <TurnAroundIcon />,
  },
  {
    label: 'よこ',
    prompt: '被写体を横向きにしてください',
    icon: <TurnSideIcon />,
  },
];


interface Layer {
    id: string;
    prompt: string;
    imageBase64: string | null;
    isVisible: boolean;
    isLoading: boolean;
    error?: string;
}

interface ImageEditorProps {
    imageToEdit: ImageForEditing | null;
    onEditingComplete: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ imageToEdit, onEditingComplete }) => {
    const [prompt, setPrompt] = useState<string>('');
    const [originalImage, setOriginalImage] = useState<{ url: string; base64: string; mimeType: string; } | null>(null);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [brightness, setBrightness] = useState<number>(100);
    const [useProModel, setUseProModel] = useState<boolean>(false);
    const [hasApiKey, setHasApiKey] = useState<boolean>(false);
    const [remainingEdits, setRemainingEdits] = useState<number>(getRemainingCount('edit'));

    useEffect(() => {
        if (imageToEdit) {
            setOriginalImage(imageToEdit);
            setLayers([]);
            setBrightness(100);
            setError(null);
            onEditingComplete();
        }
    }, [imageToEdit, onEditingComplete]);

    useEffect(() => {
        const checkApiKey = async () => {
            const aistudio = (window as any).aistudio;
            if (aistudio?.hasSelectedApiKey) {
                const hasKey = await aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            }
        };
        checkApiKey();
    }, []);

    const handleSelectKey = async () => {
        const aistudio = (window as any).aistudio;
        if (aistudio?.openSelectKey) {
            try {
                await aistudio.openSelectKey();
                setHasApiKey(true);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setError(null);
            try {
                const { base64, mimeType } = await fileToBase64(file);
                const newImage = { url: URL.createObjectURL(file), base64, mimeType };
                setOriginalImage(newImage);
                setLayers([]);
                setBrightness(100);
            } catch (err) {
                setError("画像の読み込みに失敗しました。");
                setOriginalImage(null);
                setLayers([]);
            }
        }
    };

    const handleAddLayer = async () => {
        if (!prompt || !originalImage) {
            setError('画像をアップロードし、編集指示を入力してください。');
            return;
        }

        if (!checkRateLimit('edit')) {
            setError('本日の編集回数上限（10回）に達しました。明日またお試しください。');
            return;
        }

        const baseLayer = layers.find(l => l.isVisible && l.imageBase64);
        const baseImage = baseLayer ? { base64: baseLayer.imageBase64, mimeType: originalImage.mimeType } : { base64: originalImage.base64, mimeType: originalImage.mimeType };

        if (!baseImage.base64) return;
        
        setIsLoading(true);
        setError(null);
        
        const newLayer: Layer = {
            id: Date.now().toString(),
            prompt,
            imageBase64: null,
            isVisible: true,
            isLoading: true,
        };

        setLayers(prev => [newLayer, ...prev]);
        setPrompt('');

        try {
            const resultBase64 = await editImage(prompt, baseImage.base64, baseImage.mimeType, useProModel);
            setLayers(prev => prev.map(l => l.id === newLayer.id ? { ...l, imageBase64: resultBase64, isLoading: false } : l));
            setRemainingEdits(getRemainingCount('edit'));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '編集中にエラーが発生しました。';
            setError(errorMessage);
            setLayers(prev => prev.map(l => l.id === newLayer.id ? { ...l, error: errorMessage, isLoading: false } : l));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleToggleVisibility = (id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, isVisible: !l.isVisible } : l));
    };

    const handleDeleteLayer = (id: string) => {
        const layerIndex = layers.findIndex(l => l.id === id);
        if (layerIndex === -1) return;

        if (window.confirm('このレイヤーを削除しますか？')) {
            setLayers(prev => prev.slice(layerIndex + 1));
        }
    };
    
    const displayImage = useMemo(() => {
        const topVisibleLayer = layers.find(l => l.isVisible && l.imageBase64);
        if (topVisibleLayer) {
            return `data:image/png;base64,${topVisibleLayer.imageBase64}`;
        }
        return originalImage?.url || null;
    }, [layers, originalImage]);


    return (
        <Card>
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-stone-700">画像を直す</h2>
                <p className="mt-2 text-stone-500">
                    魔法のように、少しずつ修正していけます。
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {/* Control Panel */}
                <div className="md:col-span-1 space-y-6">
                    <div>
                        <label htmlFor="file-upload" className="block text-sm font-bold text-stone-700 mb-2 pl-2">画像を選ぶ</label>
                        <input id="file-upload" name="file-upload" type="file" className="block w-full text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-rose-50 file:text-rose-500 hover:file:bg-rose-100 transition-all" onChange={handleFileChange} accept="image/*" />
                    </div>
                    
                    <div>
                         <label htmlFor="prompt-input" className="block text-sm font-bold text-stone-700 mb-2 pl-2">直したいところ</label>
                        <textarea
                            id="prompt-input"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="例：猫の帽子を赤くして..."
                            className="w-full p-4 border-2 border-stone-200 rounded-[1.5rem] focus:ring-4 focus:ring-rose-100 focus:border-rose-300 transition duration-300 ease-out text-base bg-stone-50"
                            rows={2}
                            disabled={isLoading || !originalImage}
                        />
                    </div>
                    
                     <div>
                        <h3 className="text-sm font-bold text-stone-700 mb-2 pl-2">かんたん修正</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {predefinedEdits.map((edit) => (
                                <button
                                    key={edit.label}
                                    onClick={() => setPrompt(edit.prompt)}
                                    title={edit.label}
                                    disabled={isLoading || !originalImage}
                                    className="flex flex-col items-center justify-center p-3 border-2 border-stone-100 rounded-2xl text-stone-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {edit.icon}
                                    <span className="text-xs mt-1.5 font-bold">{edit.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-stone-700 mb-2 pl-2">明るさ</h3>
                        <div className="space-y-2 px-2">
                             <div>
                                <input
                                    id="brightness-slider"
                                    type="range"
                                    min="0"
                                    max="200"
                                    value={brightness}
                                    onChange={(e) => setBrightness(Number(e.target.value))}
                                    className="w-full h-3 bg-stone-200 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed accent-rose-400"
                                    disabled={!originalImage}
                                />
                            </div>
                        </div>
                    </div>
                    
                     {/* Pro Mode Toggle */}
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-rose-50 rounded-2xl border border-rose-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="text-rose-500">
                                    <DiamondIcon />
                                </div>
                                <span className="text-sm font-bold text-stone-700">プロモード</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={useProModel}
                                    onChange={(e) => setUseProModel(e.target.checked)}
                                    disabled={isLoading}
                                />
                                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-400"></div>
                            </label>
                        </div>
                        {useProModel && !hasApiKey && (
                            <div className="mt-2 text-xs">
                                <p className="text-stone-600 mb-1">Nano Banana Proを使用します。</p>
                                <button onClick={handleSelectKey} className="text-rose-500 font-bold underline">APIキーを選択</button>
                            </div>
                        )}
                    </div>

                    <div className="text-center text-sm text-stone-500 mb-2">
                        本日の残り編集回数: <span className="font-bold text-rose-500">{remainingEdits}回</span>
                    </div>

                    <Button onClick={handleAddLayer} isLoading={isLoading} disabled={!prompt || !originalImage || isLoading || (useProModel && !hasApiKey)} className="w-full py-3 shadow-lg" icon={<PlusIcon/>}>
                        魔法をかける
                    </Button>
                    
                    <div className="space-y-3 pt-4">
                        <h3 className="text-sm font-bold text-stone-700 pl-2">修正の履歴</h3>
                        {originalImage && layers.length === 0 && <p className="text-sm text-stone-400 text-center bg-stone-50 p-4 rounded-2xl border-2 border-stone-100 border-dashed">ここに履歴が残ります。</p>}
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                           {layers.map((layer, _index) => (
                               <div key={layer.id} className={`p-3 rounded-2xl border-2 transition-all ${layer.error ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-100'}`}>
                                   {layer.isLoading ? (
                                        <div className="flex items-center space-x-3">
                                            <Spinner size="sm" className="text-rose-400"/>
                                            <p className="text-sm text-stone-500 italic">"{layer.prompt}"</p>
                                        </div>
                                   ) : (
                                       <div>
                                           <div className="flex items-center justify-between">
                                                <p className={`flex-1 text-sm font-bold text-stone-600 truncate pr-2 ${!layer.isVisible ? 'line-through text-stone-300' : ''}`} title={layer.prompt}>
                                                    {layer.prompt}
                                                </p>
                                                <div className="flex items-center space-x-1">
                                                     <button onClick={() => handleToggleVisibility(layer.id)} className="p-2 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors" title={layer.isVisible ? '隠す' : '見る'}>
                                                        {layer.isVisible ? <EyeIcon/> : <EyeOffIcon/>}
                                                    </button>
                                                    <button onClick={() => handleDeleteLayer(layer.id)} className="p-2 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors" title="削除">
                                                        <TrashIcon/>
                                                    </button>
                                                </div>
                                           </div>
                                            {layer.error && <p className="text-xs text-rose-500 mt-1 font-bold">{layer.error}</p>}
                                       </div>
                                   )}
                               </div>
                           ))}
                        </div>
                    </div>
                </div>

                {/* Image Viewer */}
                <div className="md:col-span-2">
                    <div className="w-full aspect-square bg-stone-50 rounded-[2rem] flex items-center justify-center border-4 border-white shadow-inner overflow-hidden sticky top-24">
                        {isLoading && !displayImage ? (
                            <div className="text-center z-10">
                                <Spinner size="lg" className="text-rose-400 mx-auto"/>
                                <p className="mt-4 text-rose-400 font-bold animate-pulse">魔法をかけています...</p>
                            </div>
                        ) : displayImage ? (
                            <img src={displayImage} alt="編集後の画像" className="w-full h-full object-contain" style={{ filter: `brightness(${brightness}%)` }} />
                        ) : (
                            <div className="text-center text-stone-300">
                                <p className="font-bold">画像を選んでスタート</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {error && !layers.some(l => l.error) && <p className="mt-6 text-center text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-200 font-bold">{error}</p>}
        </Card>
    );
};

export default ImageEditor;
