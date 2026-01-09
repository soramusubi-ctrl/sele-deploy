import React, { useState } from 'react';
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

  const handleGenerate = async () => {
    if (!imageToAnimate || !prompt.trim()) return;
    
    setIsGenerating(true);
    setVideoUrl(null);
    setProgressMessage('アニメーション生成を開始しています...');
    
    try {
      const url = await generateVideo(
        prompt,
        imageToAnimate.base64,
        imageToAnimate.mimeType,
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
        
        {imageToAnimate && (
          <div className="mb-4">
            <img 
              src={imageToAnimate.url} 
              alt="元画像" 
              className="max-w-full h-auto rounded-lg shadow-md"
            />
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
              disabled={isGenerating || !prompt.trim()}
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
            className="w-full rounded-lg shadow-md"
          />
        </Card>
      )}
    </div>
  );
};

export default VideoGenerator;
