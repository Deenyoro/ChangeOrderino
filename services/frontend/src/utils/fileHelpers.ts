/**
 * File conversion and handling utilities
 */

/**
 * Convert base64 data URL to File object
 * @param dataUrl - Base64 data URL (e.g., "data:image/png;base64,...")
 * @param filename - Desired filename
 * @returns File object
 */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  // Split the data URL
  const arr = dataUrl.split(',');

  // Extract mime type
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  // Decode base64
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};

/**
 * Convert base64 data URL to Blob
 * @param dataUrl - Base64 data URL
 * @returns Blob object
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
};

/**
 * Get file extension from mime type
 */
export const getExtensionFromMime = (mimeType: string): string => {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'application/pdf': 'pdf',
  };

  return map[mimeType] || 'bin';
};

/**
 * Convert storage_key to public URL
 * MinIO bucket is public, so we can access files via /storage/ proxy
 */
export const storageKeyToUrl = (storageKey: string): string => {
  return `/storage/${storageKey}`;
};
