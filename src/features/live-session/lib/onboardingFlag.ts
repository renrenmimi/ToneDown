export const ONBOARDING_KEY = 'tonedown.onboarded.v1'

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== '1'
  } catch {
    return false
  }
}
