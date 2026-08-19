import React from 'react';
import { useUIStore, type BottomTab } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { Mixer } from '../Mixer/Mixer';
import { GuitarEditor } from '../Instruments/GuitarEditor';
import { DrumSequencer } from '../Instruments/DrumSequencer';
import { PianoRoll } from '../Instruments/PianoRoll';
import { ViolinEditor } from '../Instruments/ViolinEditor';
import { Inspector } from '../Inspector/Inspector';
import {
  SlidersHorizontal, Guitar, Drum, Piano, Music2,
  Settings, Pointer, Scissors, Crop, PenLine, Eraser,
  Magnet, Grid3x3
} from 'lucide-react';
import { useUIStore as useUI } from '../../store/uiStore';
import './BottomPanel.css';

const TABS: Array<{ id: BottomTab; label: string; icon: React.ReactNode }> = [
  { id: 'mixer', label: 'Mixer', icon: <SlidersHorizontal size={12} /> },
  { id: 'guitar', label: 'Guitar', icon: <Guitar size={12} /> },
  { id: 'drum', label: 'Drums', icon: <Drum size={12} /> },
  { id: 'piano', label: 'Piano', icon: <Piano size={12} /> },
  { id: 'violin', label: 'Violin', icon: <Music2 size={12} /> },
  { id: 'properties', label: 'Properties', icon: <Settings size={12} /> },
];

type ToolMode = 'select' | 'split' | 'trim' | 'draw' | 'erase';

const TOOLS: Array<{ mode: ToolMode; label: string; icon: React.ReactNode; shortcut: string }> = [
  { mode: 'select', label: 'Select', icon: <Pointer size={12} />, shortcut: 'A' },
  { mode: 'split', label: 'Split', icon: <Scissors size={12} />, shortcut: 'B' },
  { mode: 'trim', label: 'Trim', icon: <Crop size={12} />, shortcut: 'T' },
  { mode: 'draw', label: 'Draw', icon: <PenLine size={12} />, shortcut: 'P' },
  { mode: 'erase', label: 'Erase', icon: <Eraser size={12} />, shortcut: 'E' },
];

export function BottomPanel() {
  const bottomTab = useUIStore(s => s.bottomTab);
  const setBottomTab = useUIStore(s => s.setBottomTab);
  const toolMode = useUIStore(s => s.toolMode);
  const setToolMode = useUIStore(s => s.setToolMode);
  const snapEnabled = useUIStore(s => s.snapEnabled);
  const setSnapEnabled = useUIStore(s => s.setSnapEnabled);
  const gridVisible = useUIStore(s => s.gridVisible);
  const setGridVisible = useUIStore(s => s.setGridVisible);
  const snapGrid = useUIStore(s => s.snapGrid);
  const setSnapGrid = useUIStore(s => s.setSnapGrid);

  const selectedTrackId = useUIStore(s => s.selectedTrackId);
  const tracks = useProjectStore(s => s.tracks);
  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  return (
    <div className="bottom-panel">
      {/* Tab bar + tool bar */}
      <div className="bottom-panel-tabs">
        {/* Tabs */}
        <div className="tabs-row">
          {TABS.map(tab => {
            const isBass = tab.id === 'guitar' && selectedTrack?.type === 'bass';
            return (
              <button
                key={tab.id}
                className={`bottom-tab ${bottomTab === tab.id ? 'active' : ''}`}
                onClick={() => setBottomTab(tab.id)}
              >
                {tab.icon}
                <span>{isBass ? 'Bass' : tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="bottom-toolbar-sep" />

        {/* Timeline tools */}
        <div className="tools-row">
          <span className="tools-label">TOOLS</span>
          {TOOLS.map(tool => (
            <button
              key={tool.mode}
              className={`btn-icon ${toolMode === tool.mode ? 'active' : ''}`}
              data-tooltip={`${tool.label} (${tool.shortcut})`}
              onClick={() => setToolMode(tool.mode)}
            >
              {tool.icon}
            </button>
          ))}
          <div className="sep-v" style={{ height: 16, margin: '0 4px' }} />
          <button
            className={`btn-icon ${snapEnabled ? 'active' : ''}`}
            data-tooltip="Snap to Grid"
            onClick={() => setSnapEnabled(!snapEnabled)}
          >
            <Magnet size={12} />
          </button>
          <select
            className="snap-select"
            value={snapGrid}
            onChange={e => setSnapGrid(Number(e.target.value))}
            title="Snap grid"
          >
            <option value={0.25}>1/16</option>
            <option value={0.5}>1/8</option>
            <option value={1}>1/4</option>
            <option value={2}>1/2</option>
            <option value={4}>1 bar</option>
          </select>
          <button
            className={`btn-icon ${gridVisible ? 'active' : ''}`}
            data-tooltip="Show Grid"
            onClick={() => setGridVisible(!gridVisible)}
          >
            <Grid3x3 size={12} />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="bottom-panel-content">
        {bottomTab === 'mixer' && <Mixer />}
        {bottomTab === 'guitar' && (selectedTrack ? <GuitarEditor track={selectedTrack} /> : <NoTrackSelected />)}
        {bottomTab === 'drum' && (selectedTrack ? <DrumSequencer track={selectedTrack} /> : <NoTrackSelected />)}
        {bottomTab === 'piano' && (selectedTrack ? <PianoRoll track={selectedTrack} /> : <NoTrackSelected />)}
        {bottomTab === 'violin' && (selectedTrack ? <ViolinEditor track={selectedTrack} /> : <NoTrackSelected />)}
        {bottomTab === 'properties' && <Inspector />}
      </div>
    </div>
  );
}

function NoTrackSelected() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
      Select a track to edit
    </div>
  );
}
