import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]
const MAX_BYTES = 10 * 1024 * 1024

function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf"
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  return null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { id: userId } = await params
  const isAdmin = session.user.role === "admin"
  if (userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ data: null, error: "No file provided" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ data: null, error: "Invalid file type. Upload PDF, PNG, or JPG." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ data: null, error: "File too large (max 10 MB)." }, { status: 400 })
  }

  if (!process.env.CLOUDINARY_URL) {
    return NextResponse.json({ data: null, error: "File storage not configured." }, { status: 500 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const detected = detectMimeFromBuffer(buffer)
  if (!detected || !ALLOWED_TYPES.includes(detected)) {
    return NextResponse.json({ data: null, error: "Invalid file type. Upload PDF, PNG, or JPG." }, { status: 400 })
  }

  const cloudinary = (await import("cloudinary")).v2

  let uploadResult: any
  try {
    uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "auto", folder: "reseller-licenses", public_id: `${userId}-${Date.now()}` },
        (err, result) => { if (err) reject(err); else resolve(result) }
      ).end(buffer)
    })
  } catch {
    return NextResponse.json({ data: null, error: "Upload failed. Please try again." }, { status: 500 })
  }

  let user
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        resellerLicenseUrl: uploadResult.secure_url,
        resellerLicenseUploadedAt: new Date(),
      },
      select: { resellerLicenseUrl: true, resellerLicenseUploadedAt: true },
    })
  } catch {
    return NextResponse.json({ data: null, error: "Failed to save license." }, { status: 500 })
  }

  return NextResponse.json({ data: user, error: null })
}
