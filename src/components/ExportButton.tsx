import { useState } from 'react';
import { Download } from 'lucide-react';

import { useStorage } from '@/hooks/useStorage';
import { Button } from '@/components/ui/button';
import { ExportSessionsModal } from '@/components/ExportSessionsModal'; // Импортируем модальное окно

const ExportButton = () => {
  const { sessions } = useStorage();
  const [isModalOpen, setIsModalOpen] = useState(false); // Состояние для управления видимостью модального окна

  const handleOpenModal = () => {
    if (sessions.length === 0) {
      alert("Нет данных для экспорта.");
      return;
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Button onClick={handleOpenModal} disabled={sessions.length === 0}>
        <Download className="mr-2 h-4 w-4" />
        Экспорт в XLSX
      </Button>
      <ExportSessionsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        sessions={sessions} // Передаем сессии в модальное окно
      />
    </>
  );
};

export default ExportButton;
