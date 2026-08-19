import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrackType = 'audio' | 'vocal' | 'guitar' | 'bass' | 'piano' | 'drum' | 'violin' | 'midi';

export interface FXChain {
  eq: { enabled: boolean; low: number; lowMid: number; mid: number; highMid: number; high: number; };
  compressor: { enabled: boolean; threshold: number; ratio: number; attack: number; release: number; makeupGain: number; };
  reverb: { enabled: boolean; type: 'room' | 'hall' | 'plate'; mix: number; decay: number; };
  delay: { enabled: boolean; time: number; feedback: number; mix: number; };
}

export interface GuitarSettings {
  guitarType: 'acoustic' | 'electric-clean' | 'electric-distorted' | 'solo' | 'string' | 'bass';
  chords: ChordDef[];
  strummingPattern: StrokeType[];
  strummingSpeed: number;
  humanize: number;
  swing: number;
  velocity: number;
}

export type StrokeType = 'D' | 'U' | 'R' | 'A' | 'M'; // Down, Up, Rest, Accent, MutedMute

export interface ChordDef {
  root: string;
  type: string;
  duration: number; // in beats
  strummingPattern?: StrokeType[]; // per-chord override; undefined = use global pattern
}

export interface DrumPattern {
  kit: 'acoustic' | 'studio' | 'rock' | 'pop' | 'electronic' | 'lofi';
  steps: 16 | 32;
  tracks: DrumTrackPattern[];
}

export interface DrumTrackPattern {
  instrument: string;
  label: string;
  hits: DrumHit[];
}

export interface DrumHit {
  step: number;
  velocity: number; // 0-127
}

export interface PianoNote {
  pitch: number; // MIDI pitch 0-127
  startBar: number;
  durationBars: number;
  velocity: number;
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  startBeat: number; // absolute beat position
  durationBeats: number;
  type: TrackType;
  audioUrl?: string;
  audioBuffer?: AudioBuffer;
  waveformData?: Float32Array;
  fadeIn: number; // seconds
  fadeOut: number;
  gain: number;
  locked: boolean;
  muted: boolean;
  color?: string;
  chord?: { root: string; type: string; strummingPattern?: StrokeType[] };
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  color: string;
  clips: Clip[];
  volume: number; // 0-1
  pan: number; // -1 to 1
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  fx: FXChain;
  guitarSettings?: GuitarSettings;
  drumPattern?: DrumPattern;
  pianoNotes?: PianoNote[];
  collapsed: boolean;
}

export interface Marker {
  id: string;
  position: number; // beat
  label: string;
  color: string;
}

export interface HistoryEntry {
  action: string;
  state: Partial<ProjectState>;
}

export interface ProjectState {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  key: string;
  sampleRate: number;
  tracks: Track[];
  markers: Marker[];
  masterVolume: number;
  history: ProjectState[];
  historyIndex: number;
  futureHistory: ProjectState[];
}

// ─── Default FX Chain ─────────────────────────────────────────────────────────

export function defaultFX(): FXChain {
  return {
    eq: { enabled: false, low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 },
    compressor: { enabled: false, threshold: -24, ratio: 4, attack: 10, release: 150, makeupGain: 0 },
    reverb: { enabled: false, type: 'room', mix: 0.2, decay: 1.5 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.15 },
  };
}

// ─── Demo Project ─────────────────────────────────────────────────────────────

function mkClip(id: string, trackId: string, name: string, type: TrackType, startBeat: number, durationBeats: number, color?: string): Clip {
  return { id, trackId, name, type, startBeat, durationBeats, fadeIn: 0, fadeOut: 0, gain: 1, locked: false, muted: false, color };
}

function mkTrack(id: string, type: TrackType, name: string, color: string, clips: Clip[]): Track {
  return {
    id, type, name, color,
    clips,
    volume: 0.8, pan: 0, muted: false, soloed: false, armed: false,
    fx: defaultFX(),
    collapsed: false,
    ...(type === 'guitar' ? { guitarSettings: defaultGuitarSettings() } : {}),
    ...(type === 'bass' ? { guitarSettings: defaultBassSettings() } : {}),
    ...(type === 'drum' ? { drumPattern: defaultDrumPattern() } : {}),
    ...(type === 'piano' ? { pianoNotes: [] } : {}),
  };
}

