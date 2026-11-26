export function notify(msg: string): void {
  window.dispatchEvent(new CustomEvent<string>('skouar:toast', { detail: msg }))
}
