import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import GetQuoteForm from "./components/GetQuote-Form"

export default async function GetQuotePage() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  return <GetQuoteForm role={role} taxRate={taxRate} />
}
