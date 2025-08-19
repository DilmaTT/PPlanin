export type SessionPeriod = {
  startTime: string;
  endTime: string;
  type: 'play' | 'break' | 'select';
};

export type Session = {
  id: string;
  overallStartTime: string;
  overallEndTime: string;
  overallDuration: number;
  overallProfit: number;
  overallHandsPlayed: number;
  notes: string;
  handsPlayed: number;
  periods?: SessionPeriod[]; // Make periods optional
};

export type Settings = {
  theme: 'dark' | 'light' | 'system';
  splitPeriods: boolean;
  showNotes: boolean;
  showHandsPlayed: boolean;
  allowManualEditing: boolean;
  showLiveClock?: boolean; // Optional
  showTodayStats?: boolean; // Optional
  goals: {
    hours: number;
    hands: number;
    sessions: number;
  };
  listViewOptions: {
    showMonth: boolean;
    showDayOfWeek: boolean;
    showYear: boolean;
    dateRangeMode: 'all' | 'week' | 'month' | 'custom'; // Added 'custom'
    customStartDate: string | null;
    customEndDate: string | null;
    sortOrder: 'asc' | 'desc';
    showStartTime: boolean;
    showEndTime: boolean;
    showSessionCount: boolean;
    showDuration: boolean;
    showHandsPerHour: boolean;
    showDailyPlan: boolean;
    showDailyPlanRemaining: boolean;
    showDailyPlanHands?: boolean; // Optional
    showTotalPlayTime: boolean;
    showTotalPlanRemaining: boolean;
    showTotalsRow: boolean;
  };
  plans: {
    [date: string]: Plan; // YYYY-MM-DD -> Plan
  };
  offDays: {
    [date: string]: boolean; // YYYY-MM-DD -> true if off day
  };
};

export type Plan = {
  hours: number;
  hands: number;
};
