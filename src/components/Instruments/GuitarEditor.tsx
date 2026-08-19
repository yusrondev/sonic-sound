import React, { useState } from 'react';
import type { Track, ChordDef, StrokeType } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
import { audioEngine } from '../../engine/AudioEngine';
import { Play, Plus, Trash2, RefreshCw } from 'lucide-react';
import './GuitarEditor.css';

const GUITAR_TYPES = [
  { value: 'acoustic', label: 'Acoustic' },
  { value: 'electric-clean', label: 'Electric Clean' },
  { value: 'electric-distorted', label: 'Electric Distorted' },
  { value: 'solo', label: 'Lead/Solo' },
  { value: 'string', label: 'String Guitar' },
  { value: 'bass', label: 'Bass Guitar' },
] as const;

const CHORDS: Array<{ root: string; type: string; label: string }> = [
  { root: 'C', type: 'maj', label: 'C' }, { root: 'C', type: 'm', label: 'Cm' },
  { root: 'C', type: '7', label: 'C7' }, { root: 'C', type: 'maj7', label: 'Cmaj7' },
  { root: 'D', type: 'maj', label: 'D' }, { root: 'D', type: 'm', label: 'Dm' },
  { root: 'D', type: '7', label: 'D7' },
  { root: 'E', type: 'maj', label: 'E' }, { root: 'E', type: 'm', label: 'Em' },
  { root: 'E', type: '7', label: 'E7' },
  { root: 'F', type: 'maj', label: 'F' }, { root: 'F', type: 'm', label: 'Fm' },
  { root: 'G', type: 'maj', label: 'G' }, { root: 'G', type: 'm', label: 'Gm' },
  { root: 'G', type: '7', label: 'G7' },
  { root: 'A', type: 'maj', label: 'A' }, { root: 'A', type: 'm', label: 'Am' },
  { root: 'A', type: '7', label: 'A7' },
  { root: 'B', type: 'maj', label: 'B' }, { root: 'B', type: 'm', label: 'Bm' },
];

const STRUMMING_PRESETS: Record<string, StrokeType[]> = {
  Basic: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'],
  Pop: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'],
  Rock: ['D', 'D', 'U', 'D', 'D', 'U', 'D', 'U'],
  Ballad: ['D', 'R', 'U', 'R', 'D', 'R', 'U', 'R'],
  Reggae: ['R', 'U', 'R', 'U', 'R', 'U', 'R', 'U'],
  Acoustic: ['D', 'U', 'U', 'D', 'U', 'R', 'D', 'U'],
};

// Chord note mappings (MIDI)
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

// Chord diagrams (fret positions for each string E A D G B e)
const CHORD_DIAGRAMS: Record<string, (number | 'x')[]> = {
  'Cmaj': ['x', 3, 2, 0, 1, 0], 'Cmaj7': ['x', 3, 2, 0, 0, 0],
  'Dm': ['x', 'x', 0, 2, 3, 1], 'Dmaj': ['x', 'x', 0, 2, 3, 2],
  'Em': [0, 2, 2, 0, 0, 0], 'Emaj': [0, 2, 2, 1, 0, 0],
  'Fmaj': [1, 1, 2, 3, 3, 1], 'Fm': [1, 1, 1, 3, 3, 1],
  'Gmaj': [3, 2, 0, 0, 0, 3], 'Gm': [3, 1, 0, 0, 3, 3],
  'Amaj': ['x', 0, 2, 2, 2, 0], 'Am': ['x', 0, 2, 2, 1, 0],
  'Bmaj': ['x', 2, 4, 4, 4, 2], 'Bm': ['x', 2, 4, 4, 3, 2],
};

interface Props { track: Track; }

