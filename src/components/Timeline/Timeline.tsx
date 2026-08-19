import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import type { Clip, Track } from '../../store/projectStore';
import { TRACK_HEIGHT, RULER_HEIGHT, beatToPixel, pixelToBeat, snapBeat } from './TimelineUtils';
import './Timeline.css';

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const clipsCanvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tracks = useProjectStore(s => s.tracks);
  const bpm = useProjectStore(s => s.bpm);
  const timeSignature = useProjectStore(s => s.timeSignature);
  const markers = useProjectStore(s => s.markers);
  const { moveClip, splitClip, removeClip, duplicateClip, updateClip, addClip } = useProjectStore();

  const zoom = useUIStore(s => s.zoom);
  const scrollLeft = useUIStore(s => s.scrollLeft);
  const scrollTop = useUIStore(s => s.scrollTop);
  const setScrollLeft = useUIStore(s => s.setScrollLeft);
  const setScrollTop = useUIStore(s => s.setScrollTop);
  const playheadBeat = useUIStore(s => s.playheadBeat);
  const setPlayheadBeat = useUIStore(s => s.setPlayheadBeat);
  const selectedClipId = useUIStore(s => s.selectedClipId);
  const setSelectedClip = useUIStore(s => s.setSelectedClip);
  const selectedTrackId = useUIStore(s => s.selectedTrackId);
  const setSelectedTrack = useUIStore(s => s.setSelectedTrack);
  const toolMode = useUIStore(s => s.toolMode);
  const snapEnabled = useUIStore(s => s.snapEnabled);
  const snapGrid = useUIStore(s => s.snapGrid);
  const gridVisible = useUIStore(s => s.gridVisible);
  const setContextMenu = useUIStore(s => s.setContextMenu);
  const setBottomTab = useUIStore(s => s.setBottomTab);

  const beatsPerBar = timeSignature[0];
  const TOTAL_BEATS = 256; // total timeline beats

  // Calculate total content width
  const totalWidth = beatToPixel(TOTAL_BEATS, zoom);
  const totalHeight = tracks.length * TRACK_HEIGHT;

  // Draw ruler
  const drawRuler = useCallback(() => {
    const canvas = rulerCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;
    const w = container.clientWidth;
    const h = RULER_HEIGHT;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#0d0e10';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#2a2d35';
    ctx.lineWidth = 1;

    // Bottom border
    ctx.strokeStyle = '#2a2d35';
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();

    const startBeat = pixelToBeat(scrollLeft, zoom);
    const endBeat = pixelToBeat(scrollLeft + w, zoom);

    // Draw bar markers
    for (let beat = Math.floor(startBeat / beatsPerBar) * beatsPerBar; beat <= endBeat; beat += beatsPerBar) {
      const x = beatToPixel(beat, zoom) - scrollLeft;
      const bar = Math.floor(beat / beatsPerBar) + 1;

      // Bar line
      ctx.strokeStyle = '#3a3d47';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();

      // Bar number
      ctx.fillStyle = '#8b8fa8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(String(bar), x + 4, 14);

      // Beat subdivisions
      if (zoom > 16) {
        for (let b = 1; b < beatsPerBar; b++) {
          const bx = beatToPixel(beat + b, zoom) - scrollLeft;
          ctx.strokeStyle = '#1e2028';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx + 0.5, h / 2);
          ctx.lineTo(bx + 0.5, h);
          ctx.stroke();

          if (zoom > 32) {
            ctx.fillStyle = '#555869';
            ctx.font = '9px Inter, sans-serif';
            ctx.fillText(String(b + 1), bx + 2, h - 4);
          }
        }
      }
    }

    // Draw markers
    markers.forEach(marker => {
      const x = beatToPixel(marker.position, zoom) - scrollLeft;
      if (x < 0 || x > w) return;
      ctx.fillStyle = marker.color;
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = marker.color;
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillText(marker.label, x + 4, 22);
    });

    // Playhead on ruler
    const phX = beatToPixel(playheadBeat, zoom) - scrollLeft;
    if (phX >= 0 && phX <= w) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(phX - 5, 0);
      ctx.lineTo(phX + 5, 0);
      ctx.lineTo(phX + 5, 8);
      ctx.lineTo(phX, h);
      ctx.lineTo(phX - 5, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [scrollLeft, zoom, beatsPerBar, markers, playheadBeat]);

  // Track type → clip color
  function clipColor(track: Track): string {
    const map: Record<string, string> = {
      drum: '#7c3aed', bass: '#059669', guitar: '#d97706',
      piano: '#0891b2', violin: '#be185d', vocal: '#c026d3', audio: '#2563eb', midi: '#6366f1',
    };
    return map[track.type] ?? '#2563eb';
  }

  // Draw waveform on clip
  function drawWaveform(ctx: CanvasRenderingContext2D, clip: Clip, x: number, y: number, w: number, h: number, color: string) {
    if (!clip.waveformData) return;
    const data = clip.waveformData;
    const samples = data.length;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    const mid = y + h / 2;
    for (let i = 0; i < w; i++) {
      const idx = Math.floor((i / w) * samples);
      const v = data[idx] ?? 0;
      ctx.moveTo(x + i, mid - v * (h / 2 - 2));
      ctx.lineTo(x + i, mid + v * (h / 2 - 2));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Draw pattern preview (drum/guitar)
  function drawPatternPreview(ctx: CanvasRenderingContext2D, track: Track, x: number, y: number, w: number, h: number) {
    if (track.type === 'drum' && track.drumPattern) {
      const pattern = track.drumPattern;
      const steps = pattern.steps;
      const stepW = w / steps;
      pattern.tracks.slice(0, 4).forEach((dt, row) => {
        const rowY = y + 4 + row * 8;
        dt.hits.forEach(hit => {
          const hitX = x + hit.step * stepW;
          ctx.fillStyle = `rgba(255,255,255,${hit.velocity / 127 * 0.7})`;
          ctx.fillRect(hitX + 1, rowY, stepW - 2, 5);
        });
      });
    } else if ((track.type === 'guitar' || track.type === 'bass') && track.guitarSettings) {
      const chords = track.guitarSettings.chords;
      const totalBeats = chords.reduce((a, c) => a + c.duration, 0) || 16;
      let currentBeat = 0;
      chords.forEach(chord => {
        const chordX = x + (currentBeat / totalBeats) * w;
        const chordW = (chord.duration / totalBeats) * w - 2;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(chordX, y + h / 2 - 8, Math.max(4, chordW), 16);
        if (chordW > 20) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '9px Inter, sans-serif';
          ctx.fillText(`${chord.root}${chord.type}`, chordX + 3, y + h / 2 + 3);
        }
        currentBeat += chord.duration;
      });
    } else if (track.type === 'piano' && track.pianoNotes) {
      track.pianoNotes.slice(0, 20).forEach(note => {
        const noteX = x + (note.startBar / 8) * w;
        const noteW = Math.max(3, (note.durationBars / 8) * w);
        const noteY = y + h - 4 - ((note.pitch - 36) / 84) * (h - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(noteX, noteY, noteW, 3);
      });
    }
  }

  // Draw all clips on canvas
  const drawClips = useCallback(() => {
    const canvas = clipsCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;
    const w = totalWidth;
    const h = Math.max(totalHeight, 200);
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#0e0f11';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    if (gridVisible) {
      for (let beat = 0; beat <= TOTAL_BEATS; beat += beatsPerBar) {
        const x = beatToPixel(beat, zoom);
        ctx.strokeStyle = '#1e2028';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }
      if (zoom > 16) {
        for (let beat = 0; beat <= TOTAL_BEATS; beat++) {
          if (beat % beatsPerBar === 0) continue;
          const x = beatToPixel(beat, zoom);
          ctx.strokeStyle = '#161820';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
        }
      }
    }

    // Track lane separators
    tracks.forEach((_, i) => {
      const y = i * TRACK_HEIGHT;
      ctx.strokeStyle = '#1a1c20';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + TRACK_HEIGHT - 0.5); ctx.lineTo(w, y + TRACK_HEIGHT - 0.5); ctx.stroke();
    });

    // Draw clips
    tracks.forEach((track, ti) => {
      const trackY = ti * TRACK_HEIGHT;
      const color = clipColor(track);
      const isTrackSelected = track.id === selectedTrackId;

      track.clips.forEach(clip => {
        const clipX = beatToPixel(clip.startBeat, zoom);
        const clipW = Math.max(4, beatToPixel(clip.durationBeats, zoom));
        const clipY = trackY + 2;
        const clipH = TRACK_HEIGHT - 4;

        const isSelected = clip.id === selectedClipId;
        const opacity = clip.muted || track.muted ? 0.35 : 1;
        ctx.globalAlpha = opacity;

        // Clip background
        const bgColor = isSelected
          ? `rgba(${hexToRgb(color)}, 0.7)`
          : `rgba(${hexToRgb(color)}, 0.38)`;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(clipX, clipY, clipW, clipH, 3);
        ctx.fill();

        // Clip border
        ctx.strokeStyle = isSelected ? color : `rgba(${hexToRgb(color)}, 0.6)`;
        ctx.lineWidth = isSelected ? 1.5 : 1;
        ctx.stroke();

        // Fade in handle
        if (clip.fadeIn > 0) {
          const fadeW = (clip.fadeIn * bpm / 60) * zoom;
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.beginPath();
          ctx.moveTo(clipX, clipY + clipH);
          ctx.lineTo(clipX + fadeW, clipY);
          ctx.lineTo(clipX, clipY);
          ctx.closePath();
          ctx.fill();
        }

        // Waveform / pattern / chord text
        const innerX = clipX + 2;
        const innerW = clipW - 4;
        if (innerW > 8) {
          if (clip.waveformData) {
            drawWaveform(ctx, clip, innerX, clipY + 12, innerW, clipH - 14, color);
          } else if (clip.chord) {
            // Draw a big clean chord label centered
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${clip.chord.root}${clip.chord.type}`, clipX + clipW / 2, clipY + clipH / 2 + 4);
            ctx.textAlign = 'left';
          } else {
            drawPatternPreview(ctx, track, innerX, clipY + 10, innerW, clipH - 12);
          }
        }

        // Clip label
        if (!clip.chord) {
          ctx.globalAlpha = opacity;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.save();
          ctx.rect(clipX + 3, clipY, clipW - 6, 14);
          ctx.clip();
          ctx.fillText(clip.name, clipX + 4, clipY + 9);
          ctx.restore();
        }

        // Resize handle right
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(clipX + clipW - 4, clipY + clipH / 4, 3, clipH / 2);

        ctx.globalAlpha = 1;
      });
    });

    // Playhead line
    const phX = beatToPixel(playheadBeat, zoom);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(phX + 0.5, 0);
    ctx.lineTo(phX + 0.5, h);
    ctx.stroke();
  }, [tracks, zoom, scrollLeft, scrollTop, selectedClipId, selectedTrackId, playheadBeat, gridVisible, beatsPerBar, bpm]);

  // Redraw on changes
  useEffect(() => { drawRuler(); drawClips(); }, [drawRuler, drawClips]);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(() => { drawRuler(); drawClips(); });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [drawRuler, drawClips]);

  // Scroll sync
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
    setScrollTop(e.currentTarget.scrollTop);
  }, [setScrollLeft, setScrollTop]);

  // Mouse interaction
  const dragRef = useRef<{ clipId: string; trackId: string; startX: number; startBeat: number; } | null>(null);
  const resizeRef = useRef<{ clipId: string; trackId: string; startX: number; origDuration: number; } | null>(null);
  const playheadDrag = useRef(false);

  const getEventInfo = (e: React.MouseEvent) => {
    const rect = clipsCanvasRef.current!.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const beat = pixelToBeat(canvasX, zoom);
    const trackIndex = Math.floor(canvasY / TRACK_HEIGHT);
    const track = tracks[Math.max(0, Math.min(tracks.length - 1, trackIndex))];
    return { canvasX, canvasY, beat, track, trackIndex };
  };

  const findClipAtBeat = (track: Track, beat: number, canvasX: number): { clip: Clip; isResizeHandle: boolean } | null => {
    for (const clip of track.clips) {
      const x = beatToPixel(clip.startBeat, zoom);
      const w = Math.max(4, beatToPixel(clip.durationBeats, zoom));
      if (canvasX >= x && canvasX <= x + w) {
        const isResizeHandle = canvasX > x + w - 8;
        return { clip, isResizeHandle };
      }
    }
    return null;
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const { beat, track, canvasY, canvasX } = getEventInfo(e);
    if (!track) return;

    // Ruler click → move playhead
    if (canvasY < 0) { setPlayheadBeat(beat); return; }

    const found = findClipAtBeat(track, beat, canvasX);

    if (e.button === 2) {
      // Right click → context menu
      if (found) {
        setSelectedClip(found.clip.id);
        setSelectedTrack(track.id);
        setContextMenu({
          x: e.clientX, y: e.clientY,
          items: [
            { label: 'Split at Playhead', action: () => { splitClip(track.id, found.clip.id, useUIStore.getState().playheadBeat); setContextMenu(null); } },
            { label: 'Duplicate', action: () => { duplicateClip(track.id, found.clip.id); setContextMenu(null); } },
            { label: 'Delete', action: () => { removeClip(track.id, found.clip.id); setContextMenu(null); } },
            { separator: true, label: '', action: () => {} },
            { label: found.clip.muted ? 'Unmute' : 'Mute', action: () => { updateClip(track.id, found.clip.id, { muted: !found.clip.muted }); setContextMenu(null); } },
            { label: found.clip.locked ? 'Unlock' : 'Lock', action: () => { updateClip(track.id, found.clip.id, { locked: !found.clip.locked }); setContextMenu(null); } },
          ]
        });
      }
      return;
    }

    if (toolMode === 'select' || toolMode === 'trim') {
      if (found && !found.clip.locked) {
        setSelectedClip(found.clip.id);
        setSelectedTrack(track.id);
        if (found.isResizeHandle || toolMode === 'trim') {
          resizeRef.current = { clipId: found.clip.id, trackId: track.id, startX: e.clientX, origDuration: found.clip.durationBeats };
        } else {
          dragRef.current = { clipId: found.clip.id, trackId: track.id, startX: e.clientX, startBeat: found.clip.startBeat };
        }
      } else if (!found) {
        // Click empty area → deselect, maybe move playhead
        setSelectedClip(null);
        setPlayheadBeat(Math.max(0, beat));
        setSelectedTrack(track.id);
      }
    } else if (toolMode === 'split') {
      if (found) {
        splitClip(track.id, found.clip.id, beat);
      }
    } else if (toolMode === 'erase') {
      if (found) {
        removeClip(track.id, found.clip.id);
      }
    }
  }, [toolMode, zoom, scrollLeft, scrollTop, tracks, splitClip, removeClip, duplicateClip, setSelectedClip, setSelectedTrack, setPlayheadBeat, setContextMenu, updateClip]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const beatDelta = dx / zoom;
        const newBeat = Math.max(0, dragRef.current.startBeat + beatDelta);
        const snapped = snapEnabled ? snapBeat(newBeat, snapGrid) : newBeat;
        moveClip(dragRef.current.clipId, dragRef.current.trackId, snapped);
      }
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startX;
        const beatDelta = dx / zoom;
        const newDuration = Math.max(snapGrid, resizeRef.current.origDuration + beatDelta);
        const snapped = snapEnabled ? snapBeat(newDuration, snapGrid) : newDuration;
        updateClip(resizeRef.current.trackId, resizeRef.current.clipId, { durationBeats: snapped });
      }
    };
    const onUp = () => { dragRef.current = null; resizeRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [zoom, snapEnabled, snapGrid, moveClip, updateClip]);

  // Zoom with wheel
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const { setZoom, zoom } = useUIStore.getState();
      setZoom(zoom - e.deltaY * 0.3);
    } else if (e.shiftKey) {
      setScrollLeft(scrollLeft + e.deltaY * 2);
    } else {
      if (scrollRef.current) {
        scrollRef.current.scrollTop += e.deltaY;
        scrollRef.current.scrollLeft += e.deltaX;
      }
    }
  }, [scrollLeft, setScrollLeft]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type === 'chord') {
        const rect = clipsCanvasRef.current!.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const rawBeat = pixelToBeat(canvasX, zoom);
        const beat = snapEnabled ? snapBeat(rawBeat, snapGrid) : rawBeat;
        const trackIndex = Math.floor(canvasY / TRACK_HEIGHT);
        const track = tracks[Math.max(0, Math.min(tracks.length - 1, trackIndex))];

        if (track && (track.type === 'guitar' || track.type === 'bass')) {
          const chordName = `${data.root}${data.chordType}`;
          addClip({
            trackId: track.id,
            name: chordName,
            startBeat: Math.max(0, beat),
            durationBeats: 4, // 1 bar default
            type: track.type,
            locked: false,
            muted: false,
            fadeIn: 0,
            fadeOut: 0,
            gain: 1,
            chord: { root: data.root, type: data.chordType }
          });
        }
      }
    } catch (err) {
      console.error('Drop handling failed', err);
    }
  }, [zoom, snapEnabled, snapGrid, tracks, addClip]);

  return (
    <div className="timeline-container" ref={containerRef} onWheel={onWheel}>
      {/* Ruler */}
      <div className="timeline-ruler-row">
        <canvas
          ref={rulerCanvasRef}
          className="timeline-ruler-canvas"
          onClick={(e) => {
            const rect = rulerCanvasRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            setPlayheadBeat(Math.max(0, pixelToBeat(x + scrollLeft, zoom)));
          }}
        />
      </div>

      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        className="timeline-scroll"
        onScroll={handleScroll}
      >
        {/* Canvas for clips */}
        <div style={{ width: totalWidth, height: Math.max(totalHeight, 200), position: 'relative' }}>
          <canvas
            ref={clipsCanvasRef}
            className="timeline-clips-canvas"
            onMouseDown={onMouseDown}
            onContextMenu={e => e.preventDefault()}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{ cursor: getCursor(toolMode) }}
          />
        </div>
      </div>

      {/* Empty state */}
      {tracks.length === 0 && (
        <div className="timeline-empty">
          <span>Add tracks to get started</span>
        </div>
      )}
    </div>
  );
}

function getCursor(toolMode: string): string {
  switch (toolMode) {
    case 'split': return 'col-resize';
    case 'trim': return 'ew-resize';
    case 'erase': return 'crosshair';
    default: return 'default';
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
