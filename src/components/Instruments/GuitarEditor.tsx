import React, { useState } from 'react';
import type { Track, ChordDef, StrokeType } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
import { audioEngine } from '../../engine/AudioEngine';
import { Play, Trash2, RefreshCw, Layers, Shuffle } from 'lucide-react';
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

const BEAT_LABELS = ['1', '\u0026', '2', '\u0026', '3', '\u0026', '4', '\u0026'];
const STROKE_DISPLAY: Record<StrokeType, string> = { D: '\u2193', U: '\u2191', R: '\u00B7', A: '\u2193!', M: 'M' };
const STROKE_ORDER: StrokeType[] = ['D', 'U', 'R', 'A', 'M'];

interface Props { track: Track; }

export function GuitarEditor({ track }: Props) {
  const { updateGuitarSettings, updateChordStrumming } = useProjectStore();
  const gs = track.guitarSettings;

  // -1 = global (no chord selected), >= 0 = editing that chord's strumming
  const [selectedChordIdx, setSelectedChordIdx] = useState<number>(-1);
  const [selectedPreset, setSelectedPreset] = useState<string>('Pop');

  if (!gs) return <div className="no-settings">No guitar settings available</div>;

  // Effective pattern: per-chord if set, otherwise global
  const effectivePattern = (chordIdx: number): StrokeType[] =>
    gs.chords[chordIdx]?.strummingPattern ?? gs.strummingPattern;

  // Active pattern being edited in strumming section
  const isGlobal = selectedChordIdx === -1;
  const activePattern: StrokeType[] = isGlobal
    ? gs.strummingPattern
    : effectivePattern(selectedChordIdx);

  const diagramChord = isGlobal ? gs.chords[0] : gs.chords[selectedChordIdx];
  const diagramKey = diagramChord
    ? `${diagramChord.root}${diagramChord.type === '' ? 'maj' : diagramChord.type}`
    : 'Cmaj';
  const strings = track.type === 'bass' ? ['E', 'A', 'D', 'G'] : ['E', 'A', 'D', 'G', 'B', 'e'];
  const fullDiagram = CHORD_DIAGRAMS[diagramKey] ?? [0, 0, 0, 0, 0, 0];
  const diagram = track.type === 'bass' ? fullDiagram.slice(0, 4) : fullDiagram;

  const playChord = async (chord: ChordDef) => {
    const typeKey = chord.type === '' || chord.type === 'maj' ? 'maj' : chord.type;
    const key = `${chord.root}${typeKey}`;
    const notes = CHORD_NOTES[key] ?? ['C3', 'E3', 'G3'];
    await audioEngine.playChord(notes, '2n', gs.guitarType, chord.strummingPattern);
  };

  const addChord = (root: string, type: string) => {
    updateGuitarSettings(track.id, {
      chords: [...gs.chords, { root, type: type === 'maj' ? '' : type, duration: 4 }]
    });
  };

  const removeChord = (index: number) => {
    const newChords = gs.chords.filter((_, i) => i !== index);
    updateGuitarSettings(track.id, { chords: newChords });
    if (selectedChordIdx >= newChords.length) setSelectedChordIdx(newChords.length - 1);
  };

  const updateChordDuration = (index: number, dur: number) => {
    const chords = gs.chords.map((c, i) => i === index ? { ...c, duration: dur } : c);
    updateGuitarSettings(track.id, { chords });
  };

  const toggleStroke = (strokeIdx: number) => {
    const pattern = [...activePattern];
    const current = pattern[strokeIdx];
    const next = STROKE_ORDER[(STROKE_ORDER.indexOf(current) + 1) % STROKE_ORDER.length];
    pattern[strokeIdx] = next;
    if (isGlobal) {
      updateGuitarSettings(track.id, { strummingPattern: pattern });
    } else {
      updateChordStrumming(track.id, selectedChordIdx, pattern);
    }
  };

  const applyPreset = (preset: string) => {
    setSelectedPreset(preset);
    const pattern = STRUMMING_PRESETS[preset];
    if (isGlobal) {
      updateGuitarSettings(track.id, { strummingPattern: pattern });
    } else {
      updateChordStrumming(track.id, selectedChordIdx, [...pattern]);
    }
  };

  const resetToGlobal = () => {
    if (!isGlobal) updateChordStrumming(track.id, selectedChordIdx, undefined);
  };

  const hasCustomPattern = !isGlobal && !!gs.chords[selectedChordIdx]?.strummingPattern;

  const activeChord = !isGlobal ? gs.chords[selectedChordIdx] : null;
  const strumSectionTitle = isGlobal
    ? 'STRUMMING PATTERN â€” Global'
    : `STRUMMING â€” ${activeChord?.root}${activeChord?.type || 'maj'}${hasCustomPattern ? ' âœ¦ Custom' : ' (global)'}`;

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
                      <span className="fret-x">Ã—</span>
                    ) : diagram[i] === 0 ? (
                      <span className="fret-open">â—‹</span>
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
            {gs.chords.map((chord, i) => {
              const hasOwn = !!chord.strummingPattern;
              const isSelected = selectedChordIdx === i;
              return (
                <div
                  key={i}
                  className={`chord-chip${isSelected ? ' selected' : ''}${hasOwn ? ' has-custom' : ''}`}
                  draggable
                  onClick={() => setSelectedChordIdx(isSelected ? -1 : i)}
                  title={hasOwn ? 'Custom strumming â€” click to edit' : 'Click to add per-chord strumming'}
                  onDragStart={(e) => {
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select')) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'chord',
                      root: chord.root,
                      chordType: chord.type,
                      strummingPattern: chord.strummingPattern
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <button
                    className="chord-play"
                    onClick={(e) => { e.stopPropagation(); playChord(chord); }}
                    title="Preview chord"
                  >
                    <Play size={9} />
                  </button>
                  <div className="chord-chip-info">
                    <span className="chord-name">{chord.root}{chord.type || 'maj'}</span>
                    {/* Mini strumming preview */}
                    <div className="chord-strum-mini">
                      {effectivePattern(i).slice(0, 4).map((s, si) => (
                        <span key={si} className={`mini-stroke mini-${s.toLowerCase()}`}>
                          {STROKE_DISPLAY[s]}
                        </span>
                      ))}
                      {hasOwn && <span className="chord-custom-badge">âœ¦</span>}
                    </div>
                  </div>
                  <select
                    className="chord-dur"
                    value={chord.duration}
                    onChange={e => { e.stopPropagation(); updateChordDuration(i, Number(e.target.value)); }}
                    onClick={e => e.stopPropagation()}
                    title="Duration (beats)"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                  </select>
                  <button className="chord-remove" onClick={(e) => { e.stopPropagation(); removeChord(i); }}>
                    <Trash2 size={9} />
                  </button>
                </div>
              );
            })}
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
                    type: 'chord', root: c.root, chordType: c.type === 'maj' ? '' : c.type
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
        <div className="strumming-section-header">
          <div className="section-title">{strumSectionTitle}</div>
          <div className="strumming-section-actions">
            <button
              className={`btn${isGlobal ? ' active' : ''}`}
              style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
              onClick={() => setSelectedChordIdx(-1)}
              title="Edit global strumming pattern"
            >
              <Shuffle size={9} /> Global
            </button>
            {!isGlobal && (
              hasCustomPattern ? (
                <button
                  className="btn"
                  title="Reset to global strumming pattern"
                  onClick={resetToGlobal}
                  style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <RefreshCw size={9} /> Use Global
                </button>
              ) : (
                <button
                  className="btn strum-custom-btn"
                  title="Create a custom strumming for this chord"
                  onClick={() => updateChordStrumming(track.id, selectedChordIdx, [...gs.strummingPattern])}
                  style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <Layers size={9} /> Make Custom
                </button>
              )
            )}
          </div>
        </div>

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
              {BEAT_LABELS.map((b, i) => (
                <span key={i} className="strum-beat-label">{b}</span>
              ))}
            </div>
            <div className="strum-strokes">
              {activePattern.map((stroke, i) => (
                <button
                  key={i}
                  className={`strum-btn stroke-${stroke.toLowerCase()}`}
                  onClick={() => toggleStroke(i)}
                  title={`Click to change (current: ${stroke})`}
                >
                  {STROKE_DISPLAY[stroke]}
                </button>
              ))}
            </div>
          </div>

          {/* Global params */}
          {isGlobal && (
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
          )}

          {/* Per-chord hint when using global */}
          {!isGlobal && !hasCustomPattern && (
            <div className="strum-hint">
              <span>This chord uses the <strong>global</strong> pattern. Click <em>Make Custom</em> to give it its own strumming.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
