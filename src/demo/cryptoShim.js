// The browser build swaps node:crypto for this file.
export function randomUUID() {
  return globalThis.crypto.randomUUID();
}
