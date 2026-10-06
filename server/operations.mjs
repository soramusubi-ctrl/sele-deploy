import { HttpError } from './security.mjs';
const bad = () => { throw new HttpError(400, '入力の形式・長さ・画像サイズを確認してください。'); };
const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : bad();
const choice = (value, choices) => choices.includes(value) ? value : bad();
function image(data, mimeType) {
  if (typeof data !== 'string' || data.length > 1_400_000 || data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) bad();
  choice(mimeType, ['image/png', 'image/jpeg', 'image/webp']);
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > 1_048_576 || bytes.toString('base64') !== data) bad();
  // Reject mislabeled arbitrary payloads. Provider decodes the bounded image itself.
  const valid = mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) bad();
  return { inlineData: { data, mimeType } };
}
const angles = {
  auto: 'その会話に最もふさわしいドラマチックな構図を自分で決めてください。',
  'close-up': '顔中心のクローズアップ構図にしてください。',
  medium: '上半身と周囲のアイテムが入るミディアムショットにしてください。',
  long: '全身と広大な背景が入るロングショットにしてください。',
  'low-angle': '見上げるローアングルにしてください。',
  'high-angle': '見下ろす俯瞰構図にしてください。',
  'diagonal-right-top': '右斜め上から見下ろす構図にしてください。',
};
const guideSchema = { type: 'OBJECT', properties: {
  characterName: { type: 'STRING' }, title: { type: 'STRING' }, description: { type: 'STRING' },
  stats: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, value: { type: 'NUMBER' }, max: { type: 'NUMBER' } }, required: ['label', 'value', 'max'] } },
  items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, description: { type: 'STRING' }, rarity: { type: 'STRING' } }, required: ['name', 'description', 'rarity'] } },
}, required: ['characterName', 'title', 'description', 'stats', 'items'] };
export function operation(body) {
  let parts, model = 'gemini-3-flash-preview', cost = 1;
  const generationConfig = { candidateCount: 1, maxOutputTokens: 2048 };
  switch (body.operation) {
    case 'summarize': {
      const angle = choice(body.angle ?? 'auto', Object.keys(angles));
      parts = [{ text: `以下の会話から絵画の情景描写（100文字程度の日本語）を生成してください。${angles[angle]}\n会話: ${text(body.conversation, 12000)}` }];
      break;
    }
    case 'analyze':
      parts = [image(body.imageBase64, body.mimeType || 'image/png'), { text: 'このゲーム攻略本風の画像からキャラクター名、紹介文、ステータス、アイテムを抽出しJSONで返してください。' }];
      Object.assign(generationConfig, { responseMimeType: 'application/json', responseSchema: guideSchema });
      break;
    case 'generate':
    case 'edit': {
      if (typeof body.useProModel !== 'boolean') bad();
      const pro = body.useProModel;
      model = pro ? 'gemini-3-pro-image' : 'gemini-3.1-flash-image';
      const resolution = choice(body.resolution ?? '1K', ['1K', '2K', '4K']);
      cost = pro ? { '1K': 40, '2K': 80, '4K': 160 }[resolution] : 10;
      generationConfig.maxOutputTokens = 8192;
      generationConfig.responseModalities = ['TEXT', 'IMAGE'];
      generationConfig.imageConfig = { aspectRatio: choice(body.aspectRatio ?? '1:1', ['1:1', '16:9', '9:16']) };
      generationConfig.imageConfig.imageSize = pro ? resolution : '1K';
      parts = [];
      let prompt = text(body.prompt, 6000);
      if (body.operation === 'edit') parts.push(image(body.imageBase64, body.mimeType));
      else {
        const characters = body.characterContext ?? [];
        if (!Array.isArray(characters) || characters.length > 3) bad();
        for (const character of characters) {
          if (!character || typeof character !== 'object' || !Array.isArray(character.images) || character.images.length > 1) bad();
          const name = text(character.name, 100);
          if (character.images.length) {
            const ref = character.images[0];
            parts.push(image(ref.base64, ref.mimeType || 'image/png'));
            prompt += `\nリファレンス画像の人物「${name}」の特徴を反映してください。`;
          }
        }
      }
      parts.push({ text: prompt });
      break;
    }
    default: bad();
  }
  return { kind: body.operation, model, cost, payload: { contents: [{ role: 'user', parts }], generationConfig } };
}
export function resultFor(op, result) {
  const candidate = result.candidates?.[0];
  if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'IMAGE_SAFETY') throw new HttpError(422, '画像や文章を生成できませんでした。入力を変えてお試しください。');
  const parts = candidate.content?.parts || [];
  if (op.kind === 'generate' || op.kind === 'edit') {
    const data = parts.find(part => part.inlineData)?.inlineData;
    if (!data?.data || typeof data.data !== 'string' || data.data.length > 24_000_000 || !['image/png','image/jpeg','image/webp'].includes(data.mimeType)) throw new HttpError(502, '生成された画像を取得できませんでした。');
    return data.data;
  }
  const answer = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
  if (!answer || answer.length > 20000) throw new HttpError(502, 'AIからの応答を取得できませんでした。');
  if (op.kind === 'summarize') return answer.trim();
  try {
    const guide = JSON.parse(answer);
    if (typeof guide.characterName !== 'string' || typeof guide.title !== 'string' || typeof guide.description !== 'string' || !Array.isArray(guide.stats) || guide.stats.length > 30 || !Array.isArray(guide.items) || guide.items.length > 30 ||
      guide.stats.some(s => !s || typeof s.label !== 'string' || s.label.length > 100 || !Number.isFinite(s.value) || !Number.isFinite(s.max)) ||
      guide.items.some(i => !i || typeof i.name !== 'string' || i.name.length > 200 || typeof i.description !== 'string' || i.description.length > 2000 || typeof i.rarity !== 'string')) throw Error();
    return guide;
  } catch { throw new HttpError(502, '画像の解析結果を読み取れませんでした。'); }
}
