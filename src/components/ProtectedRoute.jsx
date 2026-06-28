import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: '#8A8A80' }}>加载中...</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: '#8A8A80' }}>加载中...</div>
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}
