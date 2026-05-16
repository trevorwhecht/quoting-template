export function newLocalId(): string {
  return `local-${Date.now()}-${Math.random()}`
}
