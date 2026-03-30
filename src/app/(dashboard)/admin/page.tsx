'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LayoutGrid, FileText, Users, Plus, Settings, DollarSign, TrendingUp, MessageSquareText } from 'lucide-react'

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
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <Link href="/admin/templates/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Template
          </Button>
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
            <Card>
              <CardContent className="pt-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Designs Created</p>
                    <p className="text-xs text-muted-foreground/70 mb-3">Total across all users</p>
                    <p className="text-4xl font-light text-foreground">{stats?.designs || 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Templates */}
            <Card>
              <CardContent className="pt-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Templates</p>
                    <p className="text-xs text-muted-foreground/70 mb-3">Available templates</p>
                    <p className="text-4xl font-light text-foreground">{stats?.templates || 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <LayoutGrid className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Users */}
            <Card>
              <CardContent className="pt-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Users</p>
                    <p className="text-xs text-muted-foreground/70 mb-3">Registered accounts</p>
                    <p className="text-4xl font-light text-foreground">{stats?.users || 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estimated AI Cost */}
            <Card>
              <CardContent className="pt-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Est. AI Cost</p>
                    <p className="text-xs text-muted-foreground/70 mb-3">
                      Using {stats?.aiProvider === 'openai' ? 'GPT-4o' : 'Claude Sonnet'}
                    </p>
                    <p className="text-4xl font-light text-foreground">
                      ${estimatedCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Chart */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground">Designs created over time</p>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setChartView('weekly')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      chartView === 'weekly'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setChartView('monthly')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      chartView === 'monthly'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between gap-2 px-4" style={{ height: '240px' }}>
                {chartData.map((item, i) => {
                  const barHeight = maxCount > 0 ? (item.count / maxCount) * 200 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="text-xs text-muted-foreground mb-2">{item.count}</span>
                      <div
                        className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/40"
                        style={{ height: `${Math.max(barHeight, 4)}px` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-4 px-4">
                {chartData.map((item, i) => (
                  <span key={i} className="flex-1 text-center text-xs text-muted-foreground truncate">
                    {chartView === 'weekly'
                      ? new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
                      : new Date(item.date + '-01').toLocaleDateString('en-US', { month: 'short' })
                    }
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/templates">
              <Card className="hover:bg-accent transition-colors cursor-pointer group">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium group-hover:text-primary transition-colors">Manage Templates</p>
                      <p className="text-sm text-muted-foreground">View and edit templates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/templates/new">
              <Card className="hover:bg-accent transition-colors cursor-pointer group">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium group-hover:text-primary transition-colors">Create Template</p>
                      <p className="text-sm text-muted-foreground">Add a new template</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/users">
              <Card className="hover:bg-accent transition-colors cursor-pointer group">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium group-hover:text-primary transition-colors">Manage Users</p>
                      <p className="text-sm text-muted-foreground">View registered users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/prompts">
              <Card className="hover:bg-accent transition-colors cursor-pointer group">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquareText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium group-hover:text-primary transition-colors">System Prompts</p>
                      <p className="text-sm text-muted-foreground">Manage prompt templates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/settings">
              <Card className="hover:bg-accent transition-colors cursor-pointer group">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium group-hover:text-primary transition-colors">Settings</p>
                      <p className="text-sm text-muted-foreground">AI provider & configuration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
