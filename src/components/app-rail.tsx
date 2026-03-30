'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Radar, MapPinHouse, Flame, Shield } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useUserRole } from '@/hooks/use-user-role'

interface AppEntry {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  active?: boolean
}

const apps: AppEntry[] = [
  {
    id: 'zma',
    label: 'ZMA',
    icon: Radar,
    href: 'https://zma.listingleads.com',
  },
  {
    id: 'magic-buyer',
    label: 'Magic Buyer',
    icon: MapPinHouse,
    href: 'https://magic-buyer-letter.listingleads.com/',
  },
  {
    id: 'cannonball',
    label: 'Cannon Ball',
    icon: Flame,
    href: '/templates',
    active: true,
  },
]

export function AppRail() {
  const { resolvedTheme } = useTheme()
  const { isAdmin } = useUserRole()
  const pathname = usePathname()
  const isAdminSection = pathname.startsWith('/admin')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const logoSrc =
    mounted && resolvedTheme === 'dark'
      ? '/logo-collapsed-dark-mode.svg'
      : '/logo-collapsed.svg'

  return (
    <div className="flex flex-col w-[60px] h-full bg-zinc-50 dark:bg-zinc-900 border-r border-border flex-shrink-0">
      {/* LL Logo */}
      <a
        href="https://www.listingleads.com/plan"
        className="flex items-center justify-center h-14 hover:bg-accent transition-colors"
      >
        <Image
          key={`rail-logo-${resolvedTheme}`}
          src={logoSrc}
          alt="Listing Leads"
          width={28}
          height={28}
          className="size-7"
          priority
        />
      </a>

      {/* App Icons */}
      <div className="flex-1 flex flex-col items-center pt-3 gap-1">
        {apps.map((app) => {
          const Icon = app.icon
          const isActive = app.active

          const content = (
            <div
              className={cn(
                'flex flex-col items-center justify-center w-[52px] py-2 rounded-lg transition-colors cursor-pointer',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-medium mt-1 leading-tight text-center">
                {app.label}
              </span>
            </div>
          )

          if (app.active) {
            return (
              <Link key={app.id} href={app.href}>
                {content}
              </Link>
            )
          }

          return (
            <a key={app.id} href={app.href}>
              {content}
            </a>
          )
        })}
      </div>

      {/* Admin toggle at bottom */}
      {isAdmin && (
        <div className="flex flex-col items-center pb-3">
          <Link
            href={isAdminSection ? '/templates' : '/admin'}
            className={cn(
              'flex flex-col items-center justify-center w-[52px] py-2 rounded-lg transition-colors cursor-pointer',
              isAdminSection
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Shield className="h-5 w-5" />
            <span className="text-[9px] font-medium mt-1 leading-tight">
              {isAdminSection ? 'Back' : 'Admin'}
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
