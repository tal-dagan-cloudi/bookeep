import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import sharp from "sharp"

const STORAGE_DIR = path.join(process.cwd(), "storage")
const THUMBNAILS_DIR = path.join(STORAGE_DIR, "thumbnails")

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true })
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  orgId: string
): Promise<{ filePath: string; fileType: string; fileSizeBytes: number }> {
  const ext = path.extname(originalName).toLowerCase()
  const fileId = randomUUID()
  const fileName = `${fileId}${ext}`
  const orgDir = path.join(STORAGE_DIR, orgId)

  await ensureDir(orgDir)

  const filePath = path.join(orgDir, fileName)
  await writeFile(filePath, buffer)

  return {
    filePath: `${orgId}/${fileName}`,
    fileType: ext.replace(".", ""),
    fileSizeBytes: buffer.length,
  }
}

export async function getFile(relativePath: string): Promise<Buffer> {
  const fullPath = path.join(STORAGE_DIR, relativePath)
  return readFile(fullPath)
}

export async function generateThumbnail(
  relativePath: string,
  orgId: string
): Promise<string> {
  await ensureDir(THUMBNAILS_DIR)

  const fullPath = path.join(STORAGE_DIR, relativePath)
  const fileBuffer = await readFile(fullPath)
  const ext = path.extname(relativePath).toLowerCase()
  const thumbName = `${path.basename(relativePath, ext)}_thumb.webp`
  const thumbRelPath = `thumbnails/${thumbName}`
  const thumbFullPath = path.join(THUMBNAILS_DIR, thumbName)

  if ([".jpg", ".jpeg", ".png", ".webp", ".heic"].includes(ext)) {
    await sharp(fileBuffer)
      .resize(300, 300, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(thumbFullPath)
  } else if (ext === ".pdf") {
    // For PDFs, create a placeholder thumbnail
    // In production, use pdf-to-image library
    await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 4,
        background: { r: 245, g: 245, b: 245, alpha: 1 },
      },
    })
      .webp({ quality: 80 })
      .toFile(thumbFullPath)
  }

  return thumbRelPath
}

export async function getThumbnail(relativePath: string): Promise<Buffer> {
  const fullPath = path.join(STORAGE_DIR, relativePath)
  return readFile(fullPath)
}
