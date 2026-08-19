import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { audioEngine } from '../../engine/AudioEngine';
import './Mixer.css';

export function Mixer() {
  const tracks = useProjectStore(s => s.tracks);
  const masterVolume = useProjectStore(s => s.masterVolume);
  const setMasterVolume = useProjectStore(s => s.setMasterVolume);
  const setTrackVolume = useProjectStore(s => s.setTrackVolume);
  const setTrackPan = useProjectStore(s => s.setTrackPan);
  const setTrackMute = useProjectStore(s => s.setTrackMute);
  const setTrackSolo = useProjectStore(s => s.setTrackSolo);

  const [levels, setLevels] = useState<Record<string, number>>({});

  // Level metering animation
  useEffect(() => {
    let frame: number;
    const tick = () => {
      const newLevels: Record<string, number> = {};
      tracks.forEach(t => { newLevels[t.id] = audioEngine.getTrackLevel(t.id); });
      newLevels['master'] = audioEngine.getMasterLevel();
      setLevels(newLevels);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tracks]);

  // Update audio engine when volume/pan changes
  useEffect(() => {
    tracks.forEach(t => {
      audioEngine.ensureTrackNodes(t.id);
      audioEngine.updateTrackVolume(t.id, t.muted ? 0 : t.volume);
      audioEngine.updateTrackPan(t.id, t.pan);
    });
    audioEngine.setMasterVolume(masterVolume);
  }, [tracks, masterVolume]);

  const trackColor = (type: string): string => {
    const map: Record<string, string> = {
      drum: '#7c3aed', bass: '#059669', guitar: '#d97706', piano: '#0891b2',
      violin: '#be185d', vocal: '#c026d3', audio: '#2563eb', midi: '#6366f1',
    };
    return map[type] ?? '#2563eb';
  };

  return (
    <div className="mixer">
      <div className="mixer-channels">
        {tracks.map(track => (
          <ChannelStrip
            key={track.id}
            name={track.name}
            type={track.type}
            color={trackColor(track.type)}
            volume={track.volume}
            pan={track.pan}
            muted={track.muted}
            soloed={track.soloed}
            level={levels[track.id] ?? 0}
            onVolume={v => setTrackVolume(track.id, v)}
            onPan={v => setTrackPan(track.id, v)}
            onMute={() => setTrackMute(track.id, !track.muted)}
            onSolo={() => setTrackSolo(track.id, !track.soloed)}
          />
        ))}

        {/* Master Channel */}
        <ChannelStrip
          name="Master"
          type="master"
          color="#3b82f6"
          volume={masterVolume}
          pan={0}
          muted={false}
          soloed={false}
          level={levels['master'] ?? 0}
          onVolume={setMasterVolume}
          onPan={() => {}}
          onMute={() => {}}
          onSolo={() => {}}
          isMaster
        />
      </div>
    </div>
  );
}

interface ChannelProps {
  name: string;
  type: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  level: number;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
  onMute: () => void;
  onSolo: () => void;
  isMaster?: boolean;
}

function ChannelStrip({ name, type, color, volume, pan, muted, soloed, level, onVolume, onPan, onMute, onSolo, isMaster }: ChannelProps) {
  const faderH = 120;
  const faderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startV = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startV.current = volume;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dy = startY.current - e.clientY;
      const newV = Math.max(0, Math.min(1, startV.current + dy / faderH));
      onVolume(newV);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onVolume]);

  const dbVal = volume > 0 ? Math.round(20 * Math.log10(volume)) : -Infinity;
  const dbDisplay = volume === 0 ? '-∞' : `${dbVal > 0 ? '+' : ''}${dbVal}`;
  const levelH = Math.min(1, level) * 100;

  return (
    <div className={`channel-strip ${isMaster ? 'master-channel' : ''} ${muted ? 'muted' : ''}`}
      style={{ borderTop: `2px solid ${color}` }}>
      {/* Channel name */}
      <div className="channel-name truncate" title={name}>{name}</div>

      {/* Pan */}
      {!isMaster && (
        <div className="channel-pan">
          <input
            type="range" min={-1} max={1} step={0.01} value={pan}
            className="pan-knob-slider"
            onChange={e => onPan(Number(e.target.value))}
            title={`Pan: ${pan === 0 ? 'C' : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(-pan * 100)}`}`}
          />
          <span className="pan-label">{pan === 0 ? 'C' : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(-pan * 100)}`}</span>
        </div>
      )}

      {/* Meter + Fader */}
      <div className="channel-fader-area">
        {/* Level meter */}
        <div className="channel-meter">
          <div className="meter-bar">
            <div className="meter-fill-bar" style={{ height: `${levelH}%` }} />
          </div>
          <div className="meter-bar">
            <div className="meter-fill-bar" style={{ height: `${levelH * 0.9}%` }} />
          </div>
        </div>

        {/* Fader track */}
        <div className="fader-track" style={{ height: faderH }}>
          <div className="fader-rail" />
          <div
            ref={faderRef}
            className="fader-thumb"
            style={{ bottom: `${volume * (faderH - 16)}px` }}
            onMouseDown={onMouseDown}
          />
        </div>
      </div>

      {/* dB display */}
      <div className="channel-db font-mono">{dbDisplay} dB</div>

      {/* M / S buttons */}
      <div className="channel-buttons">
        {!isMaster && (
          <>
            <button className={`ch-btn ${muted ? 'active-mute' : ''}`} onClick={onMute}>M</button>
            <button className={`ch-btn ${soloed ? 'active-solo' : ''}`} onClick={onSolo}>S</button>
          </>
        )}
        {isMaster && <span className="master-label">MASTER</span>}
      </div>
    </div>
  );
}
