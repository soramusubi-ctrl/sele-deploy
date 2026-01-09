
export const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // result is in format "data:[mimeType];base64,[data]"
      const [header, data] = result.split(',');
      if (!header || !data) {
        return reject(new Error("Invalid file format"));
      }
      const mimeType = header.split(';')[0].split(':')[1];
       if (!mimeType) {
        return reject(new Error("Could not determine mime type"));
      }
      resolve({ base64: data, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};
