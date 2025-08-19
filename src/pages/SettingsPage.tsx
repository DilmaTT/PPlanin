import { useStorage } from '@/hooks/useStorage';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const SettingsPage = () => {
  const { settings, updateSettings } = useStorage();

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Настройки вида 'Список'</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Формат даты</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-month">Показывать месяц</Label>
                    <Switch
                      id="show-month"
                      checked={settings.listViewOptions.showMonth}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showMonth: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-day-of-week">Показывать день недели</Label>
                    <Switch
                      id="show-day-of-week"
                      checked={settings.listViewOptions.showDayOfWeek}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showDayOfWeek: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-year">Показывать год</Label>
                    <Switch
                      id="show-year"
                      checked={settings.listViewOptions.showYear}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showYear: checked } })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Период отображения</h3>
                <RadioGroup
                  value={settings.listViewOptions.dateRangeMode}
                  onValueChange={(value) => updateSettings({ listViewOptions: { ...settings.listViewOptions, dateRangeMode: value as 'all' | 'month' | 'week' | 'custom' } })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="month" id="date-range-month" />
                    <Label htmlFor="date-range-month">За месяц</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="week" id="date-range-week" />
                    <Label htmlFor="date-range-week">За неделю</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="date-range-custom" />
                    <Label htmlFor="date-range-custom">Свой вариант</Label>
                  </div>
                </RadioGroup>
                {settings.listViewOptions.dateRangeMode === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div className="space-y-1.5">
                      <Label>От</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !settings.listViewOptions.customStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {settings.listViewOptions.customStartDate ? (
                              format(new Date(settings.listViewOptions.customStartDate), "PPP", { locale: ru })
                            ) : (
                              <span>Выберите дату</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={settings.listViewOptions.customStartDate ? new Date(settings.listViewOptions.customStartDate) : undefined}
                            onSelect={(date) =>
                              updateSettings({
                                listViewOptions: {
                                  ...settings.listViewOptions,
                                  customStartDate: date ? date.toISOString() : null,
                                },
                              })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label>До</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !settings.listViewOptions.customEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {settings.listViewOptions.customEndDate ? (
                              format(new Date(settings.listViewOptions.customEndDate), "PPP", { locale: ru })
                            ) : (
                              <span>Выберите дату</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={settings.listViewOptions.customEndDate ? new Date(settings.listViewOptions.customEndDate) : undefined}
                            onSelect={(date) =>
                              updateSettings({
                                listViewOptions: {
                                  ...settings.listViewOptions,
                                  customEndDate: date ? date.toISOString() : null,
                                },
                              })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Сортировка</h3>
                <RadioGroup
                  value={settings.listViewOptions.sortOrder}
                  onValueChange={(value) => updateSettings({ listViewOptions: { ...settings.listViewOptions, sortOrder: value as 'asc' | 'desc' } })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="asc" id="sort-asc" />
                    <Label htmlFor="sort-asc">С начала (старые сверху)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="desc" id="sort-desc" />
                    <Label htmlFor="sort-desc">С конца (новые сверху)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Столбцы таблицы</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-start-time">Время начала сессии</Label>
                    <Switch
                      id="show-start-time"
                      checked={settings.listViewOptions.showStartTime}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showStartTime: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-end-time">Время окончания сессии</Label>
                    <Switch
                      id="show-end-time"
                      checked={settings.listViewOptions.showEndTime}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showEndTime: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-session-count">Кол-во сессий за день</Label>
                    <Switch
                      id="show-session-count"
                      checked={settings.listViewOptions.showSessionCount}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showSessionCount: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-duration">Общая длительность</Label>
                    <Switch
                      id="show-duration"
                      checked={settings.listViewOptions.showDuration}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showDuration: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-hands-per-hour">Рук в час</Label>
                    <Switch
                      id="show-hands-per-hour"
                      checked={settings.listViewOptions.showHandsPerHour}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showHandsPerHour: checked } })}
                      disabled={!settings.showHandsPlayed}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-daily-plan">План на день (часы)</Label>
                    <Switch
                      id="show-daily-plan"
                      checked={settings.listViewOptions.showDailyPlan}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showDailyPlan: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-daily-plan-hands">План на день (руки)</Label>
                    <Switch
                      id="show-daily-plan-hands"
                      checked={settings.listViewOptions.showDailyPlanHands}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showDailyPlanHands: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-daily-plan-remaining">Осталось по плану на день</Label>
                    <Switch
                      id="show-daily-plan-remaining"
                      checked={settings.listViewOptions.showDailyPlanRemaining}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showDailyPlanRemaining: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-total-play-time">Общее игровое время за день</Label>
                    <Switch
                      id="show-total-play-time"
                      checked={settings.listViewOptions.showTotalPlayTime}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showTotalPlayTime: checked } })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-total-plan-remaining">Осталось по общему плану</Label>
                    <Switch
                      id="show-total-plan-remaining"
                      checked={settings.listViewOptions.showTotalPlanRemaining}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showTotalPlanRemaining: checked } })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Итоги</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-totals-row">Показывать общие данные за период</Label>
                    <Switch
                      id="show-totals-row"
                      checked={settings.listViewOptions.showTotalsRow}
                      onCheckedChange={(checked) => updateSettings({ listViewOptions: { ...settings.listViewOptions, showTotalsRow: checked } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Настройки сессии</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-splitting">Включить разделение</Label>
                <Switch
                  id="enable-splitting"
                  checked={settings.splitPeriods}
                  onCheckedChange={(checked) => updateSettings({ splitPeriods: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-notes">Показывать поле 'Заметки'</Label>
                <Switch
                  id="show-notes"
                  checked={settings.showNotes}
                  onCheckedChange={(checked) => updateSettings({ showNotes: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-hands">Показывать поле 'Количество рук'</Label>
                <Switch
                  id="show-hands"
                  checked={settings.showHandsPlayed}
                  onCheckedChange={(checked) => updateSettings({ showHandsPlayed: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-manual-editing">Разрешить ручное редактирование в дашборде</Label>
                <Switch
                  id="allow-manual-editing"
                  checked={settings.allowManualEditing}
                  onCheckedChange={(checked) => updateSettings({ allowManualEditing: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Элементы страницы 'Сессия'</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-live-clock">Показывать текущее время</Label>
                <Switch
                  id="show-live-clock"
                  checked={settings.showLiveClock}
                  onCheckedChange={(checked) => updateSettings({ showLiveClock: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-today-stats">Показывать статистику за сегодня</Label>
                <Switch
                  id="show-today-stats"
                  checked={settings.showTodayStats}
                  onCheckedChange={(checked) => updateSettings({ showTodayStats: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
