import { supabase } from '../lib/supabase'
import { notifyPartner } from './pushNotifications'

const BUCKET = 'meal-photos'

async function addSignedUrls(meals) {
  return Promise.all(
    meals.map(async (meal) => {
      const photos = await Promise.all(
        (meal.meal_photos || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(async (photo) => {
            const { data, error } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(photo.storage_path, 60 * 60)

            if (error) throw error

            return {
              id: photo.id,
              path: photo.storage_path,
              name: photo.storage_path.split('/').pop(),
              url: data.signedUrl,
            }
          }),
      )

      return { ...meal, photos }
    }),
  )
}

export async function getMealsForDate(coupleId, date) {
  const { data, error } = await supabase
    .from('meals')
    .select('id, user_id, meal_type, meal_time, memo, meal_photos(id, storage_path, sort_order), meal_food_items(id, food_name, normalized_name)')
    .eq('couple_id', coupleId)
    .eq('meal_date', date)
    .order('meal_time')

  if (error) throw error
  return addSignedUrls((data || []).map((meal) => ({
    ...meal,
    foods: (meal.meal_food_items || []).map((item) => item.food_name),
  })))
}

export async function getFoodSuggestions(coupleId, query = '') {
  let request = supabase
    .from('meal_food_items')
    .select('food_name, normalized_name, created_at')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(200)

  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
  if (normalizedQuery) request = request.ilike('normalized_name', `%${normalizedQuery}%`)

  const { data, error } = await request
  if (error) throw error

  const grouped = new Map()
  ;(data || []).forEach((item) => {
    const current = grouped.get(item.normalized_name)
    grouped.set(item.normalized_name, {
      name: current?.name || item.food_name,
      count: (current?.count || 0) + 1,
      latest: current?.latest || item.created_at,
    })
  })

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
    .slice(0, 8)
}

export async function getMealDatesForMonth(coupleId, monthStart, monthEnd) {
  const { data, error } = await supabase
    .from('meals')
    .select('meal_date, user_id')
    .eq('couple_id', coupleId)
    .gte('meal_date', monthStart)
    .lt('meal_date', monthEnd)

  if (error) throw error
  return data || []
}

export async function saveMeal({
  coupleId,
  date,
  mealType,
  time,
  memo,
  photos,
  foodNames = [],
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .upsert(
      {
        couple_id: coupleId,
        user_id: userId,
        meal_date: date,
        meal_type: mealType,
        meal_time: time,
        memo: memo || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,meal_date,meal_type' },
    )
    .select('id')
    .single()

  if (mealError) throw mealError

  const keptPaths = photos.filter((photo) => photo.path).map((photo) => photo.path)
  const { data: previousPhotos, error: previousError } = await supabase
    .from('meal_photos')
    .select('storage_path')
    .eq('meal_id', meal.id)

  if (previousError) throw previousError

  const removedPaths = (previousPhotos || [])
    .map((photo) => photo.storage_path)
    .filter((path) => !keptPaths.includes(path))

  if (removedPaths.length) {
    const { error: removeStorageError } = await supabase.storage
      .from(BUCKET)
      .remove(removedPaths)
    if (removeStorageError) throw removeStorageError
  }

  const finalPhotos = []
  for (const [index, photo] of photos.slice(0, 3).entries()) {
    if (photo.path) {
      finalPhotos.push({ path: photo.path, sortOrder: index })
      continue
    }

    const extension = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${meal.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, photo.file, { contentType: photo.file.type, upsert: false })

    if (uploadError) throw uploadError
    finalPhotos.push({ path, sortOrder: index })
  }

  const { error: deleteRowsError } = await supabase
    .from('meal_photos')
    .delete()
    .eq('meal_id', meal.id)
  if (deleteRowsError) throw deleteRowsError

  if (finalPhotos.length) {
    const { error: photoRowsError } = await supabase
      .from('meal_photos')
      .insert(
        finalPhotos.map((photo) => ({
          meal_id: meal.id,
          storage_path: photo.path,
          sort_order: photo.sortOrder,
        })),
      )
    if (photoRowsError) throw photoRowsError
  }

  const { error: deleteFoodsError } = await supabase
    .from('meal_food_items')
    .delete()
    .eq('meal_id', meal.id)
  if (deleteFoodsError) throw deleteFoodsError

  const uniqueFoods = [...new Map(
    foodNames
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => [name.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' '), name]),
  ).values()].slice(0, 10)

  if (uniqueFoods.length) {
    const { error: foodRowsError } = await supabase
      .from('meal_food_items')
      .insert(uniqueFoods.map((foodName) => ({
        meal_id: meal.id,
        couple_id: coupleId,
        user_id: userId,
        food_name: foodName,
      })))
    if (foodRowsError) throw foodRowsError
  }

  const mealLabels = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식', late_night: '야식' }
  notifyPartner(
    'meals',
    '새 식단 기록',
    `파트너가 ${mealLabels[mealType] || '식단'}을 기록했어요.`,
    `/?daily=${date}`,
  )

  return meal.id
}

export async function deleteMeal(mealId) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data: photos, error: photoError } = await supabase
    .from('meal_photos')
    .select('storage_path, meals!inner(user_id)')
    .eq('meal_id', mealId)
    .eq('meals.user_id', userId)

  if (photoError) throw photoError

  const { error: deleteError } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId)
    .eq('user_id', userId)

  if (deleteError) throw deleteError

  const paths = (photos || []).map((photo) => photo.storage_path)
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths)
    if (storageError) throw storageError
  }
}
