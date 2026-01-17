/**
 * 画像をリサイズおよび圧縮してWebP形式のBlobとして返します。
 * @param fileOrUrl 圧縮する画像ファイルまたはデータURL
 * @param maxSize 長辺の最大ピクセル数（デフォルト1024px）
 * @param quality 圧縮品質（0.0〜1.0、デフォルト0.8）
 * @returns 圧縮されたWebP形式のBlob
 */
export async function compressImage(fileOrUrl: File | string, maxSize: number = 1024, quality: number = 0.8): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;

      if (width > height && width > maxSize) {
        height = height * (maxSize / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = width * (maxSize / height);
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob"));
          }
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));

    if (typeof fileOrUrl === 'string') {
      img.src = fileOrUrl;
    } else {
      img.src = URL.createObjectURL(fileOrUrl);
    }
  });
}

/**
 * BlobをBase64文字列に変換します。
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // data:image/webp;base64, の部分を削除して純粋なBase64のみを返す
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
