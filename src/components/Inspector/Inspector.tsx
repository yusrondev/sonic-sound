import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { Trash2 } from 'lucide-react';
import './Inspector.css';

export function Inspector() {
  const selectedTrackId = useUIStore(s => s.selectedTrackId);
  const selectedClipId = useUIStore(s => s.selectedClipId);
  const tracks = useProjectStore(s => s.tracks);
  const { setTrackVolume, setTrackPan, updateClip, removeClip, removeTrack, updateTrackFX } = useProjectStore();

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const selectedClip = selectedTrack?.clips.find(c => c.id === selectedClipId);

  if (!selectedTrack && !selectedClip) {
    return (
      <div className="inspector empty-inspector">
        <span>Select a track or clip to view properties</span>
      </div>
    );
  }

  return (
    <div className="inspector">
      {/* Track properties */}
      {selectedTrack && (
        <div className="inspector-section">
          <div className="inspector-header">
            <div className="inspector-title">TRACK</div>
            <button className="btn-icon" style={{ width: 20, height: 20 }}
              onClick={() => removeTrack(selectedTrack.id)}>
              <Trash2 size={10} />
            </button>
          </div>

          <div className="prop-row">
            <span className="prop-label">Name</span>
            <span className="prop-value truncate">{selectedTrack.name}</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Type</span>
            <span className="prop-value capitalize">{selectedTrack.type}</span>
          </div>

          <div className="inspector-sep" />

          <div className="prop-row slider-row">
            <span className="prop-label">Volume</span>
            <input type="range" min={0} max={1} step={0.01} value={selectedTrack.volume}
              onChange={e => setTrackVolume(selectedTrack.id, Number(e.target.value))} />
            <span className="prop-val-num">{Math.round(selectedTrack.volume * 100)}</span>
          </div>
          <div className="prop-row slider-row">
            <span className="prop-label">Pan</span>
            <input type="range" min={-1} max={1} step={0.01} value={selectedTrack.pan}
              onChange={e => setTrackPan(selectedTrack.id, Number(e.target.value))} />
            <span className="prop-val-num">{selectedTrack.pan === 0 ? 'C' : selectedTrack.pan > 0 ? `R${Math.round(selectedTrack.pan * 100)}` : `L${Math.round(-selectedTrack.pan * 100)}`}</span>
          </div>

          <div className="inspector-sep" />

          {/* FX quick access */}
          <div className="section-title" style={{ marginBottom: 4 }}>FX CHAIN</div>
          <FXToggleRow label="EQ" active={selectedTrack.fx.eq.enabled}
            onToggle={() => updateTrackFX(selectedTrack.id, { eq: { ...selectedTrack.fx.eq, enabled: !selectedTrack.fx.eq.enabled } })} />
          <FXToggleRow label="Compressor" active={selectedTrack.fx.compressor.enabled}
            onToggle={() => updateTrackFX(selectedTrack.id, { compressor: { ...selectedTrack.fx.compressor, enabled: !selectedTrack.fx.compressor.enabled } })} />
          <FXToggleRow label="Reverb" active={selectedTrack.fx.reverb.enabled}
            onToggle={() => updateTrackFX(selectedTrack.id, { reverb: { ...selectedTrack.fx.reverb, enabled: !selectedTrack.fx.reverb.enabled } })} />
          <FXToggleRow label="Delay" active={selectedTrack.fx.delay.enabled}
            onToggle={() => updateTrackFX(selectedTrack.id, { delay: { ...selectedTrack.fx.delay, enabled: !selectedTrack.fx.delay.enabled } })} />

          {/* EQ sliders when enabled */}
          {selectedTrack.fx.eq.enabled && (
            <div className="fx-expanded">
              {(['low', 'lowMid', 'mid', 'highMid', 'high'] as const).map(band => (
                <div key={band} className="prop-row slider-row">
                  <span className="prop-label" style={{ width: 40 }}>{band.toUpperCase().slice(0, 3)}</span>
                  <input type="range" min={-12} max={12} step={0.5}
                    value={selectedTrack.fx.eq[band]}
                    onChange={e => updateTrackFX(selectedTrack.id, { eq: { ...selectedTrack.fx.eq, [band]: Number(e.target.value) } })} />
                  <span className="prop-val-num">{selectedTrack.fx.eq[band] > 0 ? `+${selectedTrack.fx.eq[band]}` : selectedTrack.fx.eq[band]}dB</span>
                </div>
              ))}
            </div>
          )}

          {/* Reverb when enabled */}
          {selectedTrack.fx.reverb.enabled && (
            <div className="fx-expanded">
              <div className="prop-row slider-row">
                <span className="prop-label" style={{ width: 40 }}>MIX</span>
                <input type="range" min={0} max={1} step={0.01}
                  value={selectedTrack.fx.reverb.mix}
                  onChange={e => updateTrackFX(selectedTrack.id, { reverb: { ...selectedTrack.fx.reverb, mix: Number(e.target.value) } })} />
                <span className="prop-val-num">{Math.round(selectedTrack.fx.reverb.mix * 100)}%</span>
              </div>
              <div className="prop-row slider-row">
                <span className="prop-label" style={{ width: 40 }}>DCAY</span>
                <input type="range" min={0.1} max={8} step={0.1}
                  value={selectedTrack.fx.reverb.decay}
                  onChange={e => updateTrackFX(selectedTrack.id, { reverb: { ...selectedTrack.fx.reverb, decay: Number(e.target.value) } })} />
                <span className="prop-val-num">{selectedTrack.fx.reverb.decay.toFixed(1)}s</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clip properties */}
      {selectedClip && selectedTrack && (
        <div className="inspector-section">
          <div className="inspector-header">
            <div className="inspector-title">CLIP</div>
            <button className="btn-icon" style={{ width: 20, height: 20 }}
              onClick={() => removeClip(selectedTrack.id, selectedClip.id)}>
              <Trash2 size={10} />
            </button>
          </div>

          <div className="prop-row">
            <span className="prop-label">Name</span>
            <span className="prop-value truncate">{selectedClip.name}</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Start</span>
            <span className="prop-value font-mono">{selectedClip.startBeat.toFixed(2)} beat</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Length</span>
            <span className="prop-value font-mono">{selectedClip.durationBeats.toFixed(2)} beat</span>
          </div>
          <div className="inspector-sep" />
          <div className="prop-row slider-row">
            <span className="prop-label">Gain</span>
            <input type="range" min={0} max={2} step={0.01} value={selectedClip.gain}
              onChange={e => updateClip(selectedTrack.id, selectedClip.id, { gain: Number(e.target.value) })} />
            <span className="prop-val-num">{Math.round(selectedClip.gain * 100)}%</span>
          </div>
          <div className="prop-row slider-row">
            <span className="prop-label">Fade In</span>
            <input type="range" min={0} max={4} step={0.1} value={selectedClip.fadeIn}
              onChange={e => updateClip(selectedTrack.id, selectedClip.id, { fadeIn: Number(e.target.value) })} />
            <span className="prop-val-num">{selectedClip.fadeIn.toFixed(1)}s</span>
          </div>
          <div className="prop-row slider-row">
            <span className="prop-label">Fade Out</span>
            <input type="range" min={0} max={4} step={0.1} value={selectedClip.fadeOut}
              onChange={e => updateClip(selectedTrack.id, selectedClip.id, { fadeOut: Number(e.target.value) })} />
            <span className="prop-val-num">{selectedClip.fadeOut.toFixed(1)}s</span>
          </div>
          <div className="inspector-sep" />
          <div className="prop-row">
            <span className="prop-label">Muted</span>
            <input type="checkbox" checked={selectedClip.muted}
              onChange={e => updateClip(selectedTrack.id, selectedClip.id, { muted: e.target.checked })} />
          </div>
          <div className="prop-row">
            <span className="prop-label">Locked</span>
            <input type="checkbox" checked={selectedClip.locked}
              onChange={e => updateClip(selectedTrack.id, selectedClip.id, { locked: e.target.checked })} />
          </div>
        </div>
      )}
    </div>
  );
}

function FXToggleRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="fx-toggle-row">
      <button
        className={`fx-toggle-btn ${active ? 'active' : ''}`}
        onClick={onToggle}
      >
        {active ? '◉' : '○'}
      </button>
      <span className="fx-toggle-label">{label}</span>
      {active && <span className="fx-active-badge">ON</span>}
    </div>
  );
}
