import { prepareAiImage } from '../utils/aiImageInput';
import { ensureAiSession } from './aiSession';

export interface GuideInfo {
    characterName: string;
    title: string;
    description: string;
    stats: { label: string; value: number; max: number }[];
    items: { name: string; description: string; rarity: string }[];
}

type CharacterReference = { name: string; images?: { base64: string; mimeType?: string }[] };
async function request<T>(body: object): Promise<T> {
    await ensureAiSession();
    const json = JSON.stringify(body);
    if (new TextEncoder().encode(json).length > 3_000_000) throw new Error('送信する画像が大きすぎます。参照画像を減らすか、小さな画像を選んでください。');
    const response = await fetch('/api/ai', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: json, signal: AbortSignal.timeout(115000),
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('AIサーバーに接続できません。管理者に設定を確認してください。'); }
    if (!response.ok) throw new Error(data.error || 'AI生成に失敗しました。');
    return data.result as T;
}
export const analyzeGuideImage = async (imageBase64: string): Promise<GuideInfo> => {
    const image = await prepareAiImage(imageBase64, 'image/png');
    return request({ operation: 'analyze', imageBase64: image.base64, mimeType: image.mimeType });
};
export const summarizeConversation = (conversation: string, angle = 'auto'): Promise<string> => request({ operation: 'summarize', conversation, angle });
export const generateImage = async (
    prompt: string, characterContext: CharacterReference[] = [],
    aspectRatio: '1:1' | '16:9' | '9:16' = '1:1', useProModel = false,
    resolution: '1K' | '2K' | '4K' = '1K', _angle = 'normal'
): Promise<string> => {
    void _angle; // Retained for compatibility; the prompt already incorporates the angle.
    const references = await Promise.all(characterContext.map(async character => ({ name: character.name,
        images: await Promise.all((character.images || []).slice(0, 1).map(image => prepareAiImage(image.base64, image.mimeType || 'image/png'))) })));
    return request({ operation: 'generate', prompt, characterContext: references, aspectRatio, useProModel, resolution });
};
export const editImage = async (prompt: string, imageBase64: string, mimeType: string, useProModel = false): Promise<string> => {
    const image = await prepareAiImage(imageBase64, mimeType);
    return request({ operation: 'edit', prompt, imageBase64: image.base64, mimeType: image.mimeType, useProModel });
};

// Provider URLs, operation names and keys stay server-side. Ownership uses an HttpOnly cookie.
type VideoJob = { jobId: string; status: 'pending' | 'ready' | 'uncertain' | 'failed' | 'expired'; retryAfterMs: number };
type PendingVideo = { requestId: string; jobId?: string };
async function videoRequest(body: object, signal?: AbortSignal): Promise<Response> {
    await ensureAiSession();
    const timeout = AbortSignal.timeout(70000);
    const response = await fetch('/api/video', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '動画の状態を確認できません。同じ入力で再度ボタンを押すと、再生成せず状態を確認します。');
    }
    return response;
}
function delayVideo(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
        const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
        signal?.addEventListener('abort', abort, { once: true });
    });
}
export const generateVideo = async (
    prompt: string, imageBase64: string, mimeType: string, aspectRatio: '16:9' | '9:16',
    onProgress: (message: string) => void, signal?: AbortSignal
): Promise<string> => {
    const prepared = await prepareAiImage(imageBase64, mimeType);
    imageBase64 = prepared.base64; mimeType = prepared.mimeType;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) throw new Error('PNG、JPEG、WebPの画像を選択してください。');
    if (!prompt.trim() || prompt.length > 3000) throw new Error('動画の指示は1〜3000文字で入力してください。');
    // Save a request ID before creation so reloads, timeouts, and repeated clicks
    // cannot silently issue a duplicate paid job for this pending input.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([prompt.trim(), imageBase64, mimeType, aspectRatio])));
    const key = `sele:video:pending:v2:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    // Legacy records include an access-code-dependent digest and cannot be safely
    // matched to this input. Never silently create a second paid job during migration.
    let legacyPending = false;
    try {
        for (let i = 0; i < sessionStorage.length; i++) {
            if (/^sele:video:pending:[a-f0-9]{64}$/.test(sessionStorage.key(i) || '')) legacyPending = true;
        }
    } catch { throw new Error('重複課金を防ぐため、ブラウザーのセッション保存を有効にしてから動画を生成してください。'); }
    if (legacyPending) throw new Error('更新前に受け付けた動画が残っています。重複課金を防ぐため、新しい動画は作成せず管理者に確認してください。');
    let pending: PendingVideo;
    try {
        const saved = sessionStorage.getItem(key);
        pending = saved ? JSON.parse(saved) as PendingVideo : { requestId: crypto.randomUUID() };
        if (typeof pending.requestId !== 'string') throw new Error('invalid saved request');
        sessionStorage.setItem(key, JSON.stringify(pending));
    } catch { throw new Error('重複課金を防ぐため、ブラウザーのセッション保存を有効にしてから動画を生成してください。'); }
    let job = await (await videoRequest(pending.jobId ? { action: 'status', jobId: pending.jobId } : {
        action: 'create', requestId: pending.requestId, prompt, imageBase64, mimeType, aspectRatio,
    }, signal)).json() as VideoJob;
    pending.jobId = job.jobId;
    sessionStorage.setItem(key, JSON.stringify(pending));
    for (let poll = 0; job.status === 'pending' && poll < 120; poll++) {
        onProgress('アニメーションを生成中... この画面で状態を確認しています。');
        await delayVideo(10000, signal);
        job = await (await videoRequest({ action: 'status', jobId: pending.jobId }, signal)).json() as VideoJob;
    }
    if (job.status === 'uncertain') throw new Error('生成の受付結果を確認できません。重複課金を防ぐため自動再生成はしません。管理者に確認してください。');
    if (job.status === 'failed') throw new Error('動画を生成できませんでした。同じ入力からの自動再生成はしません。入力を変更すると新しい生成になります。');
    if (job.status !== 'ready') throw new Error('動画の確認時間が上限に達しました。管理者に確認してください。自動再生成はしません。');
    onProgress('生成した動画を取得中...');
    const response = await videoRequest({ action: 'download', jobId: pending.jobId }, signal);
    if (!response.headers.get('content-type')?.startsWith('video/mp4')) throw new Error('動画を取得できませんでした。');
    const blob = await response.blob();
    if (!blob.size || blob.size > 64 * 1024 * 1024) throw new Error('動画のサイズを確認できませんでした。');
    sessionStorage.removeItem(key);
    return URL.createObjectURL(blob);
};
