import { saveAs } from 'file-saver';

// Функция для проверки, запущено ли приложение в среде Tauri
export const isTauri = (): boolean => '__TAURI__' in window;

/**
 * Абстракция для сохранения файлов, которая работает как в вебе, так и в Tauri.
 * @param fileName - Имя файла по умолчанию.
 * @param data - Данные для сохранения в виде Blob.
 */
export const saveFile = async (fileName: string, data: Blob): Promise<void> => {
  if (isTauri()) {
    try {
      // Динамически импортируем API Tauri только при необходимости
      const { save } = await import('@tauri-apps/api/dialog');
      const { writeBinaryFile } = await import('@tauri-apps/api/fs');

      // Используем нативный диалог сохранения Tauri
      const filePath = await save({
        defaultPath: fileName,
      });

      if (filePath) {
        // Конвертируем Blob в Uint8Array и записываем файл
        const buffer = await data.arrayBuffer();
        await writeBinaryFile(filePath, new Uint8Array(buffer));
      }
    } catch (error) {
      console.error("Ошибка сохранения файла в Tauri:", error);
      // Здесь можно добавить уведомление для пользователя
    }
  } else {
    // Используем file-saver для веб-браузеров
    saveAs(data, fileName);
  }
};
