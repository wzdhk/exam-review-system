import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getStats } from '../api'
import { useAuth } from '../context/AuthContext'
import './Home.css'

function Home() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    total: 0,
    banks: 0,
    attempted: 0,
    correct: 0,
    mistakes: 0
  })

  useEffect(() => {
    getStats()
      .then(data => setStats(data))
      .catch(err => console.error('Failed to load stats:', err))
  }, [])

  const accuracy = stats.attempted > 0
    ? ((stats.correct / stats.attempted) * 100).toFixed(1)
    : 0

  return (
    <div className="home">
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

      <div className="features">
        <h2 className="section-title">功能特点</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔐</div>
            <h3>账户隔离</h3>
            <p>每个用户的题库和错题独立保存，互不干扰</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>题型分类</h3>
            <p>选择 / 判断 / 填空 / 简答 / 编程 五种题型，可按类型练习</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💾</div>
            <h3>进度保留</h3>
            <p>离开后再回来，继续上次的答题位置和选择</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>错题分类</h3>
            <p>错题按题库归类，针对性巩固薄弱知识点</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
