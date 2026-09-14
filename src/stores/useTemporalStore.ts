import { create } from 'zustand';
import type { HistoricalMoment } from '../services/temporalEngine';

export interface TemporalStoreState {
  isTimelineActive: boolean;
  temporalYear: number | null;
  activeMoment: HistoricalMoment | null;

  setIsTimelineActive: (active: boolean) => void;
  toggleTimeline: (defaultYear?: number) => void;
  setTemporalYear: (
    yearOrUpdater: number | null | ((prev: number | null) => number | null)
  ) => void;
  setActiveMoment: (moment: HistoricalMoment | null) => void;
  jumpToYear: (year: number, moment?: HistoricalMoment | null) => void;
  closeTimeline: () => void;
}

export const useTemporalStore = create<TemporalStoreState>((set) => ({
  isTimelineActive: false,
  temporalYear: null,
  activeMoment: null,

  setIsTimelineActive: (isTimelineActive) => set({ isTimelineActive }),

  toggleTimeline: (defaultYear) => {
    set((state) => {
      const nextActive = !state.isTimelineActive;
      return {
        isTimelineActive: nextActive,
        temporalYear: nextActive ? state.temporalYear ?? defaultYear ?? 1950 : state.temporalYear,
        activeMoment: nextActive ? state.activeMoment : null,
      };
    });
  },

  setTemporalYear: (yearOrUpdater) => {
    set((state) => ({
      temporalYear:
        typeof yearOrUpdater === 'function' ? yearOrUpdater(state.temporalYear) : yearOrUpdater,
    }));
  },

  setActiveMoment: (activeMoment) => set({ activeMoment }),

  jumpToYear: (year, moment = null) => {
    set({
      isTimelineActive: true,
      temporalYear: year,
      activeMoment: moment,
    });
  },

  closeTimeline: () => {
    set({
      isTimelineActive: false,
      activeMoment: null,
    });
  },
}));
