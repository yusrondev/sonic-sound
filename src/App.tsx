// SonicSound Main App entry point
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TransportBar } from './components/Transport/TransportBar';
import { TrackList } from './components/TrackPanel/TrackList';
import { Timeline } from './components/Timeline/Timeline';
import { BottomPanel } from './components/BottomPanel/BottomPanel';
import { ToastContainer } from './components/Common/Toast';
import { ContextMenuOverlay } from './components/Common/ContextMenu';
import { useUIStore } from './store/uiStore';
import { useProjectStore } from './store/projectStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { audioEngine } from './engine/AudioEngine';
import './App.css';

const SPLITTER_SIZE = 4;

export default function App() {
  const trackPanelWidth = useUIStore(s => s.trackPanelWidth);
  const setTrackPanelWidth = useUIStore(s => s.setTrackPanelWidth);
  const bottomPanelHeight = useUIStore(s => s.bottomPanelHeight);
  const setBottomPanelHeight = useUIStore(s => s.setBottomPanelHeight);

  const bpm = useProjectStore(s => s.bpm);
  const audioLoadingCount = useUIStore(s => s.audioLoadingCount);

  // Drag state for vertical splitter (track panel width)
  const vDragging = useRef(false);
  const vStart = useRef(0);
  const vStartW = useRef(0);

  // Drag state for horizontal splitter (bottom panel height)
  const hDragging = useRef(false);
  const hStart = useRef(0);
  const hStartH = useRef(0);

  // Wire keyboard shortcuts
  useKeyboardShortcuts();

  // Wire audio engine BPM
  useEffect(() => { audioEngine.setBpm(bpm); }, [bpm]);

  // Vertical splitter (between track panel and timeline)
  const onVMouseDown = useCallback((e: React.MouseEvent) => {
    vDragging.current = true;
    vStart.current = e.clientX;
    vStartW.current = trackPanelWidth;
    e.preventDefault();
  }, [trackPanelWidth]);

  // Horizontal splitter (between main area and bottom panel)
  const onHMouseDown = useCallback((e: React.MouseEvent) => {
    hDragging.current = true;
    hStart.current = e.clientY;
    hStartH.current = bottomPanelHeight;
    e.preventDefault();
  }, [bottomPanelHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (vDragging.current) {
        setTrackPanelWidth(vStartW.current + (e.clientX - vStart.current));
      }
      if (hDragging.current) {
        setBottomPanelHeight(hStartH.current - (e.clientY - hStart.current));
      }
    };
    const onUp = () => { vDragging.current = false; hDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [setTrackPanelWidth, setBottomPanelHeight]);

  return (
    <div className="app-shell" onClick={() => { audioEngine.resume(); }}>
      {/* Top Toolbar */}
      <div className="app-toolbar">
        <Toolbar />
      </div>

      {/* Transport Bar */}
      <div className="app-transport">
        <TransportBar />
      </div>

      {/* Main Area */}
      <div className="app-main">
        {/* Track Panel + Timeline */}
        <div className="app-center" style={{ height: `calc(100% - ${bottomPanelHeight + SPLITTER_SIZE}px)` }}>
          {/* Track Panel */}
          <div className="app-track-panel" style={{ width: trackPanelWidth, flexShrink: 0 }}>
            <TrackList />
          </div>

          {/* Vertical Splitter */}
          <div className="splitter-v" onMouseDown={onVMouseDown} />

          {/* Timeline */}
          <div className="app-timeline">
            <Timeline />
          </div>
        </div>

        {/* Horizontal Splitter */}
        <div className="splitter-h" onMouseDown={onHMouseDown} />

        {/* Bottom Panel */}
        <div className="app-bottom" style={{ height: bottomPanelHeight }}>
          <BottomPanel />
        </div>
      </div>

      {/* Overlays */}
      <ToastContainer />
      <ContextMenuOverlay />

      {audioLoadingCount > 0 && (
        <div className="audio-loading-overlay">
          <div className="audio-loading-content">
            <div className="audio-loader-spinner" />
            <h3>Loading High-Quality Audio Samples</h3>
            <p>Retrieving HD files from online CDN repository. First-time load may take a moment...</p>
          </div>
        </div>
      )}
    </div>
  );
}
