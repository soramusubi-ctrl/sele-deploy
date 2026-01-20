
import React, { useState, useEffect, useRef } from 'react';
import { generateImage, summarizeConversation, analyzeGuideImage, GuideInfo as GeminiGuideInfo } from '../services/geminiService';
import Button from './Button';
import Spinner from './Spinner';
import type { ImageForEditing, CharacterState } from '../App';
import { compressImage, blobToBase64 } from '../utils/imageUtils';

// Local GuideInfo interface to match UI needs
interface LocalGuideInfo {
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

const WandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5l-2.293 2.293a1 1 0 000 1.414l4.586 4.586a1 1 0 001.414 0l2.293-2.293m-8.586 0L2 22m10.5-11.5L15 6.5m-3 3l-1.5-1.5" />
    </svg>
);

const DiamondIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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
    { value: 'sns-icons-6', label: 'SNSアイコン(いろいろ)', mode: 'play' },
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
    'diagonal-right-top': '構図：被写体を右斜め上の高めの位置から捕らえた、立体的で奥行きのあるダイナミックなアングル。'
};

// Move StepHeader and Card outside the component to prevent re-creation on each render
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

interface ImageGeneratorProps {
  mode: 'create' | 'play';
  characters: CharacterState[];
  setCharacters: React.Dispatch<React.SetStateAction<CharacterState[]>>;
  onStartEditing: (image: ImageForEditing, prompt: string, style: string, aspect: string) => void;
  onStartAnimating: (image: ImageForEditing) => void;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ mode, characters, setCharacters, onStartEditing, onStartAnimating: _onStartAnimating }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [log, setLog] = useState<string>('');
  const [style, setStyle] = useState<string>(mode === 'create' ? 'anime' : 'plushie');
  const [angle, setAngle] = useState<string>('auto');
  const [aspect, setAspect] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [useProModel] = useState<boolean>(false);
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [, setIsAnalyzing] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [guideInfo, setGuideInfo] = useState<LocalGuideInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setStyle(mode === 'create' ? 'anime' : 'plushie');
  }, [mode]);

  

  



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
        const summary = await summarizeConversation(log, angle);
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
        
        // アクティブなキャラクターの画像を圧縮してBase64配列を作成
        const characterImages = await Promise.all(
            activeCharacters.map(async (c) => {
                const imageUrl = c.images[0]?.url || '';
                const blob = await compressImage(imageUrl, 1024, 0.8);
                const base64 = await blobToBase64(blob);
                return {
                    name: c.name,
                    images: [{
                        base64: base64,
                        mimeType: blob.type
                    }]
                };
            })
        );

        let finalPrompt = prompt;

        if (angle !== 'auto' && angleInstructionMap[angle]) {
            finalPrompt += `\n${angleInstructionMap[angle]}`;
        }

        if (style === 'realistic') {
            finalPrompt = `「${prompt}」を、超高精細なフォトリアル・シネマティックスタイルで描いてください。\n            【品質】：実写と見紛う高品質なポートレート。プラスチックのようなフィギュア感、ドール感を完全に排除してください。\n            【質感】：人間味のある生きた肌の質感（細かな毛穴、自然な肌の艶）、瞳の深みのある虹彩、一本一本が独立して描かれた繊細な毛髪。\n            【ライティング】：柔らかくドラマチックなシネマティックライティング。自然光の反射や微細なシャドウを正確に描写し、空気感のある美しいボケ（Boke）を背景に加えてください。\n            Professional high-end photography, 8k resolution, realistic human skin texture, natural lighting, cinematic mood.`;
        } else if (style === 'plushie') {
            const charNames = activeCharacters.map(c => `「${c.name}」`).join('や');
            finalPrompt = `Create an adorable high-quality plushie ${charNames ? `modeled after ${charNames}` : ''}.\n            The character should be a soft, huggable stuffed toy with visible fabric texture, stitching details, and cute button eyes.\n            Style: Soft toy photography, studio lighting, macro shot, felt and cotton texture.\n            Prompt: ${prompt}`;
        } else if (style === 'manga') {
            finalPrompt = `Create a 4-panel manga (Yon-koma) layout telling a short story about: ${prompt}.\n            Style: Clean black and white manga art, expressive characters, speed lines, and sound effects (onomatopoeia in English like "POW", "WHOOSH", "ZAP").\n    【構成】：物語が1コマ目から順に「起（導入）」「承（展開）」「転（変化）」「結（結末）」の4つのコマ割りで進むように描いてください。        Layout: 4 vertical panels with clear borders.`;
        } else if (style === 'sns-icons-6') {
            finalPrompt = `Create a grid of 6 different high-quality SNS profile icons for: ${prompt}.\n            Style: Modern flat illustration, vibrant colors, varied expressions and poses.\n            Layout: 3x4 grid of circular or square icons.`;
        } else if (style === 'instruction-manual') {
            finalPrompt = `Create a retro video game instruction manual page for: ${prompt}.\n            Include: Character artwork, stat bars (HP, MP, ATK, DEF), and a brief description in a classic RPG font.\n            Style: 90s JRPG manual art, slightly weathered paper texture, pixel art elements.`;
        } else if (style === 'picture-book') {
            finalPrompt = `Create a beautiful double-page spread for a children\'s picture book about: ${prompt}.\n            Style: 木の机の上に置かれた、美しい絵本の見開きページ。Soft watercolor and colored pencil, whimsical atmosphere, large areas for text.\n            Include: A short poetic sentence in English at the bottom.`;
        } else if (style === 'watercolor') {
            finalPrompt = `「${prompt}」を、繊細な水彩画スタイルで描いてください。\n            【技法】：透明感のある色彩、美しい滲みとぼかし、手漉き紙の質感。\n            【雰囲気】：光が透き通るような、優しく穏やかな空気感。\n            Delicate watercolor painting, wet-on-wet technique, soft edges, paper texture.`;
        } else if (style === 'oil-painting') {
            finalPrompt = `「${prompt}」を、重厚な油彩画スタイルで描いてください。\n            【技法】：力強い筆致（インパスト）、豊かな色彩の重なり、キャンバスの布目。\n            【雰囲気】：古典的で格調高く、光と影のコントラストが際立つ表現。\n            Classic oil painting, thick brushstrokes, impasto technique, canvas texture, dramatic lighting.`;
        } else if (style === 'chibi') {
            finalPrompt = `「${prompt}」を、愛らしいちびキャラ（2頭身）スタイルで描いてください。\n            【特徴】：大きな瞳、デフォルメされた体型、ポップで明るい配色。\n            【雰囲気】：かわいらしく、見ているだけで癒されるような可愛さ。\n            Cute chibi style, super deformed, big expressive eyes, vibrant colors, kawaii aesthetic.`;
        } else if (style === 'line-art') {
            finalPrompt = `「${prompt}」を、洗練された線画（ラインアート）スタイルで描いてください。\n            【技法】：強弱のある美しい主線、最小限の陰影、白場を活かした構成。\n            【雰囲気】：ミニマルでモダン、かつキャラクターの個性が際立つ表現。\n            Clean line art, minimalist style, elegant strokes, black and white with selective accents.`;
        } else if (style === '3d-render') {
            finalPrompt = `「${prompt}」を、最新の3Dレンダリングスタイルで描いてください。\n            【質感】：サブサーフェス・スキャッタリングによる柔らかな肌、物理ベースのリアルな素材感。\n            【雰囲気】：ピクサーやドリームワークスのような、高品質な3Dアニメーション映画のワンシーン。\n            High-end 3D render, Octane render, Ray tracing, stylized character design, soft global illumination.`;
        } else if (style === 'other') {
  const variants = [
    {
      name: "JRPGファンタジー・コンセプトアート",
      prompt: `「${prompt}」を、JRPGファンタジーのコンセプトアートとして描いてください。
【雰囲気】：壮大、神秘的、冒険の始まり。ドラマチックな光。
【描写】：緻密な背景、シネマティックな構図、空気遠近。`
    },
    {
      name: "アメリカンコミック",
      prompt: `「${prompt}」を、アメリカンコミック風に描いてください。
【表現】：太めのインク線、強い陰影、ハーフトーン、ダイナミックな構図。`
    },
    {
      name: "ぷっくりシール",
      prompt: `「${prompt}」を、ぷっくりしたステッカー（シール）風に描いてください。
【表現】：白フチ、つや、立体感、ポップで可愛いデフォルメ。背景はシンプル。`
    },
    {
      name: "コルクボード写真",
      prompt: `「${prompt}」を、コルクボードにピンで留めた写真のように描いてください。
【表現】：少し色あせた写真質感、紙の縁、影、ピンやマスキングテープの演出。`
    },
  ];

  const pick = variants[Math.floor(Math.random() * variants.length)];
  finalPrompt = pick.prompt;
}

        const base64 = await generateImage(finalPrompt, characterImages, aspect, useProModel, resolution, angle);
        const imageUrl = `data:image/png;base64,${base64}`;
        setGeneratedImage(imageUrl);
        
        recordGeneration();

        if (style === 'instruction-manual') {
            setIsAnalyzing(true);
            try {
                const info: GeminiGuideInfo = await analyzeGuideImage(base64);
                // Map GeminiGuideInfo to LocalGuideInfo
                const localInfo: LocalGuideInfo = {
                    characterName: info.characterName,
                    description: info.description,
                    items: info.items.map(i => i.name),
                    stats: {
                        hp: info.stats.find(s => s.label.toUpperCase() === 'HP')?.value || 100,
                        mp: info.stats.find(s => s.label.toUpperCase() === 'MP')?.value || 100,
                        atk: info.stats.find(s => s.label.toUpperCase() === 'ATK')?.value || 10,
                        def: info.stats.find(s => s.label.toUpperCase() === 'DEF')?.value || 10,
                        spd: info.stats.find(s => s.label.toUpperCase() === 'SPD')?.value || 10,
                    }
                };
                setGuideInfo(localInfo);
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

  const sampleConversations = [
    { label: "Cute Animals", text: "A: ねえ見て、子犬が子猫のしっぽ追いかけてる。\nB: うそ、可愛すぎ。こっち来た…！\nA: 縁側の光があったかいね。毛がふわって光ってる。\nB: 小鳥まで寄ってきた。パンくず狙ってる顔してる。\nA: マグの湯気がふわっと上がって、空気が甘い匂い。\nB: この瞬間、写真じゃなくて絵にしたい。" },
    { label: "Candy Castle", text: "A: あそこ…お菓子でできた城じゃない？\nB: 塔がアイシングで、窓が飴…光ってる。\nA: 足元、チョコの川。橋はクッキーだ。\nB: 綿あめみたいな雲がちぎれて流れてる。\nA: 近づくとキャラメルの匂いが濃くなる…食べたい。\nB: 今日は冒険より、味見が先かもね。" },
    { label: "Fantasy Adventure", text: "A: 崖の上だ。下は霧で見えない。\nB: 風が強い…手、離さないで。\nA: 遠くに古い塔。稲妻で一瞬だけ輪郭が見えた。\nB: 行くなら今。夜が濃くなる前に。\nA: 足元の草が光ってる…魔法陣みたいだ。\nB: 私たち、ちゃんと帰れるかな。" },
    { label: "After School", text: "A: 放課後の廊下、誰もいないね。\nB: 窓の光だけ。靴音がやけに響く。\nA: さっきの一言、言いすぎた。ごめん。\nB: びっくりしただけ。嫌いになったわけじゃない。\nA: じゃあ、帰り道…少しだけ一緒に歩く？\nB: …うん。雨の匂いするね。" }
  ];

  const handleSampleClick = (text: string) => {
    if (prompt) {
      if (window.confirm("現在のプロンプトが上書きされます。新しいサンプルで始めますか？")) {
        setPrompt('');
        setLog(text);
        logRef.current?.focus();
      }
    } else {
      setLog(text);
      logRef.current?.focus();
    }
  };

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
                          className={`flex items-center space-x-2 px-4 py-2 rounded-full text-[14px] font-bold transition-all ${
                              angle === opt.value 
                                  ? 'bg-rose-400 text-white shadow-md scale-105'
                                  : 'bg-white text-stone-500 hover:bg-stone-100'
                          }`}
                      >
                          <span className="text-lg">{opt.icon}</span>
                          <span>{opt.label}</span>
                      </button>
                  ))}
              </div>
            </Card>

            {/* Step 2: 物語を紡ぐ */}
            <Card>
              <StepHeader num={2} title="物語を紡ぐ" sub="(今日の会話ログをコピペ)" />
              <textarea
                key="log-textarea"
                ref={logRef}
                value={log}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  if (!(e.nativeEvent instanceof InputEvent) || !e.nativeEvent.isComposing) {
                    setLog(e.target.value)
                  }
                }}
                placeholder="心に残った会話や、日記の断片をここに..."
                className="w-full h-32 p-4 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-rose-300 focus:outline-none transition-all text-sm leading-relaxed"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {sampleConversations.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleSampleClick(p.text)}
                    className="text-xs bg-stone-100 text-stone-500 px-3 py-1 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-all"
                  >
                    {p.label} を試す
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <Button 
                  onClick={handleSummarize}
                  disabled={!log || isSummarizing}
                  className="w-full"
                >
                  {isSummarizing ? <Spinner /> : <WandIcon />} 
                  ログからシーンを要約
                </Button>
              </div>
            </Card>

            {/* Step 3: 設定した登場人物 */}
            <Card>
              <StepHeader num={3} title="設定した登場人物" />
              {characters.length > 0 ? (
                <div className="space-y-3">
                  {characters.map(char => (
                    <div key={char.id} className="flex items-center justify-between p-2 rounded-lg bg-stone-50">
                      <div className="flex items-center space-x-3">
                        <img src={char.images[0]?.url} alt={char.name} className="w-12 h-12 rounded-full object-cover" />
                        <span className="font-bold text-stone-600">{char.name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button onClick={() => insertCharacterToPrompt(char.name)} className="text-xs bg-rose-100 text-rose-500 px-3 py-1 rounded-full hover:bg-rose-200 transition-all">プロンプトに追加</button>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="checkbox" checked={char.isActive} onChange={() => toggleCharacterActive(char.id)} className="form-checkbox h-5 w-5 text-rose-400 rounded focus:ring-rose-300" />
                          <span className="text-xs text-stone-500">アクティブ</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400 text-center py-4">設定タブでキャラクターを登録してください</p>
              )}
            </Card>

            {/* Step 4: こんなシーンでどう？ */}
            <Card>
              <StepHeader num={4} title="こんなシーンでどう？" sub="(プロンプト生成・編集)" />
              <textarea
                key="prompt-textarea"
                ref={promptRef}
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  if (!(e.nativeEvent instanceof InputEvent) || !e.nativeEvent.isComposing) {
                    setPrompt(e.target.value)
                  }
                }}
                placeholder="描きたい情景の、具体的な筆致をここに..."
                className="w-full h-48 p-4 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-rose-300 focus:outline-none transition-all text-sm leading-relaxed"
              />
            </Card>

            {/* Step 5: お好きなスタイルで */}
            <Card>
              <StepHeader num={5} title="お好きなスタイルで" />
              <div className="flex flex-wrap gap-3">
                {filteredStyles.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center space-x-2 ${
                      style === s.value
                        ? 'bg-rose-400 text-white shadow-md scale-105'
                        : 'bg-white text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-stone-100 flex items-center justify-center space-x-6">
                  <button onClick={() => setAspect('1:1')} className={`p-3 rounded-lg ${aspect === '1:1' ? 'bg-rose-100 text-rose-400' : 'text-stone-300 hover:bg-stone-100'}`}><SquareIcon /></button>
                  <button onClick={() => setAspect('16:9')} className={`p-3 rounded-lg ${aspect === '16:9' ? 'bg-rose-100 text-rose-400' : 'text-stone-300 hover:bg-stone-100'}`}><LandscapeIcon /></button>
                  <button onClick={() => setAspect('9:16')} className={`p-3 rounded-lg ${aspect === '9:16' ? 'bg-rose-100 text-rose-400' : 'text-stone-300 hover:bg-stone-100'}`}><PortraitIcon /></button>
              </div>
            </Card>

            {/* Step 6: 描いてみせます */}
            <Card>
              <StepHeader num={6} title="描いてみせます" />
              <div className={`space-y-4 transition-opacity ${useProModel ? '' : 'opacity-50 cursor-not-allowed'}`}>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-stone-50">
                  <div className="flex items-center space-x-3">
                    <DiamondIcon />
                    <span className="font-bold text-stone-600">プロモード</span>
                    <span className="text-xs bg-rose-400 text-white px-2 py-0.5 rounded-full">Coming soon</span>
                  </div>
                  <div className="relative w-12 h-6">
                    <input type="checkbox" id="pro-toggle" className="sr-only" checked={useProModel}  disabled />
                    <div className="block bg-stone-200 w-12 h-6 rounded-full"></div>
                    <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"></div>
                  </div>
                </div>
                <div className="flex items-center justify-around">
                  <button disabled={!useProModel} onClick={() => setResolution('1K')} className={`px-4 py-2 rounded-full text-sm ${resolution === '1K' && useProModel ? 'bg-rose-400 text-white' : 'text-stone-400'}`}>1K</button>
                  <button disabled={!useProModel} onClick={() => setResolution('2K')} className={`px-4 py-2 rounded-full text-sm ${resolution === '2K' && useProModel ? 'bg-rose-400 text-white' : 'text-stone-400'}`}>2K</button>
                  <button disabled={!useProModel} onClick={() => setResolution('4K')} className={`px-4 py-2 rounded-full text-sm ${resolution === '4K' && useProModel ? 'bg-rose-400 text-white' : 'text-stone-400'}`}>4K</button>
                </div>
              </div>
              <div className="mt-6">
                <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                    {isLoading ? <Spinner /> : '🖌️ 描き起こす'}
                  </Button>
              </div>
              {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
              <p className="text-xs text-stone-400 text-center mt-2">1日の生成回数: 残り {getRemainingGenerations()} 回</p>
            </Card>
          </div>

          <div className="sticky top-12">
            <Card className="h-[42rem]">
              <div className="h-full flex items-center justify-center bg-stone-50 rounded-3xl overflow-hidden">
                {isLoading ? (
                  <div className="text-center space-y-2">
                    <Spinner size="lg" />
                    <p className="text-sm text-stone-400">空想を紡いでいます...</p>
                  </div>
                ) : generatedImage ? (
                  <div className="relative w-full h-full group">
                    <img src={generatedImage} alt="Generated art" className="w-full h-full object-contain" />
                    <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button onClick={() => onStartEditing({ url: generatedImage || '', base64: '', mimeType: 'image/png' }, prompt, style, aspect)}>直す</Button>
                      {/* <Button onClick={() => onStartAnimating({ url: generatedImage, prompt, style, aspect })} size="sm">動かす</Button> */}
                        <a
  href={generatedImage}
  download={`quiet-atelier-${Date.now()}.png`}
  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 font-bold hover:shadow-md transition"
>
  保存
</a>

                    </div>
                    {guideInfo && (
                      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-4 rounded-lg text-xs text-stone-700 space-y-2 max-w-xs">
                        <h4 className="font-bold text-sm">{guideInfo.characterName}</h4>
                        <p>{guideInfo.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {guideInfo.items.map(item => <span key={item} className="text-xs bg-rose-100 text-rose-500 px-2 py-0.5 rounded-full">{item}</span>)}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                          <div><span className="font-bold">HP</span> {guideInfo.stats.hp}</div>
                          <div><span className="font-bold">MP</span> {guideInfo.stats.mp}</div>
                          <div><span className="font-bold">ATK</span> {guideInfo.stats.atk}</div>
                          <div><span className="font-bold">DEF</span> {guideInfo.stats.def}</div>
                          <div><span className="font-bold">SPD</span> {guideInfo.stats.spd}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-stone-300 space-y-2">
                    <div className="text-4xl">🎨</div>
                    <p className="font-light">ATELIER QUIET // WAITING FOR INSPIRATION</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
