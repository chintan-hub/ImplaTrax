/**
 * Reads an image file and re-encodes it as a small data URI, capped at
 * `maxDim` on its longest side. There's no upload backend, so any logo a
 * user picks is stored inline in localStorage — without downscaling, a
 * single unedited phone photo could burn through most of the app's
 * persistence quota.
 */
export function fileToResizedDataUrl(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a readable image.'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not process the image.'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
