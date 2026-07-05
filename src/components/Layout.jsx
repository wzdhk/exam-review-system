import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from './Footer'
import './Layout.css'

function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="layout">
      <nav className="nav">
        <div className="nav-content">
          <Link to="/" className="logo">
            <span className="logo-mark">K</span>
            <span>考试复习</span>
          </Link>
          <div className="nav-links">
            <Link to="/" className={isActive('/') ? 'active' : ''}>首页</Link>
            <Link to="/upload" className={isActive('/upload') ? 'active' : ''}>导入题库</Link>
            <Link to="/banks" className={isActive('/banks') ? 'active' : ''}>题库列表</Link>
            <Link to="/quiz" className={isActive('/quiz') ? 'active' : ''}>开始答题</Link>
            <Link to="/exams" className={isActive('/exams') ? 'active' : ''}>考试</Link>
            <Link to="/mistakes" className={isActive('/mistakes') ? 'active' : ''}>错题本</Link>
            {user && user.role === 'admin' && (
              <Link to="/admin" className={isActive('/admin') ? 'active admin-link' : 'admin-link'}>管理后台</Link>
            )}
          </div>
          <div className="user-menu">
            {user && (
              <>
                <span className="user-name">
                  {user.role === 'admin' && <span className="admin-badge">管理员</span>}
                  {user.username}
                </span>
                <button onClick={handleLogout} className="logout-btn">退出</button>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="main-content">{children}</main>
      <Footer />
    </div>
  )
}

export default Layout
