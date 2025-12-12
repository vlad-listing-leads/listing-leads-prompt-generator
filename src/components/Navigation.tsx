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
  ChevronDown,
  User,
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
    { href: '/designs', label: 'Designs' },
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
        <div className="flex-1 flex items-center gap-4">
          <Link
            href="/designs"
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
          <div className={cn(
            "hidden sm:flex items-center gap-2 text-sm",
            isDark ? "text-[#f5d5d5]/50" : "text-[#c4a090]"
          )}>
            <span>Powered by</span>
            <Image
              src="/claude.svg"
              alt="Claude"
              width={72}
              height={18}
              className={isDark ? "opacity-60" : "opacity-50"}
            />
          </div>
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
          <div className="hidden md:flex items-center relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
                isDark
                  ? "text-white hover:bg-white/10"
                  : "text-gray-900 hover:bg-gray-100"
              )}
            >
              <span className="text-sm font-medium">
                {profile?.full_name || profile?.email?.split('@')[0]}
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                userMenuOpen && "rotate-180"
              )} />
            </button>

            {/* User dropdown menu */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className={cn(
                  "absolute right-0 top-full mt-2 z-20 rounded-lg shadow-xl overflow-hidden min-w-[160px] border",
                  isDark
                    ? "bg-[#2a2a2a] border-white/10"
                    : "bg-white border-gray-200"
                )}>
                  <Link
                    href="/account"
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors",
                      isDark
                        ? "text-gray-300 hover:bg-white/10 hover:text-white"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <User className="w-4 h-4" />
                    Account
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      handleSignOut()
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-t",
                      isDark
                        ? "text-gray-300 hover:bg-white/10 hover:text-white border-white/10"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-gray-100"
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
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
            <div className={cn("text-sm font-medium mb-3", isDark ? "text-white" : "text-gray-900")}>
              {profile?.full_name || profile?.email?.split('@')[0]}
            </div>
            <div className="space-y-1">
              <Link
                href="/account"
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isDark
                    ? "text-gray-400 hover:text-white hover:bg-white/10"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="w-4 h-4" />
                Account
              </Link>
              <button
                onClick={handleSignOut}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isDark
                    ? "text-gray-400 hover:text-white hover:bg-white/10"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
