// RA: compatibility entry points never probe or mutate GitHub stars, including direct callers.
export const ORCA_REPO = 'stablyai/orca'
export async function checkOrcaStarred(): Promise<boolean | null> {
  return null
}
export async function starOrca(): Promise<boolean> {
  return false
}
export function __resetOrcaStarCheckForTests(): void {}
