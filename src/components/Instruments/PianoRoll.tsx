import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { Track, PianoNote } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
import { audioEngine } from '../../engine/AudioEngine';
import './PianoRoll.css';

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TOTAL_PITCHES = 88; // Piano range
const BASE_PITCH = 21; // A0
const NOTE_HEIGHT = 10;
const BEAT_WIDTH = 40;
const KEYBOARD_WIDTH = 48;

function pitchToLabel(pitch: number): string {
  const note = NOTE_LABELS[(pitch - 12) % 12];
  const octave = Math.floor((pitch - 12) / 12);
  return `${note}${octave}`;
}

function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes((pitch - 12) % 12);
}

interface Props { track: Track; }

export function PianoRoll({ track }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addPianoNote, removePianoNote } = useProjectStore();
  const notes = track.pianoNotes ?? [];
  const [zoom, setZoom] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalBars = 16;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#0e0f11';
    ctx.fillRect(0, 0, W, H);

    const beatW = BEAT_WIDTH * zoom;
    const startPitch = BASE_PITCH + Math.floor(scrollTop / NOTE_HEIGHT);
    const visiblePitches = Math.ceil(H / NOTE_HEIGHT) + 1;

    // Draw grid
    for (let row = 0; row < visiblePitches; row++) {
      const pitch = BASE_PITCH + TOTAL_PITCHES - 1 - (Math.floor(scrollTop / NOTE_HEIGHT) + row);
      const y = row * NOTE_HEIGHT;
      ctx.fillStyle = isBlackKey(pitch) ? '#111318' : '#131519';
      ctx.fillRect(0, y, W, NOTE_HEIGHT);

      // Horizontal line
      ctx.strokeStyle = '#1a1c20';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, y + NOTE_HEIGHT - 0.5); ctx.lineTo(W, y + NOTE_HEIGHT - 0.5); ctx.stroke();

      // C highlight
      if ((pitch - 12) % 12 === 0) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.fillRect(0, y, W, NOTE_HEIGHT);
        ctx.fillStyle = '#555869';
        ctx.font = '7px Inter, sans-serif';
        ctx.fillText(pitchToLabel(pitch), 2, y + 8);
      }
    }

    // Beat lines
    for (let beat = 0; beat <= totalBars * 4; beat++) {
      const x = beat * beatW - scrollLeft;
      ctx.strokeStyle = beat % 4 === 0 ? '#2a2d35' : '#1a1c20';
      ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }

    // Draw notes
    notes.forEach(note => {
      const row = BASE_PITCH + TOTAL_PITCHES - 1 - note.pitch;
      const y = row * NOTE_HEIGHT - scrollTop;
      const x = note.startBar * beatW - scrollLeft;
      const w = note.durationBars * beatW - 2;
      const h = NOTE_HEIGHT - 1;

      if (y + h < 0 || y > H || x + w < 0 || x > W) return;

      const alpha = note.velocity / 127;
      ctx.fillStyle = `rgba(37, 99, 235, ${0.5 + alpha * 0.5})`;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(4, w), h, 2);
      ctx.fill();

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (w > 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '8px Inter, sans-serif';
        ctx.fillText(pitchToLabel(note.pitch), x + 2, y + 8);
      }
    });
  }, [notes, zoom, scrollLeft, scrollTop]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        draw();
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;
    const beat = x / (BEAT_WIDTH * zoom);
    const row = Math.floor(y / NOTE_HEIGHT);
    const pitch = BASE_PITCH + TOTAL_PITCHES - 1 - row;

    if (e.button === 2) {
      // Right click → remove
      const idx = notes.findIndex(n => {
        const nx = n.startBar * BEAT_WIDTH * zoom - scrollLeft;
        const ny = (BASE_PITCH + TOTAL_PITCHES - 1 - n.pitch) * NOTE_HEIGHT - scrollTop;
        return e.clientX - rect.left >= nx && e.clientX - rect.left <= nx + n.durationBars * BEAT_WIDTH * zoom
          && e.clientY - rect.top >= ny && e.clientY - rect.top <= ny + NOTE_HEIGHT;
      });
      if (idx >= 0) removePianoNote(track.id, idx);
      return;
    }

    // Add note
    audioEngine.playNote(pitchToLabel(pitch), '8n');
    addPianoNote(track.id, {
      pitch,
      startBar: Math.max(0, Math.floor(beat * 4) / 4),
      durationBars: 1,
      velocity: 100,
    });
  }, [notes, zoom, scrollLeft, scrollTop, track.id, addPianoNote, removePianoNote]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      setZoom(z => Math.max(0.3, Math.min(4, z - e.deltaY * 0.005)));
    } else if (e.shiftKey) {
      setScrollLeft(s => Math.max(0, s + e.deltaY));
    } else {
      setScrollTop(s => Math.max(0, s + e.deltaY));
    }
    e.preventDefault();
  }, []);

  // Virtual piano keyboard on left side
  const visiblePitches = 50;
  const keyboardPitches = Array.from({ length: visiblePitches }, (_, i) => BASE_PITCH + TOTAL_PITCHES - 1 - Math.floor(scrollTop / NOTE_HEIGHT) - i);

  return (
    <div className="piano-roll">
      {/* Keyboard */}
      <div className="piano-keyboard" style={{ width: KEYBOARD_WIDTH }}>
        {keyboardPitches.map(pitch => (
          <div
            key={pitch}
            className={`piano-key ${isBlackKey(pitch) ? 'piano-key-black' : 'piano-key-white'}`}
            style={{ height: NOTE_HEIGHT }}
            onClick={() => audioEngine.playNote(pitchToLabel(pitch), '8n')}
            title={pitchToLabel(pitch)}
          >
            {(pitch - 12) % 12 === 0 && (
              <span className="key-label">{pitchToLabel(pitch)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="piano-canvas-container">
        <canvas
          ref={canvasRef}
          className="piano-roll-canvas"
          onMouseDown={onMouseDown}
          onContextMenu={e => e.preventDefault()}
          onWheel={onWheel}
          style={{ cursor: 'crosshair' }}
        />
      </div>
    </div>
  );
}
