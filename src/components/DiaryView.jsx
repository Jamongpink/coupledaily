import { useEffect, useState } from 'react'
import { deleteDiary, getDiariesForDate, saveDiary } from '../services/diaries'

const formatDate = (date) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function DiaryView({
  displayName,
  partnerName,
  coupleId,
  userId,
  openEditorOnMount = false,
  onEditorOpened,
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [diaries, setDiaries] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dateKey = toDateKey(selectedDate)
  const myDiary = diaries.find((diary) => diary.user_id === userId)
  const partnerDiary = diaries.find((diary) => diary.user_id !== userId)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setIsEditing(false)

    getDiariesForDate(coupleId, dateKey)
      .then((data) => {
        if (active) setDiaries(data)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || '일기를 불러오지 못했어요.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [coupleId, dateKey])

  const moveDay = (amount) => {
    setSelectedDate((current) => {
      const next = new Date(current)
      next.setDate(next.getDate() + amount)
      return next
    })
  }

  const openEditor = () => {
    setContent(myDiary?.content || '')
    setError('')
    setIsEditing(true)
  }

  useEffect(() => {
    if (!openEditorOnMount || loading) return
    setContent(myDiary?.content || '')
    setError('')
    setIsEditing(true)
    onEditorOpened?.()
  }, [loading, myDiary?.content, onEditorOpened, openEditorOnMount])

  const handleSave = async (event) => {
    event.preventDefault()
    if (!content.trim()) {
      setError('일기 내용을 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const saved = await saveDiary({ coupleId, date: dateKey, content })
      setDiaries((current) => [...current.filter((diary) => diary.user_id !== userId), saved])
      window.dispatchEvent(new CustomEvent('coupledaily:diaries-changed', { detail: { date: dateKey } }))
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError.message || '일기를 저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!myDiary || !window.confirm('이 일기를 삭제할까요?')) return
    setSaving(true)
    setError('')
    try {
      await deleteDiary(myDiary.id)
      setDiaries((current) => current.filter((diary) => diary.id !== myDiary.id))
      window.dispatchEvent(new CustomEvent('coupledaily:diaries-changed', { detail: { date: dateKey } }))
      setContent('')
      setIsEditing(false)
    } catch (deleteError) {
      setError(deleteError.message || '일기를 삭제하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="diary-page">
      <header className="diary-page-header">
        <div>
          <p className="today-label">OUR DIARY</p>
          <h1>{isEditing ? '나의 일기 쓰기' : '두 사람의 일기'}</h1>
          <p>{isEditing ? `${formatDate(selectedDate)}의 마음을 기록해 보세요.` : '서로의 하루를 각자의 공간에 기록하고 함께 읽어보세요.'}</p>
        </div>
        {!isEditing && (
          <div className="diary-date-navigation" aria-label="일기 날짜 이동">
            <button type="button" aria-label="이전 날짜" onClick={() => moveDay(-1)}>‹</button>
            <strong>{formatDate(selectedDate)}</strong>
            <button type="button" aria-label="다음 날짜" onClick={() => moveDay(1)}>›</button>
          </div>
        )}
      </header>

      {error && <p className="diary-error" role="alert">{error}</p>}

      {isEditing ? (
        <form className="diary-editor" onSubmit={handleSave}>
          <label htmlFor="diary-content">일기 내용</label>
          <textarea
            id="diary-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={5000}
            placeholder="오늘은 어떤 하루였나요?"
            autoFocus
          />
          <div className="diary-editor-footer">
            <span>{content.length.toLocaleString()} / 5,000</span>
            <div>
              {myDiary && <button className="danger" type="button" onClick={handleDelete} disabled={saving}>삭제</button>}
              <button className="secondary" type="button" onClick={() => setIsEditing(false)} disabled={saving}>취소</button>
              <button className="primary" type="submit" disabled={saving || !content.trim()}>{saving ? '저장 중...' : myDiary ? '수정하기' : '저장하기'}</button>
            </div>
          </div>
        </form>
      ) : (
        <div className="diary-grid" aria-busy={loading}>
          <article className="diary-card mine">
            <header>
              <span className="diary-avatar" aria-hidden="true">{displayName.slice(0, 1)}</span>
              <div><p>나의 일기</p><strong>{displayName}님</strong></div>
              <span className="diary-status">{myDiary ? '작성 완료' : '작성 전'}</span>
            </header>
            <button className="diary-content-button" type="button" onClick={openEditor} disabled={loading}>
              {loading ? <p>일기를 불러오는 중...</p> : myDiary ? <p className="diary-text">{myDiary.content}</p> : (
                <div className="diary-empty">
                  <span aria-hidden="true">✎</span>
                  <strong>오늘의 마음을 남겨보세요</strong>
                  <p>내용 부분을 누르면 일기를 작성할 수 있어요.</p>
                </div>
              )}
            </button>
          </article>

          <article className="diary-card partner">
            <header>
              <span className="diary-avatar" aria-hidden="true">{partnerName.slice(0, 1)}</span>
              <div><p>상대방 일기</p><strong>{partnerName}님</strong></div>
              <span className="diary-status">{partnerDiary ? '작성 완료' : '작성 전'}</span>
            </header>
            {loading ? <div className="diary-empty"><p>일기를 불러오는 중...</p></div> : partnerDiary ? (
              <div className="diary-readonly"><p className="diary-text">{partnerDiary.content}</p></div>
            ) : (
              <div className="diary-empty">
                <span aria-hidden="true">♡</span>
                <strong>아직 작성된 일기가 없어요</strong>
                <p>상대방이 일기를 작성하면 이곳에서 확인할 수 있어요.</p>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  )
}

export default DiaryView
