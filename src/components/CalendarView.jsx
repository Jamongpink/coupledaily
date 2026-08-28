import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteMeal,
  getMealDatesForMonth,
  getMealsForDate,
  getMealMemoSuggestions,
  saveMeal as saveMealRecord,
} from '../services/meals'
import {
  deleteSchedule,
  getSchedulesForDate,
  getSchedulesForMonth,
  saveSchedule as saveScheduleRecord,
} from '../services/schedules'
import { createGoal, getGoalsForMonth, updateGoalStatus } from '../services/goals'
import { getAnniversaries } from '../services/anniversaries'
import { compressImage } from '../lib/imageCompression'
import { getDiariesForDate, getDiaryDatesForMonth } from '../services/diaries'

const mealTypes = [
  ['breakfast', '아침', '☀️'],
  ['lunch', '점심', '🍚'],
  ['dinner', '저녁', '🌙'],
  ['snack', '간식', '🍪'],
  ['lateNight', '야식', '🌜'],
]

const stickers = [
  ['운동', '🏋️'], ['공부', '🎓'], ['회의', '📖'], ['업무', '💼'],
  ['출장', '🧳'], ['약속', '🗓️'], ['데이트', '💗'], ['병원', '🏥'],
  ['이동', '🚙'], ['휴식', '🏕️'], ['여행', '✈️'], ['기타', '✨'],
]

const initialMeals = {
  breakfast: { mine: null, partner: { time: '08:20', memo: '간단한 아침 식사', photos: [] } },
  lunch: { mine: { time: '13:10', memo: '점심 기록', photos: [] }, partner: null },
  dinner: {
    mine: { time: '19:30', memo: '저녁 기록', photos: [] },
    partner: { time: '20:10', memo: '퇴근 후 저녁 식사', photos: [] },
  },
  snack: { mine: null, partner: { time: '15:30', memo: '오후 간식', photos: [] } },
  lateNight: { mine: null, partner: null },
}

const goalEvaluationOptions = [
  ['achieved', '○', '달성'],
  ['partial', '△', '부분 달성'],
  ['missed', '×', '미달성'],
]

const formatDate = (date) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(date)

const formatMonth = (date) =>
  new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date)

const inputDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const inputTime = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

const roundDateTimeToHalfHour = (date, time) => {
  const [hours, minutes] = time.split(':').map(Number)
  const rounded = new Date(`${date}T00:00:00`)
  rounded.setMinutes((hours * 60) + (Math.round(minutes / 30) * 30))

  return {
    date: inputDate(rounded),
    time: inputTime(rounded),
    value: rounded,
  }
}

const getRoundedCurrentTime = () => {
  const now = new Date()
  return roundDateTimeToHalfHour(inputDate(now), inputTime(now)).time
}

