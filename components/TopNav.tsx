'use client'

import { Bell, HelpCircle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function TopNav() {
  return (
    <nav className="bg-black border-b border-gray-800 px-4 py-4">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/ci-logo.png"
            alt="CI Connect Logo"
            width={64}
            height={64}
            className="object-contain"
          />
        </Link>

        {/* Right side icons */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="text-gray-400 hover:text-violet-400 transition-colors relative">
            <Bell className="h-6 w-6" />
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 bg-violet-400 text-black text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
              3
            </span>
          </button>

          {/* Help */}
          <button className="text-gray-400 hover:text-violet-400 transition-colors">
            <HelpCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </nav>
  )
}