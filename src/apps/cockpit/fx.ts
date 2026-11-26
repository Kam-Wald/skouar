export function beep(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new AC()
    const play = (f: number, t0: number): void => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.connect(g)
      g.connect(ac.destination)
      o.frequency.value = f
      g.gain.setValueAtTime(0.12, ac.currentTime + t0)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t0 + 0.3)
      o.start(ac.currentTime + t0)
      o.stop(ac.currentTime + t0 + 0.32)
    }
    play(880, 0)
    play(1174, 0.18)
  } catch {
  }
}

export function notifyOS(title: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title)
  } catch {
  }
}

export async function askNotifPermission(): Promise<void> {
  try {
    await Notification.requestPermission()
  } catch {
  }
}
