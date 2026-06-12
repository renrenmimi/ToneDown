import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch } from 'wouter'

// Each feature is a lazy route chunk.
const LandingPage = lazy(() => import('./features/landing/LandingPage'))
const LiveSessionPage = lazy(() => import('./features/live-session/LiveSessionPage'))
const HistoryPage = lazy(() => import('./features/history/HistoryPage'))
const SparringPage = lazy(() => import('./features/sparring/SparringPage'))
const GymPage = lazy(() => import('./features/drills/GymPage'))
const DemoPage = lazy(() => import('./features/demo/DemoPage'))

function RouteFallback() {
  return <div className="min-h-screen bg-surface" aria-hidden />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/app" component={LiveSessionPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/spar" component={SparringPage} />
        <Route path="/gym" component={GymPage} />
        <Route path="/demo" component={DemoPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Suspense>
  )
}
