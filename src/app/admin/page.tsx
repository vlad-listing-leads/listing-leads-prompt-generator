'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { LayoutGrid, FileText, Users, Plus, Settings, DollarSign, TrendingUp } from 'lucide-react'

interface Stats {
  templates: number
  designs: number
  users: number
  aiProvider: string
}

interface DailyActivity {
  date: string
  count: number
}

// Dark theme card component
function DarkCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1e1e1e] rounded-2xl border border-white/5 ${className}`}>
      {children}
    </div>
  )
}

// Calculate estimated AI cost
function calculateEstimatedCost(designCount: number, provider: string): number {
  // Average tokens per design generation
  const avgInputTokens = 3000  // HTML + prompt
  const avgOutputTokens = 5000 // Generated HTML

  // Pricing per 1M tokens (as of 2024)
  const pricing: Record<string, { input: number; output: number }> = {
    anthropic: { input: 3.00, output: 15.00 },   // Claude Sonnet
    openai: { input: 2.50, output: 10.00 },      // GPT-4o
  }

  const rates = pricing[provider] || pricing.anthropic

  // Cost per design
  const inputCost = (avgInputTokens * rates.input) / 1_000_000
  const outputCost = (avgOutputTokens * rates.output) / 1_000_000
  const costPerDesign = inputCost + outputCost

  return designCount * costPerDesign
}

// Format date for display
function formatDate(dateStr: string, view: 'weekly' | 'monthly'): string {
  const date = new Date(dateStr)
  if (view === 'monthly') {
    return date.toLocaleDateString('en-US', { month: 'short' })
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly')

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()

      try {
        // Fetch basic counts
        const [templatesRes, designsRes, usersRes, settingsRes] = await Promise.all([
          supabase.from('listing_templates').select('id', { count: 'exact', head: true }),
          supabase.from('customizations').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('app_settings').select('value').eq('key', 'ai_provider').single(),
        ])

        // Fetch daily activity (designs created per day for the last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: activityData } = await supabase
          .from('customizations')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true })

        // Group by date
        const activityByDate: Record<string, number> = {}

        // Initialize all days with 0
        for (let i = 0; i < 30; i++) {
          const date = new Date()
          date.setDate(date.getDate() - (29 - i))
          const dateStr = date.toISOString().split('T')[0]
          activityByDate[dateStr] = 0
        }

        // Count designs per day
        activityData?.forEach((item) => {
          const dateStr = item.created_at.split('T')[0]
          if (activityByDate[dateStr] !== undefined) {
            activityByDate[dateStr]++
          }
        })

        const dailyData = Object.entries(activityByDate).map(([date, count]) => ({
          date,
          count,
        }))

        setDailyActivity(dailyData)
        setStats({
          templates: templatesRes.count || 0,
          designs: designsRes.count || 0,
          users: usersRes.count || 0,
          aiProvider: settingsRes.data?.value?.provider || 'anthropic',
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Get chart data based on view
  const getChartData = () => {
    if (chartView === 'weekly') {
      // Last 7 days
      return dailyActivity.slice(-7)
    } else {
      // Group by month
      const monthlyData: Record<string, number> = {}
      dailyActivity.forEach(({ date, count }) => {
        const monthKey = date.substring(0, 7) // YYYY-MM
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + count
      })
      return Object.entries(monthlyData).map(([date, count]) => ({ date, count }))
    }
  }

  const chartData = getChartData()
  const maxCount = Math.max(...chartData.map(d => d.count), 1)
  const estimatedCost = stats ? calculateEstimatedCost(stats.designs, stats.aiProvider) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <Link
          href="/admin/templates/new"
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Designs Created */}
            <DarkCard className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Designs Created</p>
                  <p className="text-xs text-gray-500 mb-3">Total across all users</p>
                  <p className="text-4xl font-light text-white">{stats?.designs || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#f5d5d5]/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#f5d5d5]" />
                </div>
              </div>
            </DarkCard>

            {/* Total Templates */}
            <DarkCard className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Templates</p>
                  <p className="text-xs text-gray-500 mb-3">Available templates</p>
                  <p className="text-4xl font-light text-white">{stats?.templates || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </DarkCard>

            {/* Total Users */}
            <DarkCard className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Users</p>
                  <p className="text-xs text-gray-500 mb-3">Registered accounts</p>
                  <p className="text-4xl font-light text-white">{stats?.users || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </DarkCard>

            {/* Estimated AI Cost */}
            <DarkCard className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Est. AI Cost</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Using {stats?.aiProvider === 'openai' ? 'GPT-4o' : 'Claude Sonnet'}
                  </p>
                  <p className="text-4xl font-light text-white">
                    ${estimatedCost.toFixed(2)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
            </DarkCard>
          </div>

          {/* Activity Chart */}
          <DarkCard className="p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-400">Designs created over time</p>
              <div className="flex gap-1 bg-[#2a2a2a] rounded-lg p-1">
                <button
                  onClick={() => setChartView('weekly')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    chartView === 'weekly'
                      ? 'bg-[#f5d5d5] text-gray-900'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setChartView('monthly')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    chartView === 'monthly'
                      ? 'bg-[#f5d5d5] text-gray-900'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="h-64 flex items-end justify-between gap-2 px-4">
              {chartData.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-2">{item.count}</span>
                  <div
                    className="w-full bg-[#f5d5d5]/20 rounded-t transition-all hover:bg-[#f5d5d5]/40 min-h-[4px]"
                    style={{ height: `${Math.max((item.count / maxCount) * 100, 2)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 px-4">
              {chartData.map((item, i) => (
                <span key={i} className="flex-1 text-center text-xs text-gray-500 truncate">
                  {chartView === 'weekly'
                    ? new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
                    : new Date(item.date + '-01').toLocaleDateString('en-US', { month: 'short' })
                  }
                </span>
              ))}
            </div>
          </DarkCard>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/templates">
              <DarkCard className="p-5 hover:bg-[#252525] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#f5d5d5]/10 flex items-center justify-center">
                    <LayoutGrid className="w-5 h-5 text-[#f5d5d5]" />
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-[#f5d5d5] transition-colors">Manage Templates</p>
                    <p className="text-sm text-gray-500">View and edit templates</p>
                  </div>
                </div>
              </DarkCard>
            </Link>

            <Link href="/admin/templates/new">
              <DarkCard className="p-5 hover:bg-[#252525] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#f5d5d5]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#f5d5d5]" />
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-[#f5d5d5] transition-colors">Create Template</p>
                    <p className="text-sm text-gray-500">Add a new template</p>
                  </div>
                </div>
              </DarkCard>
            </Link>

            <Link href="/admin/users">
              <DarkCard className="p-5 hover:bg-[#252525] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#f5d5d5]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#f5d5d5]" />
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-[#f5d5d5] transition-colors">Manage Users</p>
                    <p className="text-sm text-gray-500">View registered users</p>
                  </div>
                </div>
              </DarkCard>
            </Link>

            <Link href="/admin/settings">
              <DarkCard className="p-5 hover:bg-[#252525] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#f5d5d5]/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[#f5d5d5]" />
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-[#f5d5d5] transition-colors">Settings</p>
                    <p className="text-sm text-gray-500">AI provider & configuration</p>
                  </div>
                </div>
              </DarkCard>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
