import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { audioEngine } from '../engine/AudioEngine';

export function useKeyboardShortcuts() {
  const { undo, redo, saveProject, duplicateClip, removeClip, splitClip } = useProjectStore();
  const { setToolMode, setZoom, zoom, addToast, setLoopEnabled, loopEnabled } = useUIStore();

  useEffect(() => {
    let isPlaying = false;

    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if editing text input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // ─── File ────────────────────────────────────────────
      if (ctrl && e.key === 's') {
        e.preventDefault();
        saveProject();
        addToast({ message: 'Project saved', type: 'success' });
        return;
      }

      // ─── Undo / Redo ──────────────────────────────────────
      if (ctrl && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
        return;
      }
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // ─── Transport ────────────────────────────────────────
      if (e.code === 'Space') {
        e.preventDefault();
        const { tracks, bpm } = useProjectStore.getState();
        const { playheadBeat, setPlayheadBeat } = useUIStore.getState();
        if (audioEngine.playing) {
          audioEngine.pause();
        } else {
          audioEngine.play(tracks, playheadBeat, bpm);
        }
        return;
      }

      if (e.key === 'Home') {
        useUIStore.getState().setPlayheadBeat(0);
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        const { isRecording, setIsRecording } = useUIStore.getState();
        setIsRecording(!isRecording);
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        setLoopEnabled(!loopEnabled);
        return;
      }

      // ─── Tools ────────────────────────────────────────────
      if (e.key === 'a' || e.key === 'A') { setToolMode('select'); return; }
      if (e.key === 'b' || e.key === 'B') { setToolMode('split'); return; }
      if (e.key === 't' || e.key === 'T') { setToolMode('trim'); return; }
      if (e.key === 'p' || e.key === 'P') { setToolMode('draw'); return; }
      if (e.key === 'e' || e.key === 'E') { setToolMode('erase'); return; }

      // ─── Clip operations ──────────────────────────────────
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        const { selectedClipId, selectedTrackId } = useUIStore.getState();
        if (selectedClipId && selectedTrackId) {
          duplicateClip(selectedTrackId, selectedClipId);
          addToast({ message: 'Clip duplicated', type: 'success' });
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedClipId, selectedTrackId } = useUIStore.getState();
        if (selectedClipId && selectedTrackId) {
          removeClip(selectedTrackId, selectedClipId);
          useUIStore.getState().setSelectedClip(null);
        }
        return;
      }

      // ─── Zoom ─────────────────────────────────────────────
      if (e.key === '=' || e.key === '+') {
        setZoom(zoom + 8);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        setZoom(zoom - 8);
        return;
      }

      // ─── Mute / Solo ──────────────────────────────────────
      if (e.key === 'm' || e.key === 'M') {
        const { selectedTrackId } = useUIStore.getState();
        if (selectedTrackId) {
          const track = useProjectStore.getState().tracks.find(t => t.id === selectedTrackId);
          if (track) useProjectStore.getState().setTrackMute(selectedTrackId, !track.muted);
        }
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        if (!ctrl) {
          const { selectedTrackId } = useUIStore.getState();
          if (selectedTrackId) {
            const track = useProjectStore.getState().tracks.find(t => t.id === selectedTrackId);
            if (track) useProjectStore.getState().setTrackSolo(selectedTrackId, !track.soloed);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, saveProject, duplicateClip, removeClip, splitClip, setToolMode, setZoom, zoom, addToast, setLoopEnabled, loopEnabled]);
}