export function defaultGuitarSettings(): GuitarSettings {
  return {
    guitarType: 'acoustic',
    chords: [
      { root: 'C', type: 'maj', duration: 4 },
      { root: 'Am', type: '', duration: 4 },
      { root: 'F', type: 'maj', duration: 4 },
      { root: 'G', type: 'maj', duration: 4 },
    ],
    strummingPattern: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'],
    strummingSpeed: 1,
    humanize: 0.2,
    swing: 0,
    velocity: 80,
  };
}

export function defaultBassSettings(): GuitarSettings {
  return {
    guitarType: 'bass',
    chords: [
      { root: 'C', type: 'maj', duration: 4 },
      { root: 'Am', type: '', duration: 4 },
    ],
    strummingPattern: ['D', 'R', 'D', 'R', 'D', 'R', 'D', 'R'],
    strummingSpeed: 1,
    humanize: 0.1,
    swing: 0,
    velocity: 90,
  };
}

export function defaultDrumPattern(): DrumPattern {
  return {
    kit: 'acoustic',
    steps: 16,
    tracks: [
      { instrument: 'kick', label: 'Kick', hits: [{ step: 0, velocity: 100 }, { step: 8, velocity: 95 }] },
      { instrument: 'snare', label: 'Snare', hits: [{ step: 4, velocity: 90 }, { step: 12, velocity: 88 }] },
      { instrument: 'hat-closed', label: 'Hi-Hat', hits: [0,2,4,6,8,10,12,14].map(s => ({ step: s, velocity: 70 })) },
      { instrument: 'hat-open', label: 'Open Hat', hits: [{ step: 6, velocity: 75 }, { step: 14, velocity: 75 }] },
      { instrument: 'clap', label: 'Clap', hits: [] },
      { instrument: 'tom', label: 'Tom', hits: [{ step: 13, velocity: 85 }] },
      { instrument: 'crash', label: 'Crash', hits: [{ step: 0, velocity: 80 }] },
      { instrument: 'ride', label: 'Ride', hits: [] },
    ],
  };
}

export function buildDemoProject(): ProjectState {
  const tracks: Track[] = [
    mkTrack('t-drum', 'drum', 'Drums', '#7c3aed', [
      mkClip('c-d1', 't-drum', 'Beat 01', 'drum', 0, 16),
      mkClip('c-d2', 't-drum', 'Beat 01', 'drum', 16, 16),
      mkClip('c-d3', 't-drum', 'Beat 02', 'drum', 32, 8),
    ]),
    mkTrack('t-bass', 'bass', 'Bass', '#059669', [
      mkClip('c-b1', 't-bass', 'Bass Loop', 'bass', 4, 20),
      mkClip('c-b2', 't-bass', 'Bass Loop', 'bass', 24, 12),
    ]),
    mkTrack('t-guitar', 'guitar', 'Acoustic Guitar', '#d97706', [
      mkClip('c-g1', 't-guitar', 'Chord Prog', 'guitar', 0, 16),
      mkClip('c-g2', 't-guitar', 'Chord Prog', 'guitar', 20, 20),
    ]),
    mkTrack('t-egtr', 'guitar', 'Electric Guitar', '#f59e0b', [
      mkClip('c-eg1', 't-egtr', 'Lead Riff', 'guitar', 16, 16),
      mkClip('c-eg2', 't-egtr', 'Lead Riff', 'guitar', 36, 8),
    ]),
    mkTrack('t-piano', 'piano', 'Piano', '#0891b2', [
      mkClip('c-p1', 't-piano', 'Keys', 'piano', 8, 24),
    ]),
    mkTrack('t-violin', 'violin', 'Violin', '#be185d', [
      mkClip('c-v1', 't-violin', 'Strings', 'violin', 24, 16),
    ]),
    mkTrack('t-vocal', 'vocal', 'Lead Vocal', '#c026d3', [
      mkClip('c-voc1', 't-vocal', 'Verse', 'vocal', 16, 20),
      mkClip('c-voc2', 't-vocal', 'Chorus', 'vocal', 40, 16),
    ]),
    mkTrack('t-bvoc', 'vocal', 'Backing Vocal', '#9333ea', [
      mkClip('c-bv1', 't-bvoc', 'Backing', 'vocal', 40, 16),
    ]),
  ];

  // Set specific drum pattern for demo
  const drumTrack = tracks[0];
  drumTrack.drumPattern = defaultDrumPattern();

  // Set guitar settings for demo
  const guitarTrack = tracks[2];
  guitarTrack.guitarSettings = defaultGuitarSettings();

  const eGuitarTrack = tracks[3];
  if (eGuitarTrack.guitarSettings) {
    eGuitarTrack.guitarSettings.guitarType = 'electric-clean';
    eGuitarTrack.guitarSettings.strummingPattern = ['D', 'D', 'U', 'D', 'U', 'R', 'D', 'U'];
  }

  return {
    id: 'demo-project',
    name: 'My First Song',
    bpm: 120,
    timeSignature: [4, 4],
    key: 'C Major',
    sampleRate: 44100,
    tracks,
    markers: [
      { id: 'm1', position: 0, label: 'Intro', color: '#3b82f6' },
      { id: 'm2', position: 16, label: 'Verse', color: '#10b981' },
      { id: 'm3', position: 40, label: 'Chorus', color: '#f59e0b' },
    ],
    masterVolume: 0.85,
    history: [],
    historyIndex: -1,
    futureHistory: [],
  };
}

