/**
 * AudioEngine — Web Audio API singleton
 * Manages AudioContext, master bus, and per-track processing chains.
 */

import * as Tone from 'tone';
import type { Track, Clip, FXChain } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useProjectStore } from '../store/projectStore';

interface TrackNodes {
  gain: GainNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  eq: IIRFilterNode | null;
  compressor: DynamicsCompressorNode | null;
  convolver: ConvolverNode | null;
  destination: AudioNode;
  instrument?: any;
  kick?: Tone.MembraneSynth;
  snare?: Tone.NoiseSynth;
  hihat?: Tone.NoiseSynth;
}

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function pitchToLabel(pitch: number): string {
  const note = NOTE_LABELS[(pitch - 12) % 12];
  const octave = Math.floor((pitch - 12) / 12);
  return `${note}${octave}`;
}

function shiftNotesOctave(notes: string[], offset: number): string[] {
  return notes.map(note => {
    const match = note.match(/^([A-G]#?b?)(\d)$/);
    if (!match) return note;
    const name = match[1];
    const octave = parseInt(match[2], 10);
    return `${name}${Math.max(1, octave + offset)}`;
  });
}

const CHORD_NOTES: Record<string, string[]> = {
  'Cmaj': ['C3', 'E3', 'G3'], 'Cm': ['C3', 'Eb3', 'G3'], 'C7': ['C3', 'E3', 'G3', 'Bb3'],
  'Cmaj7': ['C3', 'E3', 'G3', 'B3'],
  'Dmaj': ['D3', 'F#3', 'A3'], 'Dm': ['D3', 'F3', 'A3'], 'D7': ['D3', 'F#3', 'A3', 'C4'],
  'Emaj': ['E3', 'G#3', 'B3'], 'Em': ['E3', 'G3', 'B3'], 'E7': ['E3', 'G#3', 'B3', 'D4'],
  'Fmaj': ['F3', 'A3', 'C4'], 'Fm': ['F3', 'Ab3', 'C4'],
  'Gmaj': ['G3', 'B3', 'D4'], 'Gm': ['G3', 'Bb3', 'D4'], 'G7': ['G3', 'B3', 'D4', 'F4'],
  'Amaj': ['A3', 'C#4', 'E4'], 'Am': ['A3', 'C4', 'E4'], 'A7': ['A3', 'C#4', 'E4', 'G4'],
  'Bmaj': ['B3', 'D#4', 'F#4'], 'Bm': ['B3', 'D4', 'F#4'],
};

class AudioEngine {
  private static instance: AudioEngine;
  ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private trackNodes: Map<string, TrackNodes> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();

  // Playback state
  private isPlaying = false;
  private startTime = 0; // AudioContext time when play was pressed
  private startBeat = 0; // Beat position when play was pressed
  private bpm = 120;
  private animFrameId: number | null = null;

  // Synths
  private synthsInitialized = false;
  private guitarSynth: Tone.PolySynth | null = null;
  private pianoSynth: Tone.PolySynth | null = null;
  private violinSynth: Tone.PolySynth | null = null;
  private kickSynth: Tone.MembraneSynth | null = null;
  private snareSynth: Tone.NoiseSynth | null = null;
  private hihatSynth: Tone.NoiseSynth | null = null;

  // Scheduler
  private schedulerIntervalId: any = null;
  private lastScheduledBeat = 0;

  // Callbacks
  onPlayheadUpdate?: (beat: number) => void;
  onPlaybackEnd?: () => void;

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 44100 });
      Tone.setContext(this.ctx);
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.value = -3;
      this.masterLimiter.knee.value = 3;
      this.masterLimiter.ratio.value = 20;
      this.masterLimiter.attack.value = 0.001;
      this.masterLimiter.release.value = 0.1;

      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 2048;

      this.masterGain.connect(this.masterLimiter);
      this.masterLimiter.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  resume() {
    this.ensureContext();
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
    Tone.getTransport().bpm.value = bpm;
  }

  setMasterVolume(vol: number) {
    if (this.masterGain) this.masterGain.gain.value = vol;
  }

  // Create or update audio processing chain for a track
  ensureTrackNodes(trackId: string, track?: Track): TrackNodes {
    const ctx = this.ensureContext();
    if (!track) {
      track = useProjectStore.getState().tracks.find(t => t.id === trackId);
    }

    if (!this.trackNodes.has(trackId)) {
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      gain.connect(panner);
      panner.connect(analyser);
      analyser.connect(this.masterGain!);

      const nodes: TrackNodes = { gain, panner, analyser, eq: null, compressor: null, convolver: null, destination: gain };
      
      if (track) {
        this.initializeTrackInstrument(nodes, track);
      }

      this.trackNodes.set(trackId, nodes);
    } else if (track) {
      // Lazy load/ensure instruments exist if type is provided later
      const nodes = this.trackNodes.get(trackId)!;
      if (!nodes.instrument && !nodes.kick) {
        this.initializeTrackInstrument(nodes, track);
      }
    }
    return this.trackNodes.get(trackId)!;
  }

  reinitializeInstrument(trackId: string) {
    const track = useProjectStore.getState().tracks.find(t => t.id === trackId);
    if (!track) return;
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return;

    if (nodes.instrument) {
      nodes.instrument.dispose();
      nodes.instrument = undefined;
    }
    this.initializeTrackInstrument(nodes, track);
  }

  private initializeTrackInstrument(nodes: TrackNodes, track: Track) {
    switch (track.type) {
      case 'piano':
        useUIStore.getState().incrementAudioLoading();
        nodes.instrument = new Tone.Sampler({
          urls: {
            A1: "A1.mp3", A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3", A6: "A6.mp3", A7: "A7.mp3",
            C1: "C1.mp3", C2: "C2.mp3", C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3", C7: "C7.mp3", C8: "C8.mp3",
            "D#1": "Ds1.mp3", "D#2": "Ds2.mp3", "D#3": "Ds3.mp3", "D#4": "Ds4.mp3", "D#5": "Ds5.mp3", "D#6": "Ds6.mp3", "D#7": "Ds7.mp3",
            "F#1": "Fs1.mp3", "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3", "F#5": "Fs5.mp3", "F#6": "Fs6.mp3", "F#7": "Fs7.mp3"
          },
          baseUrl: "/samples/piano/",
          onload: () => {
            console.log('Piano sampler loaded');
            useUIStore.getState().decrementAudioLoading();
          },
          onerror: () => {
            console.error('Piano sampler load failed');
            useUIStore.getState().decrementAudioLoading();
            nodes.instrument = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'sine' },
              envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.8 }
            }).connect(nodes.gain);
          }
        }).connect(nodes.gain);
        break;
        
      case 'guitar':
      case 'bass': {
        let gType = track.type === 'bass' ? 'bass' : (track.guitarSettings?.guitarType || 'acoustic');
        let baseUrl = "/samples/guitar-acoustic/";
        let urls: Record<string, string> = {};

        if (gType === 'electric-clean' || gType === 'electric-distorted' || gType === 'solo') {
          baseUrl = "/samples/guitar-electric/";
          urls = {
            A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
            C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3",
            "C#2": "Cs2.mp3",
            "D#3": "Ds3.mp3", "D#4": "Ds4.mp3", "D#5": "Ds5.mp3",
            E2: "E2.mp3",
            "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3", "F#5": "Fs5.mp3"
          };
        } else if (gType === 'string') {
          baseUrl = "/samples/guitar-nylon/";
          urls = {
            A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
            "A#5": "As5.mp3",
            B1: "B1.mp3", B2: "B2.mp3", B3: "B3.mp3", B4: "B4.mp3",
            "C#3": "Cs3.mp3", "C#4": "Cs4.mp3", "C#5": "Cs5.mp3",
            D2: "D2.mp3", D3: "D3.mp3", D5: "D5.mp3",
            "D#4": "Ds4.mp3",
            E2: "E2.mp3", E3: "E3.mp3", E4: "E4.mp3", E5: "E5.mp3",
            "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3", "F#5": "Fs5.mp3",
            G3: "G3.mp3", G5: "G5.mp3",
            "G#2": "Gs2.mp3", "G#4": "Gs4.mp3", "G#5": "Gs5.mp3"
          };
        } else if (gType === 'bass') {
          baseUrl = "/samples/bass-electric/";
          urls = {
            "A#1": "As1.mp3", "A#2": "As2.mp3", "A#3": "As3.mp3", "A#4": "As4.mp3",
            "C#1": "Cs1.mp3", "C#2": "Cs2.mp3", "C#3": "Cs3.mp3", "C#4": "Cs4.mp3", "C#5": "Cs5.mp3",
            E1: "E1.mp3", E2: "E2.mp3", E3: "E3.mp3", E4: "E4.mp3",
            G1: "G1.mp3", G2: "G2.mp3", G3: "G3.mp3", G4: "G4.mp3"
          };
        } else {
          // acoustic
          urls = {
            A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3",
            "A#2": "As2.mp3", "A#3": "As3.mp3", "A#4": "As4.mp3",
            B2: "B2.mp3", B3: "B3.mp3", B4: "B4.mp3",
            C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3",
            "C#3": "Cs3.mp3", "C#4": "Cs4.mp3", "C#5": "Cs5.mp3",
            D2: "D2.mp3", D3: "D3.mp3", D4: "D4.mp3", D5: "D5.mp3",
            "D#2": "Ds2.mp3", "D#3": "Ds3.mp3", "D#4": "Ds4.mp3",
            E2: "E2.mp3", E3: "E3.mp3", E4: "E4.mp3",
            F2: "F2.mp3", F3: "F3.mp3", F4: "F4.mp3",
            "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3",
            G2: "G2.mp3", G3: "G3.mp3", G4: "G4.mp3",
            "G#2": "Gs2.mp3", "G#3": "Gs3.mp3", "G#4": "Gs4.mp3"
          };
        }

        useUIStore.getState().incrementAudioLoading();
        nodes.instrument = new Tone.Sampler({
          urls,
          baseUrl,
          onload: () => {
            console.log(`Guitar sampler loaded: ${gType}`);
            useUIStore.getState().decrementAudioLoading();
          },
          onerror: () => {
            console.error(`Guitar sampler load failed: ${gType}`);
            useUIStore.getState().decrementAudioLoading();
            nodes.instrument = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'triangle' },
              envelope: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.6 }
            }).connect(nodes.gain);
          }
        }).connect(nodes.gain);
        
        if (gType === 'electric-distorted' || gType === 'solo') {
          const dist = new Tone.Distortion(0.8).connect(nodes.gain);
          nodes.instrument.disconnect(nodes.gain);
          nodes.instrument.connect(dist);
        }
        break;
      }

      case 'violin':
        useUIStore.getState().incrementAudioLoading();
        nodes.instrument = new Tone.Sampler({
          urls: {
            A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3", A6: "A6.mp3",
            C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3", C7: "C7.mp3",
            E4: "E4.mp3", E5: "E5.mp3", E6: "E6.mp3",
            G3: "G3.mp3", G4: "G4.mp3", G5: "G5.mp3", G6: "G6.mp3"
          },
          baseUrl: "/samples/violin/",
          onload: () => {
            console.log('Violin sampler loaded');
            useUIStore.getState().decrementAudioLoading();
          },
          onerror: () => {
            console.error('Violin sampler load failed');
            useUIStore.getState().decrementAudioLoading();
            nodes.instrument = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'sawtooth' },
              envelope: { attack: 0.15, decay: 0.2, sustain: 0.7, release: 1.0 }
            }).connect(nodes.gain);
          }
        }).connect(nodes.gain);
        break;

      case 'drum':
        useUIStore.getState().incrementAudioLoading();
        nodes.instrument = new Tone.Sampler({
          urls: {
            "C1": "kick.mp3",
            "D1": "snare.mp3",
            "F#1": "hihat.mp3"
          },
          baseUrl: "/samples/drum/",
          onload: () => {
            console.log('Drum sampler loaded');
            useUIStore.getState().decrementAudioLoading();
          },
          onerror: () => {
            console.error('Drum sampler load failed');
            useUIStore.getState().decrementAudioLoading();
            nodes.kick = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4 }).connect(nodes.gain);
            nodes.snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(nodes.gain);
            nodes.hihat = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).connect(nodes.gain);
          }
        }).connect(nodes.gain);
        break;
    }
  }

  updateTrackVolume(trackId: string, volume: number) {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) nodes.gain.gain.value = volume;
  }

  updateTrackPan(trackId: string, pan: number) {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) nodes.panner.pan.value = pan;
  }

  // Get analyser data for metering
  getTrackLevel(trackId: string): number {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return 0;
    const data = new Uint8Array(nodes.analyser.frequencyBinCount);
    nodes.analyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > max) max = v;
    }
    return max;
  }

  getMasterLevel(): number {
    if (!this.masterAnalyser) return 0;
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > max) max = v;
    }
    return max;
  }

  // Play all audio clips
  playAudioClips(tracks: Track[], startBeat: number, bpm: number) {
    const ctx = this.ensureContext();
    this.bpm = bpm;
    const beatsPerSecond = bpm / 60;

    // Stop existing sources
    this.stopAllSources();

    tracks.forEach(track => {
      if (track.muted) return;
      const nodes = this.ensureTrackNodes(track.id, track);
      nodes.gain.gain.value = track.volume;
      nodes.panner.pan.value = track.pan;

      track.clips.forEach(clip => {
        if (!clip.audioBuffer || clip.muted) return;
        if (clip.startBeat + clip.durationBeats < startBeat) return;

        const clipStartTime = (clip.startBeat - startBeat) / beatsPerSecond;
        if (clipStartTime < 0) return; // skip clips in the past for simplicity

        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;
        source.connect(nodes.destination);

        const scheduleTime = ctx.currentTime + clipStartTime;
        source.start(scheduleTime);
        source.stop(scheduleTime + clip.durationBeats / beatsPerSecond);
        this.sources.set(`${track.id}-${clip.id}`, source);
      });
    });
  }

  private stopAllSources() {
    this.sources.forEach(source => {
      try { source.stop(); } catch {}
    });
    this.sources.clear();
  }

  async initSynths() {
    if (this.synthsInitialized) return;
    await Tone.start();
    
    this.guitarSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 1 }
    }).toDestination();

    this.pianoSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.8, release: 0.8 }
    }).toDestination();

    this.violinSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.2, decay: 0.2, sustain: 0.8, release: 1.2 }
    }).toDestination();

    this.kickSynth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4 }).toDestination();
    this.snareSynth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination();
    this.hihatSynth = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).toDestination();

    this.synthsInitialized = true;
  }

  startScheduler(tracks: Track[]) {
    this.initSynths();
    if (this.schedulerIntervalId) clearInterval(this.schedulerIntervalId);
    
    this.schedulerIntervalId = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(this.schedulerIntervalId);
        this.schedulerIntervalId = null;
        return;
      }
      
      const currentBeat = this.getCurrentBeat();
      const beatsPerSecond = this.bpm / 60;
      const lookaheadBeats = 0.25 * beatsPerSecond; // 250ms look ahead
      const startScheduled = this.lastScheduledBeat;
      const endScheduled = currentBeat + lookaheadBeats;
      
      if (endScheduled <= startScheduled) return;

      this.scheduleEvents(tracks, startScheduled, endScheduled);
      this.lastScheduledBeat = endScheduled;
    }, 40);
  }

  scheduleEvents(tracks: Track[], Left: number, Right: number) {
    tracks.forEach(track => {
      if (track.muted) return;
      
      const nodes = this.ensureTrackNodes(track.id, track);
      
      track.clips.forEach(clip => {
        if (clip.muted) return;
        
        // Find overlap between scheduling window [Left, Right] and clip timeline [clip.startBeat, clip.startBeat + clip.durationBeats]
        const clipEnd = clip.startBeat + clip.durationBeats;
        const clipLeft = Math.max(Left, clip.startBeat);
        const clipRight = Math.min(Right, clipEnd);
        
        if (clipLeft >= clipRight) return;

        // 1. Drums
        if (track.type === 'drum' && track.drumPattern) {
          const pattern = track.drumPattern;
          const steps = pattern.steps;
          const lenBeats = steps * 0.25;

          pattern.tracks.forEach(dt => {
            dt.hits.forEach(hit => {
              const relativeHitBeat = hit.step * 0.25;
              
              // find multiples of pattern loop that fall into clipLeft/clipRight
              const minLoopIdx = Math.floor((clipLeft - clip.startBeat - relativeHitBeat) / lenBeats);
              const maxLoopIdx = Math.ceil((clipRight - clip.startBeat - relativeHitBeat) / lenBeats);

              for (let idx = Math.max(0, minLoopIdx); idx <= maxLoopIdx; idx++) {
                const absBeat = clip.startBeat + idx * lenBeats + relativeHitBeat;
                if (absBeat >= clipLeft && absBeat < clipRight) {
                  const time = this.startTime + (absBeat - this.startBeat) / (this.bpm / 60);
                  if (this.ctx && time >= this.ctx.currentTime) {
                    this.triggerTrackDrumHitAtTime(nodes, dt.instrument, time);
                  }
                }
              }
            });
          });
        }

        // 2. Piano & Violin
        if ((track.type === 'piano' || track.type === 'violin') && track.pianoNotes) {
          track.pianoNotes.forEach(note => {
            const absBeat = note.startBar * 4; // 1 bar = 4 beats
            if (absBeat >= clipLeft && absBeat < clipRight) {
              const time = this.startTime + (absBeat - this.startBeat) / (this.bpm / 60);
              if (this.ctx && time >= this.ctx.currentTime) {
                const synth = nodes.instrument;
                if (synth) {
                  synth.triggerAttackRelease(pitchToLabel(note.pitch), `${note.durationBars}m`, time);
                }
              }
            }
          });
        }

        // 3. Guitar & Bass
        if ((track.type === 'guitar' || track.type === 'bass') && track.guitarSettings) {
          const gs = track.guitarSettings;
          const strumLenBeats = 4;
          const strokeStep = 0.5;

          gs.strummingPattern.forEach((stroke, stepIdx) => {
            if (stroke === 'R') return; // rest

            const relativeStrumBeat = stepIdx * strokeStep;
            const minLoopIdx = Math.floor((clipLeft - clip.startBeat - relativeStrumBeat) / strumLenBeats);
            const maxLoopIdx = Math.ceil((clipRight - clip.startBeat - relativeStrumBeat) / strumLenBeats);

            for (let idx = Math.max(0, minLoopIdx); idx <= maxLoopIdx; idx++) {
              const absBeat = clip.startBeat + idx * strumLenBeats + relativeStrumBeat;
              if (absBeat >= clipLeft && absBeat < clipRight) {
                // Determine active chord in progression
                let activeChord: { root: string; type: string } | null = clip.chord
                  ? { root: clip.chord.root, type: clip.chord.type }
                  : null;

                if (!activeChord) {
                  const progressionBeats = gs.chords.reduce((acc, c) => acc + c.duration, 0) || 16;
                  const relativeBeatInProgression = (absBeat - clip.startBeat) % progressionBeats;
                  
                  let accum = 0;
                  let rawChord = gs.chords[0];
                  for (const c of gs.chords) {
                    accum += c.duration;
                    if (relativeBeatInProgression < accum) {
                      rawChord = c;
                      break;
                    }
                  }
                  if (rawChord) {
                    activeChord = { root: rawChord.root, type: rawChord.type === '' ? 'maj' : rawChord.type };
                  }
                }

                if (activeChord) {
                  const type = activeChord.type === '' ? 'maj' : activeChord.type;
                  const key = `${activeChord.root}${type}`;
                  let notes = CHORD_NOTES[key] ?? ['C3', 'E3', 'G3'];
                  if (track.type === 'bass') {
                    notes = shiftNotesOctave(notes, -2);
                  }
                  const time = this.startTime + (absBeat - this.startBeat) / (this.bpm / 60);
                  if (this.ctx && time >= this.ctx.currentTime && nodes.instrument) {
                    this.triggerStrum(nodes.instrument, notes, time, stroke, gs);
                  }
                }
              }
            }
          });
        }
      });
    });
  }

  triggerStrum(
    sampler: any,
    notes: string[],
    time: number,
    stroke: string,
    gs: { humanize: number; velocity: number }
  ) {
    if (!sampler) return;

    // Sort notes from low to high frequency
    const sortedNotes = [...notes].sort((a, b) => {
      return Tone.Frequency(a).toMidi() - Tone.Frequency(b).toMidi();
    });

    let notesToPlay = sortedNotes;
    if (stroke === 'U') {
      // Upstroke: sweep high to low
      notesToPlay = [...sortedNotes].reverse();
    }

    // Delay between strings (sweeping speed). ~25ms base
    const baseStrumDelay = 0.025;
    
    // Humanize sweep speed
    const humanizeOffset = (Math.random() - 0.5) * 0.01 * gs.humanize;
    const strumDelay = Math.max(0.008, baseStrumDelay + humanizeOffset);

    // Velocity scaling
    let velocity = gs.velocity / 127;
    if (stroke === 'A') {
      velocity = Math.min(1.0, velocity * 1.25); // Accent
    } else if (stroke === 'M') {
      velocity = velocity * 0.5; // Soft mute
    }

    notesToPlay.forEach((note, index) => {
      const noteDelay = index * strumDelay;
      const noteTime = time + noteDelay;
      const duration = stroke === 'M' ? '32n' : '2n';
      sampler.triggerAttackRelease(note, duration, noteTime, velocity);
    });
  }

  triggerTrackDrumHitAtTime(nodes: TrackNodes, instrument: string, time: number) {
    if (nodes.instrument && nodes.instrument.loaded) {
      if (instrument === 'kick') {
        nodes.instrument.triggerAttackRelease('C1', '8n', time);
      } else if (instrument === 'snare') {
        nodes.instrument.triggerAttackRelease('D1', '8n', time);
      } else if (instrument === 'hat-closed' || instrument === 'hat-open') {
        nodes.instrument.triggerAttackRelease('F#1', '8n', time);
      }
    } else {
      if (instrument === 'kick' && nodes.kick) {
        nodes.kick.triggerAttackRelease('C1', '8n', time);
      } else if (instrument === 'snare' && nodes.snare) {
        nodes.snare.triggerAttackRelease('16n', time);
      } else if ((instrument === 'hat-closed' || instrument === 'hat-open') && nodes.hihat) {
        nodes.hihat.triggerAttackRelease('32n', time);
      }
    }
  }

  play(tracks: Track[], startBeat: number, bpm: number) {
    const ctx = this.ensureContext();
    this.isPlaying = true;
    this.startTime = ctx.currentTime;
    this.startBeat = startBeat;
    this.lastScheduledBeat = startBeat;
    this.bpm = bpm;
    this.playAudioClips(tracks, startBeat, bpm);
    this.startScheduler(tracks);
    this.startPlayheadAnimation();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    this.stopAllSources();
    this.stopPlayheadAnimation();
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    this.stopAllSources();
    this.stopPlayheadAnimation();
    this.startBeat = 0;
    this.onPlayheadUpdate?.(0);
  }

  getCurrentBeat(): number {
    if (!this.ctx || !this.isPlaying) return this.startBeat;
    const elapsed = this.ctx.currentTime - this.startTime;
    return this.startBeat + elapsed * (this.bpm / 60);
  }

  get playing() { return this.isPlaying; }

  private startPlayheadAnimation() {
    const tick = () => {
      if (!this.isPlaying) return;
      this.onPlayheadUpdate?.(this.getCurrentBeat());
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopPlayheadAnimation() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // Load audio file into buffer
  async loadAudioFile(file: File): Promise<{ buffer: AudioBuffer; waveformData: Float32Array }> {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const waveformData = this.extractWaveform(buffer, 1000);
    return { buffer, waveformData };
  }

  extractWaveform(buffer: AudioBuffer, samples: number): Float32Array {
    const channel = buffer.getChannelData(0);
    const blockSize = Math.floor(channel.length / samples);
    const waveform = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(channel[start + j] ?? 0);
        if (v > max) max = v;
      }
      waveform[i] = max;
    }
    return waveform;
  }

  playStrumPattern(sampler: any, notes: string[], gs: any) {
    const bpm = this.bpm;
    const beatsPerSecond = bpm / 60;
    const strokeStep = 0.5; // 8-step pattern is 4 beats total (half a beat per step)
    const now = Tone.now();

    gs.strummingPattern.forEach((stroke: string, stepIdx: number) => {
      if (stroke === 'R') return; // rest
      
      const delayBeats = stepIdx * strokeStep;
      const delaySeconds = delayBeats / beatsPerSecond;
      const time = now + delaySeconds;
      
      this.triggerStrum(sampler, notes, time, stroke, gs);
    });
  }

  // Tone.js instrument playback helpers
  async playChord(notes: string[], duration: string = '2n', guitarType: string = 'acoustic') {
    await Tone.start();
    const selectedTrackId = useUIStore.getState().selectedTrackId;
    if (!selectedTrackId) return;
    
    const nodes = this.ensureTrackNodes(selectedTrackId);
    
    if (nodes && nodes.instrument) {
      if (nodes.instrument.loaded !== false) {
        const track = useProjectStore.getState().tracks.find(t => t.id === selectedTrackId);
        if (track && (track.type === 'guitar' || track.type === 'bass') && track.guitarSettings) {
          let notesToPlay = notes;
          if (track.type === 'bass') {
            notesToPlay = shiftNotesOctave(notes, -2);
          }
          this.playStrumPattern(nodes.instrument, notesToPlay, track.guitarSettings);
        } else {
          nodes.instrument.triggerAttackRelease(notes, duration);
        }
      }
    } else {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: guitarType === 'electric-distorted' ? 'sawtooth' : 'triangle' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 1.2 },
      }).toDestination();
      synth.triggerAttackRelease(notes, duration);
      setTimeout(() => synth.dispose(), 3000);
    }
  }

  async playDrumHit(instrument: string) {
    await Tone.start();
    const selectedTrackId = useUIStore.getState().selectedTrackId;
    if (!selectedTrackId) return;

    const nodes = this.ensureTrackNodes(selectedTrackId);

    if (nodes) {
      this.triggerTrackDrumHitAtTime(nodes, instrument, Tone.now());
    } else {
      if (instrument === 'kick') {
        const kick = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4 }).toDestination();
        kick.triggerAttackRelease('C1', '8n');
        setTimeout(() => kick.dispose(), 500);
      } else if (instrument === 'snare') {
        const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).toDestination();
        snare.triggerAttackRelease('16n');
        setTimeout(() => snare.dispose(), 500);
      } else {
        const hihat = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).toDestination();
        hihat.triggerAttackRelease('32n');
        setTimeout(() => hihat.dispose(), 500);
      }
    }
  }

  async playNote(note: string, duration: string = '4n') {
    await Tone.start();
    const selectedTrackId = useUIStore.getState().selectedTrackId;
    if (!selectedTrackId) return;

    const nodes = this.ensureTrackNodes(selectedTrackId);

    if (nodes && nodes.instrument) {
      if (nodes.instrument.loaded !== false) {
        nodes.instrument.triggerAttackRelease(note, duration);
      }
    } else {
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 },
      }).toDestination();
      synth.triggerAttackRelease(note, duration);
      setTimeout(() => synth.dispose(), 2000);
    }
  }

  dispose() {
    this.stopAllSources();
    this.stopPlayheadAnimation();
    this.trackNodes.clear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const audioEngine = AudioEngine.getInstance();
