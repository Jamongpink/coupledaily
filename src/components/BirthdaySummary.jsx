const nextBirthday = (birthday) => {
  if (!birthday) return null
  const [, month, day] = birthday.split('-').map(Number)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(today.getFullYear(), month - 1, day)
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return next
}

const birthdayLabel = (birthday) => {
  const next = nextBirthday(birthday)
  if (!next) return '생일 정보가 없어요'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((next - today) / 86400000)
  const date = `${next.getMonth() + 1}월 ${next.getDate()}일`
  return `${date} · ${days === 0 ? '오늘' : `D-${days}`}`
}

function BirthdaySummary({ displayName, partnerName, birthday, partnerBirthday }) {
  return (
    <section className="birthday-summary" aria-label="두 사람의 생일">
      <article>
        <span aria-hidden="true">🎂</span>
        <div>
          <small>{displayName}님의 생일</small>
          <strong>{birthdayLabel(birthday)}</strong>
        </div>
      </article>
      <article className="partner">
        <span aria-hidden="true">🎂</span>
        <div>
          <small>{partnerName}님의 생일</small>
          <strong>{birthdayLabel(partnerBirthday)}</strong>
        </div>
      </article>
    </section>
  )
}

export default BirthdaySummary
