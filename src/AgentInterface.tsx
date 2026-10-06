
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessCode } from './services/aiAccess';
import { generateImage } from './services/geminiService';
import Card from './components/Card';
import Button from './components/Button';
import Spinner from './components/Spinner';
import type { CharacterState } from './App';

interface AgentInterfaceProps {
    characters: CharacterState[];
}

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const EarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.333 9.667a4.667 4.667 0 10-9.333 0c0 1.54.54 2.964 1.442 4.09l-1.442 2.91 2.91-1.443a4.655 4.655 0 002.423.676c2.577 0 4.667-2.09 4.667-4.666z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.667 4.5A7.167 7.167 0 002.5 11.667c0 1.764.636 3.39 1.696 4.656L2.5 21.5l5.177-1.696a7.158 7.158 0 002.49.43c3.96 0 7.166-3.206 7.166-7.167" />
    </svg>
);

const VolumeUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
);

const VolumeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
);


const AgentInterface: React.FC<AgentInterfaceProps> = ({ characters }) => {
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSilentMode, setIsSilentMode] = useState(true);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const socketRef = useRef<WebSocket | null>(null);
    const connectionVersion = useRef(0);
    const connectingRef = useRef(false);
    const mountedRef = useRef(true);
    const drawingVersion = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopAllAudio = useCallback(() => {
        sourcesRef.current.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsSpeaking(false);
    }, []);

    const handleDisconnect = useCallback((message = '') => {
        connectionVersion.current += 1;
        connectingRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        const socket = socketRef.current;
        socketRef.current = null;
        if (socket && socket.readyState < WebSocket.CLOSING) {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
            socket.close();
        }
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        audioSourceRef.current?.disconnect();
        audioSourceRef.current = null;
        stopAllAudio();
        for (const ctx of [inputAudioContextRef.current, outputAudioContextRef.current]) {
            if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
        }
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
        setStatusMessage(message);
    }, [stopAllAudio]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            drawingVersion.current += 1;
            handleDisconnect();
        };
    }, [handleDisconnect]);

    const selectedCharacter = characters.find(c => c.id === selectedCharId);
    const handleConnect = async () => {
        if (!selectedCharacter || connectingRef.current || socketRef.current) return;
        const accessCode = getAccessCode();
        if (!accessCode) { setStatusMessage('先に利用コードを入力してください。'); return; }
        connectingRef.current = true;
        setIsConnecting(true);
        const version = ++connectionVersion.current;
        const current = () => mountedRef.current && connectionVersion.current === version;
        const silent = isSilentMode;
        const cancelledDraws = new Set<string>();
        let drawQueue = Promise.resolve();
        setStatusMessage('マイクと安全な音声接続を準備しています...');
        try {
            inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
            // Start/resume in this user gesture for Safari's audio policy.
            void inputAudioContextRef.current.resume();
            void outputAudioContextRef.current.resume();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: true, noiseSuppression: true, autoGainControl: true,
            } });
            if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
            mediaStreamRef.current = stream;
            const url = new URL('/api/live', window.location.origin);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            // Only our own server is contacted; no provider SDK/key/token is in the browser.
            const socket = new WebSocket(url);
            socketRef.current = socket;
            timerRef.current = setTimeout(() => {
                if (current()) handleDisconnect('接続がタイムアウトしました。もう一度お試しください。');
            }, 15_000);
            socket.onopen = () => {
                if (!current()) { socket.close(); return; }
                socket.send(JSON.stringify({ type: 'start', accessCode,
                    characterName: selectedCharacter.name,
                    otherCharacters: characters.filter(c => c.isActive && c.id !== selectedCharacter.id).map(c => c.name).slice(0, 5),
                    silent,
                }));
            };
            socket.onmessage = event => {
                if (!current()) return;
                let message: { type: string; durationMs?: number; data?: string; reason?: string; id?: string; prompt?: string; style?: string };
                try { message = JSON.parse(event.data as string); } catch { handleDisconnect('音声データを受信できませんでした。'); return; }
                if (message.type === 'ready') {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    // UX fallback only. The server independently owns the paid-session timer.
                    timerRef.current = setTimeout(() => {
                        if (current()) handleDisconnect('45秒の接続が終了しました。続けるにはもう一度開始してください。');
                    }, Math.min(message.durationMs || 45_000, 45_000) + 1000);
                    connectingRef.current = false;
                    setIsConnecting(false);
                    setIsConnected(true);
                    setStatusMessage(silent ? '聞き取り中（最大45秒）...' : '通話中（最大45秒）');
                    const input = inputAudioContextRef.current;
                    if (!input || !mediaStreamRef.current) return;
                    const source = input.createMediaStreamSource(mediaStreamRef.current);
                    const processor = input.createScriptProcessor(4096, 1, 1);
                    processor.onaudioprocess = e => {
                        if (!current() || socket.readyState !== WebSocket.OPEN) return;
                        if (socket.bufferedAmount > 128_000) { handleDisconnect('回線が混み合っています。再接続してください。'); return; }
                        socket.send(createPcm(e.inputBuffer.getChannelData(0), input.sampleRate));
                    };
                    source.connect(processor);
                    processor.connect(input.destination);
                    audioSourceRef.current = source;
                    scriptProcessorRef.current = processor;
                } else if (message.type === 'audio' && message.data && !silent) {
                    playAudio(message.data);
                } else if (message.type === 'interrupted') {
                    stopAllAudio();
                } else if (message.type === 'cancelDraw' && message.id) {
                    cancelledDraws.add(message.id);
                } else if (message.type === 'draw' && message.id && message.prompt) {
                    const { id, prompt, style } = message;
                    drawQueue = drawQueue.then(async () => {
                        if (!current() || cancelledDraws.has(id)) return;
                        const drawing = ++drawingVersion.current;
                        setIsGenerating(true);
                        setStatusMessage(`🎨 ${selectedCharacter.name}が筆を執りました...`);
                        let ok = false;
                        try {
                            const activeChars = characters.filter(c => c.isActive).map(c => ({ name: c.name, images: c.images }));
                            const result = await generateImage(`${prompt}\nStyle: ${style || 'アニメ'}`, activeChars);
                            // An image already requested may finish after the audio session ends.
                            if (mountedRef.current && drawing === drawingVersion.current && !cancelledDraws.has(id)) {
                                setGeneratedImage(`data:image/png;base64,${result}`);
                                if (current()) setStatusMessage(`${selectedCharacter.name}が描き上げました`);
                            }
                            ok = true;
                        } catch {
                            if (current()) setStatusMessage('描画に失敗しました。利用上限や画像サイズを確認してください。');
                        } finally {
                            if (mountedRef.current && drawing === drawingVersion.current) setIsGenerating(false);
                            if (current() && !cancelledDraws.has(id) && socket.readyState === WebSocket.OPEN) {
                                socket.send(JSON.stringify({ type: 'toolResult', id, ok }));
                            }
                        }
                    });
                } else if (message.type === 'end') {
                    const reasons: Record<string, string> = {
                        duration: '45秒の接続が終了しました。続けるにはもう一度開始してください。',
                        limit: '今回の音声利用上限に達しました。続けるにはもう一度開始してください。',
                        quota: '利用上限または同時接続数に達しました。少し待つか管理者に確認してください。',
                        auth: '利用コードを確認してください。',
                        slow: '回線が混み合っています。再接続してください。',
                        error: '音声接続に失敗しました。管理者に設定を確認してください。',
                        closed: '音声接続が終了しました。',
                    };
                    handleDisconnect(reasons[message.reason || 'closed'] || reasons.closed);
                }
            };
            socket.onerror = () => { if (current()) handleDisconnect('音声接続に失敗しました。もう一度お試しください。'); };
            socket.onclose = () => { if (current()) handleDisconnect('音声接続が終了しました。'); };
        } catch {
            if (current()) handleDisconnect('接続できませんでした。マイクの許可と利用コードを確認してください。');
        }
    };

    const playAudio = (base64Data: string) => {
        const ctx = outputAudioContextRef.current;
        if (!ctx || ctx.state === 'closed') return;
        try {
            const binary = atob(base64Data);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            if (bytes.byteLength % 2) return;
            const view = new DataView(bytes.buffer);
            const buffer = ctx.createBuffer(1, bytes.byteLength / 2, 24000);
            const channel = buffer.getChannelData(0);
            for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.onended = () => { sourcesRef.current.delete(source); if (!sourcesRef.current.size) setIsSpeaking(false); };
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
            setIsSpeaking(true);
        } catch { /* Ignore a malformed playback chunk without logging payloads. */ }
    };

    function createPcm(data: Float32Array, sampleRate: number): ArrayBuffer {
        const ratio = sampleRate / 16000;
        const length = Math.floor(data.length / ratio);
        const buffer = new ArrayBuffer(length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < length; i++) {
            const position = i * ratio;
            const offset = Math.floor(position);
            const fraction = position - offset;
            const value = data[offset] * (1 - fraction) + data[Math.min(offset + 1, data.length - 1)] * fraction;
            view.setInt16(i * 2, Math.max(-1, Math.min(1, value)) * 32767, true);
        }
        return buffer;
    }

    // --- Render Logic ---

    // 1. Selection Screen
    if (!selectedCharId) {
        return (
            <Card className="min-h-[400px]">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-stone-700">どのキャラに描かせますか？</h2>
                    <p className="text-stone-500 mt-2">他のAIの音声や会話を聞き取って、絵を描き起こします。</p>
                </div>

                {characters.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50">
                        <p className="text-stone-400 font-bold mb-4">キャラクターがいません</p>
                        <p className="text-sm text-stone-400">「描く」タブでキャラクターを作成してください。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {characters.map(char => (
                            <button
                                key={char.id}
                                onClick={() => setSelectedCharId(char.id)}
                                className="flex flex-col items-center p-6 rounded-2xl border-2 border-stone-100 hover:border-rose-200 hover:bg-rose-50 transition-all group bg-white"
                            >
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-stone-100 mb-4 shadow-sm group-hover:shadow-md transition-all border-2 border-white">
                                    {char.images.length > 0 ? (
                                        <img src={char.images[0].url} alt={char.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                                            <UserIcon />
                                        </div>
                                    )}
                                </div>
                                <span className="font-bold text-stone-700 group-hover:text-rose-500 text-lg">{char.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // 2. Call Screen
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
            <div className="space-y-6">
                <Card className="text-center py-8 flex flex-col items-center justify-center h-full min-h-[400px] relative overflow-hidden">
                    
                    {/* Character Avatar with Animation */}
                    <div className="relative mb-8 z-10">
                        <div className={`w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-4 border-white overflow-hidden bg-stone-100 ${isSpeaking && !isSilentMode ? 'scale-105 ring-4 ring-rose-200' : ''}`}>
                            {selectedCharacter && selectedCharacter.images.length > 0 ? (
                                <img src={selectedCharacter.images[0].url} alt={selectedCharacter.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-stone-300"><UserIcon /></div>
                            )}
                        </div>
                        {isSpeaking && !isSilentMode && (
                            <div className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-40"></div>
                        )}
                        {isConnected && !isSpeaking && (
                            <div className="absolute inset-0 rounded-full border-2 border-stone-300 animate-pulse opacity-20"></div>
                        )}
                        {/* Status Icon for Silent Mode */}
                        {isSilentMode && isConnected && (
                            <div className="absolute -bottom-2 -right-2 bg-rose-500 text-white p-2 rounded-full shadow-lg animate-bounce">
                                <EarIcon />
                            </div>
                        )}
                    </div>
                    
                    <h2 className="text-2xl font-bold text-stone-700 mb-1 z-10">{selectedCharacter?.name}</h2>
                    <p className={`text-sm font-bold mb-8 z-10 min-h-[1.5em] transition-colors ${isConnected ? 'text-rose-500' : 'text-stone-400'}`}>
                        {statusMessage || (isConnected ? "接続中" : "待機中")}
                    </p>

                    <div className="z-10 flex flex-col items-center space-y-6 w-full max-w-xs">
                        {!isConnected ? (
                            <>
                                {/* Mode Toggle */}
                                <div className="flex items-center justify-center space-x-4 bg-stone-50 p-2 rounded-xl w-full">
                                    <button 
                                        disabled={isConnecting} onClick={() => setIsSilentMode(true)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${isSilentMode ? 'bg-white shadow-sm text-rose-500' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        <VolumeOffIcon />
                                        <span>聞き取りのみ</span>
                                    </button>
                                    <button 
                                        disabled={isConnecting} onClick={() => setIsSilentMode(false)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${!isSilentMode ? 'bg-white shadow-sm text-rose-500' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        <VolumeUpIcon />
                                        <span>会話する</span>
                                    </button>
                                </div>

                                <div className="flex items-center space-x-4 w-full justify-center">
                                    <button onClick={() => { handleDisconnect(); setSelectedCharId(null); }} className="text-stone-400 hover:text-stone-600 font-bold px-4 py-2">
                                        戻る
                                    </button>
                                    <Button disabled={isConnecting} onClick={handleConnect} className="shadow-xl shadow-rose-100 text-lg px-8 py-4 rounded-full flex-1" icon={isSilentMode ? <EarIcon /> : <PhoneIcon />}>
                                        {isConnecting ? "接続中..." : isSilentMode ? "聞き取り開始" : "通話する"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <Button onClick={() => handleDisconnect()} variant="secondary" className="px-8 py-3 rounded-full bg-red-50 text-red-500 border-red-100 hover:bg-red-100 w-full">
                                切断する
                            </Button>
                        )}
                    </div>

                    <p className="text-xs text-stone-400 mt-5 z-10">1回最大45秒。継続には再接続が必要です。</p>
                    {/* Background decorations */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                        <div className="absolute top-10 left-10 w-20 h-20 bg-rose-200 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
                        <div className="absolute top-10 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
                        <div className="absolute bottom-10 left-20 w-20 h-20 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col">
                <Card className="flex-1 flex flex-col min-h-[400px] items-center justify-center bg-stone-50 border-4 border-white shadow-inner rounded-[2rem] overflow-hidden relative group">
                    {isGenerating ? (
                        <div className="text-center p-6">
                             <Spinner size="lg" className="text-rose-400 mx-auto mb-4" />
                             <p className="font-bold text-stone-500 animate-pulse">{selectedCharacter?.name}が描いています...</p>
                        </div>
                    ) : generatedImage ? (
                        <>
                            <img src={generatedImage} alt="Generated from conversation" className="w-full h-full object-contain shadow-sm" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <a href={generatedImage} download={`live-capture-${Date.now()}.png`} className="bg-white text-rose-500 px-6 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    保存する
                                </a>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-stone-300 p-8">
                             <div className="mb-4 mx-auto w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-3xl">🖼️</div>
                             <p className="font-bold text-lg mb-2">自動スケッチ</p>
                             <p className="text-sm opacity-70">
                                {isSilentMode 
                                    ? "外部の音声や会話を聞き取って、\n自動的に絵を描き起こします。" 
                                    : "会話の中で「写真撮ろう」「絵を描いて」と\n話しかけると、ここに絵が表示されます。"}
                             </p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default AgentInterface;

