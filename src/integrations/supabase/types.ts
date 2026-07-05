export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          building_id: string
          created_at: string
          id: string
          manager_id: string
          title: string | null
        }
        Insert: {
          body: string
          building_id: string
          created_at?: string
          id?: string
          manager_id: string
          title?: string | null
        }
        Update: {
          body?: string
          building_id?: string
          created_at?: string
          id?: string
          manager_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "property_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      building_branding: {
        Row: {
          accent_color: string | null
          app_icon_url: string | null
          app_name: string | null
          app_short_name: string | null
          building_id: string
          community_icon_url: string | null
          community_name: string | null
          community_tagline: string | null
          cover_image_url: string | null
          created_at: string
          custom_domain: string | null
          custom_tagline: string | null
          draft: Json | null
          draft_updated_at: string | null
          email_accent_color: string | null
          email_logo_url: string | null
          email_primary_color: string | null
          enable_powered_by_footer: boolean
          favicon_url: string | null
          hero_image_url: string | null
          homepage_headline: string | null
          homepage_subheadline: string | null
          id: string
          login_screen_image_url: string | null
          logo_url: string | null
          playbook_cover_image_url: string | null
          primary_color: string | null
          published_at: string | null
          secondary_color: string | null
          splash_screen_image_url: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          app_icon_url?: string | null
          app_name?: string | null
          app_short_name?: string | null
          building_id: string
          community_icon_url?: string | null
          community_name?: string | null
          community_tagline?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_tagline?: string | null
          draft?: Json | null
          draft_updated_at?: string | null
          email_accent_color?: string | null
          email_logo_url?: string | null
          email_primary_color?: string | null
          enable_powered_by_footer?: boolean
          favicon_url?: string | null
          hero_image_url?: string | null
          homepage_headline?: string | null
          homepage_subheadline?: string | null
          id?: string
          login_screen_image_url?: string | null
          logo_url?: string | null
          playbook_cover_image_url?: string | null
          primary_color?: string | null
          published_at?: string | null
          secondary_color?: string | null
          splash_screen_image_url?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          app_icon_url?: string | null
          app_name?: string | null
          app_short_name?: string | null
          building_id?: string
          community_icon_url?: string | null
          community_name?: string | null
          community_tagline?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_tagline?: string | null
          draft?: Json | null
          draft_updated_at?: string | null
          email_accent_color?: string | null
          email_logo_url?: string | null
          email_primary_color?: string | null
          enable_powered_by_footer?: boolean
          favicon_url?: string | null
          hero_image_url?: string | null
          homepage_headline?: string | null
          homepage_subheadline?: string | null
          id?: string
          login_screen_image_url?: string | null
          logo_url?: string | null
          playbook_cover_image_url?: string | null
          primary_color?: string | null
          published_at?: string | null
          secondary_color?: string | null
          splash_screen_image_url?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_branding_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: true
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_legal_documents: {
        Row: {
          building_id: string
          content: string
          created_at: string
          doc_type: string
          id: string
          is_current: boolean
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          building_id: string
          content?: string
          created_at?: string
          doc_type: string
          id?: string
          is_current?: boolean
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          building_id?: string
          content?: string
          created_at?: string
          doc_type?: string
          id?: string
          is_current?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "building_legal_documents_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_playbook_items: {
        Row: {
          building_id: string
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          building_id: string
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_playbook_items_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_settings: {
        Row: {
          allow_resident_circle_creation: boolean
          building_id: string
          community_style: string
          created_at: string
          enable_ai_matching: boolean
          enable_circles: boolean
          enable_community_board: boolean
          enable_concierge: boolean
          enable_conversations: boolean
          enable_experiences: boolean
          enable_introductions: boolean
          enable_resident_ambassadors: boolean
          enable_resident_exchange: boolean
          id: string
          limit_circle_visibility: boolean
          require_circle_approval: boolean
          theme: string
          updated_at: string
        }
        Insert: {
          allow_resident_circle_creation?: boolean
          building_id: string
          community_style?: string
          created_at?: string
          enable_ai_matching?: boolean
          enable_circles?: boolean
          enable_community_board?: boolean
          enable_concierge?: boolean
          enable_conversations?: boolean
          enable_experiences?: boolean
          enable_introductions?: boolean
          enable_resident_ambassadors?: boolean
          enable_resident_exchange?: boolean
          id?: string
          limit_circle_visibility?: boolean
          require_circle_approval?: boolean
          theme?: string
          updated_at?: string
        }
        Update: {
          allow_resident_circle_creation?: boolean
          building_id?: string
          community_style?: string
          created_at?: string
          enable_ai_matching?: boolean
          enable_circles?: boolean
          enable_community_board?: boolean
          enable_concierge?: boolean
          enable_conversations?: boolean
          enable_experiences?: boolean
          enable_introductions?: boolean
          enable_resident_ambassadors?: boolean
          enable_resident_exchange?: boolean
          id?: string
          limit_circle_visibility?: boolean
          require_circle_approval?: boolean
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_settings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: true
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_settings_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          building_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          setting_key: string | null
          template_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          building_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          setting_key?: string | null
          template_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          building_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          setting_key?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_settings_audit_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_settings_audit_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "building_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      building_templates: {
        Row: {
          created_at: string
          enabled_features: Json
          homepage_priority: Json
          id: string
          is_system: boolean
          recommended_circles: Json
          template_description: string | null
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_features?: Json
          homepage_priority?: Json
          id?: string
          is_system?: boolean
          recommended_circles?: Json
          template_description?: string | null
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_features?: Json
          homepage_priority?: Json
          id?: string
          is_system?: boolean
          recommended_circles?: Json
          template_description?: string | null
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          access_code: string
          address: string | null
          amenities: string[]
          archived_at: string | null
          city: string
          community_id: string
          community_intro: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          floor_count: number | null
          id: string
          name: string
          property_type: string | null
          status: string
          template_id: string | null
          unit_count: number | null
          website: string | null
        }
        Insert: {
          access_code?: string
          address?: string | null
          amenities?: string[]
          archived_at?: string | null
          city: string
          community_id?: string
          community_intro?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          floor_count?: number | null
          id?: string
          name: string
          property_type?: string | null
          status?: string
          template_id?: string | null
          unit_count?: number | null
          website?: string | null
        }
        Update: {
          access_code?: string
          address?: string | null
          amenities?: string[]
          archived_at?: string | null
          city?: string
          community_id?: string
          community_intro?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          floor_count?: number | null
          id?: string
          name?: string
          property_type?: string | null
          status?: string
          template_id?: string | null
          unit_count?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "building_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          profile_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          profile_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          building_id: string
          created_at: string
          created_by: string
          id: string
          interest_tag: string
          name: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by: string
          id?: string
          interest_tag: string
          name: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string
          id?: string
          interest_tag?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invites: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          invited_by: string | null
          invited_user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_invites_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_join_requests: {
        Row: {
          circle_id: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          circle_id: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_join_requests_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          building_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          building_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          building_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          body: string
          connection_id: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          connection_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          connection_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          building_id: string
          created_at: string
          event_id: string
          id: string
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          status: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          building_id: string
          capacity: number | null
          cover_emoji: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          building_id: string
          capacity?: number | null
          cover_emoji?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          capacity?: number | null
          cover_emoji?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          author_id: string
          body: string
          building_id: string
          created_at: string
          id: string
          thread_id: string
        }
        Insert: {
          author_id: string
          body: string
          building_id: string
          created_at?: string
          id?: string
          thread_id: string
        }
        Update: {
          author_id?: string
          body?: string
          building_id?: string
          created_at?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string
          body: string
          building_id: string
          category: string
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          reply_count: number
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          building_id: string
          category: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          reply_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          building_id?: string
          category?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          reply_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          building_id: string
          category: string
          circle_type: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string
          icon: string | null
          id: string
          interest_tag: string | null
          is_default: boolean
          is_pinned: boolean
          join_requirement: string
          member_count: number
          moderator_id: string | null
          name: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          building_id: string
          category: string
          circle_type?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          icon?: string | null
          id?: string
          interest_tag?: string | null
          is_default?: boolean
          is_pinned?: boolean
          join_requirement?: string
          member_count?: number
          moderator_id?: string | null
          name: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          building_id?: string
          category?: string
          circle_type?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          icon?: string | null
          id?: string
          interest_tag?: string | null
          is_default?: boolean
          is_pinned?: boolean
          join_requirement?: string
          member_count?: number
          moderator_id?: string | null
          name?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          is_current: boolean
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_current?: boolean
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_current?: boolean
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      manager_permissions: {
        Row: {
          granted_at: string
          id: string
          manager_id: string
          permission: string
        }
        Insert: {
          granted_at?: string
          id?: string
          manager_id: string
          permission: string
        }
        Update: {
          granted_at?: string
          id?: string
          manager_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_permissions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "property_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          building_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_free: boolean
          price: number
          seller_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          building_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          price?: number
          seller_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          price?: number
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_flags: {
        Row: {
          building_id: string
          channel_id: string | null
          created_at: string
          id: string
          message_id: string
          message_type: string
          reporter_id: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          building_id: string
          channel_id?: string | null
          created_at?: string
          id?: string
          message_id: string
          message_type?: string
          reporter_id?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          building_id?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          message_id?: string
          message_type?: string
          reporter_id?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_flags_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flags_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhood_places: {
        Row: {
          address: string | null
          building_id: string
          category: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          order_index: number
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          building_id: string
          category?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          order_index?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          building_id?: string
          category?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          order_index?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhood_places_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          building_id: string
          channel_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          recipient_id: string
        }
        Insert: {
          building_id: string
          channel_id?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          recipient_id: string
        }
        Update: {
          building_id?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_managers: {
        Row: {
          building_id: string
          created_at: string
          disabled_at: string | null
          id: string
          manager_code: string | null
          name: string
          user_id: string | null
        }
        Insert: {
          building_id: string
          created_at?: string
          disabled_at?: string | null
          id?: string
          manager_code?: string | null
          name?: string
          user_id?: string | null
        }
        Update: {
          building_id?: string
          created_at?: string
          disabled_at?: string | null
          id?: string
          manager_code?: string | null
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_managers_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: true
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_introductions: {
        Row: {
          building_id: string
          created_at: string
          id: string
          message: string | null
          recipient_id: string
          requester_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          requester_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_introductions_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_introductions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_introductions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_introductions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_introductions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_introductions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_introductions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_invites: {
        Row: {
          accepted_at: string | null
          building_id: string
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          invite_code: string
          invited_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          building_id: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code: string
          invited_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          building_id?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_invites_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_profiles: {
        Row: {
          accepted_privacy_at: string | null
          accepted_privacy_version: number | null
          accepted_terms_at: string | null
          accepted_terms_version: number | null
          avatar_path: string | null
          bio: string | null
          building_id: string
          company: string | null
          cover_path: string | null
          created_at: string
          favorite_local_spots: string[]
          first_name: string
          id: string
          interest_tags: string[]
          is_visible: boolean
          job_title: string | null
          languages: string[]
          last_active_at: string
          last_name: string | null
          pets: string[]
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          professional_skills: string[]
          social_links: Json
          user_id: string
        }
        Insert: {
          accepted_privacy_at?: string | null
          accepted_privacy_version?: number | null
          accepted_terms_at?: string | null
          accepted_terms_version?: number | null
          avatar_path?: string | null
          bio?: string | null
          building_id: string
          company?: string | null
          cover_path?: string | null
          created_at?: string
          favorite_local_spots?: string[]
          first_name: string
          id?: string
          interest_tags?: string[]
          is_visible?: boolean
          job_title?: string | null
          languages?: string[]
          last_active_at?: string
          last_name?: string | null
          pets?: string[]
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          professional_skills?: string[]
          social_links?: Json
          user_id: string
        }
        Update: {
          accepted_privacy_at?: string | null
          accepted_privacy_version?: number | null
          accepted_terms_at?: string | null
          accepted_terms_version?: number | null
          avatar_path?: string | null
          bio?: string | null
          building_id?: string
          company?: string | null
          cover_path?: string | null
          created_at?: string
          favorite_local_spots?: string[]
          first_name?: string
          id?: string
          interest_tags?: string[]
          is_visible?: boolean
          job_title?: string | null
          languages?: string[]
          last_active_at?: string
          last_name?: string | null
          pets?: string[]
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          professional_skills?: string[]
          social_links?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_profiles_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_suspensions: {
        Row: {
          building_id: string
          id: string
          lifted_at: string | null
          reason: string | null
          resident_id: string
          suspended_at: string
          suspended_by: string | null
        }
        Insert: {
          building_id: string
          id?: string
          lifted_at?: string | null
          reason?: string | null
          resident_id: string
          suspended_at?: string
          suspended_by?: string | null
        }
        Update: {
          building_id?: string
          id?: string
          lifted_at?: string | null
          reason?: string | null
          resident_id?: string
          suspended_at?: string
          suspended_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_suspensions_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_suspensions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_suspensions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "resident_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_suspensions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "resident_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      resident_profiles_safe: {
        Row: {
          building_id: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          interest_tags: string[] | null
          is_visible: boolean | null
          job_title: string | null
          last_active_at: string | null
          last_name: string | null
          privacy_level: Database["public"]["Enums"]["privacy_level"] | null
          user_id: string | null
          visibility: string | null
        }
        Insert: {
          building_id?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          interest_tags?: string[] | null
          is_visible?: boolean | null
          job_title?: never
          last_active_at?: string | null
          last_name?: never
          privacy_level?: Database["public"]["Enums"]["privacy_level"] | null
          user_id?: string | null
          visibility?: never
        }
        Update: {
          building_id?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          interest_tags?: string[] | null
          is_visible?: boolean | null
          job_title?: never
          last_active_at?: string | null
          last_name?: never
          privacy_level?: Database["public"]["Enums"]["privacy_level"] | null
          user_id?: string | null
          visibility?: never
        }
        Relationships: [
          {
            foreignKeyName: "resident_profiles_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_public_profiles: {
        Row: {
          building_id: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          interest_tags: string[] | null
          is_visible: boolean | null
          job_title: string | null
        }
        Insert: {
          building_id?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          interest_tags?: string[] | null
          is_visible?: boolean | null
          job_title?: string | null
        }
        Update: {
          building_id?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          interest_tags?: string[] | null
          is_visible?: boolean | null
          job_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_profiles_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_template_to_building: {
        Args: { _building_id: string; _template_id: string }
        Returns: undefined
      }
      approve_circle_join: {
        Args: { _decision: string; _request_id: string }
        Returns: undefined
      }
      building_exists: { Args: { _building_id: string }; Returns: boolean }
      channel_building: { Args: { _channel_id: string }; Returns: string }
      claim_manager_code: { Args: { _code: string }; Returns: string }
      current_resident_id: { Args: { _building_id: string }; Returns: string }
      generate_building_access_code: { Args: never; Returns: string }
      generate_community_id: { Args: never; Returns: string }
      generate_manager_access_code: { Args: never; Returns: string }
      get_building_info: {
        Args: { _building_id: string }
        Returns: {
          city: string
          id: string
          name: string
        }[]
      }
      group_building_id: { Args: { _group_id: string }; Returns: string }
      has_accepted_intro_with: {
        Args: { _target_profile: string }
        Returns: boolean
      }
      has_building_access: { Args: { _building_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: { Args: { _channel_id: string }; Returns: boolean }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_of_building: {
        Args: { _building_id: string }
        Returns: boolean
      }
      is_my_profile: { Args: { _profile_id: string }; Returns: boolean }
      is_resident_of_building: {
        Args: { _building_id: string }
        Returns: boolean
      }
      lookup_building_by_code: {
        Args: { _code: string }
        Returns: {
          city: string
          id: string
          name: string
        }[]
      }
      profile_visibility: { Args: { _profile_id: string }; Returns: string }
      regenerate_building_access_code: {
        Args: { _building_id: string }
        Returns: string
      }
      seed_default_groups: {
        Args: { _building_id: string }
        Returns: undefined
      }
      shares_circle_with_profile: {
        Args: { _target_profile: string }
        Returns: boolean
      }
      user_shares_building_with: {
        Args: { _other_uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
      privacy_level: "public" | "introduction_only" | "circle_only" | "limited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      privacy_level: ["public", "introduction_only", "circle_only", "limited"],
    },
  },
} as const
