/**
 * Web-specific audio utilities for the mobile app when running in web mode
 */

// Declare global window interface to add our custom properties
declare global {
  interface Window {
    lastRecordedAudioBlob?: Blob;
  }
}

/**
 * Stores the audio blob in the window object for later use
 * This is used for retry and Gemini processing in web mode
 */
export const storeAudioBlob = async (audioUri: string): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  try {
    // For web, audioUri is a blob URL, so we need to fetch the blob first
    const response = await fetch(audioUri);
    const blob = await response.blob();
    
    // Store the blob in the window object
    window.lastRecordedAudioBlob = blob;
    console.log('Audio blob stored in window object for web platform');
  } catch (error) {
    console.error('Failed to store audio blob:', error);
  }
};

/**
 * Gets the stored audio blob from the window object
 */
export const getStoredAudioBlob = (): Blob | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.lastRecordedAudioBlob;
};

/**
 * Clears the stored audio blob from the window object
 */
export const clearStoredAudioBlob = (): void => {
  if (typeof window === 'undefined') return;
  window.lastRecordedAudioBlob = undefined;
  console.log('Cleared stored audio blob from window object');
};
