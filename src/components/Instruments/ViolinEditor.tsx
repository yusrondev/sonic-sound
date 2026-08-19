import React from 'react';
import type { Track } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
import './ViolinEditor.css';

const VIOLIN_TYPES = ['Violin', 'Solo Violin', 'String Ensemble'];

interface Props { track: Track; }

export function ViolinEditor({ track }: Props) {
  const { updateTrackFX, updateTrack } = useProjectStore();
  const fx = track.fx;

  return (
    <div className="violin-editor">
      <section className="violin-section">
        <div className="section-title">VIOLIN TYPE</div>
        <div className="violin-types">
          {VIOLIN_TYPES.map(t => (
            <button key={t} className={`guitar-type-btn ${track.name.includes(t) ? 'active' : ''}`}
              onClick={() => updateTrack(track.id, { name: t })}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="violin-section">
        <div className="section-title">ARTICULATION</div>
        {['Legato', 'Staccato', 'Pizzicato', 'Tremolo', 'Col Legno'].map(a => (
          <button key={a} className="articulation-btn">{a}</button>
        ))}
      </section>

      <section className="violin-section">
        <div className="section-title">EXPRESSION</div>
        <div className="violin-params">
          {[
            { label: 'Volume', param: 'volume', min: 0, max: 1, step: 0.01, value: track.volume },
            { label: 'Attack', param: 'attack', min: 0, max: 2, step: 0.01, value: 0.05 },
            { label: 'Release', param: 'release', min: 0, max: 4, step: 0.01, value: 0.8 },
            { label: 'Vibrato', param: 'vibrato', min: 0, max: 1, step: 0.01, value: 0.3 },
            { label: 'Reverb', param: 'reverb', min: 0, max: 1, step: 0.01, value: 0.4 },
          ].map(p => (
            <div key={p.label} className="control-row">
              <span className="control-label">{p.label.toUpperCase().slice(0, 4)}</span>
              <input type="range" min={p.min} max={p.max} step={p.step} defaultValue={p.value}
                className="violin-slider" />
              <span className="control-value">{Math.round(p.value * 100)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="violin-section">
        <div className="section-title">REVERB</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['None', 'Room', 'Hall', 'Cathedral', 'Plate'].map(r => (
            <button key={r} className={`guitar-type-btn ${r === 'Hall' ? 'active' : ''}`}>{r}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
