
import React, { useState, useEffect, useRef } from 'react';
import { generateImage, summarizeConversation, analyzeGuideImage } from '../services/geminiService';
import type { GuideInfo } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { canGenerate, recordGeneration, getRemainingGenerations } from '../utils/rateLimiter';
import Button from './Button';
import Spinner from './Spinner';
import type { ImageForEditing, CharacterState } from '../App';

// Icons
const UserPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
);

const DiamondIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
    'close-up': '構図：キャラクターの表情や瞳の輝きを強調する、顔中心の至近距離からのクローズアップ。背景は美しくボケている。',
    'medium': '構図：キャラクターの上半身と周囲のアイテムがバランスよく収まる、標準的なミディアムショット。',
    'long': '構図：全身と広大な背景、空や風景が贅沢に入るロングショット・フルショット。',
    'low-angle': '構図：地面に近い低い位置から見上げるような、ダイナミックで迫力のあるローアングル。',
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
    if (aistudio?.openSelectKey) {
        try {
            await aistudio.openSelectKey();
            setHasApiKey(true);
        } catch (e) {
            console.error(e);
        }
    }
  };

  const handleSummarize = async () => {
      if (!log) return;
      setIsSummarizing(true);
      setError(null);
      try {
          const summary = await summarizeConversation(log, angle);
          setPrompt(summary);
      } catch (err) {
          setError("プロンプトの作成に失敗しました。");
      } finally {
          setIsSummarizing(false);
      }
  };

  const handleAddCharacter = () => {
    setCharacters(prev => [...prev, {
      id: Date.now().toString(),
      name: `新キャラ`,
      isActive: true,
      images: []
    }]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, charId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const { base64, mimeType } = await fileToBase64(file);
      const url = URL.createObjectURL(file);
      setCharacters(prev => prev.map(c => c.id === charId ? {
        ...c, images: [{ url, base64, mimeType }]
      } : c));
    }
  };

  const toggleCharacterActive = (charId: string) => {
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, isActive: !c.isActive } : c));
  };

  const insertCharacterToPrompt = (name: string) => {
    if (!promptRef.current) return;
    const textarea = promptRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const insertText = `「${name}」`;
    setPrompt(before + insertText + after);
    
    setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    }, 0);
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `ai-painter-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    if (useProModel && !hasApiKey) {
        setError("プロモードを利用するにはAPIキーの選択が必要です。");
        return;
    }

    // 使用制限チェック
    const limitCheck = canGenerate();
    if (!limitCheck.allowed) {
        setError(limitCheck.reason || "生成できません。");
        return;
    }

    setIsLoading(true);
    setError(null);
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
            finalPrompt = `${charNames ? `${charNames}をモデルにした、` : ''}最高品質で愛らしい「ぬいぐるみ（Plushie）」を生成してください。
            【瞳の表現】：ボタンではなく、うるうるとした透明感のある「グラスアイ」または「プラスチックアイ」を使用してください。瞳の奥には光の反射（キャッチライト）があり、生命感と可愛らしさを強調します。
            【素材の質感】：思わず触れたくなるような、ふかふかのボア生地や高品質なモヘアの質感。非常に細かく柔らかな毛並み。
            【ディテール】：丁寧な手縫いのステッチ、小さな肉球の刺繍、リボンなどのアクセサリー。
            【雰囲気】：情景（${prompt}）に基づいた、温かみのあるライティングと、柔らかなクッションに囲まれたような心地よい構図。
            High quality, intricate plush texture, glistening glass eyes, warm and cozy aesthetic, high resolution.`;
        } else if (style === 'instruction-manual') {
            finalPrompt = `「${prompt}」のシーンを、日本のレトロなゲーム攻略本（公式設定資料集）の1ページとして描いてください。
            【構成】：左側にキャラクターの立ち絵。右側には、魔法のアイテムや武器、不思議な道具などのアイコンが3つほど整然と並んでいます。
            【デザイン】：下部にはHPやMP、ATKなどの数値が書かれたステータスウィンドウ。全体的に1990年代の高品質な2Dデジタルペイントスタイルで、印刷された紙の質感が少しあります。`;
        } else if (style === 'picture-book') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('と');
            finalPrompt = `木の机の上に置かれた、物語の核心を突く美しい絵本の見開きページ。
            【左ページ】：情景（${prompt}）に基づいた、優しく語りかけるような「手書き風の日本語テキスト（縦書きまたは横書き）」が配置されている。
            【右ページ】：最高品質の水彩画タッチで描かれた、「${prompt}」の幻想的な挿絵。${charNames ? `登場人物の${charNames}が、物語の役割に応じたポーズで生き生きと描かれている。` : ''}
            【質感とライティング】：古い良質な紙の繊維感、わずかな紙のしわ。窓からの柔らかな木漏れ日がページに落ち、空気中の塵が光り輝いている。 cinematic lighting, masterpieces of children's book illustration, emotional and cozy atmosphere.`;
        } else if (style === 'manga') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('や');
            finalPrompt = `「${prompt}」というストーリーを、日本の伝統的な「4コマ漫画（Yonkoma Manga）」形式で描いてください。
            【構成】：縦に4つのコマが整然と並んだレイアウト。
            1コマ目（起）：物語の導入、日常。
            2コマ目（承）：事件の発生。
            3コマ目（転）：意外な展開、あるいはボケ。
            4コマ目（結）：結末、あるいはツッコミ。
            【ビジュアル】：プロの漫画家による高品質なモノクロ線画とスクリーントーン。${charNames ? `${charNames}が各コマで豊かな表情を見せている。` : ''}
            【演出】：セリフ吹き出し、漫符（！、？、汗など）、日本語のオノマトペ（ドキドキ、バーンなど）。 Japanese Manga Style.`;
        } else if (style === 'sns-icons-12') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('や');
            finalPrompt = `SNS用の円形アイコン素材12種類のセットを、1枚の画像に3x4のグリッド形式で描いてください。
            【被写体】：${charNames ? `${charNames}をモデルにした` : ''}可愛い「ちびキャラ（2頭身）」のバストアップ。
            【多様な服装】：12個のアイコンはすべて異なる衣装（私服、和服、騎士、メイド、パジャマ、制服、サイバー、ゴスロリ、ヒーロー、魔法使い、着ぐるみ、タキシード）を着せてください。
            【構成】：各アイコンは円形のパステルカラー背景に収まっており、切り抜きやすいデザイン。
            【タッチ】：太い主線とはっきりした塗りの日本のアニメ風アイコンスタイル. Vibrant digital art, cute chibi avatar collection.`;
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
        <div className="space-y-8">
          {/* Characters Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-700 pl-2">登場人物</h3>
              <button onClick={handleAddCharacter} className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-stone-100 rounded-full text-rose-400 text-xs font-bold shadow-sm hover:shadow-md transition-all">
                <UserPlusIcon />
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
                  <button onClick={() => toggleCharacterActive(char.id)} className={`ml-2 w-4 h-4 rounded flex items-center justify-center ${char.isActive ? 'bg-rose-400 text-white' : 'bg-stone-200 text-white'}`}><CheckIcon /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Scene Input */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-stone-700 pl-2">シーン</h3>
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

            {mode === 'create' && (
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
            )}

            <div className="bg-stone-50/50 rounded-[2rem] p-4 border-2 border-stone-100 border-dashed space-y-3">
              <textarea value={log} onChange={(e) => setLog(e.target.value)} placeholder="会話や日記のログをここに貼ると要約できます..." className="w-full h-16 bg-white rounded-xl p-3 text-xs text-stone-500 border border-stone-100 outline-none resize-none" />
              <button onClick={handleSummarize} disabled={isSummarizing || !log} className="w-full py-2 bg-white border-2 border-rose-100 rounded-full text-rose-400 text-xs font-bold hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
                {isSummarizing ? <Spinner size="sm" /> : <WandIcon />}
                <span>ログからシーンを生成</span>
              </button>
            </div>
          </section>

          {/* Style & Aspect Section */}
          <div className="grid grid-cols-2 gap-8">
            <section className="space-y-4">
                <h3 className="text-sm font-bold text-stone-700 pl-2">画風</h3>
                <div className="grid grid-cols-1 gap-1.5">
                    {filteredStyles.map(s => (
                        <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-xl border text-[10px] font-bold transition-all ${style === s.value ? 'border-rose-300 bg-rose-50 text-rose-500 shadow-sm' : 'border-stone-100 bg-white text-stone-500'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </section>
            <section className="space-y-4">
                <h3 className="text-sm font-bold text-stone-700 pl-2">比率</h3>
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
            </section>
          </div>

          {/* Pro Mode & API Key */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-rose-50 rounded-[2rem] border border-rose-100">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white rounded-full text-rose-500 shadow-sm"><DiamondIcon /></div>
                    <div><h3 className="text-xs font-bold text-stone-700">プロモード</h3><p className="text-[10px] text-stone-500">高画質モデル / 解像度選択</p></div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={useProModel} onChange={(e) => setUseProModel(e.target.checked)} disabled={isLoading}/>
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-400"></div>
                </label>
            </div>
            {useProModel && !hasApiKey && (
                <div className="mt-3 flex flex-col items-center">
                    <button onClick={handleSelectKey} className="px-6 py-1.5 bg-white border border-rose-200 rounded-full text-rose-500 text-[10px] font-bold hover:shadow-md transition-all">
                        APIキーを選択
                    </button>
                </div>
            )}
            {useProModel && hasApiKey && (
                 <div className="mt-3 pt-3 border-t border-rose-100 flex space-x-2">
                    {['1K', '2K', '4K'].map((res) => (
                        <button key={res} onClick={() => setResolution(res as any)} className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all border ${resolution === res ? 'bg-rose-400 border-rose-400 text-white' : 'bg-white border-stone-200 text-stone-400'}`}>
                            {res}
                        </button>
                    ))}
                 </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-center text-xs text-stone-400">
              本日の残り生成回数: {getRemainingGenerations()}回
            </div>
            <Button onClick={handleGenerate} isLoading={isLoading} disabled={!prompt || (useProModel && !hasApiKey)} className="w-full py-6 text-xl rounded-full bg-rose-200 hover:bg-rose-300 text-rose-600 shadow-lg border-none transition-all active:scale-95">
              🖌️ 描き起こす
            </Button>
          </div>
        </div>

        {/* Result Area */}
        <div className="space-y-6">
          <div className="bg-stone-100 rounded-[3rem] p-4 min-h-[450px] flex flex-col items-center justify-center border-8 border-white shadow-xl overflow-hidden relative">
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <p className="text-[10px] text-[#908caa] leading-relaxed italic">「{guideInfo.description}」</p>
                                        <div className="space-y-2">
                                            {guideInfo.stats.map((s, i) => (
                                                <div key={i} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-bold">
                                                        <span>{s.label}</span>
                                                        <span>{s.value}/{s.max}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-[#26233a] rounded-full overflow-hidden border border-[#44475a]">
                                                        <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-300" style={{ width: `${(s.value/s.max)*100}%` }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-emerald-300 border-l-2 border-emerald-300 pl-2 mb-2">FOUND ITEMS</p>
                                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 text-[10px]">
                                            {guideInfo.items.map((item, i) => (
                                                <div key={i} className="bg-[#26233a] p-2 rounded-lg border border-[#44475a] group hover:border-emerald-300 transition-colors">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-emerald-200">▶ {item.name}</span>
                                                    </div>
                                                    <p className="text-[#908caa] text-[9px]">{item.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <button onClick={handleDownload} className="flex items-center space-x-2 px-6 py-3 bg-white rounded-full shadow-md text-stone-600 text-sm font-bold hover:bg-stone-50 hover:scale-105 transition-all">
                    <DownloadIcon />
                    <span>保存する</span>
                  </button>
                  <button onClick={() => onStartEditing({ url: generatedImage, base64: generatedImage.split(',')[1], mimeType: 'image/png' })} className="px-6 py-3 bg-white rounded-full shadow-md text-rose-500 text-sm font-bold hover:scale-105 transition-all">
                    描き直す
                  </button>
                  <button disabled className="px-6 py-3 bg-gray-200 rounded-full shadow-md text-gray-400 text-sm font-bold cursor-not-allowed opacity-50">
                    アニメ化
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-stone-300 space-y-2">
                <div className="text-4xl">📘</div>
                <p className="font-bold">キャンバスは真っ白です</p>
              </div>
            )}
          </div>
          {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-center text-sm font-bold border border-rose-100">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
