'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Moon,
  Sun,
} from 'lucide-react'

interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'user' | 'admin'
  theme_preference: 'light' | 'dark' | null
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

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

        // Apply saved theme preference from database
        if (data?.theme_preference) {
          setTheme(data.theme_preference)
        }
      }

      setIsLoading(false)
    }

    fetchProfile()
  }, [setTheme])

  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)

    // Save to database
    if (profile?.id) {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', profile.id)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/designs', label: 'Designs' },
    { href: '/profile', label: 'Profile' },
    { href: 'https://listingleads.com/plan', label: 'Weekly Plan', external: true },
  ]

  const adminItems = [
    { href: '/admin', label: 'Admin' },
  ]

  const allNavItems = profile?.role === 'admin'
    ? [...navItems, ...adminItems]
    : navItems

  if (isLoading) {
    return (
      <nav className="h-14 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="h-full max-w-screen-xl mx-auto px-6 flex items-center justify-center">
          <span className="text-sm font-medium text-muted-foreground">Loading...</span>
        </div>
      </nav>
    )
  }

  return (
    <nav className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full w-full px-6 flex items-center">
        {/* Logo - Left */}
        <div className="flex-1 flex items-center gap-4">
          <Link
            href="/designs"
            className="hover:opacity-70 transition-opacity"
          >
            <Image
              src={mounted && theme === 'dark' ? '/logo-white.svg' : '/logo-dark.svg'}
              alt="Listing Leads"
              width={175}
              height={25}
              priority
            />
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <span>Powered by</span>
            <Image
              src={mounted && theme === 'dark' ? '/claude.svg' : '/dark-claude.svg'}
              alt="Claude"
              width={72}
              height={18}
              className="opacity-60"
            />
          </div>
        </div>

        {/* Center Navigation - Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {allNavItems.map((item) => (
            'external' in item && item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
                  pathname.startsWith(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {item.label}
              </Link>
            )
          ))}
        </div>

        {/* User Menu - Right */}
        <div className="flex-1 flex justify-end items-center">
          {/* Desktop */}
          <div className="hidden md:flex items-center relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-foreground hover:bg-accent"
            >
              <span className="text-sm font-medium">
                {profile?.first_name || profile?.email?.split('@')[0]}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                early adopter
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
                <div className="absolute right-0 top-full mt-2 z-20 rounded-lg shadow-xl overflow-hidden min-w-[160px] border border-border bg-card">
                  <Link
                    href="/account"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <User className="w-4 h-4" />
                    Account
                  </Link>
                  <button
                    onClick={handleThemeToggle}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-t border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {mounted && theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4" />
                        Light Mode
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4" />
                        Dark Mode
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      handleSignOut()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-t border-border text-muted-foreground hover:bg-accent hover:text-foreground"
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
            className="md:hidden p-2 -mr-2 transition-colors text-muted-foreground hover:text-foreground"
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
        <div className="md:hidden absolute top-14 left-0 right-0 border-b border-border shadow-lg bg-card">
          <div className="py-3 px-6 space-y-1">
            {allNavItems.map((item) => (
              'external' in item && item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    pathname.startsWith(item.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>

          <div className="py-3 px-6 border-t border-border">
            <div className="flex items-center gap-2 text-sm font-medium mb-3 text-foreground">
              <span>{profile?.first_name || profile?.email?.split('@')[0]}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                early adopter
              </span>
            </div>
            <div className="space-y-1">
              <Link
                href="/account"
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="w-4 h-4" />
                Account
              </Link>
              <button
                onClick={handleThemeToggle}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                {mounted && theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    Dark Mode
                  </>
                )}
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
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
