export type ProviderType = 'spotify' | 'steam' | 'youtube' | 'google_maps'
export type GenerationStatus = 'pending' | 'generating' | 'done' | 'failed'

export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  created_at: string
}

export interface ConnectedAccount {
  id: string
  user_id: string
  provider: ProviderType
  provider_user_id: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  scopes: string[] | null
  last_synced_at: string | null
  needs_reauth: boolean
  extra_data: Record<string, unknown> | null
  created_at: string
}

export interface Event {
  id: string
  user_id: string
  provider: ProviderType
  event_type: string
  occurred_at: string
  month_key: string
  raw_data: Record<string, unknown>
  display_title: string | null
  display_subtitle: string | null
  thumbnail_url: string | null
  created_at: string
}

export interface Sticker {
  id: string
  event_id: string | null
  user_id: string
  template_id: string
  image_url: string | null
  generation_status: GenerationStatus
  generated_at: string | null
  created_at: string
}

export interface Scrapbook {
  id: string
  user_id: string
  month_key: string
  title: string
  canvas_state: unknown | null
  thumbnail_url: string | null
  share_token: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface ScrapbookSticker {
  id: string
  scrapbook_id: string
  sticker_id: string
  position_x: number
  position_y: number
  rotation: number
  scale_x: number
  scale_y: number
  z_index: number
  note_text: string | null
  created_at: string
}

export type PublicScrapbook = Pick<Scrapbook, 'id' | 'user_id' | 'month_key' | 'title' | 'canvas_state' | 'thumbnail_url' | 'is_public'>

// Follows the exact shape Supabase's GenericSchema / GenericTable requires
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Profile>
        Relationships: []
      }
      connected_accounts: {
        Row: ConnectedAccount
        Insert: Omit<ConnectedAccount, 'id' | 'created_at'>
        Update: Partial<ConnectedAccount>
        Relationships: []
      }
      events: {
        Row: Event
        Insert: Omit<Event, 'id' | 'created_at'>
        Update: Partial<Event>
        Relationships: []
      }
      stickers: {
        Row: Sticker
        Insert: Omit<Sticker, 'id' | 'created_at'>
        Update: Partial<Sticker>
        Relationships: []
      }
      scrapbooks: {
        Row: Scrapbook
        Insert: Omit<Scrapbook, 'id' | 'share_token' | 'created_at' | 'updated_at'>
        Update: Partial<Scrapbook>
        Relationships: []
      }
      scrapbook_stickers: {
        Row: ScrapbookSticker
        Insert: Omit<ScrapbookSticker, 'id' | 'created_at'>
        Update: Partial<ScrapbookSticker>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_scrapbook: {
        Args: { p_share_token: string }
        Returns: PublicScrapbook[]
      }
    }
    Enums: {
      provider_type: ProviderType
      generation_status: GenerationStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
