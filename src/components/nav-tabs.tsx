'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Palette,
  LayoutTemplate,
  User,
  BarChart3,
  Users,
  FileText,
  Settings,
  MessageSquareText,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserRole } from '@/hooks/use-user-role'

interface NavTab {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const mainTabs: NavTab[] = [
  { href: '/designs', label: 'Designs', icon: Palette },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/profile', label: 'Profile', icon: User },
]

const adminTabs: NavTab[] = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/admin/prompts', label: 'Prompts', icon: MessageSquareText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/plans', label: 'Plans', icon: Shield },
]

function TabItem({ tab, isActive }: { tab: NavTab; isActive: boolean }) {
  const Icon = tab.icon
  return (
    <Link
      href={tab.href}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
        isActive
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {tab.label}
    </Link>
  )
}

export function NavTabs() {
  const pathname = usePathname()
  const { isAdmin } = useUserRole()

  const isAdminSection = pathname.startsWith('/admin')

  const tabs = isAdminSection && isAdmin ? adminTabs : mainTabs

  const isTabActive = (tab: NavTab) => {
    if (tab.href === '/designs') return pathname === '/designs' || pathname === '/'
    if (tab.href === '/admin') return pathname === '/admin'
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <TabItem key={tab.href} tab={tab} isActive={isTabActive(tab)} />
      ))}
    </div>
  )
}