export function GuitarEditor({ track }: Props) {
  const { updateGuitarSettings } = useProjectStore();
  const gs = track.guitarSettings;
  const [selectedPreset, setSelectedPreset] = useState<string>('Pop');

  if (!gs) return <div className="no-settings">No guitar settings available</div>;

  const playChord = async (chord: ChordDef) => {
    const typeKey = chord.type === '' || chord.type === 'maj' ? 'maj' : chord.type;
    const key = `${chord.root}${typeKey}`;
    const notes = CHORD_NOTES[key] ?? ['C3', 'E3', 'G3'];
    await audioEngine.playChord(notes, '2n', gs.guitarType);
  };

  const addChord = (root: string, type: string) => {
    updateGuitarSettings(track.id, {
      chords: [...gs.chords, { root, type: type === 'maj' ? '' : type, duration: 4 }]
    });
  };

  const removeChord = (index: number) => {
    updateGuitarSettings(track.id, { chords: gs.chords.filter((_, i) => i !== index) });
  };

  const updateChordDuration = (index: number, dur: number) => {
    const chords = gs.chords.map((c, i) => i === index ? { ...c, duration: dur } : c);
    updateGuitarSettings(track.id, { chords });
  };

  const applyPreset = (preset: string) => {
    setSelectedPreset(preset);
    updateGuitarSettings(track.id, { strummingPattern: STRUMMING_PRESETS[preset] });
  };

  const toggleStroke = (index: number) => {
    const pattern = [...gs.strummingPattern];
    const order: StrokeType[] = ['D', 'U', 'R', 'A', 'M'];
    const current = pattern[index];
    const next = order[(order.indexOf(current) + 1) % order.length];
    pattern[index] = next;
    updateGuitarSettings(track.id, { strummingPattern: pattern });
  };

  // Get chord diagram
  const selectedChord = gs.chords[0];
  const diagramKey = selectedChord ? `${selectedChord.root}${selectedChord.type === '' ? 'maj' : selectedChord.type}` : 'Cmaj';
  const strings = track.type === 'bass' ? ['E', 'A', 'D', 'G'] : ['E', 'A', 'D', 'G', 'B', 'e'];
  const fullDiagram = CHORD_DIAGRAMS[diagramKey] ?? [0, 0, 0, 0, 0, 0];
  const diagram = track.type === 'bass' ? fullDiagram.slice(0, 4) : fullDiagram;

  return (
    <div className="guitar-editor">
      {/* Guitar Type Selection (hidden for bass) */}
      {track.type !== 'bass' && (
        <section className="guitar-section">
          <div className="section-title">GUITAR TYPE</div>
          <div className="guitar-types">
            {GUITAR_TYPES.map(t => (
              <button
                key={t.value}
                className={`guitar-type-btn ${gs.guitarType === t.value ? 'active' : ''}`}
                onClick={() => {
                  updateGuitarSettings(track.id, { guitarType: t.value as any });
                  audioEngine.reinitializeInstrument(track.id);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Chord Diagram + Progression */}
      <div className="guitar-main">
        {/* Chord Diagram */}
        <section className="guitar-section chord-diagram-section">
          <div className="section-title">CHORD DIAGRAM</div>
          <div className="chord-diagram">
            <div className="chord-diagram-name">{diagramKey.replace('maj', '')}</div>
            <div className="chord-fretboard">
              {strings.map((s, i) => (
                <div key={s} className="chord-string-row">
                  <span className="string-label">{s}</span>
                  <div className="fret-dots">
                    {diagram[i] === 'x' ? (
                      <span className="fret-x">×</span>
                    ) : diagram[i] === 0 ? (
                      <span className="fret-open">○</span>
                    ) : (
                      [1, 2, 3, 4].map(fret => (
                        <div key={fret} className={`fret-cell ${diagram[i] === fret ? 'active' : ''}`} />
                      ))
                    )}
                  </div>
                  <span className="fret-num">{diagram[i] === 'x' ? 'X' : diagram[i] === 0 ? '0' : diagram[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Chord Progression */}
        <section className="guitar-section progression-section">
          <div className="section-title">CHORD PROGRESSION</div>
          <div className="chord-progression">
            {gs.chords.map((chord, i) => (
              <div 
                key={i} 
                className="chord-chip"
                draggable
                onDragStart={(e) => {
                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select')) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'chord',
                    root: chord.root,
                    chordType: chord.type
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                title="Drag chord to timeline track"
              >
                <button
                  className="chord-play"
                  onClick={() => playChord(chord)}
                  title="Preview chord"
                >
                  <Play size={9} />
                </button>
                <span className="chord-name">{chord.root}{chord.type || 'maj'}</span>
                <select
                  className="chord-dur"
                  value={chord.duration}
                  onChange={e => updateChordDuration(i, Number(e.target.value))}
                  title="Duration (beats)"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                </select>
                <button className="chord-remove" onClick={() => removeChord(i)}><Trash2 size={9} /></button>
              </div>
            ))}
          </div>

          {/* Chord picker */}
          <div className="chord-picker">
            {CHORDS.map(c => (
              <button
                key={`${c.root}${c.type}`}
                className="chord-pick-btn"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'chord',
                    root: c.root,
                    chordType: c.type === 'maj' ? '' : c.type
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addChord(c.root, c.type === 'maj' ? '' : c.type)}
                title="Click to add to progression, or Drag to timeline track"
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Strumming Pattern */}
      <section className="guitar-section strumming-section">
        <div className="section-title">STRUMMING PATTERN</div>
        <div className="strumming-area">
          {/* Presets */}
          <div className="strum-presets">
            {Object.keys(STRUMMING_PRESETS).map(preset => (
              <button
                key={preset}
                className={`btn ${selectedPreset === preset ? 'active' : ''}`}
                style={{ fontSize: 11 }}
                onClick={() => applyPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Pattern editor */}
          <div className="strum-pattern">
            <div className="strum-beats">
              {['1', '&', '2', '&', '3', '&', '4', '&'].map((b, i) => (
                <span key={i} className="strum-beat-label">{b}</span>
              ))}
            </div>
            <div className="strum-strokes">
              {gs.strummingPattern.map((stroke, i) => (
                <button
                  key={i}
                  className={`strum-btn stroke-${stroke.toLowerCase()}`}
                  onClick={() => toggleStroke(i)}
                  title={`Click to change (current: ${stroke})`}
                >
                  {stroke === 'D' ? '↓' : stroke === 'U' ? '↑' : stroke === 'R' ? '·' : stroke === 'A' ? '↓!' : 'M'}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="strum-params">
            <div className="control-row">
              <span className="control-label">HMNZ</span>
              <input type="range" min={0} max={1} step={0.01} value={gs.humanize}
                onChange={e => updateGuitarSettings(track.id, { humanize: Number(e.target.value) })} />
              <span className="control-value">{Math.round(gs.humanize * 100)}%</span>
            </div>
            <div className="control-row">
              <span className="control-label">SWNG</span>
              <input type="range" min={0} max={1} step={0.01} value={gs.swing}
                onChange={e => updateGuitarSettings(track.id, { swing: Number(e.target.value) })} />
              <span className="control-value">{Math.round(gs.swing * 100)}%</span>
            </div>
            <div className="control-row">
              <span className="control-label">VEL</span>
              <input type="range" min={1} max={127} step={1} value={gs.velocity}
                onChange={e => updateGuitarSettings(track.id, { velocity: Number(e.target.value) })} />
              <span className="control-value">{gs.velocity}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
