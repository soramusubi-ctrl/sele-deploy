import React, { useState, useEffect, useRef } from 'react';
import { generateImage, summarizeConversation, analyzeGuideImage, GuideInfo } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import Button from './common/Button';
import Spinner from './common/Spinner';
import type { ImageForEditing, CharacterState } from '../App';

// Icons
const UserPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
);

const DiamondIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const WandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5l-2.293 2.293a1 1 0 000 1.414l4.586 4.586a1 1 0 001.414 0l2.293-2.293m-8.586 0L2 22m10.5-11.5L15 6.5m-3 3l-1.5-1.5" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const SquareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
);

const LandscapeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="7" width="18" height="10" rx="2" />
    </svg>
);

const PortraitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
    </svg>
);

const ChatBubbleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
);

interface GuideInfo {
    characterName: string;
    stats: {
        hp: number;
        mp: number;
        atk: number;
        def: number;
        spd: number;
    };
    description: string;
    items: string[];
}

const predefinedStyles = [
    { value: 'watercolor', label: '水彩画', mode: 'create' },
    { value: 'oil-painting', label: '油絵', mode: 'create' },
    { value: 'realistic', label: 'リアル', mode: 'create' },
    { value: 'anime', label: 'アニメ', mode: 'create' },
    { value: 'chibi', label: 'ちびキャラ', mode: 'create' },
    { value: 'line-art', label: '線画', mode: 'create' },
    { value: '3d-render', label: '3D', mode: 'create' },
    { value: 'plushie', label: 'ぬいぐるみ', mode: 'play' },
    { value: 'manga', label: '4コマ漫画', mode: 'play' },
    { value: 'sns-icons-12', label: 'SNSアイコン(12種)', mode: 'play' },
    { value: 'instruction-manual', label: '攻略本風', mode: 'play' },
    { value: 'picture-book', label: '絵本の見開き', mode: 'play' },
    { value: 'other', label: 'その他', mode: 'both' },
];

const angleOptions = [
    { value: 'auto', label: 'おまかせ', icon: '✨' },
    { value: 'close-up', label: 'アップ', icon: '👀' },
    { value: 'medium', label: 'ふつう', icon: '👤' },
    { value: 'long', label: '引き', icon: '🏔️' },
    { value: 'low-angle', label: 'あおり', icon: '🔼' },
    { value: 'high-angle', label: 'ふかん', icon: '🔽' },
    { value: 'diagonal-right-top', label: '右斜め上', icon: '↗️' },
];

const angleInstructionMap: Record<string, string> = {
    'close-up': '構図：キャラクターの表情やディテールが強調されるクローズアップ、接写構図。',
    'medium': '構図：キャラクターの腰から上が映る、標準的で安定感のあるミディアムショット。',
    'long': '構図：キャラクターの全身と周囲の風景が広く映る、開放的なロングショット、引きの構図。',
    'low-angle': '構図：低い位置から見上げるような、キャラクターが力強く、あるいは大きく見えるローアングル、あおり構図。',
    'high-angle': '構図：高い位置から見下ろすような、キャラクターが愛らしく見えるハイアングル、俯瞰構図。',
    'diagonal-right-top': '構図：被写体を右斜め上の高めの位置から捉えた、立体的で奥行きのあるダイナミックなアングル。'
};

