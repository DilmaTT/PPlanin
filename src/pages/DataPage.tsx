import { useRef, ChangeEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/hooks/use-toast';
import type { Settings, Session } from '@/types';
import { read, utils } from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportSessionsModal } from '@/components/ExportSessionsModal';

const DataPage = () => {
  const { sessions, settings, updateSettings, importSessions, resetAllData } = useStorage();
  const { toast } = useToast();
  const settingsFileInputRef = useRef<HTMLInputElement>(null);
  const sessionsFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleSettingsExport = () => {
    try {
      const settingsJson = JSON.stringify(settings, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'poker-tracker-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: 'Экспорт успешен',
        description: 'Ваши настройки были сохранены в файл.',
      });
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось экспортировать настройки.',
        variant: 'destructive',
      });
    }
  };

  const handleSettingsImportClick = () => {
    settingsFileInputRef.current?.click();
  };

  const handleSettingsFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      toast({
        title: 'Неверный тип файла',
        description: 'Пожалуйста, выберите файл в формате .json.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Failed to read file content.');
        }
        const importedSettings = JSON.parse(text) as Settings;
        
        updateSettings(importedSettings);
        
        toast({
          title: 'Импорт успешен',
          description: 'Ваши настройки были успешно загружены.',
        });
      } catch (error) {
        console.error('Failed to import settings:', error);
        toast({
          title: 'Ошибка импорта',
          description: 'Не удалось прочитать или применить настройки из файла.',
          variant: 'destructive',
        });
      } finally {
        if (settingsFileInputRef.current) {
          settingsFileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
       toast({
        title: 'Ошибка чтения файла',
        description: 'Произошла ошибка при чтении файла.',
        variant: 'destructive',
      });
    };
    reader.readAsText(file);
  };

  const handleSessionImportClick = () => {
    sessionsFileInputRef.current?.click();
  };

  const handleSessionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = utils.sheet_to_json(worksheet) as any[];

        const allImportedSessions: Session[] = [];

        json.forEach(row => {
          // Check for the 'rawData' key which contains the JSON string of sessions for that day
          const rawDataString = row['rawData']; 
          
          if (typeof rawDataString === 'string' && rawDataString !== 'IS_OFF_DAY') {
            try {
              const daySessions: Session[] = JSON.parse(rawDataString);
              allImportedSessions.push(...daySessions);
            } catch (parseError) {
              console.warn('Failed to parse rawData for a row, skipping:', row, parseError);
              // Optionally, you could toast a warning here for individual row failures
            }
          }
        });

        importSessions(allImportedSessions);
        toast({
          title: 'Импорт сессий успешен',
          description: `Успешно загружено ${allImportedSessions.length} сессий.`,
        });

      } catch (error) {
        console.error('Failed to import sessions:', error);
        toast({
          title: 'Ошибка импорта сессий',
          description: 'Не удалось прочитать файл или его содержимое. Убедитесь, что он имеет правильный формат и содержит данные.',
          variant: 'destructive',
        });
      } finally {
        if (sessionsFileInputRef.current) {
          sessionsFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleResetData = () => {
    if (window.confirm('Вы уверены, что хотите удалить все сессии и планы? Это действие необратимо.')) {
      resetAllData();
      toast({
        title: 'Данные сброшены',
        description: 'Все сессии, планы и настройки были удалены.',
      });
    }
  };

  return (
    <>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Управление данными</h1>
        <div className="space-y-8 max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Экспорт и Импорт Настроек</CardTitle>
              <CardDescription>
                Сохраните ваши текущие настройки в файл или загрузите их из ранее сохраненного файла.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={handleSettingsExport}>Экспорт настроек</Button>
                <Button variant="outline" onClick={handleSettingsImportClick}>Импорт настроек</Button>
                <input
                  type="file"
                  ref={settingsFileInputRef}
                  onChange={handleSettingsFileChange}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Экспорт данных</CardTitle>
              <CardDescription>
                Сохраните все ваши игровые сессии в XLSX файл для анализа или загрузите их из файла.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={() => setIsExportModalOpen(true)}>Экспорт данных (XLSX)</Button>
                <Button variant="outline" onClick={handleSessionImportClick}>Импорт сессий (XLSX)</Button>
                <input
                  type="file"
                  ref={sessionsFileInputRef}
                  onChange={handleSessionFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Опасная зона</CardTitle>
              <CardDescription>
                Это действие полностью удалит все ваши сессии, планы и сбросит все настройки к значениям по умолчанию.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleResetData}>
                Сбросить все данные
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <ExportSessionsModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        sessions={sessions}
      />
    </>
  );
};

export default DataPage;
