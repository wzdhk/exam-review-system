import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getQuestions, getQuestionTypes, submitAnswer } from '../api'
import { useAuth } from '../context/AuthContext'
import './Quiz.css'

const TYPE_LABELS = {
  all: '全部',
  multiple_choice: '单选题',
  multiple_select: '多选题',
  judgment: '判断题',
  fill_blank: '填空题',
  essay: '简答题',
  coding: '编程题'
}

const TYPE_ORDER = ['all', 'multiple_choice', 'multiple_select', 'judgment', 'fill_blank', 'essay', 'coding']

function Quiz() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const bankId = searchParams.get('bankId') ? parseInt(searchParams.get('bankId')) : null
  const typeFilter = searchParams.get('type') || 'all'

  const [allQuestions, setAllQuestions] = useState([])
  const [typeCounts, setTypeCounts] = useState({})
  const [answers, setAnswers] = useState({})
  const [indices, setIndices] = useState({})
  const [userAnswer, setUserAnswer] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [referenceAnswer, setReferenceAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const restoredKeyRef = useRef(null)

  const storageKey = user && bankId ? `quiz_state_${user.id}_${bankId}` : null

  const questions = useMemo(() => {
    if (typeFilter === 'all') return allQuestions
    return allQuestions.filter(q => q.type === typeFilter)
  }, [allQuestions, typeFilter])

  const currentIndex = indices[typeFilter] || 0
  const currentQuestion = questions[currentIndex]
  const result = currentQuestion ? answers[currentQuestion.id] : null
  const showResult = !!result
  const isSubjective = currentQuestion && (currentQuestion.type === 'essay' || currentQuestion.type === 'coding')

  const setCurrentIndex = (i) => {
    setIndices(prev => ({ ...prev, [typeFilter]: i }))
  }

  useEffect(() => {
    if (!bankId) { setLoading(false); return }
    setLoading(true)
    Promise.all([getQuestions(bankId), getQuestionTypes(bankId)])
      .then(([qs, counts]) => { setAllQuestions(qs); setTypeCounts(counts) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [bankId])

  useEffect(() => {
    if (!storageKey) return
    if (restoredKeyRef.current === storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ answers, indices }))
      } catch (_) {}
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const data = JSON.parse(raw)
        setAnswers(data.answers || {})
        setIndices(data.indices || {})
      } else {
        setAnswers({})
        setIndices({})
      }
    } catch (_) {
      setAnswers({})
      setIndices({})
    }
    restoredKeyRef.current = storageKey
  }, [storageKey, answers, indices])

  useEffect(() => {
    if (!currentQuestion) {
      setUserAnswer('')
      setShowReference(false)
      setReferenceAnswer('')
      return
    }
    const saved = answers[currentQuestion.id]
    setUserAnswer(saved ? saved.userAnswer : '')
    setShowReference(false)
    setReferenceAnswer(saved && saved.referenceShown ? saved.correctAnswer : '')
  }, [currentQuestion && currentQuestion.id])

  useEffect(() => {
    if (questions.length > 0 && currentIndex >= questions.length) {
      setCurrentIndex(Math.max(0, questions.length - 1))
    }
  }, [questions.length, currentIndex, typeFilter])

  const handleTypeChange = (t) => {
    const params = new URLSearchParams(searchParams)
    if (t === 'all') params.delete('type'); else params.set('type', t)
    setSearchParams(params, { replace: true })
  }

  const handleSubmit = async () => {
    if (!currentQuestion) return
    if (!userAnswer.toString().trim()) { alert('请先作答'); return }
    setSubmitting(true)
    try {
      const data = await submitAnswer(currentQuestion.id, userAnswer)
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          userAnswer,
          correct: data.correct,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          referenceShown: false
        }
      }))
    } catch (err) {
      alert('提交失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleShowReference = () => {
    if (!currentQuestion) return
    if (!userAnswer.toString().trim()) { alert('请先作答再查看参考答案'); return }
    setReferenceAnswer(currentQuestion.answer)
    setShowReference(true)
  }

  const handleSelfJudge = async (correct) => {
    if (!currentQuestion) return
    setSubmitting(true)
    try {
      const data = await submitAnswer(currentQuestion.id, userAnswer, correct)
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          userAnswer,
          correct: data.correct,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          referenceShown: true
        }
      }))
    } catch (err) {
      alert('提交失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    if (!currentQuestion) return
    setAnswers(prev => {
      const copy = { ...prev }
      delete copy[currentQuestion.id]
      return copy
    })
    setUserAnswer('')
    setShowReference(false)
    setReferenceAnswer('')
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1)
  }
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }
  const handleJump = (i) => setCurrentIndex(i)

  if (loading) return <div className="quiz-page"><div className="loading">加载题目中...</div></div>

  if (!bankId) {
    return (
      <div className="quiz-page">
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h2>请先选择题库</h2>
          <Link to="/banks" className="btn btn-primary">前往题库列表</Link>
        </div>
      </div>
    )
  }

  if (allQuestions.length === 0) {
    return (
      <div className="quiz-page">
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h2>该题库暂无题目</h2>
          <Link to="/banks" className="btn btn-primary">选择其他题库</Link>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-page">
        <div className="quiz-header">
          <h1 className="page-title">答题练习</h1>
          <Link to="/banks" className="btn btn-secondary">返回题库</Link>
        </div>
        <TypeFilter typeFilter={typeFilter} typeCounts={typeCounts} total={allQuestions.length} onChange={handleTypeChange} />
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h2>该题型暂无题目</h2>
          <p>试试其他题型</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return <div className="quiz-page"><div className="loading">准备题目中...</div></div>
  }

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <h1 className="page-title">答题练习</h1>
        <div className="header-right">
          <div className="progress-info">题目 {currentIndex + 1} / {questions.length}</div>
          <Link to="/banks" className="btn btn-secondary btn-small">返回题库</Link>
        </div>
      </div>

      <TypeFilter typeFilter={typeFilter} typeCounts={typeCounts} total={allQuestions.length} onChange={handleTypeChange} />

      <AnimatePresence mode="wait">
        <motion.div
          key={`${typeFilter}-${currentIndex}`}
          className="quiz-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <div className="question-type-badge">{TYPE_LABELS[currentQuestion.type] || currentQuestion.type}</div>
          <h2 className="question-text">{currentQuestion.question}</h2>

          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="options">
              {currentQuestion.options.map(option => (
                <label
                  key={option.label}
                  className={`option ${userAnswer === option.label ? 'selected' : ''} ${
                    showResult && option.label === currentQuestion.answer ? 'correct' : ''
                  } ${
                    showResult && userAnswer === option.label && !result.correct ? 'incorrect' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={option.label}
                    checked={userAnswer === option.label}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={showResult}
                  />
                  <span className="option-label">{option.label}</span>
                  <span className="option-text">{option.text}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'multiple_select' && currentQuestion.options && (() => {
            const selected = userAnswer ? userAnswer.split('') : []
            const correctSet = (currentQuestion.answer || '').toUpperCase().split('')
            const toggle = (label) => {
              if (showResult) return
              const next = new Set(selected)
              if (next.has(label)) next.delete(label); else next.add(label)
              const sorted = Array.from(next).sort().join('')
              setUserAnswer(sorted)
            }
            return (
              <div className="options">
                <div className="multi-hint">多选题 · 可勾选多个选项</div>
                {currentQuestion.options.map(option => {
                  const isPicked = selected.includes(option.label)
                  const isCorrect = correctSet.includes(option.label)
                  return (
                    <label
                      key={option.label}
                      className={`option ${isPicked ? 'selected' : ''} ${
                        showResult && isCorrect ? 'correct' : ''
                      } ${
                        showResult && isPicked && !isCorrect ? 'incorrect' : ''
                      }`}
                      onClick={(e) => { e.preventDefault(); toggle(option.label) }}
                    >
                      <input
                        type="checkbox"
                        value={option.label}
                        checked={isPicked}
                        readOnly
                        disabled={showResult}
                      />
                      <span className="option-label">{option.label}</span>
                      <span className="option-text">{option.text}</span>
                    </label>
                  )
                })}
              </div>
            )
          })()}

          {currentQuestion.type === 'judgment' && (
            <div className="options">
              {[{ v: '对', icon: '√' }, { v: '错', icon: '×' }].map(opt => (
                <label
                  key={opt.v}
                  className={`option ${userAnswer === opt.v ? 'selected' : ''} ${
                    showResult && currentQuestion.answer === opt.v ? 'correct' : ''
                  } ${
                    showResult && userAnswer === opt.v && !result.correct ? 'incorrect' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={opt.v}
                    checked={userAnswer === opt.v}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={showResult}
                  />
                  <span className="option-label judgment-icon">{opt.icon}</span>
                  <span className="option-text">{opt.v}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'fill_blank' && (
            <div className="answer-input">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="请输入答案（多个答案用 / 分隔表示任意一个均可）"
                disabled={showResult}
                className="text-input"
              />
            </div>
          )}

          {currentQuestion.type === 'essay' && (
            <div className="answer-input">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="请输入答案"
                disabled={showResult}
                className="textarea-input"
                rows="6"
              />
            </div>
          )}

          {currentQuestion.type === 'coding' && (
            <div className="answer-input">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="请输入代码"
                disabled={showResult}
                className="textarea-input code-input"
                rows="12"
                spellCheck={false}
              />
            </div>
          )}

          {isSubjective && !showResult && showReference && (
            <div className="reference-box">
              <div className="reference-title">参考答案</div>
              <pre className="reference-content">{referenceAnswer}</pre>
              <div className="self-judge-actions">
                <button onClick={() => handleSelfJudge(true)} disabled={submitting} className="btn btn-success">我答对了</button>
                <button onClick={() => handleSelfJudge(false)} disabled={submitting} className="btn btn-danger">我答错了</button>
              </div>
            </div>
          )}

          {showResult && (
            <motion.div
              className={`result-box ${result.correct ? 'correct' : 'incorrect'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="result-icon">{result.correct ? '✅' : '❌'}</div>
              <div className="result-content">
                <div className="result-title">{result.correct ? '回答正确！' : '回答错误'}</div>
                {!result.correct && (
                  <div className="result-answer">
                    正确答案：<strong><pre className="inline-answer">{result.correctAnswer}</pre></strong>
                  </div>
                )}
                <div className="result-message">{result.explanation}</div>
              </div>
            </motion.div>
          )}

          <div className="quiz-actions">
            {!showResult && !isSubjective && (
              <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
                {submitting ? '提交中...' : '提交答案'}
              </button>
            )}
            {!showResult && isSubjective && !showReference && (
              <button onClick={handleShowReference} className="btn btn-primary">查看参考答案并自评</button>
            )}
            {showResult && (
              <div className="result-actions">
                <button onClick={handleRetry} className="btn btn-secondary">重做本题</button>
                <button onClick={handleNext} className="btn btn-primary" disabled={currentIndex === questions.length - 1}>
                  {currentIndex === questions.length - 1 ? '已是最后一题' : '下一题'}
                </button>
              </div>
            )}

            <div className="navigation">
              <button onClick={handlePrev} disabled={currentIndex === 0} className="btn btn-secondary btn-nav">上一题</button>
              <button onClick={handleNext} disabled={currentIndex === questions.length - 1} className="btn btn-secondary btn-nav">跳过</button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <QuestionMap questions={questions} answers={answers} currentIndex={currentIndex} onJump={handleJump} />
    </div>
  )
}

function TypeFilter({ typeFilter, typeCounts, total, onChange }) {
  return (
    <div className="type-filter">
      {TYPE_ORDER.map(t => {
        const count = t === 'all' ? total : (typeCounts[t] || 0)
        if (t !== 'all' && count === 0) return null
        return (
          <button
            key={t}
            className={`type-chip ${typeFilter === t ? 'active' : ''}`}
            onClick={() => onChange(t)}
          >
            {TYPE_LABELS[t]} <span className="type-count">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

function QuestionMap({ questions, answers, currentIndex, onJump }) {
  if (questions.length <= 1) return null
  return (
    <div className="question-map">
      <div className="question-map-title">题目导航</div>
      <div className="question-map-grid">
        {questions.map((q, i) => {
          const a = answers[q.id]
          let cls = 'qm-cell'
          if (i === currentIndex) cls += ' current'
          if (a) cls += a.correct ? ' done-correct' : ' done-wrong'
          return (
            <button key={q.id} className={cls} onClick={() => onJump(i)} title={q.question.slice(0, 30)}>
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default Quiz

