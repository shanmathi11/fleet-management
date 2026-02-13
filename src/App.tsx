import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Iridescence from './components/Iridescence'
import Landing from './pages/Landing'
import DriverView from './pages/DriverView'
import StudentView from './pages/StudentView'
import GridDistortionDemo from './pages/GridDistortionDemo'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="fixed inset-0 z-0">
          <Iridescence
            color={[0.5, 0.6, 0.8]}
            mouseReact
            amplitude={0.1}
            speed={1}
          />
        </div>
        <div className="relative z-10 min-h-screen">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/driver" element={<DriverView />} />
            <Route path="/student" element={<StudentView />} />
            <Route path="/demo" element={<GridDistortionDemo />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
