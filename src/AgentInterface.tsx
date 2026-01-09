
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
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
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSilentMode, setIsSilentMode] = useState<boolean>(true); // Default to Silent for "No conversation needed"
    
    // Refs for Audio Contexts and Stream
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionPromiseRef = useRef<Promise<any> | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            handleDisconnect();
        };
    }, []);

    const selectedCharacter = characters.find(c => c.id === selectedCharId);

    const handleConnect = async () => {
        if (!selectedCharacter) return;

        try {
            setStatusMessage(isSilentMode ? "聞き耳を立てています..." : "呼び出し中...");
            
            // Audio Context Setup
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            // Microphone Access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } });
            mediaStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            // Tool Definition
            const drawImageTool: FunctionDeclaration = {
                name: 'draw_image',
                description: '現在の会話の情景や、聞こえてくる話を絵にして生成するツール。視覚的な説明を聞いたらすぐに実行すること。',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: {
                            type: Type.STRING,
                            description: '描画する絵の詳細な説明。',
                        },
                        style: {
                             type: Type.STRING,
                             description: '画風（例: アニメ, 水彩画, 写真）。指定がなければ「アニメ」としてください。',
                        }
                    },
                    required: ['prompt'],
                },
            };

            const otherCharacters = characters.filter(c => c.isActive && c.id !== selectedCharacter.id).map(c => c.name).join('や');
            
            // Instruction based on Mode
            let systemInstruction = "";
            
            if (isSilentMode) {
                // "No conversation needed" Mode
                systemInstruction = `あなたは「${selectedCharacter.name}」という名前のAIイラストレーターです。
現在、他のAIエージェントやユーザーの会話、あるいは物語を聞いています。
あなたの役割は「聞き役」に徹し、聞こえてきた情景や物語のワンシーンを、リアルタイムで絵にすることです。

【重要：沈黙のルール】
- **絶対に喋らないでください。** 音声応答は不要です。
- あなたの出力は \`draw_image\` ツールの呼び出しのみであるべきです。

【行動指針】
- 入力音声を注意深く聞いてください。
- 「〜な場所で」「〜が見える」といった視覚的な描写や、印象的なシーンの話が出たら、即座に \`draw_image\` ツールを使用してください。
- 躊躇せず、どんどん描いてください。`;

            } else {
                // Interactive Mode
                systemInstruction = `あなたは「${selectedCharacter.name}」という名前のAIキャラクターです。
ユーザーと音声通話をしています。自然な口調で話してください。
会話の中で「絵を描いて」と頼まれたり、素敵な情景の話になったら、\`draw_image\` ツールを使ってその場を描き出してください。
自分のことは「私」や「僕」と呼び、${otherCharacters ? `仲間の${otherCharacters}のことも` : ''}必要に応じて話題にしてください。`;
            }

            // Connect to Live API
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log("Live Session Connected");
                        setIsConnected(true);
                        setStatusMessage(isSilentMode ? "聞き取り中..." : "通話中");
                        
                        // Setup Input Stream Processing
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                        
                        const inputCtx = inputAudioContextRef.current;
                        const source = inputCtx.createMediaStreamSource(mediaStreamRef.current);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            
                            sessionPromise.then(session => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                        
                        audioSourceRef.current = source;
                        scriptProcessorRef.current = processor;
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle Audio Output - Only play if NOT in silent mode
                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && !isSilentMode) {
                            playAudio(audioData);
                        }
                        
                        // Handle Function Calls
                        if (message.toolCall && message.toolCall.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'draw_image') {
                                    setIsGenerating(true);
                                    setStatusMessage(`🎨 ${selectedCharacter.name}が筆を執りました...`);
                                    
                                    try {
                                        const prompt = (fc.args?.prompt as string) || '';
                                        const style = (fc.args?.style as string) || 'anime';
                                        
                                        // Pass active characters for visual consistency
                                        const activeChars = characters
                                            .filter(c => c.isActive)
                                            .map(c => ({ name: c.name, images: c.images }));
                                            
                                        const finalPrompt = `${prompt}\nStyle: ${style}`;
                                        
                                        const base64Image = await generateImage(
                                            finalPrompt,
                                            activeChars
                                        );
                                        
                                        setGeneratedImage(`data:image/png;base64,${base64Image}`);
                                        setStatusMessage(`${selectedCharacter.name}が描き上げました`);
                                        
                                        // Send response back to model
                                        sessionPromise.then(session => {
                                            session.sendToolResponse({
                                                functionResponses: {
                                                    id: fc.id,
                                                    name: fc.name,
                                                    response: { result: "Image generated successfully and displayed." }
                                                }
                                            });
                                        });
                                        
                                    } catch (err) {
                                        console.error(err);
                                        setStatusMessage("描画に失敗しました");
                                        
                                        sessionPromise.then(session => {
                                            session.sendToolResponse({
                                                functionResponses: {
                                                    id: fc.id,
                                                    name: fc.name,
                                                    response: { error: "Failed to generate image." }
                                                }
                                            });
                                        });
                                    } finally {
                                        setIsGenerating(false);
                                    }
                                }
                            }
                        }

                        // Handle Interruption
                        if (message.serverContent?.interrupted) {
                            stopAllAudio();
                        }
                    },
                    onclose: () => {
                        console.log("Live Session Closed");
                        handleDisconnect();
                    },
                    onerror: (err) => {
                        console.error("Live Session Error", err);
                        setStatusMessage("エラーが発生しました。");
                        handleDisconnect();
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    tools: [{ functionDeclarations: [drawImageTool] }],
                    systemInstruction: systemInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
                    }
                }
            });
            
            sessionPromiseRef.current = sessionPromise;

        } catch (error) {
            console.error("Connection failed", error);
            setStatusMessage("接続に失敗しました。");
            handleDisconnect();
        }
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        setIsSpeaking(false);
        setStatusMessage("");
        
        // Stop Microphone
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        // Stop Audio Processing
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioSourceRef.current) {
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
        
        // Close Contexts
        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        
        nextStartTimeRef.current = 0;
    };

    const playAudio = async (base64Data: string) => {
        if (!outputAudioContextRef.current) return;
        const ctx = outputAudioContextRef.current;
        
        try {
            const audioBuffer = await decodeAudioData(decode(base64Data), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            
            source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                    setIsSpeaking(false);
                }
            };
            
            const currentTime = ctx.currentTime;
            if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
            }
            
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
            setIsSpeaking(true);
            
        } catch (e) {
            console.error("Audio playback error", e);
        }
    };

    const stopAllAudio = () => {
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsSpeaking(false);
    };

    // --- Helpers ---
    
    function createBlob(data: Float32Array): { data: string; mimeType: string } {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767;
        }
        const uint8 = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return {
            data: btoa(binary),
            mimeType: 'audio/pcm;rate=16000',
        };
    }

    function decode(base64: string) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
            }
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
                                        onClick={() => setIsSilentMode(true)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${isSilentMode ? 'bg-white shadow-sm text-rose-500' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        <VolumeOffIcon />
                                        <span>聞き取りのみ</span>
                                    </button>
                                    <button 
                                        onClick={() => setIsSilentMode(false)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${!isSilentMode ? 'bg-white shadow-sm text-rose-500' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        <VolumeUpIcon />
                                        <span>会話する</span>
                                    </button>
                                </div>

                                <div className="flex items-center space-x-4 w-full justify-center">
                                    <button onClick={() => setSelectedCharId(null)} className="text-stone-400 hover:text-stone-600 font-bold px-4 py-2">
                                        戻る
                                    </button>
                                    <Button onClick={handleConnect} className="shadow-xl shadow-rose-100 text-lg px-8 py-4 rounded-full flex-1" icon={isSilentMode ? <EarIcon /> : <PhoneIcon />}>
                                        {isSilentMode ? "聞き取り開始" : "通話する"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <Button onClick={handleDisconnect} variant="secondary" className="px-8 py-3 rounded-full bg-red-50 text-red-500 border-red-100 hover:bg-red-100 w-full">
                                切断する
                            </Button>
                        )}
                    </div>

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
