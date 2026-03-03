
import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GuideInfo {
    characterName: string;
    title: string;
    description: string;
    stats: { label: string; value: number; max: number }[];
    items: { name: string; description: string; rarity: string }[];
}

const handleGeminiError = (error: any): never => {
    console.error("Gemini API Error Detail:", error);
    let msg = error.message || error.toString();
    
    if (msg.includes('Internal Server Error') || msg.includes('500')) {
        throw new Error("AIサーバーが一時的に混み合っています。少し時間をおくか、もう一度試してください。");
    }

    msg = msg.toLowerCase();
    if (msg.includes("403")) throw new Error("APIキーが無効、または権限がありません。");
    if (msg.includes("429")) throw new Error("利用制限を超えました。少し待ってから再度お試しください。");
    if (msg.includes("safety")) throw new Error("安全基準により生成がブロックされました。");
    
    throw new Error(`エラーが発生しました: ${msg}`);
};

const withRetry = async <T>(operation: () => Promise<T>, retries = 3, delay = 2500): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        const isTransient = error.message.includes('500') || error.message.includes('Internal') || error.message.includes('fetch');
        if (retries > 0 && isTransient) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return withRetry(operation, retries - 1, delay * 1.5);
        }
        throw error;
    }
};

const validateResponse = (response: any) => {
    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("AIからの応答が空でした。");
    if (candidate.finishReason === 'SAFETY') throw new Error("safety");
};

/**
 * 生成された攻略本風画像を解析し、情報を抽出する
 */
export const analyzeGuideImage = async (imageBase64: string): Promise<GuideInfo> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    parts: [
                        { inlineData: { data: imageBase64, mimeType: 'image/png' } },
                        { text: 'このゲーム攻略本風の画像から、キャラクター名、紹介文、ステータス、描かれているアイテムを抽出し、JSONで返してください。' }
                    ]
                }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characterName: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        stats: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    value: { type: Type.NUMBER },
                                    max: { type: Type.NUMBER }
                                },
                                required: ['label', 'value', 'max']
                            }
                        },
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    rarity: { type: Type.STRING }
                                },
                                required: ['name', 'description']
                            }
                        }
                    },
                    required: ['characterName', 'stats', 'items']
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Guide analysis failed", error);
        throw error;
    }
};

export const summarizeConversation = async (conversation: string, angle: string = 'auto'): Promise<string> => {
    const ai = getAiClient();
    
    const angleInstructions: Record<string, string> = {
        'auto': 'その会話に最もふさわしいドラマチックな構図を自分で決めてください。',
        'close-up': 'キャラクターの表情や瞳の輝きを強調する、顔中心のクローズアップ構図にしてください。背景はボケています。',
        'medium': '上半身と周囲のアイテムがバランスよく入るミディアムショットにしてください。',
        'long': '全身と広大な背景、空や風景が贅沢に入るロングショット・フルショットにしてください。',
        'low-angle': '地面に近い位置から見上げるような、迫力とスケール感のあるローアングルにしてください。',
        'high-angle': '空から見下ろすような、キャラクターが小さく愛らしく見えるハイアングル、俯瞰構図にしてください。',
        'diagonal-right-top': '右斜め上の高い位置から見下ろすように、シーンを立体的かつダイナミックに捉えた構図にしてください。'
    };

    try {
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `あなたは熟練の画家兼映画監督です。以下の会話から、絵画にするための情景描写（100文字程度の日本語）を生成してください。
                
                # 指定された構図
                ${angleInstructions[angle] || angleInstructions['auto']}

                # 会話内容: 
                ${conversation}`,
            });
            validateResponse(response);
            return response.text?.trim() || '';
        });
    } catch (error) {
        return handleGeminiError(error);
    }
};

export const generateImage = async (
    prompt: string, 
    characterContext: any[] = [],
    aspectRatio: '1:1' | '16:9' | '9:16' = '1:1',
    useProModel: boolean = false,
    resolution: '1K' | '2K' | '4K' = '1K',
    _angle: string = 'normal'
): Promise<string> => {
    const ai = getAiClient();
    try {
        return await withRetry(async (): Promise<string> => {
            const model = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image';
            let fullPrompt = prompt;
            const parts: any[] = [];

            if (characterContext && characterContext.length > 0) {
                characterContext.forEach(char => {
                    if (char.images && char.images.length > 0) {
                        parts.push({
                            inlineData: {
                                data: char.images[0].base64,
                                mimeType: char.images[0].mimeType || 'image/png'
                            }
                        });
                        fullPrompt += `\nリファレンス画像に写っている人物「${char.name}」の特徴を正確に反映してください。`;
                    }
                });
            }
            
            parts.push({ text: fullPrompt });

            const response = await ai.models.generateContent({
                model,
                contents: [{ parts }],
                config: { 
                    imageConfig: { 
                        aspectRatio, 
                        imageSize: useProModel ? resolution : undefined 
                    } 
                }
            });
            
            validateResponse(response);
            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData && part.inlineData.data) return part.inlineData.data;
            throw new Error("画像データが生成されませんでした。");
        });
    } catch (error) {
        return handleGeminiError(error);
    }
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string, useProModel: boolean = false): Promise<string> => {
    const ai = getAiClient();
    try {
        return await withRetry(async (): Promise<string> => {
            const model = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image';
            const response = await ai.models.generateContent({
                model,
                contents: { parts: [{ inlineData: { data: imageBase64, mimeType } }, { text: prompt }] },
            });
            validateResponse(response);
            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData && part.inlineData.data) return part.inlineData.data;
            throw new Error("編集結果がありません。");
        });
    } catch (error) {
        return handleGeminiError(error);
    }
};

export const generateVideo = async (prompt: string, imageBase64: string, mimeType: string, aspectRatio: '16:9' | '9:16', onProgress: (message: string) => void): Promise<string> => {
    const ai = getAiClient();
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: { imageBytes: imageBase64, mimeType },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
        });
        while (!operation.done) {
            onProgress("アニメーションを生成中...");
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        const res = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        return handleGeminiError(error);
    }
};
