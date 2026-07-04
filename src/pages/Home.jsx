import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getStats, getAnnouncements } from '../api'
import { useAuth } from '../context/AuthContext'
import './Home.css'

function AnnouncementModal({ announcement, onDismiss }) {
  const delay = announcement.delay_seconds || 0
  const [countdown, setCountdown] = useState(delay)
  const timerRef = useRef(null)

  useEffect(() => {
    if (delay <= 0) return
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [delay])

  return (
    <div className="ann-overlay">
      <motion.div
        className="ann-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2 }}
      >
        <div className="ann-modal-icon">📢</div>
        <h3 className="ann-modal-title">系统公告</h3>
        <p className="ann-modal-content">{announcement.content}</p>
        <div className="ann-modal-footer">
          <span className="ann-meta">{announcement.author} · {new Date(announcement.created_at).toLocaleDateString('zh-CN')}</span>
          <button
            className="btn btn-primary ann-close-btn"
            onClick={onDismiss}
            disabled={countdown > 0}
          >
            {countdown > 0 ? `${countdown}秒后可关闭` : '我知道了'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Home() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, banks: 0, attempted: 0, correct: 0, mistakes: 0 })
  const [announcements, setAnnouncements] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_announcements') || '[]') } catch { return [] }
  })

  useEffect(() => {
    getStats().then(data => setStats(data)).catch(() => {})
    getAnnouncements().then(data => setAnnouncements(data)).catch(() => {})
  }, [])

  const dismiss = (id) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem('dismissed_announcements', JSON.stringify(next))
  }

  const pending = announcements.filter(a => !dismissed.includes(a.id))
  const current = pending[0] || null

  const accuracy = stats.attempted > 0
    ? ((stats.correct / stats.attempted) * 100).toFixed(1)
    : 0

  return (
    <div className="home">
      <AnimatePresence>
        {current && (
          <AnnouncementModal
            key={current.id}
            announcement={current}
            onDismiss={() => dismiss(current.id)}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="hero-badge">
          <span className="badge">欢迎，{user?.username || '同学'}</span>
        </div>
        <h1 className="hero-title">
          大学期末<em>考试复习</em>系统
        </h1>
        <p className="hero-subtitle">
          导入题库、分类练习、错题追踪 — 让复习更高效
        </p>
        <div className="hero-actions">
          <Link to="/banks" className="btn btn-primary">选择题库</Link>
          <Link to="/upload" className="btn btn-secondary">导入题库</Link>
        </div>
      </motion.div>

      <div className="stats-grid">
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="stat-icon">📚</div>
          <div className="stat-value">{stats.banks}</div>
          <div className="stat-label">{user?.role === 'admin' ? '全部题库' : '我的题库'}</div>
        </motion.div>
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">题目总量</div>
        </motion.div>
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="stat-icon">✅</div>
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">正确率</div>
        </motion.div>
        <motion.div className="stat-card highlight" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="stat-icon">📖</div>
          <div className="stat-value">{stats.mistakes}</div>
          <div className="stat-label">错题数量</div>
        </motion.div>
      </div>

      <div className="steps">
        <h2 className="section-title">怎么用</h2>
        <div className="steps-list">
          <Link to="/upload" className="step-card">
            <div className="step-num">1</div>
            <h3>上传题库</h3>
            <p>把 PDF、Word 或 TXT 格式的题库文件传上来，系统自动识别题目和答案。</p>
          </Link>
          <Link to="/banks" className="step-card">
            <div className="step-num">2</div>
            <h3>选一个题库</h3>
            <p>题库列表里挑一个，能看到题目数量，点进去就能开始。</p>
          </Link>
          <Link to="/quiz" className="step-card">
            <div className="step-num">3</div>
            <h3>开始刷题</h3>
            <p>答完立刻显示对错和正确答案，中途退出下次还能接着上次的位置继续。</p>
          </Link>
          <Link to="/mistakes" className="step-card">
            <div className="step-num">4</div>
            <h3>回头看错题本</h3>
            <p>答错的题会自动收进错题本，考前挑这些重点复习就行，不用自己记。</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Home
