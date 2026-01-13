import React from 'react';
import Card from './Card';

const HelpPage: React.FC = () => {
  const steps = [
    {
      title: 'Step 1：視点を決める (アングル選択)',
      desc: '描きたいシーンの「距離感」や「角度」を選びます。アップにすれば表情が豊かに、引きにすれば風景が際立ちます。',
      icon: '📐'
    },
    {
      title: 'Step 2：物語を紡ぐ (会話ログを活用)',
      desc: '心に残った会話や日記などを入力してください。「ログからシーンを要約」ボタンを押すと、AIが自動で情景描写へ変換します。',
      icon: '📜'
    },
    {
      title: 'Step 3：参考画像 ある？(人物や小物)',
      desc: '特定のキャラクターや小物のイメージがある場合は、画像をアップロードしてください。AIがその特徴を理解し、絵に反映させます。',
      icon: '🖼️'
    },
    {
      title: 'Step 4：こんなシーンでどう？ (構成)',
      desc: '生成された要約を確認し、必要なら自由に書き換えてください。ここに入力された言葉が、直接キャンバスに描かれます。',
      icon: '✍️'
    },
    {
      title: 'Step 5：お好きなスタイルで (画風・比率)',
      desc: '「水彩画」や「アニメ」などの画風、そして画像の比率を選びます。あなたの気分にぴったりの筆致を見つけてください。',
      icon: '✨'
    },
    {
      title: 'Step 6：描いてみせます (プロモード・描画)',
      desc: '準備ができたら大きなボタンを押しましょう。「プロモード」をONにすると、より高品質な描画エンジンが起動します。',
      icon: '🎨'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-stone-700">創作の手引き</h2>
        <p className="text-stone-400">画家のアトリエへようこそ。あなたの物語を形にする方法をご紹介します。</p>
      </div>

      {/* プラン比較セクション */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold text-stone-700 text-center">アトリエの利用プラン</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 border-stone-100 relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-stone-600">スタンダード</h4>
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Free</span>
              </div>
              <ul className="space-y-3">
                <li className="text-sm text-stone-500 flex items-center">
                  <span className="text-rose-300 mr-2">✓</span> 基本的な描画機能
                </li>
                <li className="text-sm text-stone-500 flex items-center">
                  <span className="text-rose-300 mr-2">✓</span> アニメ・水彩など標準スタイル
                </li>
                <li className="text-sm text-stone-500 flex items-center">
                  <span className="text-rose-300 mr-2">✓</span> 標準解像度 (1K)
                </li>
                <li className="text-sm text-stone-200 flex items-center italic line-through">
                   動画アニメーション生成
                </li>
              </ul>
            </div>
          </Card>

          <Card className="border-2 border-rose-200 shadow-xl shadow-rose-50 relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30">
            <div className="absolute top-0 right-0 px-4 py-1 bg-rose-400 text-white text-[10px] font-black uppercase tracking-tighter rounded-bl-xl">Pro Member</div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-rose-500">プロ・メンバーシップ</h4>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Premium</span>
              </div>
              <ul className="space-y-3">
                <li className="text-sm text-stone-600 flex items-center font-bold">
                  <span className="text-rose-400 mr-2">★</span> 最高品質エンジン (Gemini 3 Pro)
                </li>
                <li className="text-sm text-stone-600 flex items-center font-bold">
                  <span className="text-rose-400 mr-2">★</span> 4K 超高解像度出力
                </li>
                <li className="text-sm text-stone-600 flex items-center font-bold">
                  <span className="text-rose-400 mr-2">★</span> 動画生成 (Veo) の全開放
                </li>
                <li className="text-sm text-stone-600 flex items-center font-bold">
                  <span className="text-rose-400 mr-2">★</span> 複雑な指示への完璧な理解
                </li>
              </ul>
              <p className="text-[10px] text-stone-400 mt-4 leading-relaxed italic">
                ※ プロ機能の利用には、Google Cloudにて個別の課金設定が必要となります。
              </p>
            </div>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((step, index) => (
          <Card key={index} className="hover:border-rose-100 transition-colors group">
            <div className="flex items-start space-x-4">
              <div className="text-3xl bg-stone-50 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:bg-rose-50 transition-colors flex-shrink-0">
                {step.icon}
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-stone-700 leading-tight">{step.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-r from-rose-50/50 to-purple-50/50 border-none">
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-stone-700 flex items-center">
             <span className="mr-2">💡</span> 創作をより深めるために
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <h4 className="font-bold text-stone-600 text-sm">「直す」タブ</h4>
              <p className="text-xs text-stone-500 leading-loose">
                生成された絵の「ここだけ変えたい」を叶えます。レイヤーを重ねるように、少しずつ魔法をかけて修正していけます。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-stone-600 text-sm">「動かす」タブ</h4>
              <p className="text-xs text-stone-500 leading-loose">
                静止画に息吹を吹き込みます。雪を降らせたり、微笑ませたり。映像として動き出す瞬間を体験してください。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-stone-600 text-sm">「遊ぶ」タブ</h4>
              <p className="text-xs text-stone-500 leading-loose">
                ぬいぐるみ化や4コマ漫画化など、ユニークな表現を楽しめます。「物語で遊ぶ」ための特別なキャンバスです。
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="text-center py-8">
        <p className="text-[10px] text-stone-300 tracking-[0.3em] uppercase">
          Happy Creating in Quiet Atelier
        </p>
      </div>
    </div>
  );
};

export default HelpPage;
