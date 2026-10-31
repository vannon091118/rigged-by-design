/** Lautstaerke, Kanaele und Musik: Master plus Spiele, Kampf, Bedienung getrennt. */
import { useState } from 'react';
import {
  SOUND_CHANNELS, isMuted, setChannelVolume, setMasterVolume, setMuted, soundSettings,
  type SoundChannel,
} from '../render/sound-fx';
import { musicVolume, setMusicVolume } from '../render/music';
import { PopupShell } from './popup-shell';

interface Props {
  readonly onClose: () => void;
}

const percent = (value: number): string => `${Math.round(value * 100)} %`;

export function SoundPopup({ onClose }: Props) {
  const [settings, setSettings] = useState(soundSettings);
  const refresh = (): void => setSettings(soundSettings());

  const change = (channel: SoundChannel, value: number): void => {
    setChannelVolume(channel, value);
    refresh();
  };

  return (
    <PopupShell eyebrow="GEHOER · GERAETEEINSTELLUNG" title="Sound" onClose={onClose}>
      <p className="hint">
        Die Kanaele werden getrennt geregelt und im Browser gemerkt, nicht im Spielstand:
        es ist eine Geraeteeinstellung, kein Weltzustand.
      </p>
      <label className="sound-row">
        <span>Gesamt</span>
        <input
          type="range" min="0" max="100" step="1"
          value={Math.round(settings.master * 100)}
          onChange={(event) => { setMasterVolume(Number(event.target.value) / 100); refresh(); }}
        />
        <b>{percent(settings.master)}</b>
      </label>
      <label className="sound-row">
        <span>Musik</span>
        <input
          type="range" min="0" max="100" step="1"
          value={Math.round(musicVolume() * 100)}
          onChange={(event) => { setMusicVolume(Number(event.target.value) / 100); refresh(); }}
        />
        <b>{percent(musicVolume())}</b>
      </label>
      {SOUND_CHANNELS.map((channel) => (
        <label key={channel.id} className="sound-row">
          <span>{channel.label}</span>
          <input
            type="range" min="0" max="100" step="1"
            value={Math.round(settings.channels[channel.id] * 100)}
            onChange={(event) => change(channel.id, Number(event.target.value) / 100)}
          />
          <b>{percent(settings.channels[channel.id])}</b>
        </label>
      ))}
      <div className="sound-actions">
        <button
          type="button"
          className={`btn${settings.muted ? ' warm' : ''}`}
          aria-pressed={settings.muted}
          onClick={() => { setMuted(!isMuted()); refresh(); }}
        >
          {settings.muted ? 'WIEDER EINSCHALTEN' : 'ALLES STUMM'}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setMasterVolume(1);
            for (const channel of SOUND_CHANNELS) setChannelVolume(channel.id, 1);
            setMuted(false);
            refresh();
          }}
        >
          ZURÜCKSETZEN
        </button>
      </div>
    </PopupShell>
  );
}