interface ImageGeneratorProps {
  mode: 'create' | 'play';
  characters: CharacterState[];
  setCharacters: React.Dispatch<React.SetStateAction<CharacterState[]>>;
  onStartEditing: (image: ImageForEditing) => void;
  onStartAnimating: (image: ImageForEditing) => void;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ mode, characters, setCharacters, onStartEditing, onStartAnimating: _onStartAnimating }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [log, setLog] = useState<string>('');
  const [style, setStyle] = useState<string>(mode === 'create' ? 'anime' : 'plushie');
  const [angle, setAngle] = useState<string>('auto');
  const [aspect, setAspect] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [useProModel, setUseProModel] = useState<boolean>(false);
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [guideInfo, setGuideInfo] = useState<GuideInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setStyle(mode === 'create' ? 'anime' : 'plushie');
  }, [mode]);

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
    if (aistudio?.selectApiKey) {
        await aistudio.selectApiKey();
        const hasKey = await aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
    }
  };

  const handleAddCharacter = () => {
    const newChar: CharacterState = {
      id: Math.random().toString(36).substr(2, 9),
      name: '新キャラ',
      isActive: true,
      images: []
    };
    setCharacters(prev => [...prev, newChar]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, charId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const image: ImageForEditing = {
        url: base64,
        base64: base64.split(',')[1],
        mimeType: file.type
      };
      setCharacters(prev => prev.map(c => c.id === charId ? { ...c, images: [image] } : c));
    };
    reader.readAsDataURL(file);
  };

  const toggleCharacterActive = (id: string) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const insertCharacterToPrompt = (name: string) => {
    const newPrompt = prompt ? `${prompt}、${name}` : name;
    setPrompt(newPrompt);
    promptRef.current?.focus();
  };

  const handleSummarize = async () => {
    if (!log) return;
    setIsSummarizing(true);
    try {
        const summary = await summarizeLog(log);
        setPrompt(summary);
    } catch (err) {
        console.error("Summarization failed", err);
    } finally {
        setIsSummarizing(false);
    }
  };

  const getRemainingGenerations = () => {
    const saved = localStorage.getItem('painter-generation-count');
    const today = new Date().toDateString();
    if (!saved) return 10;
    const { count, date } = JSON.parse(saved);
    if (date !== today) return 10;
    return Math.max(0, 10 - count);
  };

  const recordGeneration = () => {
    const saved = localStorage.getItem('painter-generation-count');
    const today = new Date().toDateString();
    let count = 0;
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) count = parsed.count;
    }
    localStorage.setItem('painter-generation-count', JSON.stringify({ count: count + 1, date: today }));
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    
    if (getRemainingGenerations() <= 0) {
        setError("本日の生成回数上限に達しました。また明日お試しください。");
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setGuideInfo(null);

    try {
        const activeCharacters = characters.filter(c => c.isActive);
        let finalPrompt = prompt;

        if (angle !== 'auto' && angleInstructionMap[angle]) {
            finalPrompt += `\n${angleInstructionMap[angle]}`;
        }

        if (style === 'realistic') {
            finalPrompt = `「${prompt}」を、超高精細なフォトリアル・シネマティックスタイルで描いてください。
            【品質】：実写と見紛う高品質なポートレート。プラスチックのようなフィギュア感、ドール感を完全に排除してください。
            【質感】：人間味のある生きた肌の質感（細かな毛穴、自然な肌の艶）、瞳の深みのある虹彩、一本一本が独立して描かれた繊細な毛髪。
            【ライティング】：柔らかくドラマチックなシネマティックライティング。自然光の反射や微細なシャドウを正確に描写し、空気感のある美しいボケ（Boke）を背景に加えてください。
            Professional high-end photography, 8k resolution, realistic human skin texture, natural lighting, cinematic mood.`;
        } else if (style === 'plushie') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('や');
            finalPrompt = `Create an adorable high-quality plushie ${charNames ? `modeled after ${charNames}` : ''}.
            [Eyes]: Use glistening transparent "glass eyes" or "plastic eyes" instead of buttons. The eyes should have light reflections (catchlight) to emphasize liveliness and cuteness.
            [Material texture]: Fluffy boa fabric or high-quality mohair texture that makes you want to touch it. Very fine and soft fur.
            [Details]: Carefully hand-stitched seams, small embroidered paw pads, accessories like ribbons.
            [Atmosphere]: Based on the scene (${prompt}), warm lighting and a cozy composition surrounded by soft cushions.
            High quality, intricate plush texture, glistening glass eyes, warm and cozy aesthetic, high resolution.`;
        } else if (style === 'instruction-manual') {
            finalPrompt = `Create a page from a Japanese retro game strategy guide (official art book) depicting the scene: "${prompt}".
            [Layout]: Character standing pose on the left side. On the right side, about 3 icons of magical items, weapons, or mysterious tools are neatly arranged.
            [Design]: At the bottom, a status window with numerical values like HP, MP, ATK. Overall high-quality 2D digital paint style from the 1990s, with a slight printed paper texture.
            Retro game manual aesthetic, 1990s digital art, official character design sheet.`;
        } else if (style === 'picture-book') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('と');
            finalPrompt = `A beautiful picture book spread placed on a wooden desk, capturing the heart of the story.
            [Left page]: Handwritten-style English text (horizontal layout) gently narrating the scene based on: ${prompt}.
            [Right page]: A fantastical illustration of "${prompt}" drawn in the highest quality watercolor style. ${charNames ? `Characters ${charNames} are vividly depicted in poses appropriate to their story roles.` : ''}
            [Texture and lighting]: Old quality paper fiber texture, slight paper wrinkles. Soft sunlight filtering through a window falls on the pages, with dust particles glittering in the air.
            Cinematic lighting, masterpiece children's book illustration, emotional and cozy atmosphere, high resolution.`;
        } else if (style === 'manga') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('や');
            finalPrompt = `Create a traditional Japanese "4-panel manga (Yonkoma)" depicting the story: "${prompt}".
            [Layout]: Four panels arranged vertically in an orderly manner.
            Panel 1 (Introduction): Story setup, daily life.
            Panel 2 (Development): An incident occurs.
            Panel 3 (Twist): Unexpected development or joke.
            Panel 4 (Conclusion): Ending or punchline.
            [Visual]: High-quality monochrome line art and screen tones by professional manga artists. ${charNames ? `${charNames} show rich expressions in each panel.` : ''}
            [Direction]: Speech bubbles, manga symbols (!, ?, sweat drops, etc.), English onomatopoeia.
            Japanese Manga Style, 4-koma format, black and white.`;
        } else if (style === 'sns-icons-12') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('や');
            finalPrompt = `Create a set of 12 circular SNS icon materials in a 3x4 grid format on a single image.
            [Subject]: Cute "chibi character (2-head-tall)" bust-up ${charNames ? `modeled after ${charNames}` : ''}.
            [Diverse outfits]: All 12 icons should wear different costumes (casual wear, kimono, knight, maid, pajamas, uniform, cyber, gothic lolita, hero, wizard, mascot costume, tuxedo).
            [Composition]: Each icon fits within a circular pastel-colored background, with an easy-to-cut design.
            [Style]: Japanese anime-style icon with thick outlines and clear coloring.
            Vibrant digital art, cute chibi avatar collection, 3x4 grid layout.`;
        } else {
            const styleLabel = predefinedStyles.find(s => s.value === style)?.label;
            finalPrompt += `\nタッチ: ${styleLabel}`;
        }

        const base64 = await generateImage(finalPrompt, activeCharacters, aspect, useProModel, resolution, angle);
        const imageUrl = `data:image/png;base64,${base64}`;
        setGeneratedImage(imageUrl);
        
        recordGeneration();

        if (style === 'instruction-manual') {
            setIsAnalyzing(true);
            try {
                const info = await analyzeGuideImage(base64);
                setGuideInfo(info);
            } catch (err) {
                console.error("Analysis failed", err);
            } finally {
                setIsAnalyzing(false);
            }
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : "描画に失敗しました。");
    } finally {
        setIsLoading(false);
    }
  };

  const filteredStyles = predefinedStyles.filter(s => s.mode === mode || s.mode === 'both');
  const activeCharacters = characters.filter(c => c.isActive);

  const StepHeader = ({ num, title, sub }: { num: number, title: string, sub?: string }) => (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline space-x-2">
            <span className="text-[10px] font-bold text-rose-400 tracking-widest uppercase">STEP {num} :</span>
            <h3 className="text-sm font-bold text-rose-400">{title}</h3>
        </div>
        {sub && <span className="text-[10px] text-stone-300 italic">{sub}</span>}
    </div>
  );

  const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-[2.5rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-50/50 ${className}`}>
        {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdfaf7] px-4 py-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-stone-700 tracking-tight">
              {mode === 'create' ? '空想を書き起こす' : '物語で遊ぶ'}
          </h1>
          <p className="text-stone-400 italic text-sm font-light">
              Quiet Atelier - Storytelling Through Vision
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
          <div className="space-y-6">
            {/* Step 1: 視点を決める */}
            <Card>
              <StepHeader num={1} title="視点を決める" sub="(アングル選択)" />
              <div className="flex flex-wrap gap-2">
                  {angleOptions.map((opt) => (
                      <button
                          key={opt.value}
                          onClick={() => setAngle(opt.value)}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all ${
                              angle === opt.value 
                              ? 'bg-rose-400 text-white shadow-md' 
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                          }`}
                      >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                      </button>
                  ))}
              </div>
            </Card>

            {/* Step 2: 物語を紡ぐ */}
            <Card>
              <StepHeader num={2} title="物語を紡ぐ" sub="(今日の会話ログをコピペ)" />
              <div className="space-y-4">
                <textarea 
                  value={log} 
                  onChange={(e) => setLog(e.target.value)} 
                  placeholder="心に残った会話や、日記の断片をここに..." 
                  className="w-full h-24 bg-stone-50 rounded-2xl p-4 text-xs text-stone-600 outline-none resize-none placeholder:text-stone-300" 
                />
                <button 
                  onClick={handleSummarize} 
                  disabled={isSummarizing || !log} 
                  className="w-full py-3 bg-white border border-rose-100 rounded-full text-rose-400 text-[11px] font-bold hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isSummarizing ? <Spinner size="sm" /> : <WandIcon />}
                  <span>ログからシーンを要約</span>
                </button>
              </div>
            </Card>

            {/* Step 3: 画材を揃える */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-baseline space-x-2">
                    <span className="text-[10px] font-bold text-rose-400 tracking-widest uppercase">STEP 3 :</span>
                    <h3 className="text-sm font-bold text-rose-400">参考画像 ある？</h3><span className="text-[10px] text-stone-300 italic ml-2">(登場人物や小物の画像)</span>
                </div>
                <button onClick={handleAddCharacter} className="flex items-center space-x-2 text-rose-400 hover:opacity-70 transition-all">
                    <UserPlusIcon className="w-4 h-4" />
                    <span className="text-[11px] font-bold">追加</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {characters.map(char => (
                  <div key={char.id} className={`flex items-center p-1.5 rounded-full border transition-all ${char.isActive ? 'bg-rose-50 border-rose-100' : 'bg-white border-stone-100 opacity-60'}`}>
                    <label className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-white shadow-sm">
                      {char.images[0] ? <img src={char.images[0].url} className="w-full h-full object-cover" /> : <span className="text-stone-300 text-xs">+</span>}
                      <input type="file" className="hidden" onChange={(e) => handleFileChange(e, char.id)} />
                    </label>
                    <input value={char.name} onChange={(e) => setCharacters(prev => prev.map(c => c.id === char.id ? {...c, name: e.target.value} : c))} className="ml-2 w-20 text-[11px] font-bold text-stone-700 outline-none bg-transparent" />
                    <button onClick={() => toggleCharacterActive(char.id)} className={`ml-2 w-5 h-5 rounded-full flex items-center justify-center ${char.isActive ? 'bg-rose-400 text-white' : 'bg-stone-200 text-white'}`}><CheckIcon className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Step 4: 下書きを描く */}
            <Card>
              <StepHeader num={4} title="こんなシーンでどう？" sub="(プロンプト生成・編集)" />
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {activeCharacters.map(char => (
                      <button
                          key={char.id}
                          onClick={() => insertCharacterToPrompt(char.name)}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-stone-50 hover:bg-rose-50 rounded-full border border-stone-100 transition-all group"
                      >
                          <div className="w-5 h-5 rounded-full overflow-hidden bg-stone-200 border border-white">
                              {char.images[0] && <img src={char.images[0].url} className="w-full h-full object-cover" />}
                          </div>
                          <span className="text-[10px] font-bold text-stone-500 group-hover:text-rose-400">{char.name}</span>
                      </button>
                  ))}
                </div>
                <textarea 
                  ref={promptRef} 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  placeholder="描きたい情景の、具体的な筆致をここに..." 
                  className="w-full h-32 text-stone-700 bg-transparent outline-none resize-none placeholder:text-stone-200 text-sm leading-relaxed" 
                />
              </div>
            </Card>

            {/* Step 5: 筆致を選ぶ */}
            <Card>
              <StepHeader num={5} title="お好きなスタイルで" sub="(画風・比率)" />
              <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                      <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Style</p>
                      <div className="grid grid-cols-1 gap-2">
                          {filteredStyles.map(s => (
                              <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2.5 rounded-xl border text-[11px] font-bold transition-all ${style === s.value ? 'border-rose-200 bg-rose-50 text-rose-500 shadow-sm' : 'border-stone-100 bg-white text-stone-400'}`}>
                                  {s.label}
                              </button>
                          ))}
                      </div>
                  </div>
                  <div className="space-y-3">
                      <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Aspect</p>
                      <div className="flex flex-col space-y-2">
                          {[
                              { value: '1:1', label: '正方形', icon: <SquareIcon /> },
                              { value: '16:9', label: '横長', icon: <LandscapeIcon /> },
                              { value: '9:16', label: '縦長', icon: <PortraitIcon /> }
                          ].map((item) => (
                              <button
                                  key={item.value}
                                  onClick={() => setAspect(item.value as any)}
                                  className={`flex items-center space-x-4 p-2.5 rounded-xl border transition-all ${aspect === item.value ? 'bg-rose-50 border-rose-200 text-rose-500 shadow-sm' : 'bg-white border-stone-100 text-stone-400'}`}
                              >
                                  {item.icon}
                                  <span className="text-[11px] font-bold">{item.label}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
            </Card>

            {/* Step 6: 仕上げる */}
            <Card className="bg-gradient-to-br from-white to-rose-50/30">
              <StepHeader num={6} title="描いてみせます" sub="(プロモード切り替え・最終描画)" />
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/50 rounded-3xl border border-white shadow-sm">
                    <div className="flex items-center space-x-4">
                        <div className="p-2.5 bg-rose-400 rounded-full text-white shadow-md"><DiamondIcon /></div>
                        <div>
                            <h3 className="text-xs font-bold text-stone-700">プロモード</h3>
                            <p className="text-[10px] text-stone-400">高画質モデル / 解像度選択</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={useProModel} onChange={(e) => setUseProModel(e.target.checked)} disabled={isLoading}/>
                        <div className="w-12 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-400"></div>
                    </label>
                </div>

                {useProModel && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        {!hasApiKey ? (
                            <button onClick={handleSelectKey} className="w-full py-3 bg-white border border-rose-100 rounded-full text-rose-400 text-[11px] font-bold hover:shadow-md transition-all">
                                APIキーを選択
                            </button>
                        ) : (
                            <div className="flex space-x-2">
                                {['1K', '2K', '4K'].map((res) => (
                                    <button key={res} onClick={() => setResolution(res as any)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${resolution === res ? 'bg-rose-400 border-rose-400 text-white shadow-md' : 'bg-white border-stone-200 text-stone-400'}`}>
                                        {res}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="text-center text-[10px] font-bold text-stone-300 tracking-[0.2em] uppercase">
                        Remaining: {getRemainingGenerations()} / 10
                    </div>
                    <Button 
                        onClick={handleGenerate} 
                        isLoading={isLoading} 
                        disabled={!prompt || (useProModel && !hasApiKey)} 
                        className="w-full py-8 text-xl rounded-full bg-rose-400 hover:bg-rose-500 text-white shadow-2xl border-none transition-all active:scale-[0.98] font-bold tracking-widest"
                    >
                        🖌️ 描き起こす
                    </Button>
                    {error && <p className="text-center text-xs text-rose-400 font-bold animate-pulse">{error}</p>}
                </div>
              </div>
            </Card>
          </div>

          {/* Result Area */}
          <div className="sticky top-12 space-y-8">
            <div className="bg-white rounded-[3.5rem] p-6 min-h-[600px] flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.08)] border-8 border-white overflow-hidden relative group">
              {isLoading ? (
                <div className="text-center space-y-6">
                  <Spinner size="lg" className="text-rose-300 mx-auto" />
                  <p className="text-stone-300 font-light italic tracking-widest animate-pulse">Weaving fragments of stories...</p>
                </div>
              ) : generatedImage ? (
                <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000">
                  <img src={generatedImage} alt="Generated" className="w-full h-auto rounded-[2.5rem] shadow-sm mb-6" />
                  
                  {(guideInfo || isAnalyzing) && (
                      <div className="w-full bg-[#1e1e2e] text-[#e0def4] p-8 rounded-[2.5rem] border-4 border-[#44475a] font-mono shadow-2xl overflow-hidden relative mb-6">
                          {isAnalyzing ? (
                              <div className="py-12 text-center space-y-4">
                                  <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                  <p className="text-blue-300 text-[10px] font-bold tracking-[0.3em] uppercase animate-pulse">Analyzing Canvas...</p>
                              </div>
                          ) : guideInfo && (
                              <div className="space-y-6">
                                  <div className="border-b border-[#44475a] pb-4">
                                      <h3 className="text-2xl font-bold text-yellow-300 tracking-tighter uppercase">{guideInfo.characterName}</h3>
                                  </div>
                                  <div className="grid grid-cols-2 gap-6 text-xs">
                                      <div className="space-y-2">
                                          <div className="flex justify-between"><span>HP</span><span className="text-green-400">{guideInfo.stats.hp}</span></div>
                                          <div className="flex justify-between"><span>MP</span><span className="text-blue-400">{guideInfo.stats.mp}</span></div>
                                          <div className="flex justify-between"><span>ATK</span><span className="text-red-400">{guideInfo.stats.atk}</span></div>
                                      </div>
                                      <div className="space-y-2">
                                          <div className="flex justify-between"><span>DEF</span><span className="text-yellow-400">{guideInfo.stats.def}</span></div>
                                          <div className="flex justify-between"><span>SPD</span><span className="text-purple-400">{guideInfo.stats.spd}</span></div>
                                      </div>
                                  </div>
                                  <div className="space-y-4">
                                      <p className="text-xs leading-relaxed text-stone-400 italic">"{guideInfo.description}"</p>
                                      <div className="flex flex-wrap gap-2">
                                          {guideInfo.items.map((item, i) => (
                                              <span key={i} className="px-2 py-1 bg-[#44475a] rounded text-[9px] text-yellow-200">[{item}]</span>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}

                  <div className="flex space-x-3">
                      <button onClick={() => onStartEditing({ url: generatedImage, base64: generatedImage.split(',')[1], mimeType: 'image/png' })} className="flex items-center space-x-2 px-6 py-3 bg-white border border-stone-100 rounded-full text-stone-500 text-xs font-bold shadow-sm hover:shadow-md transition-all">
                          <ScissorsIcon className="w-4 h-4" />
                          <span>直す</span>
                      </button>
                      <a href={generatedImage} download="quiet-atelier-art.png" className="flex items-center space-x-2 px-6 py-3 bg-white border border-stone-100 rounded-full text-stone-500 text-xs font-bold shadow-sm hover:shadow-md transition-all">
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          <span>保存</span>
                      </a>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-rose-100 blur-3xl opacity-20 rounded-full"></div>
                    <PaintBrushIcon className="w-20 h-20 text-stone-100 mx-auto relative z-10" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-stone-200 font-bold tracking-[0.3em] text-xs uppercase">Atelier Quiet // Waiting for Inspiration</p>
                    <p className="text-stone-100 text-[10px] font-light italic">この一瞬を残したい</p>
                  </div>
                </div>
              )}
            </div>

            {generatedImage && (
              <div className="p-8 bg-white rounded-[2.5rem] border border-stone-50 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center space-x-3 text-stone-300">
                      <CommandLineIcon className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Prompt used</span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed italic">
                      {prompt}
                  </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserPlusIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-4 h-4"}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v9m-4.5-4.5h9M3.75 20.25v-4.5m0 0h4.5m-4.5 0L9 11.25M18 20.25v-4.5m0 0h4.5m-4.5 0L23.25 11.25" /></svg>;
const CheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={className || "w-4 h-4"}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;

export default ImageGenerator;
