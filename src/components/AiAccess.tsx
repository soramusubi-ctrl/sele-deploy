import { useState } from 'react';
import { setAccessCode } from '../services/aiAccess';

export default function AiAccess() {
  const [code, setCode] = useState('');
  const [ready, setReady] = useState(false);
  return <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4" aria-label="AI利用コード">
    <p className="mb-2 text-sm">AI生成には管理者から受け取った利用コードが必要です。Gemini APIキーは入力しないでください。</p>
    {ready ? <div className="flex items-center gap-3 text-sm">
      <span role="status">利用コードを設定しました（生成時にサーバーで確認します）。</span>
      <button type="button" onClick={() => { setAccessCode(''); setReady(false); }} className="underline">解除・変更</button>
    </div> : <form className="flex gap-2" onSubmit={event => {
      event.preventDefault(); setAccessCode(code); setCode(''); setReady(true);
    }}>
      <label htmlFor="ai-access-code" className="sr-only">AI利用コード</label>
      <input id="ai-access-code" type="password" autoComplete="off" required minLength={32} maxLength={128}
        pattern="[A-Za-z0-9_-]{32,128}" value={code} onChange={event => setCode(event.target.value)}
        className="min-w-0 flex-1 rounded border p-2" placeholder="管理者からの利用コード" />
      <button type="submit" className="rounded bg-stone-700 px-4 text-white">設定</button>
    </form>}
    <p className="mt-2 text-xs text-stone-500">コードはこの画面を開いている間だけ保持します。利用上限はサーバーで共有されています。</p>
  </section>;
}
