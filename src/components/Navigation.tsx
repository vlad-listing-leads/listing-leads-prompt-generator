'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LogOut,
  Menu,
  X,
} from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'admin'
}

interface NavigationProps {
  variant?: 'light' | 'dark'
}

export function Navigation({ variant = 'light' }: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isDark = variant === 'dark'

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(data)
      }

      setIsLoading(false)
    }

    fetchProfile()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/my-designs', label: 'Designs' },
    { href: '/profile', label: 'Profile' },
  ]

  const adminItems = [
    { href: '/admin', label: 'Admin' },
  ]

  const allNavItems = profile?.role === 'admin'
    ? [...navItems, ...adminItems]
    : navItems

  if (isLoading) {
    return (
      <nav className={cn(
        "h-14 border-b backdrop-blur-sm",
        isDark
          ? "border-white/10 bg-[#141414]/80"
          : "border-gray-200/60 bg-white/80"
      )}>
        <div className="h-full max-w-screen-xl mx-auto px-6 flex items-center justify-center">
          <span className={cn("text-sm font-medium", isDark ? "text-gray-500" : "text-gray-400")}>Loading...</span>
        </div>
      </nav>
    )
  }

  return (
    <nav className={cn(
      "h-14 border-b backdrop-blur-sm sticky top-0 z-40",
      isDark
        ? "border-white/10 bg-[#141414]/80"
        : "border-gray-200/60 bg-white/80"
    )}>
      <div className="h-full max-w-screen-xl mx-auto px-6 flex items-center">
        {/* Logo - Left */}
        <div className="flex-1">
          <Link
            href="/my-designs"
            className="hover:opacity-70 transition-opacity"
          >
            <Image
              src={isDark ? "/logo-white.svg" : "/logo.svg"}
              alt="Listing Leads"
              width={175}
              height={25}
              priority
            />
          </Link>
        </div>

        {/* Center Navigation - Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {allNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
                pathname.startsWith(item.href)
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* User Menu - Right */}
        <div className="flex-1 flex justify-end items-center">
          {/* Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {profile?.full_name || profile?.email?.split('@')[0]}
            </span>
            <button
              onClick={handleSignOut}
              className={cn(
                "text-sm transition-colors flex items-center gap-1.5",
                isDark
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className={cn(
              "md:hidden p-2 -mr-2 transition-colors",
              isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className={cn(
          "md:hidden absolute top-14 left-0 right-0 border-b shadow-lg",
          isDark
            ? "bg-[#1a1a1a] border-white/10"
            : "bg-white border-gray-200/60"
        )}>
          <div className="py-3 px-6 space-y-1">
            {allNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  pathname.startsWith(item.href)
                    ? isDark
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-900 text-white'
                    : isDark
                      ? 'text-gray-400 hover:text-white hover:bg-white/10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className={cn(
            "py-3 px-6 border-t",
            isDark ? "border-white/10" : "border-gray-100"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                {profile?.full_name || profile?.email?.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                className={cn(
                  "text-sm transition-colors flex items-center gap-1.5",
                  isDark
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
