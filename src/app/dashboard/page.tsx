import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Dashboard from "./Dashboard"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const role = session.user.role
  if (role !== "admin" && role !== "employee") redirect("/account")

  return <Dashboard role={role} firstName={session.user.firstName} lastName={session.user.lastName} />
}
