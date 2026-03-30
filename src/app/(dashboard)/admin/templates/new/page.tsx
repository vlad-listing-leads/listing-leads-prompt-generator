import { TemplateEditor } from '@/components/admin'

export const metadata = {
  title: 'New Template | Admin | Listing Leads',
}

export default function NewTemplatePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Create New Template</h1>
        <p className="mt-1 text-muted-foreground">
          Design a new template with customizable fields
        </p>
      </div>

      <TemplateEditor isNew />
    </div>
  )
}
