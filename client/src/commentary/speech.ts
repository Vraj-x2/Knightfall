// Reads commentary aloud with the browser's built-in voices; nothing is sent anywhere.
const VOICE_KEY = 'chess-commentator-voice';

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function loadVoiceOn(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveVoiceOn(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  if (!on) stopSpeaking();
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

// A new line replaces whatever is still being said, so the voice never falls behind the game.
export function speak(text: string) {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.08;
  utterance.pitch = 1.05;
  const english = synth.getVoices().find((v) => v.lang.startsWith('en'));
  if (english) utterance.voice = english;
  synth.speak(utterance);
}
