import { createContext, useContext, useEffect, useState } from 'react'
import { me, login as apiLogin, register as apiRegister, logout as apiLogout, setToken, clearToken, getToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    me()
      .then(u => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const data = await apiLogin(username, password)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const register = async (username, password) => {
    const data = await apiRegister(username, password)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try { await apiLogout() } catch (_) {}
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
