import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getQuestionBanks, deleteQuestionBank } from '../api'
import { useAuth } from '../context/AuthContext'
import './QuestionBanks.css'

function QuestionBanks() {
  const { user } = useAuth()
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBanks()
  }, [])

  const loadBanks = async () => {
    try {
      const data = await getQuestionBanks()
      setBanks(data)
    } catch (error) {
      console.error('Failed to load banks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (bank) => {
    const canDelete = user.role === 'admin' || bank.user_id === user.id
    if (!canDelete) {
      alert('你没有权限删除该题库')
      return
    }
    if (!confirm(`确定要删除题库"${bank.name}"吗？将同时删除其中的所有题目和错题记录。`)) return
    try {
      await deleteQuestionBank(bank.id)
      localStorage.removeItem(`quiz_state_${user.id}_${bank.id}`)
      setBanks(prev => prev.filter(b => b.id !== bank.id))
    } catch (error) {
      alert('删除失败：' + error.message)
    }
  }

  if (loading) {
    return <div className="banks-page"><div className="loading">加载题库中...</div></div>
  }

  if (banks.length === 0) {
    return (
      <div className="banks-page">
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h2>暂无题库</h2>
          <p>{user.role === 'admin' ? '当前还没有任何用户上传题库' : '请先导入你的第一个题库'}</p>
          <Link to="/upload" className="btn btn-primary">导入题库</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="banks-page">
      <div className="banks-header">
        <div>
          <h1 className="page-title">{user.role === 'admin' ? '所有题库' : '我的题库'}</h1>
          <p className="banks-subtitle">
            {user.role === 'admin' ? `管理员视角，共 ${banks.length} 个题库` : `共 ${banks.length} 个题库`}
          </p>
        </div>
        <Link to="/upload" className="btn btn-primary">导入新题库</Link>
      </div>

      <div className="banks-grid">
        {banks.map((bank, index) => {
          const canDelete = user.role === 'admin' || bank.user_id === user.id
          const isOwn = bank.user_id === user.id
          return (
            <motion.div
              key={bank.id}
              className="bank-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="bank-header">
                <h3 className="bank-name">{bank.name}</h3>
                {canDelete && (
                  <button onClick={() => handleDelete(bank)} className="delete-btn" title="删除题库">×</button>
                )}
              </div>
              {user.role === 'admin' && !isOwn && (
                <div className="owner-tag">所有者：{bank.owner_username}</div>
              )}
              <p className="bank-description">{bank.description}</p>
              <div className="bank-stats">
                <div className="bank-stat">
                  <span className="stat-icon">📝</span>
                  <span className="stat-value">{bank.question_count}</span>
                  <span className="stat-label">道题目</span>
                </div>
              </div>
              <Link to={`/quiz?bankId=${bank.id}`} className="btn btn-primary btn-start">开始答题</Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default QuestionBanks
