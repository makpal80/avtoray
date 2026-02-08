"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { parseJwt } from "@/lib/auth"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/login")
      return
    }

    const payload = parseJwt(token)

    if (!payload.is_admin) {
      router.push("/") // или /orders
    }
  }, [])

  return <>{children}</>
}
