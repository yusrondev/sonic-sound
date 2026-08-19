import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SkipBack, Play, Pause, Square, Circle, Repeat,
  Volume2, ChevronUp, ChevronDown
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { audioEngine } from '../../engine/AudioEngine';
import './TransportBar.css';

export function TransportBar() {
  const bpm = useProjectStore(s => s.bpm);
  const setBpm = useProjectStore(s => s.setBpm);
  const timeSignature = useProjectStore(s => s.timeSignature);
  const tracks = useProjectStore(s => s.tracks);
  const key = useProjectStore(s => s.key);

  const playheadBeat = useUIStore(s => s.playheadBeat);
  const setPlayheadBeat = useUIStore(s => s.setPlayheadBeat);
  const loopEnabled = useUIStore(s => s.loopEnabled);
  const setLoopEnabled = useUIStore(s => s.setLoopEnabled);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [editingBpm, setEditingBpm] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);

  // Wire audio engine callbacks
  useEffect(() => {
    audioEngine.onPlayheadUpdate = (beat) => setPlayheadBeat(beat);
    audioEngine.onPlaybackEnd = () => setIsPlaying(false);
    return () => {
      audioEngine.onPlayheadUpdate = undefined;
      audioEngine.onPlaybackEnd = undefined;
    };
  }, [setPlayheadBeat]);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play(tracks, playheadBeat, bpm);
      setIsPlaying(true);
    }
  }, [isPlaying, tracks, playheadBeat, bpm]);

  const handleStop = useCallback(() => {
    audioEngine.stop();
    setIsPlaying(false);
    setPlayheadBeat(0);
  }, [setPlayheadBeat]);

  const handleRewind = useCallback(() => {
    if (!isPlaying) {
      setPlayheadBeat(0);
    } else {
      audioEngine.stop();
      setIsPlaying(false);
      setPlayheadBeat(0);
    }
  }, [isPlaying, setPlayheadBeat]);

  const handleRecord = useCallback(() => {
    setIsRecording(r => !r);
  }, []);

  // Tap tempo
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    const times = [...tapTimes, now].slice(-6);
    setTapTimes(times);
    if (times.length >= 2) {
      const diffs = times.slice(1).map((t, i) => t - times[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const newBpm = Math.round(60000 / avg);
      setBpm(Math.max(40, Math.min(240, newBpm)));
    }
  }, [tapTimes, setBpm]);

  // Format position as BAR:BEAT
  const beatsPerBar = timeSignature[0];
  const totalBeats = Math.max(0, playheadBeat);
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  const ticks = Math.floor((totalBeats % 1) * 100);
  const posDisplay = `${String(bar).padStart(3, '0')}:${beat}:${String(ticks).padStart(2, '0')}`;

  // Time display
  const seconds = (playheadBeat / bpm) * 60;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  const timeDisplay = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

  return (
    <div className="transport">
      {/* Rewind / Play / Stop / Record */}
      <div className="transport-controls">
        <button className="btn-transport" data-tooltip="Rewind (Home)" onClick={handleRewind}>
          <SkipBack size={14} />
        </button>
        <button
          className={`btn-transport play ${isPlaying ? 'playing' : ''}`}
          data-tooltip={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          onClick={handlePlay}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="btn-transport" data-tooltip="Stop (Space)" onClick={handleStop}>
          <Square size={14} />
        </button>
        <button
          className={`btn-transport record ${isRecording ? 'active' : ''}`}
          data-tooltip="Record (R)"
          onClick={handleRecord}
        >
          <Circle size={14} className={isRecording ? 'recording-pulse' : ''} />
        </button>
      </div>

      <div className="sep-v" style={{ height: 30, margin: '0 8px' }} />

      {/* BPM Control */}
      <div className="transport-bpm">
        <span className="transport-label">BPM</span>
        {editingBpm ? (
          <input
            ref={bpmInputRef}
            className="bpm-input"
            type="number"
            defaultValue={bpm}
            min={20} max={300}
            autoFocus
            onBlur={e => { setBpm(Number(e.target.value)); setEditingBpm(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { setBpm(Number(e.currentTarget.value)); setEditingBpm(false); }
              if (e.key === 'Escape') setEditingBpm(false);
            }}
          />
        ) : (
          <span className="bpm-display" onClick={() => setEditingBpm(true)} title="Click to edit BPM">
            {bpm}
          </span>
        )}
        <div className="bpm-arrows">
          <button className="bpm-arrow" onClick={() => setBpm(bpm + 1)}><ChevronUp size={10} /></button>
          <button className="bpm-arrow" onClick={() => setBpm(bpm - 1)}><ChevronDown size={10} /></button>
        </div>
      </div>

      {/* Tap Tempo */}
      <button className="btn tap-btn" onClick={handleTapTempo} data-tooltip="Tap Tempo">TAP</button>

      <div className="sep-v" style={{ height: 30, margin: '0 8px' }} />

      {/* Time Signature */}
      <div className="transport-section">
        <span className="transport-label">SIG</span>
        <span className="transport-value font-mono">{timeSignature[0]}/{timeSignature[1]}</span>
      </div>

      {/* Key */}
      <div className="transport-section">
        <span className="transport-label">KEY</span>
        <span className="transport-value">{key}</span>
      </div>

      <div className="sep-v" style={{ height: 30, margin: '0 8px' }} />

      {/* Position Display */}
      <div className="transport-position">
        <span className="position-bars font-mono">{posDisplay}</span>
        <span className="position-time font-mono">{timeDisplay}</span>
      </div>

      <div className="sep-v" style={{ height: 30, margin: '0 8px' }} />

      {/* Loop + Metronome */}
      <div className="transport-options">
        <button
          className={`btn-icon ${loopEnabled ? 'active' : ''}`}
          data-tooltip="Loop (L)"
          onClick={() => setLoopEnabled(!loopEnabled)}
        >
          <Repeat size={13} />
        </button>
        <button
          className={`btn-icon ${metronome ? 'active' : ''}`}
          data-tooltip="Metronome"
          onClick={() => setMetronome(m => !m)}
        >
          <span style={{ fontSize: 11, fontWeight: 600 }}>♩</span>
        </button>
      </div>

      {/* Status indicator */}
      <div className="transport-status">
        {isPlaying && <div className="status-dot playing" />}
        {isRecording && <div className="status-dot recording recording-pulse" />}
      </div>
    </div>
  );
}
