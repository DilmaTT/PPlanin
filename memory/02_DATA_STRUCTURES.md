# Структуры данных

## Объект Session:
Основная единица данных — это объект сессии, который хранится в массиве в localStorage.

```json
{
  "id": "string", // Уникальный ID, напр. timestamp
  "overallStartTime": "string", // ISO-8601
  "overallEndTime": "string", // ISO-8601
  "notes": "string", // Заметки
  "handsPlayed": "number", // Количество сыгранных рук
  "periods": [ // Массив периодов внутри сессии
    { "type": "select" | "play", "startTime": "string", "endTime": "string" }
  ],
  // Расчетные поля (не хранятся, вычисляются на лету):
  "totalDuration": "number", // в мс
  "selectDuration": "number", // в мс
  "playDuration": "number" // в мс
}
```
