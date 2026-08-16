import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import HostCreate from './pages/HostCreate'
import HostReview from './pages/HostReview'
import HostControl from './pages/HostControl'
import HostAnalytics from './pages/HostAnalytics'
import Join from './pages/Join'
import Play from './pages/Play'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host/new" element={<HostCreate />} />
        <Route path="/host/:sessionId/review" element={<HostReview />} />
        <Route path="/host/:sessionId/control" element={<HostControl />} />
        <Route path="/host/:sessionId/analytics" element={<HostAnalytics />} />
        <Route path="/join" element={<Join />} />
        <Route path="/play/:roomCode" element={<Play />} />
      </Routes>
    </BrowserRouter>
  )
}
