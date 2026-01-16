"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, PlusSquare, MessageCircle, User } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type NavItem = {
  label: string
  href: string
  icon: any
}

export default function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [ready, setReady] = useState(false)

  async function fetchUnread() {
    const res = await fetch("/api/messages/unread")
    const data = await res.json()
    setUnreadCount(data.count)
  }

  useEffect(() => {
    let channel: any

    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        setReady(true)
        return
      }

      setIsLoggedIn(true)
      await fetchUnread()

      channel = supabase
        .channel("bottom-nav-messages")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages"
          },
          fetchUnread
        )
        .subscribe()

      setReady(true)
    }

    load()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase])

  if (!ready) return null

  const navItems: NavItem[] = [
    { label: "Home", href: "/", icon: Home },
    { label: "Networking", href: "/networking", icon: Users },
    { label: "Post", href: "/post", icon: PlusSquare },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    {
      label: "Profile",
      href: isLoggedIn ? "/profile" : "/auth/login",
      icon: User
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-yellow-500/10 bg-black">
      <ul className="flex justify-around items-center h-16">
        {navItems.map(item => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/")

          const Icon = item.icon

          return (
            <li key={item.label} className="relative">
              <Link
                href={item.href}
                className={`flex flex-col items-center text-[11px] ${
                  isActive ? "text-violet-400" : "text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 mb-1" />

                  {item.label === "Messages" &&
                    unreadCount > 0 && (
                      <span
                        className="
                          absolute -top-1 -right-2
                          min-w-[16px] h-[16px]
                          rounded-full
                          bg-gradient-to-r from-violet-400 to-black
                          text-white
                          text-[9px]
                          flex items-center justify-center
                          font-semibold
                        "
                      >
                        {unreadCount}
                      </span>
                    )}
                </div>

                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
