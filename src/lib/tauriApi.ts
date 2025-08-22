// src/lib/tauriApi.ts
import { invoke } from '@tauri-apps/api';
import { save, open } from '@tauri-apps/api/dialog';
import { writeBinaryFile, readBinaryFile } from '@tauri-apps/api/fs';

/**
 * Gets the current system timestamp from the Rust backend.
 * @returns A promise that resolves to an ISO 8601 string.
 */
export const getCurrentTime = async (): Promise<string> => {
  try {
    return await invoke('get_current_timestamp');
  } catch (error) {
    console.error("Failed to get timestamp from Tauri backend, falling back to browser time.", error);
    // Fallback for when not running in Tauri or if the command fails
    return new Date().toISOString();
  }
};

/**
 * Opens a native "Save As..." dialog and saves the provided data to the selected file.
 * @param data The file content as a Uint8Array.
 * @param defaultName The default file name to suggest in the dialog.
 */
export const saveExportFile = async (data: Uint8Array, defaultName: string): Promise<void> => {
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{
      name: 'Excel Workbook',
      extensions: ['xlsx']
    }]
  });

  if (filePath) {
    await writeBinaryFile(filePath, data);
  }
};

/**
 * Opens a native "Open File" dialog and reads the content of the selected file.
 * @returns A promise that resolves to the file content as a Uint8Array, or null if no file was selected.
 */
export const readImportFile = async (): Promise<Uint8Array | null> => {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Excel Workbook',
      extensions: ['xlsx']
    }]
  });

  if (typeof selected === 'string') {
    return await readBinaryFile(selected);
  }
  return null;
};
