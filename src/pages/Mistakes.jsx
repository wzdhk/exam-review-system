import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getMistakes, getMistakeBanks, submitAnswer, deleteMistake } from '../api'
import './Mistakes.css'

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

function Mistakes() {
  const [mistakes, setMistakes] = useState([])
  const [bankList, setBankList] = useState([])
  const [bankFilter, setBankFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [mode, setMode] = useState('view')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([getMistakes(), getMistakeBanks()])
      .then(([ms, bs]) => { setMistakes(ms); setBankList(bs) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return mistakes.filter(m =>
      (bankFilter === 'all' || m.bank_id === parseInt(bankFilter)) &&
      (typeFilter === 'all' || m.type === typeFilter)
    )
  }, [mistakes, bankFilter, typeFilter])

  const typeCounts = useMemo(() => {
    const c = {}
    const pool = bankFilter === 'all'
      ? mistakes
      : mistakes.filter(m => m.bank_id === parseInt(bankFilter))
    pool.forEach(m => { c[m.type] = (c[m.type] || 0) + 1 })
    return c
  }, [mistakes, bankFilter])

  useEffect(() => {
    if (currentIndex >= filtered.length && filtered.length > 0) {
      setCurrentIndex(filtered.length - 1)
    }
    if (filtered.length === 0) setCurrentIndex(0)
  }, [filtered.length, currentIndex])

  const current = filtered[currentIndex]
  const isSubjective = current && (current.type === 'essay' || current.type === 'coding')

  const resetAnswerState = () => {
    setUserAnswer('')
    setShowReference(false)
    setResult(null)
  }

  const changeBank = (v) => { setBankFilter(v); setCurrentIndex(0); resetAnswerState() }
  const changeType = (v) => { setTypeFilter(v); setCurrentIndex(0); resetAnswerState() }
  const switchMode = (v) => { setMode(v); resetAnswerState() }

  const handleSubmit = async () => {
    if (!current) return
    if (!userAnswer.toString().trim()) { alert('请先作答'); return }
    setSubmitting(true)
    try {
      const data = await submitAnswer(current.id, userAnswer)
      setResult(data)
      if (data.correct) {
        setTimeout(() => removeFromMistakes(), 1200)
      }
    } catch (err) {
      alert('提交失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelfJudge = async (correct) => {
    if (!current) return
    setSubmitting(true)
    try {
      const data = await submitAnswer(current.id, userAnswer, correct)
      setResult(data)
      if (data.correct) {
        setTimeout(() => removeFromMistakes(), 1200)
      }
    } catch (err) {
      alert('提交失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const removeFromMistakes = async () => {
    try {
      await deleteMistake(current.id)
      setMistakes(prev => prev.filter(m => m.id !== current.id))
      setBankList(prev => prev.map(b => b.id === current.bank_id ? { ...b, count: b.count - 1 } : b).filter(b => b.count > 0))
      resetAnswerState()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteManually = async () => {
    if (!current) return
    if (!confirm('从错题本移除这道题？')) return
    try {
      await deleteMistake(current.id)
      setMistakes(prev => prev.filter(m => m.id !== current.id))
      setBankList(prev => prev.map(b => b.id === current.bank_id ? { ...b, count: b.count - 1 } : b).filter(b => b.count > 0))
      resetAnswerState()
    } catch (err) {
      alert('删除失败：' + err.message)
    }
  }

  const handleNext = () => {
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(currentIndex + 1)
      resetAnswerState()
    }
  }
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      resetAnswerState()
    }
  }

  if (loading) return <div className="mistakes-page"><div className="loading">加载错题中...</div></div>

  if (mistakes.length === 0) {
    return (
      <div className="mistakes-page">
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <h2>暂无错题</h2>
          <p>你还没有做错的题目，继续保持！</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mistakes-page">
      <div className="mistakes-header">
        <div>
          <h1 className="page-title">错题本</h1>
          <p className="mistakes-count">共 {mistakes.length} 道错题，当前筛选 {filtered.length} 道</p>
        </div>
        <div className="mode-toggle">
          <button className={`mode-btn ${mode === 'view' ? 'active' : ''}`} onClick={() => switchMode('view')}>查看模式</button>
          <button className={`mode-btn ${mode === 'practice' ? 'active' : ''}`} onClick={() => switchMode('practice')}>练习模式</button>
        </div>
      </div>

      <div className="mistakes-filters">
        <div className="filter-row">
          <label className="filter-label">题库：</label>
          <div className="type-filter inline">
            <button className={`type-chip ${bankFilter === 'all' ? 'active' : ''}`} onClick={() => changeBank('all')}>
              全部 <span className="type-count">{mistakes.length}</span>
            </button>
            {bankList.map(b => (
              <button key={b.id} className={`type-chip ${parseInt(bankFilter) === b.id ? 'active' : ''}`} onClick={() => changeBank(String(b.id))}>
                {b.name} <span className="type-count">{b.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <label className="filter-label">题型：</label>
          <div className="type-filter inline">
            {TYPE_ORDER.map(t => {
              const count = t === 'all'
                ? (bankFilter === 'all' ? mistakes.length : mistakes.filter(m => m.bank_id === parseInt(bankFilter)).length)
                : (typeCounts[t] || 0)
              if (t !== 'all' && count === 0) return null
              return (
                <button key={t} className={`type-chip ${typeFilter === t ? 'active' : ''}`} onClick={() => changeType(t)}>
                  {TYPE_LABELS[t]} <span className="type-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {filtered.length === 0 || !current ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h2>没有符合条件的错题</h2>
          <p>试试其他筛选条件</p>
        </div>
      ) : (
        <>
          <div className="progress-info">题目 {currentIndex + 1} / {filtered.length}</div>
          <motion.div key={current.id} className="mistakes-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="question-meta">
              <div className="question-type-badge">{TYPE_LABELS[current.type] || current.type}</div>
              <div className="bank-tag">📚 {current.bank_name}</div>
              {mode === 'view' && (
                <div className="wrong-answer-badge">你的答案：{(current.user_answer || '').slice(0, 30) || '(空)'}</div>
              )}
            </div>

            <h2 className="question-text">{current.question}</h2>

            {current.type === 'multiple_choice' && current.options && (
              <div className="options">
                {current.options.map(option => (
                  <label
                    key={option.label}
                    className={`option ${mode === 'practice' && userAnswer === option.label ? 'selected' : ''} ${
                      mode === 'view' && option.label === current.answer ? 'correct' : ''
                    } ${
                      mode === 'view' && option.label === current.user_answer ? 'incorrect' : ''
                    } ${
                      mode === 'practice' && result && option.label === current.answer ? 'correct' : ''
                    } ${
                      mode === 'practice' && result && userAnswer === option.label && !result.correct ? 'incorrect' : ''
                    }`}
                  >
                    {mode === 'practice' && (
                      <input type="radio" name="answer" value={option.label}
                        checked={userAnswer === option.label}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        disabled={!!result} />
                    )}
                    <span className="option-label">{option.label}</span>
                    <span className="option-text">{option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {current.type === 'multiple_select' && current.options && (() => {
              const selected = mode === 'practice' && userAnswer ? userAnswer.split('') : []
              const userPicked = (current.user_answer || '').toUpperCase().split('')
              const correctSet = (current.answer || '').toUpperCase().split('')
              const toggle = (label) => {
                if (mode !== 'practice' || result) return
                const next = new Set(selected)
                if (next.has(label)) next.delete(label); else next.add(label)
                setUserAnswer(Array.from(next).sort().join(''))
              }
              return (
                <div className="options">
                  <div className="multi-hint">多选题 · 可勾选多个选项</div>
                  {current.options.map(option => {
                    const isPicked = selected.includes(option.label)
                    const isCorrect = correctSet.includes(option.label)
                    const wasPickedWrong = userPicked.includes(option.label) && !isCorrect
                    let cls = 'option'
                    if (mode === 'practice') {
                      if (isPicked && !result) cls += ' selected'
                      if (result && isCorrect) cls += ' correct'
                      if (result && isPicked && !isCorrect) cls += ' incorrect'
                    } else {
                      if (isCorrect) cls += ' correct'
                      if (wasPickedWrong) cls += ' incorrect'
                    }
                    return (
                      <label
                        key={option.label}
                        className={cls}
                        onClick={(e) => { e.preventDefault(); toggle(option.label) }}
                      >
                        {mode === 'practice' && (
                          <input type="checkbox" value={option.label}
                            checked={isPicked}
                            readOnly
                            disabled={!!result} />
                        )}
                        <span className="option-label">{option.label}</span>
                        <span className="option-text">{option.text}</span>
                      </label>
                    )
                  })}
                </div>
              )
            })()}

            {current.type === 'judgment' && (
              <div className="options">
                {[{ v: '对', icon: '√' }, { v: '错', icon: '×' }].map(opt => (
                  <label
                    key={opt.v}
                    className={`option ${mode === 'practice' && userAnswer === opt.v ? 'selected' : ''} ${
                      mode === 'view' && current.answer === opt.v ? 'correct' : ''
                    } ${
                      mode === 'view' && current.user_answer === opt.v ? 'incorrect' : ''
                    } ${
                      mode === 'practice' && result && current.answer === opt.v ? 'correct' : ''
                    } ${
                      mode === 'practice' && result && userAnswer === opt.v && !result.correct ? 'incorrect' : ''
                    }`}
                  >
                    {mode === 'practice' && (
                      <input type="radio" name="answer" value={opt.v}
                        checked={userAnswer === opt.v}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        disabled={!!result} />
                    )}
                    <span className="option-label judgment-icon">{opt.icon}</span>
                    <span className="option-text">{opt.v}</span>
                  </label>
                ))}
              </div>
            )}

            {current.type === 'fill_blank' && mode === 'practice' && (
              <div className="answer-input">
                <input type="text" value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="请输入答案"
                  disabled={!!result}
                  className="text-input" />
              </div>
            )}

            {current.type === 'essay' && mode === 'practice' && (
              <div className="answer-input">
                <textarea value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="请输入答案"
                  disabled={!!result}
                  className="textarea-input"
                  rows="6" />
              </div>
            )}

            {current.type === 'coding' && mode === 'practice' && (
              <div className="answer-input">
                <textarea value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="请输入代码"
                  disabled={!!result}
                  className="textarea-input code-input"
                  rows="12"
                  spellCheck={false} />
              </div>
            )}

            {mode === 'view' && (
              <div className="answer-display">
                <div className="correct-answer">
                  <strong>正确答案：</strong>
                  <pre className="answer-value">{current.answer}</pre>
                </div>
              </div>
            )}

            {mode === 'practice' && isSubjective && !result && showReference && (
              <div className="reference-box">
                <div className="reference-title">参考答案</div>
                <pre className="reference-content">{current.answer}</pre>
                <div className="self-judge-actions">
                  <button onClick={() => handleSelfJudge(true)} disabled={submitting} className="btn btn-success">我答对了</button>
                  <button onClick={() => handleSelfJudge(false)} disabled={submitting} className="btn btn-danger">我答错了</button>
                </div>
              </div>
            )}

            {mode === 'practice' && result && (
              <motion.div className={`result-box ${result.correct ? 'correct' : 'incorrect'}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="result-icon">{result.correct ? '✅' : '❌'}</div>
                <div className="result-content">
                  <div className="result-title">
                    {result.correct ? '回答正确！已从错题本移除' : '仍然错误，请继续练习'}
                  </div>
                  {!result.correct && (
                    <div className="result-answer">
                      正确答案：<strong><pre className="inline-answer">{result.correctAnswer}</pre></strong>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            <div className="mistakes-actions">
              {mode === 'practice' && !result && !isSubjective && (
                <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
                  {submitting ? '提交中...' : '提交答案'}
                </button>
              )}
              {mode === 'practice' && !result && isSubjective && !showReference && (
                <button onClick={() => {
                  if (!userAnswer.toString().trim()) { alert('请先作答再查看参考答案'); return }
                  setShowReference(true)
                }} className="btn btn-primary">查看参考答案并自评</button>
              )}

              <div className="navigation">
                <button onClick={handlePrev} disabled={currentIndex === 0} className="btn btn-secondary btn-nav">上一题</button>
                <button onClick={handleNext} disabled={currentIndex >= filtered.length - 1} className="btn btn-secondary btn-nav">下一题</button>
              </div>

              <button onClick={handleDeleteManually} className="btn btn-secondary btn-small-action">
                ✕ 从错题本移除
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )

}

export default Mistakes
