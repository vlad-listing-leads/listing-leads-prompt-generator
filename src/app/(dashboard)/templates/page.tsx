import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateGallery } from '@/components/templates'

export const metadata = {
  title: 'Templates | Listing Leads',
  description: 'Browse and select a template to customize',
}

export default async function TemplatesPage() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/designs')
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Templates</h1>
        <p className="mt-1 text-gray-400">
          Choose a template to create your personalized listing page
        </p>
      </div>

      <TemplateGallery />
    </div>
  )
}
