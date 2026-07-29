const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

const loadImage = async (file) => {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' })
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 선택할 수 있어요.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('사진 한 장의 원본 크기는 25MB 이하여야 해요.')
  }

  const image = await loadImage(file)
  try {
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('사진을 최적화할 수 없는 브라우저예요.')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('사진 최적화에 실패했어요.')),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })

    if (blob.size >= file.size) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    image.close?.()
  }
}
