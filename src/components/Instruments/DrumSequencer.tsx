import React, { useState } from 'react';
import type { Track } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
import { audioEngine } from '../../engine/AudioEngine';
import { Play, RefreshCw } from 'lucide-react';
import './DrumSequencer.css';

const KITS = ['acoustic', 'studio', 'rock', 'pop', 'electronic', 'lofi'] as const;

const VELOCITY_COLORS: Record<number, string> = {};
for (let i = 0; i <= 127; i++) {
  const t = i / 127;
  const r = Math.round(37 + t * (99 - 37));
  const g = Math.round(99 + t * (235 - 99));
  const b = Math.round(235 + t * (55 - 235));
  VELOCITY_COLORS[i] = `rgb(${r},${g},${b})`;
}

function velocityColor(v: number) {
  if (v > 100) return '#60a5fa';
  if (v > 70) return '#34d399';
  if (v > 40) return '#fbbf24';
  return '#f87171';
}

interface Props { track: Track; }

export function DrumSequencer({ track }: Props) {
  const { updateDrumPattern, toggleDrumHit } = useProjectStore();
  const pattern = track.drumPattern;
  const [isPlaying, setIsPlaying] = useState(false);

  if (!pattern) return <div className="no-settings">No drum pattern available. Select a drum track.</div>;

  const handleHitToggle = async (instrument: string, step: number) => {
    const hasHit = pattern.tracks.find(t => t.instrument === instrument)?.hits.find(h => h.step === step);
    if (!hasHit) {
      // Play sound on add
      await audioEngine.playDrumHit(instrument);
    }
    toggleDrumHit(track.id, instrument, step);
  };

  const clearPattern = () => {
    updateDrumPattern(track.id, {
      tracks: pattern.tracks.map(dt => ({ ...dt, hits: [] }))
    });
  };

  const steps = pattern.steps;
  const stepLabels = Array.from({ length: steps }, (_, i) => {
    const beat = Math.floor(i / 4) + 1;
    const sub = ['1', 'e', '&', 'a'][i % 4];
    return i % 4 === 0 ? `${beat}` : (i % 2 === 0 ? '&' : '');
  });

  return (
    <div className="drum-sequencer">
      {/* Header */}
      <div className="drum-header">
        <div className="drum-kit-select">
          <span className="section-title" style={{ marginBottom: 0, marginRight: 6 }}>KIT</span>
          {KITS.map(k => (
            <button
              key={k}
              className={`drum-kit-btn ${pattern.kit === k ? 'active' : ''}`}
              onClick={() => updateDrumPattern(track.id, { kit: k })}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <div className="drum-header-actions">
          <select
            className="snap-select"
            value={steps}
            onChange={e => updateDrumPattern(track.id, { steps: Number(e.target.value) as 16 | 32 })}
          >
            <option value={16}>16 steps</option>
            <option value={32}>32 steps</option>
          </select>
          <button className="btn-icon" data-tooltip="Clear pattern" onClick={clearPattern}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="drum-grid-container">
        {/* Step labels */}
        <div className="drum-grid-row step-labels-row">
          <div className="drum-instrument-label" />
          {Array.from({ length: steps }, (_, i) => (
            <div key={i} className={`step-label ${i % 4 === 0 ? 'beat-label' : ''}`}>
              {stepLabels[i]}
            </div>
          ))}
        </div>

        {/* Drum rows */}
        {pattern.tracks.map(dt => {
          const hitSet = new Set(dt.hits.map(h => h.step));
          const velMap: Record<number, number> = {};
          dt.hits.forEach(h => { velMap[h.step] = h.velocity; });

          return (
            <div key={dt.instrument} className="drum-grid-row">
              <div
                className="drum-instrument-label"
                onClick={() => audioEngine.playDrumHit(dt.instrument)}
                title={`Preview ${dt.label}`}
              >
                {dt.label}
              </div>
              {Array.from({ length: steps }, (_, step) => {
                const active = hitSet.has(step);
                const vel = velMap[step] ?? 100;
                const isbeat = step % 4 === 0;
                const ishalf = step % 8 === 0;
                return (
                  <button
                    key={step}
                    className={`drum-step ${active ? 'active' : ''} ${isbeat ? 'on-beat' : ''} ${ishalf ? 'on-half' : ''}`}
                    style={active ? { background: velocityColor(vel), borderColor: velocityColor(vel) } : {}}
                    onClick={() => handleHitToggle(dt.instrument, step)}
                    title={active ? `Step ${step + 1} — vel: ${vel}` : `Add hit at step ${step + 1}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
