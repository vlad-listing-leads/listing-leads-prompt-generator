export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'image'
  | 'color'
  | 'url'
  | 'email'
  | 'phone'

export type CustomizationStatus = 'draft' | 'published'

export type UserRole = 'user' | 'admin'

export interface Database {
  public: {
    Tables: {
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          html_content: string
          thumbnail_url: string | null
          is_active: boolean
          size: string | null
          campaign_id: string | null
          system_prompt_id: string | null
          template_prompt: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          html_content: string
          thumbnail_url?: string | null
          is_active?: boolean
          size?: string | null
          campaign_id?: string | null
          system_prompt_id?: string | null
          template_prompt?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          html_content?: string
          thumbnail_url?: string | null
          is_active?: boolean
          size?: string | null
          campaign_id?: string | null
          system_prompt_id?: string | null
          template_prompt?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      template_fields: {
        Row: {
          id: string
          template_id: string
          field_key: string
          field_type: FieldType
          label: string
          placeholder: string | null
          default_value: string | null
          options: Json | null
          is_required: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_id: string
          field_key: string
          field_type: FieldType
          label: string
          placeholder?: string | null
          default_value?: string | null
          options?: Json | null
          is_required?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          field_key?: string
          field_type?: FieldType
          label?: string
          placeholder?: string | null
          default_value?: string | null
          options?: Json | null
          is_required?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      customizations: {
        Row: {
          id: string
          user_id: string
          template_id: string
          name: string
          status: CustomizationStatus
          created_at: string
          updated_at: string
          published_at: string | null
          published_url: string | null
          thumbnail_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          name: string
          status?: CustomizationStatus
          created_at?: string
          updated_at?: string
          published_at?: string | null
          published_url?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          name?: string
          status?: CustomizationStatus
          created_at?: string
          updated_at?: string
          published_at?: string | null
          published_url?: string | null
          thumbnail_url?: string | null
        }
      }
      field_values: {
        Row: {
          id: string
          customization_id: string
          field_id: string
          value: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customization_id: string
          field_id: string
          value?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customization_id?: string
          field_id?: string
          value?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          memberstack_id: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          memberstack_id?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          memberstack_id?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      field_type: FieldType
      customization_status: CustomizationStatus
      user_role: UserRole
    }
  }
}

// Convenience types
export type Template = Database['public']['Tables']['templates']['Row']
export type TemplateInsert = Database['public']['Tables']['templates']['Insert']
export type TemplateUpdate = Database['public']['Tables']['templates']['Update']

export type TemplateField = Database['public']['Tables']['template_fields']['Row']
export type TemplateFieldInsert = Database['public']['Tables']['template_fields']['Insert']
export type TemplateFieldUpdate = Database['public']['Tables']['template_fields']['Update']

export type Customization = Database['public']['Tables']['customizations']['Row']
export type CustomizationInsert = Database['public']['Tables']['customizations']['Insert']
export type CustomizationUpdate = Database['public']['Tables']['customizations']['Update']

export type FieldValue = Database['public']['Tables']['field_values']['Row']
export type FieldValueInsert = Database['public']['Tables']['field_values']['Insert']
export type FieldValueUpdate = Database['public']['Tables']['field_values']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// System prompt type
export interface SystemPrompt {
  id: string
  name: string
  description: string | null
  prompt_content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Extended types with relations
export interface TemplateWithFields extends Template {
  template_fields: TemplateField[]
}

export interface TemplateWithSystemPrompt extends Template {
  system_prompt: { name: string } | null
}

export interface CustomizationWithDetails extends Customization {
  template: Template
  field_values: (FieldValue & { template_field: TemplateField })[]
}

export interface FieldValueWithField extends FieldValue {
  template_field: TemplateField
}

// Campaign types
export interface Campaign {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
  template_count?: number
}

export interface CampaignInsert {
  name: string
  description?: string | null
  color?: string
}

export interface CampaignUpdate {
  name?: string
  description?: string | null
  color?: string
  is_active?: boolean
}
