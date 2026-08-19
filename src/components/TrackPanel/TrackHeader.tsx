import React, { useCallback } from 'react';
import {
  Drum, Guitar, Piano, Music2, Mic, Volume2, Layers,
  VolumeX, Headphones, CircleDot, Settings, Trash2, ChevronDown
} from 'lucide-react';
import type { Track, TrackType } from '../../store/projectStore';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { TRACK_HEIGHT } from '../Timeline/TimelineUtils';
import './TrackHeader.css';

const TYPE_ICONS: Record<TrackType, React.ReactNode> = {
  drum: <Drum size={11} />,
  bass: <Music2 size={11} />,
  guitar: <Guitar size={11} />,
  piano: <Piano size={11} />,
  violin: <Music2 size={11} />,
  vocal: <Mic size={11} />,
  audio: <Volume2 size={11} />,
  midi: <Layers size={11} />,
};

const BOTTOM_TABS: Partial<Record<TrackType, any>> = {
  drum: 'drum', guitar: 'guitar', bass: 'guitar', piano: 'piano', violin: 'properties',
};

interface Props {
  track: Track;
  index: number;
}

export function TrackHeader({ track, index }: Props) {
  const { setTrackMute, setTrackSolo, setTrackArm, setTrackVolume, setTrackPan, removeTrack, updateTrack } = useProjectStore();
  const { selectedTrackId, setSelectedTrack, setBottomTab, setContextMenu } = useUIStore();
  const isSelected = selectedTrackId === track.id;

  const handleSelect = useCallback(() => {
    setSelectedTrack(track.id);
    setBottomTab(BOTTOM_TABS[track.type] ?? 'mixer');
  }, [track.id, track.type, setSelectedTrack, setBottomTab]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Rename', action: () => { setContextMenu(null); /* handled by double click */ } },
        { label: track.muted ? 'Unmute' : 'Mute', action: () => { setTrackMute(track.id, !track.muted); setContextMenu(null); } },
        { label: track.soloed ? 'Unsolo' : 'Solo', action: () => { setTrackSolo(track.id, !track.soloed); setContextMenu(null); } },
        { separator: true, label: '', action: () => {} },
        { label: 'Delete Track', action: () => { removeTrack(track.id); setContextMenu(null); } },
      ]
    });
  }, [track, setTrackMute, setTrackSolo, removeTrack, setContextMenu]);

  return (
    <div
      className={`track-header ${isSelected ? 'selected' : ''} ${track.muted ? 'muted' : ''}`}
      style={{ height: TRACK_HEIGHT, borderLeft: `3px solid ${track.color}` }}
      onClick={handleSelect}
      onContextMenu={handleContextMenu}
    >
      {/* Top row: icon, name, delete */}
      <div className="track-top-row">
        <span className="track-type-icon" style={{ color: track.color }}>
          {TYPE_ICONS[track.type]}
        </span>
        <span className="track-name truncate">{track.name}</span>
        <button
          className="track-delete"
          onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
          data-tooltip="Delete track"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Middle row: M S ARM */}
      <div className="track-mid-row">
        <button
          className={`track-btn ${track.muted ? 'active-mute' : ''}`}
          onClick={(e) => { e.stopPropagation(); setTrackMute(track.id, !track.muted); }}
          data-tooltip="Mute (M)"
        >M</button>
        <button
          className={`track-btn ${track.soloed ? 'active-solo' : ''}`}
          onClick={(e) => { e.stopPropagation(); setTrackSolo(track.id, !track.soloed); }}
          data-tooltip="Solo (S)"
        >S</button>
        <button
          className={`track-btn ${track.armed ? 'active-arm' : ''}`}
          onClick={(e) => { e.stopPropagation(); setTrackArm(track.id, !track.armed); }}
          data-tooltip="Arm for Recording"
        >
          <CircleDot size={9} />
        </button>
        <button
          className="track-btn"
          onClick={(e) => { e.stopPropagation(); setBottomTab(BOTTOM_TABS[track.type] ?? 'mixer'); setSelectedTrack(track.id); }}
          data-tooltip="Open settings"
        >
          <Settings size={9} />
        </button>
      </div>

      {/* Volume + Pan */}
      <div className="track-controls-row">
        <span className="control-label">VOL</span>
        <input
          type="range"
          min={0} max={1} step={0.01}
          value={track.volume}
          className="track-slider vol-slider"
          onClick={e => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); setTrackVolume(track.id, Number(e.target.value)); }}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
        />
        <span className="control-value">{Math.round(track.volume * 100)}</span>
      </div>
      <div className="track-controls-row">
        <span className="control-label">PAN</span>
        <input
          type="range"
          min={-1} max={1} step={0.01}
          value={track.pan}
          className="track-slider pan-slider"
          onClick={e => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); setTrackPan(track.id, Number(e.target.value)); }}
          title={`Pan: ${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(Math.round(track.pan * 100))}`}
        />
        <span className="control-value">{track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(-track.pan * 100)}`}</span>
      </div>
    </div>
  );
}
