import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createGoal,
  deleteGoal,
  getGoalsForMonth,
  updateGoalStatus,
} from '../services/goals'

const evaluationOptions = [
  ['achieved', '○', '달성'],
  ['partial', '△', '부분 달성'],
  ['missed', '×', '미달성'],
]

const monthValue = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`

const monthLabel = (date) =>
  new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date)

function GoalList({
  title,
  goals,
  editable,
  busyId,
  onEvaluate,
  onDelete,
}) {
  return (
    <section className={`goal-list-card ${editable ? 'mine' : 'partner'}`}>
      <header className="goal-list-heading">
        <div>
          <span>{editable ? 'MY GOALS' : 'PARTNER GOALS'}</span>
          <h2>{title}</h2>
        </div>
        <strong>{goals.length}개</strong>
      </header>

      {goals.length ? (
        <ul className="goal-list">
          {goals.map((goal) => (
            <li className="goal-list-item" key={goal.id}>
              <div className="goal-list-content">
                <span className={`goal-result ${goal.status || 'pending'}`} aria-hidden="true">
                  {evaluationOptions.find(([value]) => value === goal.status)?.[1] || '·'}
                </span>
                <p>{goal.title}</p>
              </div>

              {editable ? (
                <div className="goal-actions">
                  <div className="goal-evaluation" aria-label={`${goal.title} 평가`}>
                    {evaluationOptions.map(([value, symbol, label]) => (
                      <button
                        className={goal.status === value ? `selected ${value}` : ''}
                        type="button"
                        aria-label={label}
                        aria-pressed={goal.status === value}
                        title={label}
                        disabled={busyId === goal.id}
                        onClick={() => onEvaluate(goal.id, value)}
                        key={value}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                  <button
                    className="goal-delete"
                    type="button"
                    disabled={busyId === goal.id}
                    onClick={() => onDelete(goal.id)}
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <span className="partner-goal-status">
                  {evaluationOptions.find(([value]) => value === goal.status)?.[2] || '평가 전'}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="goal-list-empty">
          <span aria-hidden="true">✓</span>
          <p>{editable ? '이번 달 나의 목표를 등록해 보세요.' : '등록된 파트너 목표가 없어요.'}</p>
        </div>
      )}
    </section>
  )
}

function GoalView({
  coupleId,
  userId,
  displayName,
  partnerName,
  onGoalsChange,
}) {
  const [month, setMonth] = useState(() => new Date())
  const [goals, setGoals] = useState([])
  const [title, setTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const targetMonth = monthValue(month)
  const myGoals = useMemo(
    () => goals.filter((goal) => goal.user_id === userId),
    [goals, userId],
  )
  const partnerGoals = useMemo(
    () => goals.filter((goal) => goal.user_id !== userId),
    [goals, userId],
  )

  const loadGoals = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setGoals(await getGoalsForMonth(coupleId, targetMonth))
    } catch (nextError) {
      setError(nextError.message || '목표를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [coupleId, targetMonth])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  const moveMonth = (amount) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
    setShowForm(false)
    setTitle('')
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    setError('')

    try {
      await createGoal({ coupleId, month: targetMonth, title })
      setTitle('')
      setShowForm(false)
      await loadGoals()
      onGoalsChange?.()
    } catch (nextError) {
      setError(nextError.message || '목표를 등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEvaluate = async (goalId, status) => {
    setBusyId(goalId)
    setError('')

    try {
      await updateGoalStatus(goalId, status)
      setGoals((current) =>
        current.map((goal) => (goal.id === goalId ? { ...goal, status } : goal)),
      )
      onGoalsChange?.()
    } catch (nextError) {
      setError(nextError.message || '목표 평가를 저장하지 못했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (goalId) => {
    setBusyId(goalId)
    setError('')

    try {
      await deleteGoal(goalId)
      setGoals((current) => current.filter((goal) => goal.id !== goalId))
      onGoalsChange?.()
    } catch (nextError) {
      setError(nextError.message || '목표를 삭제하지 못했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="goals-page">
      <header className="goals-page-header">
        <div>
          <p className="today-label">TOGETHER GOALS</p>
          <h1>우리의 월간 목표</h1>
          <p>한 달의 목표를 정하고 ○·△·×로 직접 평가해 보세요.</p>
        </div>
        <button className="primary-goal-button" type="button" onClick={() => setShowForm(true)}>
          + 목표 등록하기
        </button>
      </header>

      <div className="goal-month-picker" aria-label="목표 월 선택">
        <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
      </div>

      {showForm ? (
        <form className="goal-create-form" onSubmit={handleCreate}>
          <label htmlFor="goal-title">새 목표</label>
          <div>
            <input
              id="goal-title"
              value={title}
              maxLength={100}
              autoFocus
              placeholder="예: 일주일에 두 번 함께 산책하기"
              onChange={(event) => setTitle(event.target.value)}
            />
            <button type="submit" disabled={saving || !title.trim()}>
              {saving ? '저장 중...' : '등록'}
            </button>
            <button className="cancel" type="button" onClick={() => setShowForm(false)}>
              취소
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="goal-error">{error}</p> : null}

      {loading ? (
        <div className="goals-loading">목표를 불러오고 있어요...</div>
      ) : (
        <div className="goal-list-grid">
          <GoalList
            title={`${displayName}님의 목표`}
            goals={myGoals}
            editable
            busyId={busyId}
            onEvaluate={handleEvaluate}
            onDelete={handleDelete}
          />
          <GoalList
            title={`${partnerName}님의 목표`}
            goals={partnerGoals}
            busyId={busyId}
          />
        </div>
      )}
    </section>
  )
}

export default GoalView
