// Keep full-resolution originals in the UI. Only prepare the copy sent to AI,
// with explicit approval whenever dimensions or format need to change.
export async function prepareAiImage(base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  const supported = ['image/png', 'image/jpeg', 'image/webp'];
  if (supported.includes(mimeType) && base64.length <= 1_000_000) return { base64, mimeType };
  const source = new Image();
  source.src = `data:${mimeType};base64,${base64}`;
  try { await source.decode(); } catch { throw new Error('画像を読み取れませんでした。PNG・JPEG・WebPを選んでください。'); }
  const originalWidth = source.naturalWidth, originalHeight = source.naturalHeight;
  let ratio = Math.min(1, 1536 / Math.max(originalWidth, originalHeight));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('画像を準備できませんでした。');
  let data = '';
  do {
    canvas.width = Math.max(1, Math.floor(originalWidth * ratio));
    canvas.height = Math.max(1, Math.floor(originalHeight * ratio));
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    data = canvas.toDataURL('image/png').split(',')[1];
    ratio *= 0.8;
  } while (data.length > 1_000_000 && Math.max(canvas.width, canvas.height) > 128);
  if (data.length > 1_000_000) throw new Error('画像が大きすぎます。小さな画像を選んでください。');
  if (!window.confirm(`AIに送る画像を ${originalWidth}×${originalHeight} から ${canvas.width}×${canvas.height} のPNGコピーに変換します。元画像とダウンロード画質は変わりません。続けますか？`)) {
    throw new Error('画像の送信をキャンセルしました。');
  }
  return { base64: data, mimeType: 'image/png' };
}
