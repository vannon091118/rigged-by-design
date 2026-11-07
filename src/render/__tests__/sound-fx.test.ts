/**
 * @test-target: src/render/sound-fx.ts
 * @error-code: ERR-1003
 *
 * Lautstaerke und Kanaele sind Geraeteeinstellungen: sie muessen klemmbar, getrennt
 * und unabhaengig von der Stummschaltung sein.
 */
import { describe, expect, it } from 'vitest';
import { setChannelVolume, setMasterVolume, setMuted, SOUND_CHANNELS, soundSettings } from '../sound-fx';

describe('Sound-Kanäle', () => {
  it('klemmt Lautstärken auf 0..1 und trennt die Kanäle', () => {
    setMuted(false);
    setMasterVolume(0.5);
    setChannelVolume('combat', 2);
    setChannelVolume('game', -3);
    const settings = soundSettings();
    expect(settings.master).toBe(0.5);
    expect(settings.channels.combat).toBe(1);
    expect(settings.channels.game).toBe(0);
    expect(settings.channels.ui).toBeGreaterThan(0);
  });

  it('hält die Stummschaltung von den Kanalwerten getrennt', () => {
    setMasterVolume(0.8);
    setMuted(true);
    expect(soundSettings().muted).toBe(true);
    expect(soundSettings().master).toBe(0.8);
    setMuted(false);
    expect(soundSettings().muted).toBe(false);
    expect(SOUND_CHANNELS.map((channel) => channel.id)).toEqual(['game', 'combat', 'ui']);
  });
});
