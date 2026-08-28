import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMonthlyBi } from '../services/monthlyBi'

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
const monthLabel = (date) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date)

function PersonStats({ title, tone, stats }) {
  const goals = stats?.goals || {}
  return (
    <article className={`bi-person-card ${tone}`}>
      <h3>{title}</h3>
      <div className="bi-kpi-grid">
        <div><strong>{stats?.activeDays || 0}</strong><span>기록한 날</span></div>
        <div><strong>{stats?.mealCount || 0}</strong><span>식단</span></div>
        <div><strong>{stats?.scheduleCount || 0}</strong><span>일정</span></div>
        <div><strong>{stats?.diaryDays || 0}</strong><span>일기</span></div>
      </div>
      <section className="bi-goal-score">
        <span>목표 점수</span><strong>{goals.score ?? 0}점</strong>
        <small>○ 100점 · △ 50점 · × 0점 · 평가율 {goals.evaluationRate ?? 0}%</small>
      </section>
      <section className="bi-top-foods">
        <h4>자주 먹은 음식 TOP 5</h4>
        {stats?.topFoods?.length ? (
          <ol>{stats.topFoods.map((food) => <li key={food.name}><span>{food.name}</span><strong>{food.count}회</strong></li>)}</ol>
        ) : <p>등록된 음식명이 없어요.</p>}
      </section>
    </article>
  )
}

export default function MonthlyBiView({ userId, displayName, partnerName }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isCurrentMonth = monthKey(month) === monthKey(new Date())

  const load = useCallback(async (recalculate = false) => {
    setLoading(true)
    setError('')
    try {
      setSnapshot(await getMonthlyBi(monthKey(month), recalculate))
    } catch (requestError) {
      setError(requestError.message?.includes('get_monthly_bi')
        ? '월간 BI 데이터베이스 설정이 필요합니다.'
        : requestError.message || '월간 통계를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load(isCurrentMonth) }, [isCurrentMonth, load])
  const stats = snapshot?.stats || {}
  const people = useMemo(() => stats.users || {}, [stats.users])
  const mine = people[userId] || {}
  const partnerEntry = Object.entries(people).find(([id]) => id !== userId)?.[1] || {}
  const statusLabel = snapshot?.status === 'needs_recalculation'
    ? '재계산 필요'
    : snapshot?.status === 'finalized'
      ? '지난달 확정'
      : '이번 달 실시간'

  return (
    <section className="monthly-bi-view">
      <header className="bi-header">
        <div><span className="eyebrow">MONTHLY BI</span><h1>우리의 월간 리포트</h1></div>
        <span className={`bi-status ${snapshot?.status || ''}`}>{statusLabel}</span>
      </header>
      <nav className="bi-month-nav" aria-label="통계 월 이동">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" disabled={isCurrentMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </nav>
      <div className="bi-period-row">
        <span>{snapshot?.period_start || monthKey(month)} ~ {snapshot?.period_end || (isCurrentMonth ? '오늘' : '')}</span>
        <button type="button" onClick={() => load(true)} disabled={loading}>{loading ? '계산 중...' : isCurrentMonth ? '현재까지 다시 계산' : '통계 다시 계산'}</button>
      </div>
      {error ? <p className="bi-error">{error}</p> : null}
      {!error && loading && !snapshot ? <p className="bi-loading">월간 기록을 모으고 있어요...</p> : null}
      {!error && snapshot ? (
        <>
          <div className="bi-person-grid">
            <PersonStats title={displayName} tone="mine" stats={mine} />
            <PersonStats title={partnerName} tone="partner" stats={partnerEntry} />
          </div>
        </>
      ) : null}
    </section>
  )
}
