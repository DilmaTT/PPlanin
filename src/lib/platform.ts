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
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      let detailedMessage = 'Не удалось вызвать диалог сохранения файла.\n\n';

      if (errorMessage.toLowerCase().includes('permission denied') || errorMessage.toLowerCase().includes('not allowed')) {
        detailedMessage += 'Вероятная причина: API для диалогов или файловой системы не разрешены в конфигурации Tauri.\n\n' +
                           'Пожалуйста, проверьте ваш файл `src-tauri/tauri.conf.json` и убедитесь, что в секции `tauri.allowlist` прописаны точные разрешения. Пример правильной конфигурации:\n\n' +
                           '"allowlist": {\n' +
                           '  "dialog": {\n' +
                           '    "save": true\n' +
                           '  },\n' +
                           '  "fs": {\n' +
                           '    "writeBinaryFile": true\n' +
                           '  }\n' +
                           '}';
      } else {
        detailedMessage += 'Произошла непредвиденная ошибка. Возможные причины:\n' +
                           '- Не установлены пакеты `@tauri-apps/api`.\n' +
                           '- Несоответствие версий между `@tauri-apps/api`, `tauri-cli` и зависимостями Rust.\n' +
                           '- Проблема с конфигурацией сборщика (Vite).\n';
      }

      detailedMessage += `\n\nПодробности системной ошибки: ${errorMessage}`;

      alert(detailedMessage);
      throw error;
    }
  } else {
    // Используем file-saver для веб-браузеров
    saveAs(data, fileName);
  }
};
