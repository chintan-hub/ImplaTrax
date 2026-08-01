/**
 * A tiny mutable bridge — NOT React context — that lets DataContext (an
 * ancestor of AuthProvider in the tree, see App.tsx) attribute actions
 * (movements, case/PO/loan events, sales) to whoever is actually signed in,
 * without DataProvider needing to consume AuthContext (which doesn't exist
 * yet at the point DataProvider renders). AuthProvider keeps this in sync
 * via a `useEffect` on `currentMember`; DataContext reads it at the moment
 * of each action, never destructures it once at module load.
 */
export interface CurrentActor {
  id: string
  name: string
}

const SYSTEM_ACTOR: CurrentActor = { id: 'system', name: 'System' }

let actor: CurrentActor = SYSTEM_ACTOR

export function setCurrentActor(next: CurrentActor | null) {
  actor = next ?? SYSTEM_ACTOR
}

export function getCurrentActor(): CurrentActor {
  return actor
}