function buildEmptyProject(): ProjectState {
  return {
    id: 'empty-project',
    name: 'Untitled Project',
    bpm: 120,
    timeSignature: [4, 4],
    key: 'C Major',
    sampleRate: 44100,
    tracks: [],
    markers: [],
    masterVolume: 0.8,
    history: [],
    historyIndex: -1,
    futureHistory: [],
  };
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface ProjectStore extends ProjectState {
  // Project actions
  setProjectName: (name: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: [number, number]) => void;
  setKey: (key: string) => void;
  setMasterVolume: (vol: number) => void;

  // Track actions
  addTrack: (type: TrackType, name?: string) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  setTrackMute: (id: string, muted: boolean) => void;
  setTrackSolo: (id: string, soloed: boolean) => void;
  setTrackArm: (id: string, armed: boolean) => void;
  setTrackVolume: (id: string, volume: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;

  // Clip actions
  addClip: (clip: Omit<Clip, 'id'>) => Clip;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<Clip>) => void;
  moveClip: (clipId: string, toTrackId: string, newStartBeat: number) => void;
  splitClip: (trackId: string, clipId: string, atBeat: number) => void;
  duplicateClip: (trackId: string, clipId: string) => void;

  // Guitar
  updateGuitarSettings: (trackId: string, settings: Partial<GuitarSettings>) => void;
  updateChordStrumming: (trackId: string, chordIndex: number, pattern: StrokeType[] | undefined) => void;

  // Drum
  updateDrumPattern: (trackId: string, pattern: Partial<DrumPattern>) => void;
  toggleDrumHit: (trackId: string, drumInstrument: string, step: number) => void;

  // Piano
  addPianoNote: (trackId: string, note: Omit<PianoNote, 'id'>) => void;
  removePianoNote: (trackId: string, index: number) => void;

  // Markers
  addMarker: (marker: Omit<Marker, 'id'>) => void;
  removeMarker: (id: string) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // FX
  updateTrackFX: (trackId: string, fx: Partial<FXChain>) => void;

  // Persistence
  saveProject: () => void;
  loadProject: (project: ProjectState) => void;
  newProject: () => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function trackColor(type: TrackType): string {
  const map: Record<TrackType, string> = {
    drum: '#7c3aed', bass: '#059669', guitar: '#d97706', piano: '#0891b2',
    violin: '#be185d', vocal: '#c026d3', audio: '#2563eb', midi: '#6366f1',
  };
  return map[type] ?? '#2563eb';
}

function trackName(type: TrackType, index: number): string {
  const names: Record<TrackType, string> = {
    drum: 'Drums', bass: 'Bass', guitar: 'Guitar', piano: 'Piano',
    violin: 'Violin', vocal: 'Vocal', audio: 'Audio', midi: 'MIDI',
  };
  return `${names[type]} ${index}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const savedProject = (() => {
  try {
    const raw = localStorage.getItem('sonicsound-project');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...(savedProject || buildEmptyProject()),

  setProjectName: (name) => set({ name }),
  setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, bpm)) }),
  setTimeSignature: (timeSignature) => set({ timeSignature }),
  setKey: (key) => set({ key }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),

  addTrack: (type, name) => {
    const { tracks } = get();
    const idx = tracks.filter(t => t.type === type).length + 1;
    const id = `t-${uid()}`;
    const color = trackColor(type);
    const newTrack: Track = {
      id, type,
      name: name ?? trackName(type, idx),
      color, clips: [],
      volume: 0.8, pan: 0,
      muted: false, soloed: false, armed: false,
      fx: defaultFX(),
      collapsed: false,
      ...(type === 'guitar' || type === 'bass' ? { guitarSettings: type === 'bass' ? defaultBassSettings() : defaultGuitarSettings() } : {}),
      ...(type === 'drum' ? { drumPattern: defaultDrumPattern() } : {}),
      ...(type === 'piano' ? { pianoNotes: [] } : {}),
    };
    set(s => ({ tracks: [...s.tracks, newTrack] }));
  },

  removeTrack: (id) => set(s => ({ tracks: s.tracks.filter(t => t.id !== id) })),

  updateTrack: (id, patch) => set(s => ({
    tracks: s.tracks.map(t => t.id === id ? { ...t, ...patch } : t)
  })),

  setTrackMute: (id, muted) => set(s => ({
    tracks: s.tracks.map(t => t.id === id ? { ...t, muted } : t)
  })),

  setTrackSolo: (id, soloed) => set(s => ({
    tracks: s.tracks.map(t => t.id === id ? { ...t, soloed } : t)
  })),

  setTrackArm: (id, armed) => set(s => ({
    tracks: s.tracks.map(t => t.id === id ? { ...t, armed } : t)
  })),

  setTrackVolume: (id, volume) => set(s => ({
    tracks: s.tracks.map(t => t.id === id ? { ...t, volume } : t)
  })),

  setTrackPan: (id, pan) => set(s => ({
    tracks: s.tracks.map(t => t.id === id ? { ...t, pan } : t)
  })),

  reorderTracks: (fromIndex, toIndex) => set(s => {
    const tracks = [...s.tracks];
    const [removed] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, removed);
    return { tracks };
  }),

  addClip: (clipData) => {
    const id = `c-${uid()}`;
    const clip: Clip = { id, ...clipData };
    set(s => ({
      tracks: s.tracks.map(t => t.id === clipData.trackId ? { ...t, clips: [...t.clips, clip] } : t)
    }));
    return clip;
  },

  removeClip: (trackId, clipId) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t)
  })),

  updateClip: (trackId, clipId, patch) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId ? {
      ...t,
      clips: t.clips.map(c => c.id === clipId ? { ...c, ...patch } : c)
    } : t)
  })),

  moveClip: (clipId, toTrackId, newStartBeat) => set(s => {
    let movedClip: Clip | null = null;
    const tracks = s.tracks.map(t => {
      const clip = t.clips.find(c => c.id === clipId);
      if (clip) {
        movedClip = { ...clip, trackId: toTrackId, startBeat: newStartBeat };
        return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
      }
      return t;
    });
    if (movedClip) {
      return { tracks: tracks.map(t => t.id === toTrackId ? { ...t, clips: [...t.clips, movedClip!] } : t) };
    }
    return { tracks };
  }),

  splitClip: (trackId, clipId, atBeat) => set(s => {
    let newTracks = s.tracks.map(t => {
      if (t.id !== trackId) return t;
      const clip = t.clips.find(c => c.id === clipId);
      if (!clip || atBeat <= clip.startBeat || atBeat >= clip.startBeat + clip.durationBeats) return t;

      const leftDuration = atBeat - clip.startBeat;
      const rightDuration = clip.durationBeats - leftDuration;
      const left: Clip = { ...clip, durationBeats: leftDuration };
      const right: Clip = { ...clip, id: `c-${uid()}`, startBeat: atBeat, durationBeats: rightDuration };
      return { ...t, clips: [...t.clips.filter(c => c.id !== clipId), left, right] };
    });
    return { tracks: newTracks };
  }),

  duplicateClip: (trackId, clipId) => set(s => ({
    tracks: s.tracks.map(t => {
      if (t.id !== trackId) return t;
      const clip = t.clips.find(c => c.id === clipId);
      if (!clip) return t;
      const dup: Clip = { ...clip, id: `c-${uid()}`, startBeat: clip.startBeat + clip.durationBeats };
      return { ...t, clips: [...t.clips, dup] };
    })
  })),

  updateGuitarSettings: (trackId, settings) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId && t.guitarSettings
      ? { ...t, guitarSettings: { ...t.guitarSettings, ...settings } }
      : t)
  })),

  updateChordStrumming: (trackId, chordIndex, pattern) => set(s => ({
    tracks: s.tracks.map(t => {
      if (t.id !== trackId || !t.guitarSettings) return t;
      const chords = t.guitarSettings.chords.map((c, i) =>
        i === chordIndex ? { ...c, strummingPattern: pattern } : c
      );
      return { ...t, guitarSettings: { ...t.guitarSettings, chords } };
    })
  })),

  updateDrumPattern: (trackId, pattern) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId && t.drumPattern
      ? { ...t, drumPattern: { ...t.drumPattern, ...pattern } }
      : t)
  })),

  toggleDrumHit: (trackId, drumInstrument, step) => set(s => ({
    tracks: s.tracks.map(t => {
      if (t.id !== trackId || !t.drumPattern) return t;
      const tracks = t.drumPattern.tracks.map(dt => {
        if (dt.instrument !== drumInstrument) return dt;
        const existing = dt.hits.find(h => h.step === step);
        if (existing) {
          return { ...dt, hits: dt.hits.filter(h => h.step !== step) };
        } else {
          return { ...dt, hits: [...dt.hits, { step, velocity: 100 }] };
        }
      });
      return { ...t, drumPattern: { ...t.drumPattern, tracks } };
    })
  })),

  addPianoNote: (trackId, note) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId
      ? { ...t, pianoNotes: [...(t.pianoNotes ?? []), note as PianoNote] }
      : t)
  })),

  removePianoNote: (trackId, index) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId
      ? { ...t, pianoNotes: (t.pianoNotes ?? []).filter((_, i) => i !== index) }
      : t)
  })),

  addMarker: (marker) => set(s => ({ markers: [...s.markers, { id: `m-${uid()}`, ...marker }] })),
  removeMarker: (id) => set(s => ({ markers: s.markers.filter(m => m.id !== id) })),

  updateTrackFX: (trackId, fx) => set(s => ({
    tracks: s.tracks.map(t => t.id === trackId ? { ...t, fx: { ...t.fx, ...fx } } : t)
  })),

  pushHistory: () => {
    // Simplified history — just mark dirty
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      set({ ...prev, historyIndex: historyIndex - 1 });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      set({ ...next, historyIndex: historyIndex + 1 });
    }
  },

  saveProject: () => {
    const state = get();
    const toSave = {
      id: state.id, name: state.name, bpm: state.bpm,
      timeSignature: state.timeSignature, key: state.key,
      sampleRate: state.sampleRate, masterVolume: state.masterVolume,
      tracks: state.tracks.map(t => ({ ...t, clips: t.clips.map(c => ({ ...c, audioBuffer: undefined, waveformData: undefined })) })),
      markers: state.markers,
      history: [], historyIndex: -1, futureHistory: [],
    };
    try {
      localStorage.setItem('sonicsound-project', JSON.stringify(toSave));
    } catch (e) { console.warn('Save failed', e); }
  },

  loadProject: (project) => set({ ...project }),

  newProject: () => set({ ...buildEmptyProject() }),
}));
