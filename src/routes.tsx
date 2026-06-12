import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch } from 'wouter'

// Each feature is a lazy route chunk. The landing page ships in M1; until
// then both / and /app serve the live session so the live URL is unchanged.
const LiveSessionPage = lazy(() => import('./features/live-session/LiveSessionPage'))

function RouteFallback() {
  return <div className="min-h-screen bg-slate-950" aria-hidden />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={LiveSessionPage} />
        <Route path="/app" component={LiveSessionPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Suspense>
  )
}
