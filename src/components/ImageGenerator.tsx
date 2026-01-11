import React, { useState, useEffect, useRef } from 'react';
import { 
    PhotoIcon, 
    SparklesIcon, 
    ArrowPathIcon, 
    ArrowDownTrayIcon,
    UserPlusIcon,
    CheckIcon,
    CommandLineIcon,
    PaintBrushIcon,
    Square3Stack3DIcon,
    AdjustmentsHorizontalIcon,
    ViewColumnsIcon,
    BeakerIcon,
    CloudArrowUpIcon,
    ChatBubbleLeftRightIcon,
    WandSparklesIcon,
    ScissorsIcon,
    VideoCameraIcon,
    StarIcon
} from '@heroicons/react/24/outline';
import { generateImage, analyzeGuideImage, summarizeLog } from '../services/api';
import Spinner from './Spinner';
import Button from './Button';
import { CharacterState, ImageForEditing } from '../App';

const WandIcon = () => <WandSparklesIcon className="w-4 h-4" />;
const DiamondIcon = () => <StarIcon className="w-4 h-4" />;
const SquareIcon = () => <div className="w-4 h-4 border-2 border-current rounded-sm" />;
const LandscapeIcon = () => <div className="w-4 h-2.5 border-2 border-current rounded-sm" />;
const PortraitIcon = () => <div className="w-2.5 h-4 border-2 border-current rounded-sm" />;

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
        
        // 生成成功時に使用回数を記録
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

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-stone-700">
            {mode === 'create' ? '空想を書き起こす' : '物語で遊ぶ'}
        </h1>
        <p className="text-stone-400">
            {mode === 'create' ? '日常から冒険への扉を開きます。' : '特別なレイアウトや材質で物語を楽しみましょう。'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8">
        <div className="space-y-10">
          {/* Step 1: 視点を決める */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 pl-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold">1</span>
                <h3 className="text-sm font-bold text-stone-700">視点を決める</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 px-2">
                {angleOptions.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setAngle(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                            angle === opt.value 
                            ? 'bg-rose-400 border-rose-400 text-white shadow-sm' 
                            : 'bg-white border-stone-200 text-stone-400 hover:border-rose-200'
                        }`}
                    >
                        <span className="mr-1">{opt.icon}</span>
                        {opt.label}
                    </button>
                ))}
            </div>
          </section>

          {/* Step 2: 物語を紡ぐ */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 pl-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold">2</span>
                <h3 className="text-sm font-bold text-stone-700">物語を紡ぐ</h3>
            </div>
            <div className="bg-stone-50/50 rounded-[2rem] p-4 border-2 border-stone-100 border-dashed space-y-3">
              <textarea 
                value={log} 
                onChange={(e) => setLog(e.target.value)} 
                placeholder="会話や日記のログをここに貼ると要約できます..." 
                className="w-full h-16 bg-white rounded-xl p-3 text-xs text-stone-500 border border-stone-100 outline-none resize-none" 
              />
              <button 
                onClick={handleSummarize} 
                disabled={isSummarizing || !log} 
                className="w-full py-2 bg-white border-2 border-rose-100 rounded-full text-rose-400 text-xs font-bold hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSummarizing ? <Spinner size="sm" /> : <WandIcon />}
                <span>ログからシーンを生成</span>
              </button>
            </div>
          </section>

          {/* Step 3: 画材を揃える */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pl-2">
                <div className="flex items-center space-x-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold">3</span>
                    <h3 className="text-sm font-bold text-stone-700">画材を揃える</h3>
                </div>
                <button onClick={handleAddCharacter} className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-stone-100 rounded-full text-rose-400 text-xs font-bold shadow-sm hover:shadow-md transition-all">
                    <UserPlusIcon className="w-3 h-3" />
                    <span>追加</span>
                </button>
            </div>
            <div className="min-h-[80px] border-2 border-stone-100 border-dashed rounded-[2rem] p-4 bg-stone-50/30 flex flex-wrap gap-2">
              {characters.map(char => (
                <div key={char.id} className={`flex items-center p-1 rounded-full border transition-all ${char.isActive ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-100 opacity-60'}`}>
                  <label className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden cursor-pointer border border-white shadow-sm">
                    {char.images[0] ? <img src={char.images[0].url} className="w-full h-full object-cover" /> : <span className="text-stone-300 text-xs">+</span>}
                    <input type="file" className="hidden" onChange={(e) => handleFileChange(e, char.id)} />
                  </label>
                  <input value={char.name} onChange={(e) => setCharacters(prev => prev.map(c => c.id === char.id ? {...c, name: e.target.value} : c))} className="ml-2 w-16 text-[10px] font-bold text-stone-700 outline-none bg-transparent" />
                  <button onClick={() => toggleCharacterActive(char.id)} className={`ml-2 w-4 h-4 rounded flex items-center justify-center ${char.isActive ? 'bg-rose-400 text-white' : 'bg-stone-200 text-white'}`}><CheckIcon className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Step 4: 下書きを描く */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 pl-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold">4</span>
                <h3 className="text-sm font-bold text-stone-700">下書きを描く</h3>
            </div>
            <div className="bg-white rounded-[2rem] p-6 border-2 border-stone-100 shadow-sm focus-within:border-rose-200 transition-all space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                {activeCharacters.map(char => (
                    <button
                        key={char.id}
                        onClick={() => insertCharacterToPrompt(char.name)}
                        className="flex items-center space-x-1.5 px-2.5 py-1 bg-stone-50 hover:bg-rose-100 rounded-full border border-stone-100 hover:border-rose-200 transition-all group"
                    >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-stone-200 border border-white">
                            {char.images[0] && <img src={char.images[0].url} className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-[10px] font-bold text-stone-600 group-hover:text-rose-500">{char.name}</span>
                    </button>
                ))}
              </div>
              <textarea 
                ref={promptRef} 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                placeholder="情景を言葉にしてください..." 
                className="w-full h-32 text-stone-700 bg-transparent outline-none resize-none placeholder:text-stone-300 text-base leading-relaxed" 
              />
            </div>
          </section>

          {/* Step 5: 筆致を選ぶ */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 pl-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold">5</span>
                <h3 className="text-sm font-bold text-stone-700">筆致を選ぶ</h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pl-1">画風</p>
                    <div className="grid grid-cols-1 gap-1.5">
                        {filteredStyles.map(s => (
                            <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-xl border text-[10px] font-bold transition-all ${style === s.value ? 'border-rose-300 bg-rose-50 text-rose-500 shadow-sm' : 'border-stone-100 bg-white text-stone-500'}`}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pl-1">比率</p>
                    <div className="flex flex-col space-y-1.5">
                        {[
                            { value: '1:1', label: '正方形', icon: <SquareIcon /> },
                            { value: '16:9', label: '横長', icon: <LandscapeIcon /> },
                            { value: '9:16', label: '縦長', icon: <PortraitIcon /> }
                        ].map((item) => (
                            <button
                                key={item.value}
                                onClick={() => setAspect(item.value as any)}
                                className={`flex items-center space-x-3 p-2 rounded-xl border transition-all ${aspect === item.value ? 'bg-rose-50 border-rose-300 text-rose-500 shadow-sm' : 'bg-white border-stone-100 text-stone-400 hover:border-rose-200'}`}
                            >
                                {item.icon}
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          </section>

          {/* Step 6: 仕上げる */}
          <section className="space-y-6">
            <div className="flex items-center space-x-2 pl-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold">6</span>
                <h3 className="text-sm font-bold text-stone-700">仕上げる</h3>
            </div>
            
            <div className="p-5 bg-gradient-to-br from-stone-50 to-rose-50/30 rounded-[2rem] border-2 border-stone-100 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded-full text-rose-400 shadow-sm border border-rose-50"><DiamondIcon /></div>
                        <div>
                            <h3 className="text-xs font-bold text-stone-700">プロモード</h3>
                            <p className="text-[10px] text-stone-400">高画質モデル / 解像度選択</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={useProModel} onChange={(e) => setUseProModel(e.target.checked)} disabled={isLoading}/>
                        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-400"></div>
                    </label>
                </div>

                {useProModel && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                        {!hasApiKey ? (
                            <div className="flex flex-col items-center py-2">
                                <button onClick={handleSelectKey} className="px-6 py-2 bg-white border-2 border-rose-100 rounded-full text-rose-400 text-[10px] font-bold hover:shadow-md transition-all">
                                    APIキーを選択
                                </button>
                            </div>
                        ) : (
                            <div className="pt-3 border-t border-stone-100 flex space-x-2">
                                {['1K', '2K', '4K'].map((res) => (
                                    <button key={res} onClick={() => setResolution(res as any)} className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all border ${resolution === res ? 'bg-rose-400 border-rose-400 text-white shadow-md' : 'bg-white border-stone-200 text-stone-400'}`}>
                                        {res}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div className="text-center text-[10px] font-bold text-stone-300 tracking-widest uppercase">
                    Remaining: {getRemainingGenerations()} / 10
                </div>
                <Button 
                    onClick={handleGenerate} 
                    isLoading={isLoading} 
                    disabled={!prompt || (useProModel && !hasApiKey)} 
                    className="w-full py-8 text-xl rounded-[2rem] bg-rose-200 hover:bg-rose-300 text-rose-600 shadow-xl border-none transition-all active:scale-[0.98] font-bold"
                >
                    🖌️ 描き起こす
                </Button>
                {error && <p className="text-center text-xs text-rose-400 font-bold animate-pulse">{error}</p>}
            </div>
          </section>
        </div>

        {/* Result Area */}
        <div className="space-y-6">
          <div className="bg-stone-100 rounded-[3rem] p-4 min-h-[500px] flex flex-col items-center justify-center border-8 border-white shadow-2xl overflow-hidden relative">
            {isLoading ? (
              <div className="text-center space-y-4">
                <Spinner size="lg" className="text-rose-300 mx-auto" />
                <p className="text-stone-400 font-bold animate-pulse">物語の断片を紡いでいます...</p>
              </div>
            ) : generatedImage ? (
              <div className="w-full flex flex-col items-center animate-in fade-in duration-700">
                <img src={generatedImage} alt="Generated" className="w-full h-auto rounded-[2rem] shadow-md mb-4" />
                
                {(guideInfo || isAnalyzing) && (
                    <div className="w-full bg-[#1e1e2e] text-[#e0def4] p-5 rounded-[2rem] border-4 border-[#44475a] font-mono shadow-2xl overflow-hidden relative">
                        {isAnalyzing ? (
                            <div className="py-10 text-center space-y-3">
                                <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="text-blue-300 text-xs font-bold tracking-widest uppercase animate-pulse">Analyzing Canvas...</p>
                            </div>
                        ) : guideInfo && (
                            <div className="space-y-4">
                                <div className="border-b border-[#44475a] pb-2 mb-2">
                                    <h3 className="text-xl font-bold text-yellow-300 tracking-tighter uppercase">{guideInfo.characterName}</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-[10px]">
                                    <div className="space-y-1">
                                        <div className="flex justify-between"><span>HP</span><span className="text-green-400">{guideInfo.stats.hp}</span></div>
                                        <div className="flex justify-between"><span>MP</span><span className="text-blue-400">{guideInfo.stats.mp}</span></div>
                                        <div className="flex justify-between"><span>ATK</span><span className="text-red-400">{guideInfo.stats.atk}</span></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between"><span>DEF</span><span className="text-yellow-400">{guideInfo.stats.def}</span></div>
                                        <div className="flex justify-between"><span>SPD</span><span className="text-purple-400">{guideInfo.stats.spd}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] leading-relaxed text-stone-300 italic">"{guideInfo.description}"</p>
                                    <div className="flex flex-wrap gap-1">
                                        {guideInfo.items.map((item, i) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-[#44475a] rounded text-[8px] text-yellow-200">[{item}]</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex space-x-2 mt-4">
                    <button onClick={() => onStartEditing({ url: generatedImage, base64: generatedImage.split(',')[1], mimeType: 'image/png' })} className="flex items-center space-x-2 px-4 py-2 bg-white border border-stone-100 rounded-full text-stone-600 text-xs font-bold shadow-sm hover:shadow-md transition-all">
                        <ScissorsIcon className="w-4 h-4" />
                        <span>直す</span>
                    </button>
                    <a href={generatedImage} download="quiet-atelier-art.png" className="flex items-center space-x-2 px-4 py-2 bg-white border border-stone-100 rounded-full text-stone-600 text-xs font-bold shadow-sm hover:shadow-md transition-all">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span>保存</span>
                    </a>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 opacity-20">
                <PhotoIcon className="w-16 h-16 text-stone-300 mx-auto" />
                <p className="text-stone-400 font-bold">キャンバスは真っ白です</p>
              </div>
            )}
          </div>

          {generatedImage && (
            <div className="p-6 bg-white rounded-[2rem] border-2 border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 text-stone-400">
                    <CommandLineIcon className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Prompt used</span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-100 italic">
                    {prompt}
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UserPlusIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-4 h-4"}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v9m-4.5-4.5h9M3.75 20.25v-4.5m0 0h4.5m-4.5 0L9 11.25M18 20.25v-4.5m0 0h4.5m-4.5 0L23.25 11.25" /></svg>;
const CheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={className || "w-4 h-4"}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;

export default ImageGenerator;
