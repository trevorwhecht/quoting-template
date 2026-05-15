import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const siteUrl =
  process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const order = await prisma.order.findUnique({
    where: { token },
    select: { id: true, nickname: true, mainImage: true, updatedAt: true },
  })

  if (!order) {
    return { title: "Order Not Found" }
  }

  const title = order.nickname
    ? `Order #${order.id} — ${order.nickname}`
    : `Order #${order.id}`
  const imageUrl = `${siteUrl}/api/og/orders/${order.id}?v=${order.updatedAt.getTime()}`
  const canonicalUrl = `${siteUrl}/orders/${token}`

  return {
    title,
    description: title,
    openGraph: {
      title,
      description: title,
      url: canonicalUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: title, images: [imageUrl] },
  }
}

export default function OrderPublicLayout({ children }: { children: React.ReactNode }) {
  return children
}
