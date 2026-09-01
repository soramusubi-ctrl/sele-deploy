import React, { useEffect, useState } from 'react';
import type { ImageForEditing } from '../App';
import Button from './Button';
import Card from './Card';
import Spinner from './Spinner';
import { generateVideo } from '../services/geminiService';

interface VideoGeneratorProps {
  imageToAnimate: ImageForEditing | null;
  onAnimationComplete: () => void;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ imageToAnimate, onAnimationComplete }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [sourceImage, setSourceImage] = useState<ImageForEditing | null>(imageToAnimate);

  useEffect(() => {
    setSourceImage(imageToAnimate);
  }, [imageToAnimate]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setSourceImage({
        url,
        base64: url.replace(/^data:image\/[^;]+;base64,/, ''),
        mimeType: file.type,
      });
      setVideoUrl(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!sourceImage || !prompt.trim()) return;
    
    setIsGenerating(true);
    setVideoUrl(null);
    setProgressMessage('アニメーション生成を開始しています...');
    
    try {
      const url = await generateVideo(
        prompt,
        sourceImage.base64,
        sourceImage.mimeType,
        aspectRatio,
        setProgressMessage
      );
      setVideoUrl(url);
      setProgressMessage('');
    } catch (error: any) {
      alert(error.message || 'アニメーション生成に失敗しました');
      setProgressMessage('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold mb-4 text-stone-700">アニメーション生成</h2>
        
        {sourceImage ? (
          <div className="mb-4">
            <img 
              src={sourceImage.url}
              alt="元画像" 
              className="max-w-full h-auto rounded-lg shadow-md"
            />
          </div>
        ) : (
          <div className="mb-4 rounded-lg border-2 border-dashed border-stone-200 p-6 text-center">
            <label className="cursor-pointer font-bold text-rose-500 hover:text-rose-600">
              動かす画像を選ぶ
              <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
            </label>
            <p className="mt-2 text-xs text-stone-400">PNG、JPEG、WebPなどの画像に対応</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-stone-600">
              アニメーションの指示
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例: ゆっくりと風に揺れる"
              className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-300 focus:border-transparent"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-stone-600">
              アスペクト比
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => setAspectRatio('16:9')}
                disabled={isGenerating}
                className={aspectRatio === '16:9' ? 'bg-rose-400' : 'bg-stone-300'}
              >
                16:9
              </Button>
              <Button
                onClick={() => setAspectRatio('9:16')}
                disabled={isGenerating}
                className={aspectRatio === '9:16' ? 'bg-rose-400' : 'bg-stone-300'}
              >
                9:16
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !sourceImage || !prompt.trim()}
              className="flex-1"
            >
              {isGenerating ? <Spinner /> : 'アニメーション生成'}
            </Button>
            <Button
              onClick={onAnimationComplete}
              disabled={isGenerating}
              className="bg-stone-400 hover:bg-stone-500"
            >
              戻る
            </Button>
          </div>

          <p className="text-xs text-stone-400">
            Veo 3.1 Lite（720p）を使用します。動画生成には有料のGemini API設定が必要です。
          </p>

          {progressMessage && (
            <div className="text-center text-sm text-stone-500">
              {progressMessage}
            </div>
          )}
        </div>
      </Card>

      {videoUrl && (
        <Card>
          <h3 className="text-xl font-bold mb-4 text-stone-700">生成結果</h3>
          <video
            src={videoUrl}
            controls
            className="w-full rounded-lg shadow-md mb-4"
          />
          <a
            href={videoUrl}
            download={`quiet-atelier-video-${Date.now()}.mp4`}
            className="inline-flex w-full items-center justify-center rounded-full border-2 border-rose-100 bg-white px-6 py-3 text-base font-bold text-rose-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:ring-offset-2"
          >
            動画をダウンロード
          </a>
        </Card>
      )}
    </div>
  );
};

export default VideoGenerator;
