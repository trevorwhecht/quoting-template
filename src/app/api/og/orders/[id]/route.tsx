import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  const order = isNaN(id)
    ? null
    : await prisma.order.findUnique({
        where: { id },
        select: { id: true, nickname: true, mainImage: true },
      })

  const title = order?.nickname ? `Order #${order.id} — ${order.nickname}` : `Order #${id}`

  // With image: full-bleed photo (og:title provides the text below in share previews)
  if (order?.mainImage) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            background: "#f3f4f6",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.mainImage}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 35%" }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    )
  }

  // No image fallback: clean card with order title
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          gap: "16px",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            fontWeight: "700",
            color: "#111827",
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          {order?.nickname ?? `Order #${id}`}
        </div>
        {order?.nickname ? (
          <div style={{ fontSize: "32px", color: "#6b7280" }}>Order #{order.id}</div>
        ) : null}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  )
}
