import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Register from './pages/Register'
import MatchPage from './pages/MatchPage'
import CreateMatch from './pages/CreateMatch'
import Home from './pages/Home'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import Friends from './pages/Friends'

function AppContent() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const hideBottomNav = !user || ['/login', '/register'].includes(pathname) || pathname.startsWith('/partido/')

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Routes>
        {/* Públicas */}
        <Route path="/login"         element={<Login />} />
        <Route path="/register"      element={<Register />} />
        <Route path="/partido/:slug" element={<MatchPage />} />

        {/* Protegidas */}
        <Route path="/"            element={<AuthGuard><Home /></AuthGuard>} />
        <Route path="/crear"       element={<AuthGuard><CreateMatch /></AuthGuard>} />
        <Route path="/perfil"      element={<AuthGuard><Profile /></AuthGuard>} />
        <Route path="/usuario/:id" element={<AuthGuard><PublicProfile /></AuthGuard>} />
        <Route path="/amigos"      element={<AuthGuard><Friends /></AuthGuard>} />
        <Route path="/amigos/:id"  element={<AuthGuard><Friends /></AuthGuard>} />
      </Routes>

      {!hideBottomNav && <BottomNav />}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
