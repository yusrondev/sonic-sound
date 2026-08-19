import { create } from 'zustand';

export type ToolMode = 'select' | 'split' | 'trim' | 'draw' | 'erase';
export type BottomTab = 'mixer' | 'guitar' | 'drum' | 'piano' | 'violin' | 'properties' | 'fx';

interface UIStore {
  // Selection
  selectedTrackId: string | null;
  selectedClipId: string | null;

  // Tool mode
  toolMode: ToolMode;

  // Timeline
  zoom: number; // pixels per beat
  scrollLeft: number; // px
  scrollTop: number; // px
  snapEnabled: boolean;
  snapGrid: number; // beats
  gridVisible: boolean;

  // Panels
  bottomPanelHeight: number;
  trackPanelWidth: number;
  browserOpen: boolean;
  inspectorOpen: boolean;
  mixerOpen: boolean;
  bottomTab: BottomTab;

  // Playback position
  playheadBeat: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;

  // Toast
  toasts: ToastItem[];

  // Context menu
  contextMenu: ContextMenuState | null;

  // Recording
  isRecording: boolean;
  recordingTrackId: string | null;

  // Audio Loading
  audioLoadingCount: number;

  // Actions
  setSelectedTrack: (id: string | null) => void;
  setSelectedClip: (id: string | null) => void;
  setToolMode: (mode: ToolMode) => void;
  setZoom: (zoom: number) => void;
  setScrollLeft: (x: number) => void;
  setScrollTop: (y: number) => void;
  setSnapEnabled: (v: boolean) => void;
  setSnapGrid: (v: number) => void;
  setGridVisible: (v: boolean) => void;
  setBottomPanelHeight: (h: number) => void;
  setTrackPanelWidth: (w: number) => void;
  setBrowserOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setMixerOpen: (open: boolean) => void;
  setBottomTab: (tab: BottomTab) => void;
  setPlayheadBeat: (beat: number) => void;
  setLoopStart: (beat: number) => void;
  setLoopEnd: (beat: number) => void;
  setLoopEnabled: (v: boolean) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setIsRecording: (v: boolean) => void;
  setRecordingTrackId: (id: string | null) => void;
  incrementAudioLoading: () => void;
  decrementAudioLoading: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export const useUIStore = create<UIStore>((set, get) => ({
  selectedTrackId: 't-drum',
  selectedClipId: null,
  toolMode: 'select',
  zoom: 24,
  scrollLeft: 0,
  scrollTop: 0,
  snapEnabled: true,
  snapGrid: 1,
  gridVisible: true,
  bottomPanelHeight: 260,
  trackPanelWidth: 220,
  browserOpen: false,
  inspectorOpen: false,
  mixerOpen: true,
  bottomTab: 'mixer',
  playheadBeat: 0,
  loopStart: 0,
  loopEnd: 16,
  loopEnabled: false,
  toasts: [],
  contextMenu: null,
  isRecording: false,
  recordingTrackId: null,
  audioLoadingCount: 0,

  setSelectedTrack: (selectedTrackId) => set({ selectedTrackId }),
  setSelectedClip: (selectedClipId) => set({ selectedClipId }),
  setToolMode: (toolMode) => set({ toolMode }),
  setZoom: (zoom) => set({ zoom: Math.max(8, Math.min(120, zoom)) }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft: Math.max(0, scrollLeft) }),
  setScrollTop: (scrollTop) => set({ scrollTop: Math.max(0, scrollTop) }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setSnapGrid: (snapGrid) => set({ snapGrid }),
  setGridVisible: (gridVisible) => set({ gridVisible }),
  setBottomPanelHeight: (bottomPanelHeight) => set({ bottomPanelHeight: Math.max(120, Math.min(600, bottomPanelHeight)) }),
  setTrackPanelWidth: (trackPanelWidth) => set({ trackPanelWidth: Math.max(140, Math.min(400, trackPanelWidth)) }),
  setBrowserOpen: (browserOpen) => set({ browserOpen }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setMixerOpen: (mixerOpen) => set({ mixerOpen }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  setPlayheadBeat: (playheadBeat) => set({ playheadBeat }),
  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),

  addToast: (toast) => {
    const id = uid();
    const item: ToastItem = { id, ...toast };
    set(s => ({ toasts: [...s.toasts, item] }));
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setRecordingTrackId: (recordingTrackId) => set({ recordingTrackId }),
  incrementAudioLoading: () => set(s => ({ audioLoadingCount: s.audioLoadingCount + 1 })),
  decrementAudioLoading: () => set(s => ({ audioLoadingCount: Math.max(0, s.audioLoadingCount - 1) })),
}));
