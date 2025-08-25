import { useRef, ChangeEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/hooks/use-toast';
import type { Settings, Session } from '@/types';
import { read, utils } from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportSessionsModal } from '@/components/ExportSessionsModal';
import { saveFile } from '@/lib/platform';

const DataPage = () => {
  const { sessions, settings, updateSettings, importSessions, resetAllData } = useStorage();
  const { toast } = useToast();
  const settingsFileInputRef = useRef<HTMLInputElement>(null);
  const sessionsFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportModal, setIsExportModal] = useState(false);

  const handleSettingsExport = async () => {
    try {
      const settingsJson = JSON.stringify(settings, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      await saveFile('poker-tracker-settings.json', blob);
      toast({
        title: 'Экспорт успешен',
        description: 'Ваши настройки были сохранены в файл.',
      });
    } catch (error) {
      console.error('Failed to export settings:', error);
      // The alert is now handled inside saveFile
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
        const jsonData = utils.sheet_to_json(worksheet) as any[];

        console.log('Данные из XLSX для импорта:', jsonData);

        const allSessionsToImport = jsonData.reduce((acc: Session[], row: any, index: number) => {
          const rawDataKey = 'Raw Data'; // The header used during export
          const rawData = row[rawDataKey];

          if (typeof rawData === 'string' && rawData.startsWith('[')) {
            try {
              const sessionsFromRow = JSON.parse(rawData);
              if (Array.isArray(sessionsFromRow)) {
                acc.push(...sessionsFromRow);
              } else {
                console.warn(`Строка ${index + 2}: данные в '${rawDataKey}' не являются массивом, пропущено.`, sessionsFromRow);
              }
            } catch (error) {
              console.error(`Строка ${index + 2}: ошибка парсинга JSON из '${rawDataKey}'.`, { error, rawData });
            }
          } else if (rawData && rawData !== 'IS_OFF_DAY') {
            console.log(`Строка ${index + 2}: пропущена из-за неверного формата данных в '${rawDataKey}'.`, rawData);
          }

          return acc;
        }, []);

        console.log('Финальный массив сессий для импорта:', allSessionsToImport);
        
        if (allSessionsToImport.length > 0) {
          importSessions(allSessionsToImport);
          toast({
            title: 'Импорт сессий успешен',
            description: `Успешно загружено ${allSessionsToImport.length} сессий.`,
          });
        } else {
          toast({
            title: 'Импорт не выполнен',
            description: 'В файле не найдено сессий для импорта. Проверьте формат файла.',
            variant: 'destructive',
          });
        }

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
                <Button onClick={() => setIsExportModal(true)}>Экспорт данных (XLSX)</Button>
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
        isOpen={isExportModal}
        onClose={() => setIsExportModal(false)}
        sessions={sessions}
      />
    </>
  );
};

export default DataPage;
