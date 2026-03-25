import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import Login from './pages/Login'
import Register from './pages/Register'
import MatchPage from './pages/MatchPage'
import CreateMatch from './pages/CreateMatch'
import Home from './pages/Home'
import Profile from './pages/Profile'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <Routes>
            {/* Públicas */}
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/partido/:slug"   element={<MatchPage />} />

            {/* Protegidas */}
            <Route path="/"      element={<AuthGuard><Home /></AuthGuard>} />
            <Route path="/crear"   element={<AuthGuard><CreateMatch /></AuthGuard>} />
            <Route path="/perfil" element={<AuthGuard><Profile /></AuthGuard>} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
