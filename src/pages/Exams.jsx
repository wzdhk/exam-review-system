import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getExams } from '../api'
import './Exams.css'

const STATUS_LABELS = {
  in_progress: '进行中',
  submitted: '已交卷',
}

function Exams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getExams()
      .then(data => setExams(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="exams-page"><div className="loading">加载中...</div></div>

  if (exams.length === 0) {
    return (
      <div className="exams-page">
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h2>暂无考试</h2>
          <p>管理员发布考试后，这里会显示可参加的考试。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="exams-page">
      <div className="exams-header">
        <h1 className="page-title">考试</h1>
        <p className="exams-subtitle">选一场进入考试，题目从题库随机抽取，限时作答</p>
      </div>

      <div className="exams-grid">
        {exams.map((exam, idx) => {
          const done = exam.attempt_status === 'submitted'
          const doing = exam.attempt_status === 'in_progress'
          return (
            <motion.div
              key={exam.id}
              className={`exam-card ${done ? 'done' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <h3 className="exam-title">{exam.title}</h3>
              <div className="exam-meta">
                <span>📚 {exam.bank_name}</span>
                <span>⏱ {exam.duration_minutes} 分钟</span>
                <span>📝 {exam.total_questions} 道题</span>
              </div>
              <div className="exam-plan">
                {exam.plan.map((p, i) => (
                  <span key={i} className="plan-chip">
                    {typeLabel(p.type)} × {p.count}
                  </span>
                ))}
              </div>
              {done && (
                <div className="exam-score">
                  得分：<strong>{exam.attempt_score} / {exam.attempt_total}</strong>
                </div>
              )}
              <div className="exam-actions">
                {done ? (
                  <Link to={`/exam/${exam.id}`} className="btn btn-secondary">查看答卷</Link>
                ) : doing ? (
                  <Link to={`/exam/${exam.id}`} className="btn btn-primary">继续考试</Link>
                ) : (
                  <Link to={`/exam/${exam.id}`} className="btn btn-primary">开始考试</Link>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function typeLabel(t) {
  const map = { multiple_choice: '单选', multiple_select: '多选', judgment: '判断', fill_blank: '填空', essay: '简答' }
  return map[t] || t
}

export default Exams
