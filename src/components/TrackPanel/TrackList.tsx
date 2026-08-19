import React, { useState } from 'react';
import {
  Drum, Guitar, Piano, Music2, Mic, Volume2,
  Layers, Plus, ChevronDown, ChevronRight
} from 'lucide-react';
import { useProjectStore, type TrackType } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { TrackHeader } from './TrackHeader';
import './TrackList.css';

const TRACK_TYPES: Array<{ type: TrackType; label: string; icon: React.ReactNode; color: string }> = [
  { type: 'drum', label: 'Drums', icon: <Drum size={12} />, color: '#7c3aed' },
  { type: 'bass', label: 'Bass', icon: <Music2 size={12} />, color: '#059669' },
  { type: 'guitar', label: 'Guitar', icon: <Guitar size={12} />, color: '#d97706' },
  { type: 'piano', label: 'Piano', icon: <Piano size={12} />, color: '#0891b2' },
  { type: 'violin', label: 'Violin', icon: <Music2 size={12} />, color: '#be185d' },
  { type: 'vocal', label: 'Vocal', icon: <Mic size={12} />, color: '#c026d3' },
  { type: 'audio', label: 'Audio', icon: <Volume2 size={12} />, color: '#2563eb' },
  { type: 'midi', label: 'MIDI', icon: <Layers size={12} />, color: '#6366f1' },
];

export function TrackList() {
  const tracks = useProjectStore(s => s.tracks);
  const addTrack = useProjectStore(s => s.addTrack);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const setBottomTab = useUIStore(s => s.setBottomTab);
  const setSelectedTrack = useUIStore(s => s.setSelectedTrack);

  const handleAddTrack = (type: TrackType) => {
    addTrack(type);
    setShowAddMenu(false);
    const tabs: Record<TrackType, any> = {
      drum: 'drum', guitar: 'guitar', bass: 'guitar', piano: 'piano',
      violin: 'properties', vocal: 'properties', audio: 'properties', midi: 'properties',
    };
    setBottomTab(tabs[type]);
  };

  return (
    <div className="track-list">
      {/* Header with track count */}
      <div className="track-list-header">
        <span className="panel-label" style={{ flex: 1, border: 'none', height: 'auto' }}>
          TRACKS ({tracks.length})
        </span>
        <div className="add-track-wrapper">
          <button
            className="btn-icon add-track-btn"
            data-tooltip="Add Track"
            onClick={() => setShowAddMenu(s => !s)}
          >
            <Plus size={13} />
          </button>
          {showAddMenu && (
            <div className="add-track-menu">
              {TRACK_TYPES.map(t => (
                <button
                  key={t.type}
                  className="add-track-item"
                  onClick={() => handleAddTrack(t.type)}
                >
                  <span className="add-track-icon" style={{ color: t.color }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Track headers */}
      <div className="track-list-body">
        {tracks.length === 0 ? (
          <EmptyTrackState onAdd={handleAddTrack} />
        ) : (
          tracks.map((track, index) => (
            <TrackHeader key={track.id} track={track} index={index} />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyTrackState({ onAdd }: { onAdd: (t: TrackType) => void }) {
  return (
    <div className="empty-tracks">
      <p className="empty-title">No tracks yet</p>
      <p className="empty-sub">Create your first track:</p>
      <div className="empty-quick-add">
        {TRACK_TYPES.slice(0, 6).map(t => (
          <button key={t.type} className="quick-add-btn" style={{ borderColor: t.color }} onClick={() => onAdd(t.type)}>
            <span style={{ color: t.color }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
