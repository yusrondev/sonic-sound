import React, { useState, useRef, useEffect } from 'react';
import {
  Music, Save, FolderOpen, Download, Upload, Undo2, Redo2,
  Scissors, Copy, Clipboard, Trash2, FileMusic, Settings,
  ZoomIn, ZoomOut, Grid3x3, SlidersHorizontal, ChevronDown
} from 'lucide-react';
import { useProjectStore, buildDemoProject } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { audioEngine } from '../../engine/AudioEngine';
import './Toolbar.css';

interface MenuDef {
  label: string;
  items: MenuItemDef[];
}
interface MenuItemDef {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

export function Toolbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { name, setProjectName, saveProject, newProject, loadProject, undo, redo, bpm, setBpm, key, setKey, timeSignature } = useProjectStore();
  const { setZoom, zoom, addToast, setGridVisible, gridVisible, setBottomTab, setBrowserOpen } = useUIStore();

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleImportAudio = () => {
    setOpenMenu(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        try {
          const { buffer, waveformData } = await audioEngine.loadAudioFile(file);
          const { addTrack, addClip, tracks } = useProjectStore.getState();
          addTrack('audio', file.name.replace(/\.[^/.]+$/, ''));
          const newTracks = useProjectStore.getState().tracks;
          const newTrack = newTracks[newTracks.length - 1];
          addClip({
            trackId: newTrack.id, name: file.name,
            type: 'audio', startBeat: 0,
            durationBeats: Math.round((buffer.duration * bpm) / 60),
            audioBuffer: buffer, waveformData,
            fadeIn: 0, fadeOut: 0, gain: 1, locked: false, muted: false,
          });
          addToast({ message: `Imported: ${file.name}`, type: 'success' });
        } catch (err) {
          addToast({ message: `Failed to import: ${file.name}`, type: 'error' });
        }
      }
    };
    input.click();
  };

  const handleExport = () => {
    addToast({ message: 'Export coming soon — architecture ready for WAV/MP3 export', type: 'info' });
    setOpenMenu(null);
  };

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New Project', shortcut: 'Ctrl+N', action: () => { newProject(); setOpenMenu(null); } },
        { label: 'Load Demo Song', action: () => { loadProject(buildDemoProject()); addToast({ message: 'Demo Song loaded', type: 'success' }); setOpenMenu(null); } },
        { label: 'Save Project', shortcut: 'Ctrl+S', action: () => { saveProject(); addToast({ message: 'Project saved', type: 'success' }); setOpenMenu(null); } },
        { separator: true, label: '', action: () => {} },
        { label: 'Import Audio...', action: handleImportAudio },
        { separator: true, label: '', action: () => {} },
        { label: 'Export WAV', action: handleExport },
        { label: 'Export MP3', action: handleExport },
        { label: 'Export Stems', action: handleExport },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => { undo(); setOpenMenu(null); } },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => { redo(); setOpenMenu(null); } },
        { separator: true, label: '', action: () => {} },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => setOpenMenu(null) },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => setOpenMenu(null) },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => setOpenMenu(null) },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => setOpenMenu(null) },
        { separator: true, label: '', action: () => {} },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => setOpenMenu(null) },
        { label: 'Delete', shortcut: 'Del', action: () => setOpenMenu(null) },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom In', shortcut: '=', action: () => { setZoom(zoom + 8); setOpenMenu(null); } },
        { label: 'Zoom Out', shortcut: '-', action: () => { setZoom(zoom - 8); setOpenMenu(null); } },
        { separator: true, label: '', action: () => {} },
        { label: `${gridVisible ? 'Hide' : 'Show'} Grid`, action: () => { setGridVisible(!gridVisible); setOpenMenu(null); } },
        { label: 'Toggle Browser', action: () => { setBrowserOpen(true); setOpenMenu(null); } },
        { separator: true, label: '', action: () => {} },
        { label: 'Mixer', action: () => { setBottomTab('mixer'); setOpenMenu(null); } },
        { label: 'Piano Roll', action: () => { setBottomTab('piano'); setOpenMenu(null); } },
        { label: 'Drum Sequencer', action: () => { setBottomTab('drum'); setOpenMenu(null); } },
      ]
    },
  ];

  return (
    <div className="toolbar" ref={menuRef}>
      {/* Logo */}
      <div className="toolbar-logo">
        <Music size={14} color="#3b82f6" />
        <span className="toolbar-brand">SonicSound</span>
      </div>
      <div className="sep-v" style={{ height: 20 }} />

      {/* Menus */}
      <div className="toolbar-menus">
        {menus.map(menu => (
          <div key={menu.label} className="menu-item-wrapper">
            <button
              className={`toolbar-menu-btn ${openMenu === menu.label ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <div className="dropdown-menu">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <div key={i} className="menu-separator" />
                  ) : (
                    <button
                      key={i}
                      className="menu-item"
                      onClick={item.action}
                      disabled={item.disabled}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Project Name */}
      <div className="toolbar-project">
        {editingName ? (
          <input
            ref={nameRef}
            className="project-name-input"
            defaultValue={name}
            autoFocus
            onBlur={e => { setProjectName(e.target.value); setEditingName(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { setProjectName(e.currentTarget.value); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
          />
        ) : (
          <span className="project-name" onClick={() => setEditingName(true)} title="Click to rename">
            {name}
          </span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="toolbar-actions">
        <button className="btn-icon" data-tooltip="Undo (Ctrl+Z)" onClick={undo}><Undo2 size={13} /></button>
        <button className="btn-icon" data-tooltip="Redo (Ctrl+Shift+Z)" onClick={redo}><Redo2 size={13} /></button>
        <div className="sep-v" style={{ height: 20 }} />
        <button className="btn-icon" data-tooltip="Save (Ctrl+S)" onClick={() => { saveProject(); addToast({ message: 'Project saved', type: 'success' }); }}>
          <Save size={13} />
        </button>
        <button className="btn-icon" data-tooltip="Import Audio" onClick={handleImportAudio}><Upload size={13} /></button>
        <button className="btn-icon" data-tooltip="Export" onClick={handleExport}><Download size={13} /></button>
        <div className="sep-v" style={{ height: 20 }} />
        <button className="btn-icon" data-tooltip="Zoom In" onClick={() => setZoom(zoom + 8)}><ZoomIn size={13} /></button>
        <button className="btn-icon" data-tooltip="Zoom Out" onClick={() => setZoom(zoom - 8)}><ZoomOut size={13} /></button>
        <button className={`btn-icon ${gridVisible ? 'active' : ''}`} data-tooltip="Toggle Grid" onClick={() => setGridVisible(!gridVisible)}>
          <Grid3x3 size={13} />
        </button>
      </div>
    </div>
  );
}
