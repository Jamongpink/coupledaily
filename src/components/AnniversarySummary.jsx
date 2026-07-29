import { useEffect, useMemo, useState } from 'react'
import {
  deleteAnniversary,
  getAnniversaries,
  saveAnniversary,
} from '../services/anniversaries'

const dateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const nextOccurrence = (anniversary, now = new Date()) => {
  const original = new Date(`${anniversary.anniversary_date}T00:00:00`)
  if (!anniversary.repeats_yearly) return original
  const next = new Date(now.getFullYear(), original.getMonth(), original.getDate())
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next.setFullYear(next.getFullYear() + 1)
  }
  return next
}

function AnniversarySummary({ coupleId }) {
  const [anniversaries, setAnniversaries] = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upcoming = useMemo(
    () => anniversaries
      .map((item) => ({ ...item, nextDate: nextOccurrence(item) }))
      .filter((item) => item.nextDate >= new Date(new Date().setHours(0, 0, 0, 0)))
      .sort((a, b) => a.nextDate - b.nextDate)[0],
    [anniversaries],
  )

  useEffect(() => {
    let active = true
    getAnniversaries(coupleId)
      .then((data) => {
        if (active) setAnniversaries(data)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || '기념일을 불러오지 못했어요.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [coupleId])

  const showForm = (anniversary = null) => {
    setSelected(anniversary)
    setError('')
    setOpen(true)
    window.history.pushState(
      { ...(window.history.state || {}), coupleDaily: true, modal: 'anniversary' },
      '',
      window.location.href,
    )
  }

  const closeForm = () => {
    if (window.history.state?.modal === 'anniversary') {
      window.history.back()
    } else {
      setOpen(false)
    }
  }

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state?.modal !== 'anniversary') setOpen(false)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const existing = anniversaries[0]
    const isReplacing = !selected && existing
    if (isReplacing && !window.confirm('변경하시겠습니까?')) return

    setSaving(true)
    setError('')
    try {
      const saved = await saveAnniversary({
        id: selected?.id || existing?.id,
        coupleId,
        title: form.get('title'),
        date: form.get('date'),
        repeatsYearly: form.get('repeatsYearly') === 'on',
        memo: form.get('memo'),
      })
      setAnniversaries((current) => [...current.filter((item) => item.id !== saved.id), saved])
      window.dispatchEvent(new CustomEvent('coupledaily:anniversaries-changed'))
      closeForm()
    } catch (saveError) {
      setError(saveError.message || '기념일을 저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !window.confirm('이 기념일을 삭제할까요?')) return
    setSaving(true)
    try {
      await deleteAnniversary(selected.id)
      setAnniversaries((current) => current.filter((item) => item.id !== selected.id))
      window.dispatchEvent(new CustomEvent('coupledaily:anniversaries-changed'))
      closeForm()
    } catch (deleteError) {
      setError(deleteError.message || '기념일을 삭제하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  const daysLeft = upcoming
    ? Math.round((upcoming.nextDate - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000)
    : null

  return (
    <>
      <section className="home-summary-strip" aria-label="기념일 요약">
        <article>
          <span aria-hidden="true">♡</span>
          <div>
            <small>우리의 기념일</small>
            <strong>
              {loading ? '기념일을 불러오는 중...' : upcoming
                ? `${upcoming.title} · ${daysLeft === 0 ? '오늘' : `D-${daysLeft}`}`
                : '아직 등록된 기념일이 없어요'}
            </strong>
            {upcoming && <button className="anniversary-detail-link" type="button" onClick={() => showForm(upcoming)}>상세 보기</button>}
          </div>
          <button type="button" onClick={() => showForm()} disabled={saving}>등록하기</button>
        </article>
        {error && !open ? <p className="anniversary-inline-error">{error}</p> : null}
      </section>

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm()
        }}>
          <section className="connection-modal anniversary-modal" role="dialog" aria-modal="true" aria-labelledby="anniversary-title">
            <button className="modal-close" type="button" aria-label="닫기" onClick={closeForm}>×</button>
            <p className="today-label">ANNIVERSARY</p>
            <h2 id="anniversary-title">{selected ? '기념일 수정' : '기념일 등록'}</h2>
            <form className="anniversary-form" onSubmit={handleSubmit}>
              <label><span>기념일 이름</span><input name="title" defaultValue={selected?.title || ''} maxLength="60" placeholder="예: 우리가 처음 만난 날" required /></label>
              <label><span>날짜</span><input name="date" type="date" defaultValue={selected?.anniversary_date || dateKey(new Date())} required /></label>
              <label className="anniversary-repeat"><input name="repeatsYearly" type="checkbox" defaultChecked={selected?.repeats_yearly ?? true} /><span>매년 반복</span></label>
              <label><span>메모</span><textarea name="memo" defaultValue={selected?.memo || ''} maxLength="500" placeholder="기념일에 대한 메모를 남겨보세요." /></label>
              {error && <p className="anniversary-form-error" role="alert">{error}</p>}
              <div className="anniversary-actions">
                {selected && <button className="danger" type="button" onClick={handleDelete} disabled={saving}>삭제</button>}
                <button className="secondary" type="button" onClick={closeForm} disabled={saving}>취소</button>
                <button className="primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '저장하기'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default AnniversarySummary