function CalendarView({
  displayName,
  partnerName,
  coupleId,
  userId,
  birthday,
  partnerBirthday,
  homeResetKey,
  goalRefreshKey,
  dailyOpenRequest,
  onDetailChange,
  onOpenDiaryEditor,
}) {
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [screen, setScreen] = useState('month')
  const [modal, setModal] = useState(null)
  const [mealType, setMealType] = useState('lunch')
  const [mealOwner, setMealOwner] = useState('mine')
  const [draftPhotos, setDraftPhotos] = useState([])
  const [mealMemo, setMealMemo] = useState('')
  const [memoSuggestions, setMemoSuggestions] = useState([])
  const [mealLoading, setMealLoading] = useState(false)
  const [mealSaving, setMealSaving] = useState(false)
  const [mealError, setMealError] = useState('')
  const [photoOptimizing, setPhotoOptimizing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [mealDeleteConfirm, setMealDeleteConfirm] = useState(false)
  const cameraVideoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const cameraFileRef = useRef(null)
  const scheduleFormRef = useRef(null)
  const [meals, setMeals] = useState(initialMeals)
  const [schedules, setSchedules] = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleDraft, setScheduleDraft] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [goalBusyId, setGoalBusyId] = useState(null)
  const [goalError, setGoalError] = useState('')
  const [showQuickGoal, setShowQuickGoal] = useState(false)
  const [quickGoalTitle, setQuickGoalTitle] = useState('')
  const [quickGoalSaving, setQuickGoalSaving] = useState(false)
  const [anniversaries, setAnniversaries] = useState([])
  const [monthlyRecords, setMonthlyRecords] = useState({})
  const [monthRecordRefresh, setMonthRecordRefresh] = useState(0)
  const [todayDiaries, setTodayDiaries] = useState([])
  const [todayDiariesLoading, setTodayDiariesLoading] = useState(true)

  const selectMemoSuggestion = (name) => {
    const parts = mealMemo.split(',')
    parts[parts.length - 1] = ` ${name}`
    setMealMemo(parts.join(',').trimStart())
  }

  useEffect(() => {
    if (modal !== 'meal' || !coupleId) return
    const timer = window.setTimeout(() => {
      getMealMemoSuggestions(coupleId, mealMemo)
        .then(setMemoSuggestions)
        .catch(() => setMemoSuggestions([]))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [coupleId, mealMemo, modal])

  const monthCells = useMemo(() => {
    const blanks = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array(blanks).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)]
  }, [month])

  const scheduleRows = useMemo(() => {
    const rows = new Map()

    schedules.forEach((schedule) => {
      const row = rows.get(schedule.displayTime) || {
        time: schedule.displayTime,
        mine: [],
        partner: [],
      }
      const owner = schedule.user_id === userId ? 'mine' : 'partner'
      row[owner].push(schedule)
      rows.set(schedule.displayTime, row)
    })

    return Array.from(rows.values()).sort((a, b) => a.time.localeCompare(b.time))
  }, [schedules, userId])

  const myMonthlyGoals = useMemo(
    () => monthlyGoals.filter((goal) => goal.user_id === userId),
    [monthlyGoals, userId],
  )
  const partnerMonthlyGoals = useMemo(
    () => monthlyGoals.filter((goal) => goal.user_id !== userId),
    [monthlyGoals, userId],
  )
  const myTodayDiary = todayDiaries.find((diary) => diary.user_id === userId)
  const partnerTodayDiary = todayDiaries.find((diary) => diary.user_id !== userId)
  const scheduleDraftKey = `coupledaily:schedule-draft:${userId}`

  const clearScheduleDraft = () => {
    window.localStorage.removeItem(scheduleDraftKey)
    window.localStorage.removeItem('coupledaily:resume-editor')
    setScheduleDraft(null)
  }

  useEffect(() => {
    try {
      const resume = JSON.parse(window.localStorage.getItem('coupledaily:resume-editor') || 'null')
      if (resume?.type !== 'schedule' || resume.userId !== userId) return
      const draft = JSON.parse(window.localStorage.getItem(scheduleDraftKey) || 'null')
      if (!draft?.fields || !draft.selectedDate) return
      const restoredDate = new Date(`${draft.selectedDate}T00:00:00`)
      setSelectedDate(restoredDate)
      setMonth(new Date(restoredDate.getFullYear(), restoredDate.getMonth(), 1))
      setSelectedSchedule(draft.selectedSchedule || null)
      setScheduleDraft(draft)
      setScreen('day')
      setModal('schedule')
      onDetailChange?.(true)
    } catch {
      window.localStorage.removeItem(scheduleDraftKey)
      window.localStorage.removeItem('coupledaily:resume-editor')
      setScheduleDraft(null)
    }
  }, [onDetailChange, scheduleDraftKey, userId])

  const rememberScheduleDraft = (form) => {
    const fields = Object.fromEntries(new FormData(form).entries())
    const draft = {
      fields,
      selectedDate: inputDate(selectedDate),
      selectedSchedule,
      updatedAt: Date.now(),
    }
    setScheduleDraft(draft)
    window.localStorage.setItem(scheduleDraftKey, JSON.stringify(draft))
    window.localStorage.setItem(
      'coupledaily:resume-editor',
      JSON.stringify({ type: 'schedule', userId }),
    )
  }

  useEffect(() => {
    if (!coupleId || !userId) return
    let active = true
    const todayKey = inputDate(today)
    const loadTodayDiaries = () => {
      setTodayDiariesLoading(true)
      getDiariesForDate(coupleId, todayKey)
        .then((rows) => {
          if (active) setTodayDiaries(rows)
        })
        .catch(() => {
          if (active) setTodayDiaries([])
        })
        .finally(() => {
          if (active) setTodayDiariesLoading(false)
        })
    }

    loadTodayDiaries()
    window.addEventListener('coupledaily:diaries-changed', loadTodayDiaries)
    return () => {
      active = false
      window.removeEventListener('coupledaily:diaries-changed', loadTodayDiaries)
    }
  }, [coupleId, today, userId])

  useEffect(() => {
    if (!coupleId) return
    let active = true
    const monthStart = inputDate(month)
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    const monthEnd = inputDate(nextMonth)

    Promise.all([
      getMealDatesForMonth(coupleId, monthStart, monthEnd),
      getSchedulesForMonth(coupleId, monthStart, monthEnd),
      getDiaryDatesForMonth(coupleId, monthStart, monthEnd),
    ])
      .then(([mealRows, scheduleRows, diaryRows]) => {
        if (!active) return
        const records = {}
        const addOwnerRecord = (day, type, recordUserId) => {
          const owner = recordUserId === userId ? 'mine' : 'partner'
          records[day] = {
            ...(records[day] || {}),
            [type]: { ...(records[day]?.[type] || {}), [owner]: true },
          }
        }

        mealRows.forEach(({ meal_date: mealDate, user_id: recordUserId }) => {
          const day = Number(mealDate.slice(-2))
          addOwnerRecord(day, 'meals', recordUserId)
        })

        const monthStartDate = new Date(`${monthStart}T00:00:00`)
        const monthEndDate = new Date(`${monthEnd}T00:00:00`)
        scheduleRows.forEach((schedule) => {
          const cursor = new Date(Math.max(new Date(schedule.start_at), monthStartDate))
          cursor.setHours(0, 0, 0, 0)
          const scheduleEnd = new Date(Math.min(new Date(schedule.end_at).getTime() - 1, monthEndDate.getTime() - 1))
          while (cursor <= scheduleEnd) {
            const day = cursor.getDate()
            addOwnerRecord(day, 'schedules', schedule.user_id)
            cursor.setDate(cursor.getDate() + 1)
          }
        })
        diaryRows.forEach(({ diary_date: diaryDate, user_id: recordUserId }) => {
          addOwnerRecord(Number(diaryDate.slice(-2)), 'diaries', recordUserId)
        })
        setMonthlyRecords(records)
      })
      .catch(() => {
        if (active) setMonthlyRecords({})
      })

    return () => {
      active = false
    }
  }, [coupleId, month, monthRecordRefresh, userId])

  useEffect(() => {
    const refreshMonthRecords = () => setMonthRecordRefresh((current) => current + 1)
    window.addEventListener('coupledaily:diaries-changed', refreshMonthRecords)
    return () => window.removeEventListener('coupledaily:diaries-changed', refreshMonthRecords)
  }, [])

  useEffect(() => {
    let active = true
    const loadAnniversaries = () => {
      getAnniversaries(coupleId)
        .then((data) => {
          if (active) setAnniversaries(data)
        })
        .catch(() => {
          if (active) setAnniversaries([])
        })
    }

    loadAnniversaries()
    window.addEventListener('coupledaily:anniversaries-changed', loadAnniversaries)
    return () => {
      active = false
      window.removeEventListener('coupledaily:anniversaries-changed', loadAnniversaries)
    }
  }, [coupleId])

  const openDay = (day) => {
    const nextDate = new Date(month.getFullYear(), month.getMonth(), day)
    setSelectedDate(nextDate)
    setScreen('day')
    onDetailChange?.(true)
    window.history.pushState(
      {
        coupleDaily: true,
        view: 'home',
        daily: true,
        selectedDate: inputDate(nextDate),
      },
      '',
      window.location.href,
    )
  }

  const evaluateGoal = async (goalId, status) => {
    setGoalBusyId(goalId)
    setGoalError('')
    try {
      await updateGoalStatus(goalId, status)
      setMonthlyGoals((current) =>
        current.map((goal) => (goal.id === goalId ? { ...goal, status } : goal)),
      )
    } catch (error) {
      setGoalError(error.message || '목표 평가를 저장하지 못했습니다.')
    } finally {
      setGoalBusyId(null)
    }
  }

  const createQuickGoal = async (event) => {
    event.preventDefault()
    if (!quickGoalTitle.trim()) return

    setQuickGoalSaving(true)
    setGoalError('')
    try {
      const created = await createGoal({
        coupleId,
        month: inputDate(month),
        title: quickGoalTitle,
      })
      setMonthlyGoals((current) => [...current, created])
      setQuickGoalTitle('')
      setShowQuickGoal(false)
    } catch (error) {
      setGoalError(error.message || '목표를 등록하지 못했습니다.')
    } finally {
      setQuickGoalSaving(false)
    }
  }

  useEffect(() => {
    const handlePopState = (event) => {
      if (!event.state?.coupleDaily || event.state.view !== 'home') return
      if (event.state.daily && event.state.selectedDate) {
        setSelectedDate(new Date(`${event.state.selectedDate}T00:00:00`))
        setScreen('day')
        onDetailChange?.(true)
      } else {
        setScreen('month')
        setModal(null)
        onDetailChange?.(false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [onDetailChange])

  useEffect(() => {
    setScreen('month')
    setModal(null)
    onDetailChange?.(false)
  }, [homeResetKey, onDetailChange])

  useEffect(() => {
    const requestedDate = dailyOpenRequest?.date
    if (!requestedDate) return

    const nextDate = new Date(`${requestedDate}T00:00:00`)
    if (Number.isNaN(nextDate.getTime())) return
    setSelectedDate(nextDate)
    setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
    setScreen('day')
    onDetailChange?.(true)

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('daily')
    window.history.replaceState(
      {
        coupleDaily: true,
        view: 'home',
        daily: true,
        selectedDate: requestedDate,
      },
      '',
      `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
    )
  }, [dailyOpenRequest, onDetailChange])

  useEffect(() => {
    if (!coupleId || !userId) return

    let active = true

    const loadMonthlyGoals = async () => {
      setGoalsLoading(true)

      try {
        const rows = await getGoalsForMonth(coupleId, inputDate(month))
        if (active) setMonthlyGoals(rows)
      } catch {
        if (active) setMonthlyGoals([])
      } finally {
        if (active) setGoalsLoading(false)
      }
    }

    loadMonthlyGoals()

    return () => {
      active = false
    }
  }, [coupleId, goalRefreshKey, month, userId])

  const moveDay = (amount) => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + amount)
    setSelectedDate(next)
  }

  useEffect(() => {
    if (screen !== 'day' || !coupleId || !userId) return

    let active = true

    const loadMeals = async () => {
      setMealLoading(true)
      setMealError('')

      try {
        const rows = await getMealsForDate(coupleId, inputDate(selectedDate))
        if (!active) return

        const nextMeals = Object.fromEntries(
          mealTypes.map(([key]) => [key, { mine: null, partner: null }]),
        )

        rows.forEach((meal) => {
          const owner = meal.user_id === userId ? 'mine' : 'partner'
          nextMeals[meal.meal_type][owner] = {
            id: meal.id,
            time: meal.meal_time.slice(0, 5),
            memo: meal.memo,
            photos: meal.photos,
          }
        })

        setMeals(nextMeals)
      } catch (error) {
        if (active) setMealError(error.message || '식단을 불러오지 못했습니다.')
      } finally {
        if (active) setMealLoading(false)
      }
    }

    loadMeals()

    return () => {
      active = false
    }
  }, [coupleId, screen, selectedDate, userId])

  const loadSchedules = async () => {
    const rows = await getSchedulesForDate(coupleId, inputDate(selectedDate))
    const dayStart = new Date(`${inputDate(selectedDate)}T00:00:00`)

    setSchedules(
      rows.map((schedule) => {
        const start = new Date(schedule.start_at)
        const end = new Date(schedule.end_at)
        const visibleStart = start < dayStart ? dayStart : start

        return {
          ...schedule,
          startDate: inputDate(start),
          startTime: start.toTimeString().slice(0, 5),
          endDate: inputDate(end),
          endTime: end.toTimeString().slice(0, 5),
          displayTime: visibleStart.toTimeString().slice(0, 5),
        }
      }),
    )
  }

  useEffect(() => {
    if (screen !== 'day' || !coupleId || !userId) return

    let active = true
    setScheduleLoading(true)
    setScheduleError('')

    getSchedulesForDate(coupleId, inputDate(selectedDate))
      .then((rows) => {
        if (!active) return
        const dayStart = new Date(`${inputDate(selectedDate)}T00:00:00`)
        setSchedules(
          rows.map((schedule) => {
            const start = new Date(schedule.start_at)
            const end = new Date(schedule.end_at)
            const visibleStart = start < dayStart ? dayStart : start
            return {
              ...schedule,
              startDate: inputDate(start),
              startTime: start.toTimeString().slice(0, 5),
              endDate: inputDate(end),
              endTime: end.toTimeString().slice(0, 5),
              displayTime: visibleStart.toTimeString().slice(0, 5),
            }
          }),
        )
      })
      .catch((error) => {
        if (active) setScheduleError(error.message || '일정을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setScheduleLoading(false)
      })

    return () => {
      active = false
    }
  }, [coupleId, screen, selectedDate, userId])

  const saveMeal = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setMealSaving(true)
    setPhotoOptimizing(true)
    setMealError('')

    try {
      const optimizedPhotos = []
      for (const photo of draftPhotos) {
        if (photo.path || !photo.file) {
          optimizedPhotos.push(photo)
          continue
        }
        const file = await compressImage(photo.file)
        optimizedPhotos.push({
          ...photo,
          file,
          optimizedSize: file.size,
        })
      }

      const roundedMealTime = roundDateTimeToHalfHour(
        inputDate(selectedDate),
        data.get('mealTime'),
      )

      await saveMealRecord({
        coupleId,
        date: inputDate(selectedDate),
        mealType,
        time: roundedMealTime.time,
        memo: data.get('mealMemo'),
        photos: optimizedPhotos,
      })

      const rows = await getMealsForDate(coupleId, inputDate(selectedDate))
      const nextMeals = Object.fromEntries(
        mealTypes.map(([key]) => [key, { mine: null, partner: null }]),
      )

      rows.forEach((meal) => {
        const owner = meal.user_id === userId ? 'mine' : 'partner'
        nextMeals[meal.meal_type][owner] = {
          id: meal.id,
          time: meal.meal_time.slice(0, 5),
          memo: meal.memo,
          photos: meal.photos,
        }
      })

      setMeals(nextMeals)
      draftPhotos.forEach((photo) => {
        if (photo.file && photo.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url)
      })
      setDraftPhotos([])
      setMealMemo('')
      setModal(null)
      setMonthRecordRefresh((current) => current + 1)
    } catch (error) {
      setMealError(error.message || '식단을 저장하지 못했습니다.')
    } finally {
      setMealSaving(false)
      setPhotoOptimizing(false)
    }
  }

  const selectMealPhotos = async (event) => {
    const availableSlots = Math.max(0, 3 - draftPhotos.length)
    const files = Array.from(event.target.files || []).slice(0, availableSlots)
    event.target.value = ''
    if (!files.length) return

    setMealError('')
    try {
      const nextPhotos = []
      for (const sourceFile of files) {
        nextPhotos.push({
          name: sourceFile.name,
          url: URL.createObjectURL(sourceFile),
          file: sourceFile,
          originalSize: sourceFile.size,
        })
      }
      setDraftPhotos((current) => [...current, ...nextPhotos].slice(0, 3))
    } catch (error) {
      setMealError(error.message || '사진을 추가하지 못했습니다.')
    }
  }

  const stopMealCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraOpen(false)
    setCameraError('')
  }

  const openMealCamera = async () => {
    if (photoOptimizing || draftPhotos.length >= 3) return
    setCameraError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileRef.current?.click()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      cameraStreamRef.current = stream
      setCameraOpen(true)
    } catch {
      setMealError('카메라 권한을 허용해 주세요. 앨범 선택은 계속 사용할 수 있어요.')
    }
  }

  useEffect(() => {
    if (!cameraOpen || !cameraVideoRef.current || !cameraStreamRef.current) return
    cameraVideoRef.current.srcObject = cameraStreamRef.current
    cameraVideoRef.current.play().catch(() => {})
  }, [cameraOpen])

  const captureMealPhoto = async () => {
    const video = cameraVideoRef.current
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('카메라 화면을 준비하고 있어요. 잠시 후 다시 눌러주세요.')
      return
    }

    setCameraError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('사진을 촬영하지 못했어요.')
      context.drawImage(video, 0, 0)
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error('사진을 촬영하지 못했어요.')),
          'image/jpeg',
          0.92,
        )
      })
      const sourceFile = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setDraftPhotos((current) => [...current, {
        name: sourceFile.name,
        url: URL.createObjectURL(sourceFile),
        file: sourceFile,
        originalSize: sourceFile.size,
      }].slice(0, 3))
      stopMealCamera()
    } catch (error) {
      setCameraError(error.message || '사진을 촬영하지 못했어요.')
    }
  }

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const removeDraftPhoto = (index) => {
    setDraftPhotos((current) => {
      const target = current[index]
      if (target?.file && target.url?.startsWith('blob:')) URL.revokeObjectURL(target.url)
      return current.filter((_, photoIndex) => photoIndex !== index)
    })
  }

  const discardAndCloseMeal = () => {
    draftPhotos.forEach((photo) => {
      if (photo.file && photo.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url)
    })
    setDraftPhotos([])
    setMealMemo('')
    setMealError('')
    setMealDeleteConfirm(false)
    setModal(null)
  }

  const removeMeal = async () => {
    const meal = meals[mealType]?.mine
    if (!meal?.id) return

    setMealSaving(true)
    setMealError('')
    try {
      await deleteMeal(meal.id)
      draftPhotos.forEach((photo) => {
        if (photo.file && photo.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url)
      })
      setDraftPhotos([])
      setMeals((current) => ({
        ...current,
        [mealType]: { ...current[mealType], mine: null },
      }))
      setMealDeleteConfirm(false)
      setModal(null)
      setMonthRecordRefresh((current) => current + 1)
    } catch (error) {
      setMealError(error.message || '식단을 삭제하지 못했습니다.')
    } finally {
      setMealSaving(false)
    }
  }

  const saveSchedule = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setScheduleSaving(true)
    setScheduleError('')

    try {
      const roundedStart = roundDateTimeToHalfHour(
        data.get('startDate'),
        data.get('startTime'),
      )
      let roundedEnd = roundDateTimeToHalfHour(
        data.get('endDate'),
        data.get('endTime'),
      )

      if (roundedEnd.value <= roundedStart.value) {
        const adjustedEnd = new Date(roundedStart.value.getTime() + (30 * 60 * 1000))
        roundedEnd = {
          date: inputDate(adjustedEnd),
          time: inputTime(adjustedEnd),
          value: adjustedEnd,
        }
      }

      await saveScheduleRecord({
        id: selectedSchedule?.id,
        coupleId,
        title: data.get('title'),
        sticker: data.get('sticker'),
        startDate: roundedStart.date,
        startTime: roundedStart.time,
        endDate: roundedEnd.date,
        endTime: roundedEnd.time,
        memo: data.get('memo'),
      })
      await loadSchedules()
      setMonthRecordRefresh((current) => current + 1)
      clearScheduleDraft()
      setModal(null)
      setSelectedSchedule(null)
    } catch (error) {
      setScheduleError(error.message || '일정을 저장하지 못했습니다.')
    } finally {
      setScheduleSaving(false)
    }
  }

  const removeSelectedSchedule = async () => {
    if (!selectedSchedule?.id) return
    setScheduleSaving(true)
    setScheduleError('')

    try {
      await deleteSchedule(selectedSchedule.id)
      await loadSchedules()
      setMonthRecordRefresh((current) => current + 1)
      clearScheduleDraft()
      setModal(null)
      setSelectedSchedule(null)
      setDeleteConfirm(false)
    } catch (error) {
      setScheduleError(error.message || '일정을 삭제하지 못했습니다.')
    } finally {
      setScheduleSaving(false)
    }
  }

  const openNewSchedule = () => {
    clearScheduleDraft()
    setSelectedSchedule(null)
    setDeleteConfirm(false)
    setScheduleError('')
    setModal('schedule')
  }

  const defaultRoundedTime = getRoundedCurrentTime()
  const defaultScheduleStart = roundDateTimeToHalfHour(
    inputDate(selectedDate),
    defaultRoundedTime,
  )
  const defaultScheduleEndValue = new Date(
    defaultScheduleStart.value.getTime() + (30 * 60 * 1000),
  )
  const defaultScheduleEnd = {
    date: inputDate(defaultScheduleEndValue),
    time: inputTime(defaultScheduleEndValue),
  }

  if (screen === 'month') {
    return (
      <section className="calendar-view">
        <header className="calendar-intro">
          <div>
            <span className="eyebrow">OUR MONTH</span>
            <h2>{displayName}님과 {partnerName}님의 캘린더</h2>
            <p>날짜별 기록을 확인해요.</p>
          </div>
        </header>

        <section className="monthly-goals" aria-label="이번 달 목표">
          {[
            ['mine', '나의 이번 달 목표', myMonthlyGoals],
            ['partner', `${partnerName}님의 이번 달 목표`, partnerMonthlyGoals],
          ].map(([owner, label, goals]) => (
            <div className={`monthly-goal-card ${owner}`} key={owner}>
              <div className="monthly-goal-card-header">
                <span className="goal-owner">{label}</span>
                {owner === 'mine' ? (
                  <button
                    className="quick-goal-toggle"
                    type="button"
                    onClick={() => setShowQuickGoal((current) => !current)}
                  >
                    {showQuickGoal ? '닫기' : '+ 목표 등록'}
                  </button>
                ) : null}
              </div>
              {owner === 'mine' && showQuickGoal ? (
                <form className="quick-goal-form" onSubmit={createQuickGoal}>
                  <input
                    value={quickGoalTitle}
                    maxLength={100}
                    autoFocus
                    placeholder="이번 달 목표를 입력하세요"
                    aria-label="새 목표"
                    onChange={(event) => setQuickGoalTitle(event.target.value)}
                  />
                  <button type="submit" disabled={quickGoalSaving || !quickGoalTitle.trim()}>
                    {quickGoalSaving ? '저장 중...' : '등록'}
                  </button>
                </form>
              ) : null}
              {goalsLoading ? (
                <p className="monthly-goal-empty">불러오는 중...</p>
              ) : goals.length ? (
                <ul className="monthly-goal-list">
                  {goals.slice(0, 3).map((goal) => (
                    <li key={goal.id}>
                      <span className={`goal-result ${goal.status || 'pending'}`}>
                        {goal.status === 'achieved'
                          ? '○'
                          : goal.status === 'partial'
                            ? '△'
                            : goal.status === 'missed'
                              ? '×'
                              : '·'}
                      </span>
                      <span className="monthly-goal-title">{goal.title}</span>
                      {owner === 'mine' ? (
                        <div className="monthly-goal-evaluation" aria-label={`${goal.title} 평가`}>
                          {goalEvaluationOptions.map(([value, symbol, evaluationLabel]) => (
                            <button
                              className={goal.status === value ? `selected ${value}` : ''}
                              type="button"
                              aria-label={evaluationLabel}
                              aria-pressed={goal.status === value}
                              title={evaluationLabel}
                              disabled={goalBusyId === goal.id}
                              onClick={() => evaluateGoal(goal.id, value)}
                              key={value}
                            >
                              {symbol}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                  {goals.length > 3 ? <li className="more">외 {goals.length - 3}개</li> : null}
                </ul>
              ) : (
                <p className="monthly-goal-empty">아직 등록된 목표가 없어요.</p>
              )}
              {owner === 'mine' && goalError ? <p className="monthly-goal-error">{goalError}</p> : null}
            </div>
          ))}
        </section>

        <div className="calendar-shell">
          <div className="calendar-toolbar">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
            <h3>{formatMonth(month)}</h3>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="weekday-row">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {monthCells.map((day, index) => {
              if (!day) {
                return <span className="calendar-day empty" key={`empty-${index}`} />
              }

              const isToday =
                today.getFullYear() === month.getFullYear() &&
                today.getMonth() === month.getMonth() &&
                today.getDate() === day
              const record = monthlyRecords[day]
              const calendarDate = inputDate(new Date(month.getFullYear(), month.getMonth(), day))
              const dayAnniversaries = anniversaries.filter((anniversary) => {
                if (!anniversary.repeats_yearly) return anniversary.anniversary_date === calendarDate
                const [, anniversaryMonth, anniversaryDay] = anniversary.anniversary_date.split('-')
                return Number(anniversaryMonth) === month.getMonth() + 1 && Number(anniversaryDay) === day
              })
              const birthdayNames = [
                birthday?.slice(5) === calendarDate.slice(5) ? `${displayName}님의 생일` : null,
                partnerBirthday?.slice(5) === calendarDate.slice(5) ? `${partnerName}님의 생일` : null,
              ].filter(Boolean)

              return (
                <button
                  className={`calendar-day ${isToday ? 'is-today' : ''}`}
                  key={day}
                  type="button"
                  onClick={() => openDay(day)}
                  aria-label={`${day}일${isToday ? ', 오늘' : ''}`}
                >
                  <span className="calendar-day-number">
                    {day}
                    <span className="calendar-day-badges">
                      {dayAnniversaries.length ? (
                        <i
                          className="anniversary-heart"
                          title={dayAnniversaries.map((item) => item.title).join(', ')}
                          aria-label={`기념일: ${dayAnniversaries.map((item) => item.title).join(', ')}`}
                        >
                          ♥
                        </i>
                      ) : null}
                      {birthdayNames.length ? (
                        <i
                          className="birthday-marker"
                          title={birthdayNames.join(', ')}
                          aria-label={birthdayNames.join(', ')}
                        >
                          🎂
                        </i>
                      ) : null}
                      {isToday ? <small>오늘</small> : null}
                    </span>
                  </span>

                  {record ? (
                    <span className="calendar-records" aria-label="등록된 기록">
                      {[
                        ['meals', '식단', '🍚'],
                        ['schedules', '일정', '📅'],
                        ['diaries', '일기', '📓'],
                      ].map(([type, label, icon]) => record[type] ? (
                        <span className={`record-type ${type}`} title={`${label}: 왼쪽 나, 오른쪽 상대방`} key={type}>
                          <i aria-hidden="true">{icon}</i>
                          <span className="record-halves" aria-label={`${label}, 나 ${record[type].mine ? '기록함' : '미기록'}, 상대방 ${record[type].partner ? '기록함' : '미기록'}`}>
                            <b className={record[type].mine ? 'is-filled' : ''} />
                            <b className={record[type].partner ? 'is-filled' : ''} />
                          </span>
                        </span>
                      ) : null)}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <section
          className="daily-diaries home-diaries"
          id="home-diary"
          aria-label="오늘의 일기"
        >
          <div className="diary-section-heading">
            <div>
              <span className="eyebrow">TODAY DIARY</span>
              <h2>오늘의 일기</h2>
            </div>
            <p>두 사람의 하루를 각자의 공간에 기록해요.</p>
          </div>

          <div className="diary-grid">
            <article
              className="diary-card mine home-diary-link"
              role="button"
              tabIndex={0}
              aria-label={myTodayDiary ? '오늘의 일기 수정하기' : '오늘의 일기 작성하기'}
              onClick={onOpenDiaryEditor}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenDiaryEditor?.()
                }
              }}
            >
              <header>
                <span className="diary-avatar" aria-hidden="true">
                  {displayName.slice(0, 1)}
                </span>
                <div>
                  <p>나의 일기</p>
                  <strong>{displayName}님</strong>
                </div>
                <span className="diary-status">{myTodayDiary ? '작성 완료' : '작성 전'}</span>
              </header>
              {todayDiariesLoading ? (
                <div className="diary-empty"><p>일기를 불러오는 중...</p></div>
              ) : myTodayDiary ? (
                <div className="diary-readonly"><p className="diary-text">{myTodayDiary.content}</p></div>
              ) : (
                <div className="diary-empty">
                  <span aria-hidden="true">✎</span>
                  <strong>오늘의 마음을 남겨보세요</strong>
                  <p>일기 탭에서 오늘의 기록을 작성할 수 있어요.</p>
                </div>
              )}
            </article>

            <article className="diary-card partner">
              <header>
                <span className="diary-avatar" aria-hidden="true">
                  {partnerName.slice(0, 1)}
                </span>
                <div>
                  <p>상대방 일기</p>
                  <strong>{partnerName}님</strong>
                </div>
                <span className="diary-status">{partnerTodayDiary ? '작성 완료' : '작성 전'}</span>
              </header>
              {todayDiariesLoading ? (
                <div className="diary-empty"><p>일기를 불러오는 중...</p></div>
              ) : partnerTodayDiary ? (
                <div className="diary-readonly"><p className="diary-text">{partnerTodayDiary.content}</p></div>
              ) : (
                <div className="diary-empty">
                  <span aria-hidden="true">♡</span>
                  <strong>아직 작성된 일기가 없어요</strong>
                  <p>상대방이 일기를 작성하면 이곳에서 확인할 수 있어요.</p>
                </div>
              )}
            </article>
          </div>
        </section>
      </section>
    )
  }

  return (
    <section className="calendar-view daily-page">
      <header className="daily-header">
        <div>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setScreen('month')
              onDetailChange?.(false)
            }}
          >
            ← 월간 캘린더
          </button>
          <p>식단과 두 사람의 일정만 한눈에 확인해요.</p>
        </div>
        <div className="date-navigation" aria-label="일일 캘린더 날짜 이동">
          <button type="button" aria-label="이전 날짜" onClick={() => moveDay(-1)}>‹</button>
          <strong>{formatDate(selectedDate)}</strong>
          <button type="button" aria-label="다음 날짜" onClick={() => moveDay(1)}>›</button>
        </div>
      </header>

      <article className="meal-section-card">
        <div className="section-title-row">
          <div><span className="eyebrow">DAILY MEALS</span><h3>식단 🍚</h3></div>
          <span className="section-helper">등록한 식사는 시간으로 표시돼요</span>
        </div>
        <div className="meal-list">
          <div className="meal-list-head" aria-hidden="true">
            <span>식사</span>
            <strong>{displayName}</strong>
            <strong>{partnerName}</strong>
          </div>
          {mealTypes.map(([key, label, icon]) => {
            const meal = meals[key]
            return (
              <div className="meal-row" key={key}>
                <span className="meal-name">{icon} {label}</span>
                <button
                  className={`meal-person-cell mine ${meal.mine ? 'is-recorded' : ''}`}
                  type="button"
                  onClick={() => {
                    setMealType(key)
                    setMealOwner('mine')
                    setDraftPhotos(meal.mine?.photos || [])
                    setMealMemo(meal.mine?.memo || '')
                    setMealDeleteConfirm(false)
                    setModal('meal')
                  }}
                >
                  {meal.mine ? (
                    <><i className="owner-dot me" />{meal.mine.time}</>
                  ) : <span className="empty-action">＋ 등록</span>}
                </button>
                <button
                  className={`meal-person-cell partner ${meal.partner ? 'is-recorded' : ''}`}
                  type="button"
                  disabled={!meal.partner}
                  onClick={() => {
                    setMealType(key)
                    setMealOwner('partner')
                    setModal('partnerMeal')
                  }}
                >
                  {meal.partner ? (
                    <><i className="owner-dot partner" />{meal.partner.time}</>
                  ) : <span className="empty-action">등록 안 됨</span>}
                </button>
              </div>
            )
          })}
        </div>
        {mealLoading ? <p className="meal-status">저장된 식단을 불러오고 있어요...</p> : null}
        {mealError ? <p className="meal-status error">{mealError}</p> : null}
      </article>

      <article className="schedule-section-card">
        <div className="section-title-row">
          <div><span className="eyebrow">SHARED TIMELINE</span><h3>시간대별 일정 📅</h3></div>
          <button
            className="primary-small-button"
            type="button"
            onClick={openNewSchedule}
          >
            ＋ 일정 등록
          </button>
        </div>
        <p className="timeline-description">비어 있는 24시간은 숨기고, 두 사람 중 일정이 있는 시간만 함께 표시합니다.</p>
        <div className="schedule-table">
          <div className="schedule-table-head">
            <span>시간</span><strong>{displayName}</strong><strong>{partnerName}</strong><span>시간</span>
          </div>
          {scheduleRows.map((row) => (
            <div className="schedule-row" key={row.time}>
              <time>{row.time}</time>
              <div className="schedule-cell mine">
                {row.mine.length ? row.mine.map((schedule) => (
                  <button
                    className="schedule-chip"
                    type="button"
                    key={schedule.id}
                    onClick={() => {
                      setSelectedSchedule(schedule)
                      setDeleteConfirm(false)
                      setScheduleError('')
                      setModal('schedule')
                    }}
                  >
                    {schedule.sticker} {schedule.title}
                  </button>
                )) : <span className="schedule-empty">—</span>}
              </div>
              <div className="schedule-cell partner">
                {row.partner.length ? row.partner.map((schedule) => (
                  <button
                    className="schedule-chip"
                    type="button"
                    key={schedule.id}
                    onClick={() => {
                      setSelectedSchedule(schedule)
                      setModal('partnerSchedule')
                    }}
                  >
                    {schedule.sticker} {schedule.title}
                  </button>
                )) : <span className="schedule-empty">—</span>}
              </div>
              <time>{row.time}</time>
            </div>
          ))}
          {!scheduleLoading && scheduleRows.length === 0 ? (
            <div className="schedule-empty-state">
              <span aria-hidden="true">📅</span>
              <strong>아직 등록된 일정이 없어요</strong>
              <p>시간과 내용을 입력해 첫 일정을 추가해 보세요.</p>
              <button type="button" onClick={openNewSchedule}>＋ 첫 일정 등록하기</button>
            </div>
          ) : null}
        </div>
        {scheduleLoading ? <p className="meal-status">저장된 일정을 불러오고 있어요...</p> : null}
        {scheduleError ? <p className="meal-status error">{scheduleError}</p> : null}
      </article>

      {modal === 'meal' && (
        <div className="modal-backdrop">
          <section className="record-modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              type="button"
              onClick={discardAndCloseMeal}
              disabled={mealSaving}
              aria-label="식단 창 닫기"
            >
              ×
            </button>
            <span className="eyebrow">MEAL RECORD</span><h3>식단 등록 🍚</h3><p>{formatDate(selectedDate)}</p>
            <form onSubmit={saveMeal}>
              <fieldset className="form-fieldset">
                <legend>식사 종류</legend>
                <div className="meal-type-tabs">
                  {mealTypes.map(([key, label]) => <button className={mealType === key ? 'active' : ''} key={key} type="button" onClick={() => setMealType(key)}>{label}</button>)}
                </div>
              </fieldset>
              <label className="form-field">
                <span>식사 시간</span>
                <input
                  key={mealType}
                  name="mealTime"
                  type="time"
                  step="1800"
                  defaultValue={meals[mealType]?.mine?.time || defaultRoundedTime}
                  required
                />
              </label>
              <div className="form-field">
                <span>음식 사진</span>
                <div className="meal-photo-preview-list">
                  {draftPhotos.map((photo, index) => (
                    <figure key={`${photo.name}-${index}`}>
                      <img src={photo.url} alt={`${index + 1}번째 음식`} />
                      <button
                        type="button"
                        aria-label={`${index + 1}번째 사진 제거`}
                        onClick={() => removeDraftPhoto(index)}
                      >
                        ×
                      </button>
                    </figure>
                  ))}
                  {draftPhotos.length < 3 ? (
                    <>
                      <button
                        className="meal-photo-upload camera"
                        type="button"
                        disabled={photoOptimizing}
                        onClick={openMealCamera}
                      >
                        <span aria-hidden="true">📷</span>
                        <strong>{photoOptimizing ? '최적화 중' : '카메라로 촬영'}</strong>
                      </button>
                      <input
                        ref={cameraFileRef}
                        className="camera-file-fallback"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={photoOptimizing}
                        onChange={selectMealPhotos}
                      />
                      <label className="meal-photo-upload album">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={photoOptimizing}
                          onChange={selectMealPhotos}
                        />
                        <span aria-hidden="true">▧</span>
                        <strong>{photoOptimizing ? '최적화 중' : '앨범에서 선택'}</strong>
                      </label>
                    </>
                  ) : null}
                </div>
                <small>최대 3장까지 선택할 수 있으며, 저장할 때 긴 변 1280px·약 50% 화질로 자동 최적화됩니다.</small>
                {photoOptimizing ? <p className="photo-optimizing-status">사진 용량과 화질을 최적화하고 있어요...</p> : null}
              </div>
              <label className="form-field"><span>작성 내용</span><textarea name="mealMemo" value={mealMemo} onChange={(event) => setMealMemo(event.target.value)} placeholder="예: 김치찌개, 계란말이" /><small>음식이 여러 개라면 쉼표(,)로 구분해 주세요.</small></label>
              {memoSuggestions.length ? (
                <div className="meal-memo-suggestions" aria-label="이전에 작성한 식단">
                  <small>이전에 작성한 내용</small>
                  <div>{memoSuggestions.map((item) => <button type="button" key={item.name} onClick={() => selectMemoSuggestion(item.name)}>{item.name}</button>)}</div>
                </div>
              ) : null}
              <div className="coming-soon-row"><span>✨ AI 음식 분석</span><strong>추후 제공</strong></div>
              {mealError ? <p className="meal-status error">{mealError}</p> : null}
              {meals[mealType]?.mine?.id ? (
                <div className="meal-delete-actions">
                  {mealDeleteConfirm ? (
                    <>
                      <span>식단과 등록된 사진을 삭제할까요?</span>
                      <div>
                        <button type="button" onClick={() => setMealDeleteConfirm(false)} disabled={mealSaving}>취소</button>
                        <button className="danger" type="button" onClick={removeMeal} disabled={mealSaving}>
                          {mealSaving ? '삭제 중...' : '삭제 확인'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button className="meal-delete-button" type="button" onClick={() => setMealDeleteConfirm(true)}>
                      식단 삭제
                    </button>
                  )}
                </div>
              ) : null}
              <div className="mobile-form-dock" aria-label="식단 등록 작업">
                <button className="dock-cancel" type="button" onClick={discardAndCloseMeal} disabled={mealSaving || photoOptimizing}>
                  취소
                </button>
                <span aria-hidden="true" />
                <button className="dock-save" type="submit" disabled={mealSaving || photoOptimizing}>
                  {mealSaving || photoOptimizing ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modal === 'meal' && cameraOpen && (
        <div className="modal-backdrop meal-camera-backdrop">
          <section className="meal-camera-modal" role="dialog" aria-modal="true" aria-label="식단 사진 촬영">
            <video ref={cameraVideoRef} autoPlay muted playsInline aria-label="카메라 미리보기" />
            {cameraError ? <p role="alert">{cameraError}</p> : null}
            <div>
              <button type="button" onClick={stopMealCamera} disabled={photoOptimizing}>취소</button>
              <button className="capture" type="button" onClick={captureMealPhoto} disabled={photoOptimizing}>
                {photoOptimizing ? '최적화 중...' : '촬영'}
              </button>
            </div>
          </section>
        </div>
      )}

      {modal === 'partnerMeal' && mealOwner === 'partner' && (
        <div className="modal-backdrop">
          <section className="record-modal partner-meal-detail" role="dialog" aria-modal="true">
            <button className="modal-close" type="button" onClick={() => { clearScheduleDraft(); setModal(null) }}>×</button>
            <span className="eyebrow">PARTNER MEAL</span>
            <h3>{partnerName}님의 식단 🍚</h3>
            <p>{formatDate(selectedDate)}</p>
            <div className="partner-meal-summary">
              <div><span>식사 종류</span><strong>{mealTypes.find(([key]) => key === mealType)?.[1]}</strong></div>
              <div><span>식사 시간</span><strong>{meals[mealType].partner.time}</strong></div>
              <div><span>작성 내용</span><strong>{meals[mealType].partner.memo || '작성된 메모가 없어요.'}</strong></div>
            </div>
            <div className="meal-detail-photos">
              <span>음식 사진</span>
              {meals[mealType].partner.photos?.length ? (
                <div className="meal-photo-gallery">
                  {meals[mealType].partner.photos.map((photo, index) => (
                    <img key={`${photo.name}-${index}`} src={photo.url} alt={`${partnerName}님의 음식 ${index + 1}`} />
                  ))}
                </div>
              ) : (
                <div className="meal-photo-empty"><span aria-hidden="true">🍽️</span>등록된 음식 사진이 없어요.</div>
              )}
            </div>
            <div className="read-only-notice">상대방의 식단은 조회만 가능하며 수정하거나 삭제할 수 없습니다.</div>
            <button className="modal-submit secondary" type="button" onClick={() => setModal(null)}>확인</button>
          </section>
        </div>
      )}

      {modal === 'schedule' && (
        <div className="modal-backdrop">
          <section className="record-modal" role="dialog" aria-modal="true">
            <button className="modal-close" type="button" onClick={() => setModal(null)}>×</button>
            <span className="eyebrow">SCHEDULE RECORD</span>
            <h3>{selectedSchedule ? '일정 상세 및 수정' : '일정 등록'} 📅</h3>
            <p>{formatDate(selectedDate)}</p>
            <form ref={scheduleFormRef} onSubmit={saveSchedule} onInput={(event) => rememberScheduleDraft(event.currentTarget)}>
              <div className="form-field owner-field"><span>일정 소유자</span><strong><i className="owner-dot me" /> {displayName}</strong><small>본인의 일정만 등록할 수 있어요.</small></div>
              <label className="form-field"><span>일정 제목</span><input name="title" defaultValue={scheduleDraft?.fields?.title ?? selectedSchedule?.title ?? ''} placeholder="예: 마케팅 팀 주간 회의" required /></label>
              <fieldset className="form-fieldset">
                <legend>일정 스티커</legend>
                <div className="sticker-picker">
                  {stickers.map(([label, icon], index) => (
                    <label key={label}><input type="radio" name="sticker" value={icon} defaultChecked={scheduleDraft?.fields?.sticker ? scheduleDraft.fields.sticker === icon : selectedSchedule ? selectedSchedule.sticker === icon : index === 0} /><span>{icon}</span><small>{label}</small></label>
                  ))}
                </div>
              </fieldset>
              <div className="date-time-grid">
                <label className="form-field"><span>시작 날짜</span><input name="startDate" type="date" defaultValue={scheduleDraft?.fields?.startDate ?? selectedSchedule?.startDate ?? defaultScheduleStart.date} required /></label>
                <label className="form-field"><span>시작 시간</span><input name="startTime" type="time" step="1800" defaultValue={scheduleDraft?.fields?.startTime ?? selectedSchedule?.startTime ?? defaultScheduleStart.time} required /></label>
                <label className="form-field"><span>종료 날짜</span><input name="endDate" type="date" defaultValue={scheduleDraft?.fields?.endDate ?? selectedSchedule?.endDate ?? defaultScheduleEnd.date} required /></label>
                <label className="form-field"><span>종료 시간</span><input name="endTime" type="time" step="1800" defaultValue={scheduleDraft?.fields?.endTime ?? selectedSchedule?.endTime ?? defaultScheduleEnd.time} required /></label>
              </div>
              <label className="form-field"><span>메모</span><textarea name="memo" defaultValue={scheduleDraft?.fields?.memo ?? selectedSchedule?.memo ?? ''} placeholder="일정 내용을 적어주세요." /></label>
              {scheduleError ? <p className="meal-status error">{scheduleError}</p> : null}
              <div className="schedule-form-actions">
                {selectedSchedule ? (
                  deleteConfirm ? (
                    <div className="delete-confirm">
                      <span>정말 삭제할까요?</span>
                      <button type="button" onClick={() => setDeleteConfirm(false)}>취소</button>
                      <button className="danger" type="button" onClick={removeSelectedSchedule} disabled={scheduleSaving}>삭제</button>
                    </div>
                  ) : (
                    <button className="delete-schedule-button" type="button" onClick={() => setDeleteConfirm(true)}>일정 삭제</button>
                  )
                ) : <span />}
                <button className="modal-submit" type="submit" disabled={scheduleSaving}>
                  {scheduleSaving ? '저장 중...' : selectedSchedule ? '변경사항 저장' : '일정 등록하기'}
                </button>
              </div>
              <div className="mobile-form-dock" aria-label="일정 등록 작업">
                <button className="dock-cancel" type="button" onClick={() => setModal(null)} disabled={scheduleSaving}>
                  취소
                </button>
                <span aria-hidden="true" />
                <button className="dock-save" type="submit" disabled={scheduleSaving}>
                  {scheduleSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modal === 'partnerSchedule' && selectedSchedule && (
        <div className="modal-backdrop">
          <section className="record-modal partner-schedule-detail" role="dialog" aria-modal="true">
            <button className="modal-close" type="button" onClick={() => setModal(null)}>×</button>
            <span className="eyebrow">PARTNER SCHEDULE</span>
            <h3>{partnerName}님의 일정</h3>
            <div className="partner-meal-summary">
              <div><span>일정</span><strong>{selectedSchedule.sticker} {selectedSchedule.title}</strong></div>
              <div><span>시작</span><strong>{selectedSchedule.startDate} {selectedSchedule.startTime}</strong></div>
              <div><span>종료</span><strong>{selectedSchedule.endDate} {selectedSchedule.endTime}</strong></div>
              <div><span>메모</span><strong>{selectedSchedule.memo || '작성된 메모가 없어요.'}</strong></div>
            </div>
            <div className="read-only-notice">상대방의 일정은 조회만 가능하며 수정하거나 삭제할 수 없습니다.</div>
            <button className="modal-submit secondary" type="button" onClick={() => setModal(null)}>확인</button>
          </section>
        </div>
      )}
    </section>
  )
}

export default CalendarView
