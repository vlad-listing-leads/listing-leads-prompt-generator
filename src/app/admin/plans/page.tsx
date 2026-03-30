'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Shield, Trash2, Plus, Check } from 'lucide-react'

interface AllowedPlan {
  id: string
  memberstack_plan_id: string
  plan_name: string
  created_at: string
}

interface AvailablePlan {
  memberstack_plan_id: string
  plan_name: string
  type: string
  is_legacy?: boolean
}

export default function AdminPlansPage() {
  const [allowed, setAllowed] = useState<AllowedPlan[]>([])
  const [available, setAvailable] = useState<AvailablePlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addingPlanId, setAddingPlanId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/admin/allowed-plans')
      if (!res.ok) throw new Error('Failed to fetch plans')
      const { data } = await res.json()
      setAllowed(data.allowed ?? [])
      setAvailable(data.availablePlans ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const allowedPlanIds = new Set(allowed.map((p) => p.memberstack_plan_id))

  const handleAdd = async (plan: AvailablePlan) => {
    setAddingPlanId(plan.memberstack_plan_id)
    setError(null)

    try {
      const res = await fetch('/api/admin/allowed-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberstack_plan_id: plan.memberstack_plan_id,
          plan_name: plan.plan_name,
        }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg || 'Failed to add plan')
      }

      await fetchPlans()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plan')
    } finally {
      setAddingPlanId(null)
    }
  }

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    setError(null)

    try {
      const res = await fetch(`/api/admin/allowed-plans?id=${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to remove plan')
      await fetchPlans()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove plan')
    } finally {
      setRemovingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Plan Gating</h1>
          <p className="text-sm text-muted-foreground">
            Control which Listing Leads plans can access this app
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Allowed Plans */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-medium text-foreground mb-1">Allowed Plans</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Users with any of these plans can access the app.
          {allowed.length === 0 && ' No plans configured — all authenticated users have access.'}
        </p>

        {allowed.length > 0 ? (
          <div className="space-y-2">
            {allowed.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-foreground">{plan.plan_name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {plan.memberstack_plan_id}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(plan.id)}
                  disabled={removingId === plan.id}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {removingId === plan.id ? (
                    <Spinner size="sm" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-dashed border-border text-center">
            <p className="text-sm text-muted-foreground">
              No plans in the allowlist. All authenticated users can access the app.
            </p>
          </div>
        )}
      </Card>

      {/* Available Plans from LL */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-foreground mb-1">Available Plans</h2>
        <p className="text-sm text-muted-foreground mb-4">
          All plans from Listing Leads. Click &quot;Allow&quot; to add to the allowlist.
        </p>

        {available.length > 0 ? (
          <div className="space-y-2">
            {available.map((plan) => {
              const isAllowed = allowedPlanIds.has(plan.memberstack_plan_id)
              return (
                <div
                  key={plan.memberstack_plan_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{plan.plan_name}</span>
                    {plan.is_legacy && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                        Legacy
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {plan.type}
                    </span>
                  </div>
                  {isAllowed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                      <Check className="w-3 h-3" />
                      Allowed
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdd(plan)}
                      disabled={addingPlanId === plan.memberstack_plan_id}
                    >
                      {addingPlanId === plan.memberstack_plan_id ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <Plus className="w-3 h-3 mr-1" />
                          Allow
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-dashed border-border text-center">
            <p className="text-sm text-muted-foreground">
              No plans found. Check that LISTING_LEADS_SUPABASE_URL and LISTING_LEADS_SUPABASE_SERVICE_ROLE_KEY are configured.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
