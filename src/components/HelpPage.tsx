import React from 'react';

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-[2.5rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-50/50 ${className}`}>
      {children}
  </div>
);

const HelpPage: React.FC = () => {
  const steps = [
    {
      num: 1,
      title: "視点を決める",
      sub: "(アングル選択)",
      desc: "カメラの角度や距離を選びます。アップなら表情豊かに、引きなら風景と共に。あなたの物語に最適な視点を見つけてください。"
    },
    {
      num: 2,
      title: "物語を紡ぐ",
      sub: "(今日の会話ログをコピペ)",
      desc: "心に残った会話や日記の断片を貼り付けてください。AIがその場の空気感や感情を読み取り、絵画の核となる情景を要約します。"
    },
    {
      num: 3,
      title: "参考画像 ある？",
      sub: "(登場人物や小物の画像)",
      desc: "特定のキャラクターやアイテムを登場させたい場合は、画像をアップロードしてください。AIがその特徴を捉え、作品に反映させます。"
    },
    {
      num: 4,
      title: "こんなシーンでどう？",
      sub: "(プロンプト生成・編集)",
      desc: "要約された物語を元に、具体的な描写を言葉にします。AIが提案した文章を自由に編集して、より理想に近い「下書き」を完成させましょう。"
    },
    {
      num: 5,
      title: "お好きなスタイルで",
      sub: "(画風・比率)",
      desc: "水彩画、油絵、アニメ風など、作品の「筆致」を選びます。画面の比率も、SNS用や壁紙用など用途に合わせて調整可能です。"
    },
    {
      num: 6,
      title: "描いてみせます",
      sub: "(プロモード切り替え・最終描画)",
      desc: "すべての準備が整ったら「描き起こす」ボタンを押してください。プロモードでは、より高精細なモデルと解像度で、最高の一枚を仕上げます。"
    }
  ];

  return (
    <div className="min-h-screen bg-[#fdfaf7] px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-stone-700 tracking-tight">創作の手引き</h1>
          <p className="text-stone-400 italic text-sm font-light">Quiet Atelier - User Guide & Membership</p>
        </div>

        <div className="space-y-8">
          <h2 className="text-xl font-bold text-stone-600 border-l-4 border-rose-300 pl-4">創造のステップ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step) => (
              <Card key={step.num} className="hover:shadow-md transition-shadow">
                <div className="flex items-baseline space-x-2 mb-3">
                  <span className="text-[10px] font-bold text-rose-400 tracking-widest uppercase">STEP {step.num} :</span>
                  <h3 className="text-sm font-bold text-stone-700">{step.title}</h3>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-xl font-bold text-stone-600 border-l-4 border-rose-300 pl-4">メンバーシップのご案内</h2>
          <Card className="bg-gradient-to-br from-white to-rose-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-stone-100 rounded-full text-stone-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-stone-700">スタンダード</h3>
                </div>
                <ul className="text-xs text-stone-400 space-y-2 list-disc pl-4">
                  <li>1日10回までの画像生成</li>
                  <li>標準モデルによる描画</li>
                  <li>基本的な画風の選択</li>
                  <li>コミュニティでの作品共有</li>
                </ul>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-rose-400 rounded-full text-white shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-stone-700">プロ・メンバーシップ</h3>
                </div>
                <ul className="text-xs text-stone-400 space-y-2 list-disc pl-4">
                  <li>生成回数の制限なし</li>
                  <li>最新の高画質モデル（Pro）の利用</li>
                  <li>最大4K解像度での書き出し</li>
                  <li>すべての特殊スタイルの解放</li>
                  <li>先行機能へのアクセス</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-600 border-l-4 border-rose-300 pl-4">生成に関するご注意</h2>
          <Card className="bg-stone-50/50 border-dashed border-stone-200">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-stone-200 rounded-full text-stone-500 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-stone-700">セーフガードについて</h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  本アプリではAIの安全基準（セーフガード）を適用しています。暴力的な表現、公序良俗に反する内容、または著作権侵害の恐れがあるプロンプトや画像については、AIの判断により生成が制限されたり、ご希望通りに描き起こされない場合があります。あらかじめご了承ください。
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="text-center pt-8">
          <p className="text-[10px] text-stone-300 uppercase tracking-[0.3em]">Atelier Quiet // Your Creative Sanctuary</p>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
