/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

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
      announcements: {
        Row: {
          body: string
          club_id: string
          created_at: string
          created_by_member_id: string
          expires_at: string | null
          id: string
          is_pinned: boolean
          published_at: string | null
          title: string
          visibility: string
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          created_by_member_id: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          title: string
          visibility: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          created_by_member_id?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_creator_membership_fkey"
            columns: ["club_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["club_id", "member_id"]
          },
        ]
      }
      attendances: {
        Row: {
          checked_in_at: string | null
          id: string
          member_id: string
          note: string | null
          opening_slot_id: string
          status: string
        }
        Insert: {
          checked_in_at?: string | null
          id?: string
          member_id: string
          note?: string | null
          opening_slot_id: string
          status: string
        }
        Update: {
          checked_in_at?: string | null
          id?: string
          member_id?: string
          note?: string | null
          opening_slot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_opening_slot_id_fkey"
            columns: ["opening_slot_id"]
            isOneToOne: false
            referencedRelation: "opening_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          club_id: string
          details_json: Json
          event_type: string
          id: string
          occurred_at: string
          provider_event_id: string | null
          source: string
        }
        Insert: {
          club_id: string
          details_json?: Json
          event_type: string
          id?: string
          occurred_at?: string
          provider_event_id?: string | null
          source: string
        }
        Update: {
          club_id?: string
          details_json?: Json
          event_type?: string
          id?: string
          occurred_at?: string
          provider_event_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          code: string
          currency: string
          description: string
          id: string
          interval: string
          max_members: number
          price_cents: number
        }
        Insert: {
          code: string
          currency?: string
          description: string
          id?: string
          interval: string
          max_members: number
          price_cents: number
        }
        Update: {
          code?: string
          currency?: string
          description?: string
          id?: string
          interval?: string
          max_members?: number
          price_cents?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          deleted_at: string | null
          edited_at: string | null
          group_chat_id: string
          id: string
          sender_member_id: string
          sent_at: string
        }
        Insert: {
          body: string
          deleted_at?: string | null
          edited_at?: string | null
          group_chat_id: string
          id?: string
          sender_member_id: string
          sent_at?: string
        }
        Update: {
          body?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_chat_id?: string
          id?: string
          sender_member_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_group_chat_id_fkey"
            columns: ["group_chat_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_member_id_fkey"
            columns: ["sender_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      club_bank_accounts: {
        Row: {
          accepts_cash: boolean
          accepts_transfer: boolean
          bank_name: string
          bic: string
          cash_note: string
          club_id: string
          holder: string
          iban: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_status: string
          transfer_note: string
          updated_at: string
          updated_by_member_id: string | null
        }
        Insert: {
          accepts_cash?: boolean
          accepts_transfer?: boolean
          bank_name?: string
          bic?: string
          cash_note?: string
          club_id: string
          holder?: string
          iban?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_status?: string
          transfer_note?: string
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Update: {
          accepts_cash?: boolean
          accepts_transfer?: boolean
          bank_name?: string
          bic?: string
          cash_note?: string
          club_id?: string
          holder?: string
          iban?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_status?: string
          transfer_note?: string
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_bank_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_subscriptions: {
        Row: {
          club_id: string
          created_at: string
          ends_at: string | null
          id: string
          last_invoice_id: string | null
          plan_code: string
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          last_invoice_id?: string | null
          plan_code: string
          starts_at: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          last_invoice_id?: string | null
          plan_code?: string
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      clubs: {
        Row: {
          address: string | null
          affiliation: string | null
          billing_status: string
          country: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          slug: string
          status: string
          subscription_status: string
          tenant_key: string
          timezone: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          affiliation?: string | null
          billing_status?: string
          country: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          slug: string
          status: string
          subscription_status: string
          tenant_key: string
          timezone: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          affiliation?: string | null
          billing_status?: string
          country?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          slug?: string
          status?: string
          subscription_status?: string
          tenant_key?: string
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          created_at: string
          environment: string
          id: string
          locale: string | null
          member_id: string
          platform: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          locale?: string | null
          member_id: string
          platform?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          locale?: string | null
          member_id?: string
          platform?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_payments: {
        Row: {
          amount_cents: number
          club_id: string
          commission_amount_cents: number | null
          commission_rate_basis_points: number | null
          created_at: string
          currency: string
          event_id: string
          id: string
          member_id: string
          paid_at: string | null
          refunded_at: string | null
          registration_id: string
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          club_id: string
          commission_amount_cents?: number | null
          commission_rate_basis_points?: number | null
          created_at?: string
          currency: string
          event_id: string
          id?: string
          member_id: string
          paid_at?: string | null
          refunded_at?: string | null
          registration_id: string
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          club_id?: string
          commission_amount_cents?: number | null
          commission_rate_basis_points?: number | null
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          member_id?: string
          paid_at?: string | null
          refunded_at?: string | null
          registration_id?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string
          id: string
          member_id: string
          note: string | null
          registered_at: string
          seat_count: number
          status: string
        }
        Insert: {
          event_id: string
          id?: string
          member_id: string
          note?: string | null
          registered_at?: string
          seat_count?: number
          status: string
        }
        Update: {
          event_id?: string
          id?: string
          member_id?: string
          note?: string | null
          registered_at?: string
          seat_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          channel: string
          event_id: string
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          event_id: string
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status: string
        }
        Update: {
          channel?: string
          event_id?: string
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          category: string
          club_id: string
          created_at: string
          created_by_member_id: string
          description: string | null
          ends_at: string
          id: string
          location: string | null
          participation_price_cents: number | null
          payment_currency: string | null
          payment_mode: string
          registration_close_at: string
          registration_open_at: string
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          capacity?: number | null
          category?: string
          club_id: string
          created_at?: string
          created_by_member_id: string
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          participation_price_cents?: number | null
          payment_currency?: string | null
          payment_mode?: string
          registration_close_at: string
          registration_open_at: string
          starts_at: string
          status: string
          title: string
        }
        Update: {
          capacity?: number | null
          category?: string
          club_id?: string
          created_at?: string
          created_by_member_id?: string
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          participation_price_cents?: number | null
          payment_currency?: string | null
          payment_mode?: string
          registration_close_at?: string
          registration_open_at?: string
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_creator_membership_fkey"
            columns: ["club_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["club_id", "member_id"]
          },
        ]
      }
      external_profiles: {
        Row: {
          created_at: string
          external_user_id: string
          external_username: string | null
          id: string
          is_primary: boolean
          last_synced_at: string | null
          member_id: string
          provider: string
        }
        Insert: {
          created_at?: string
          external_user_id: string
          external_username?: string | null
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          member_id: string
          provider: string
        }
        Update: {
          created_at?: string
          external_user_id?: string
          external_username?: string | null
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          member_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chats: {
        Row: {
          club_id: string
          created_at: string
          created_by_member_id: string
          id: string
          last_message_at: string | null
          title: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by_member_id: string
          id?: string
          last_message_at?: string | null
          title: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by_member_id?: string
          id?: string
          last_message_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_chats_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_chats_creator_membership_fkey"
            columns: ["club_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["club_id", "member_id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          club_id: string
          condition: string
          id: string
          location: string | null
          minimum_stock: number
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          category: string
          club_id: string
          condition: string
          id?: string
          location?: string | null
          minimum_stock: number
          name: string
          quantity: number
          updated_at?: string
        }
        Update: {
          category?: string
          club_id?: string
          condition?: string
          id?: string
          location?: string | null
          minimum_stock?: number
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_status_history: {
        Row: {
          changed_at: string
          changed_by_user_id: string | null
          id: string
          membership_id: string
          new_status: string
          previous_status: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by_user_id?: string | null
          id?: string
          membership_id: string
          new_status: string
          previous_status: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string | null
          id?: string
          membership_id?: string
          new_status?: string
          previous_status?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_status_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          club_id: string
          created_at: string
          end_date: string | null
          id: string
          is_primary_contact: boolean
          join_date: string
          license_expiry_date: string | null
          license_number: string | null
          member_id: string
          notes: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_primary_contact?: boolean
          join_date: string
          license_expiry_date?: string | null
          license_number?: string | null
          member_id: string
          notes?: string | null
          role: string
          status: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_primary_contact?: boolean
          join_date?: string
          license_expiry_date?: string | null
          license_number?: string | null
          member_id?: string
          notes?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          club_id: string
          created_at: string
          id: string
          kind: string
          member_id: string
          payload: Json
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string
          club_id: string
          created_at?: string
          id?: string
          kind: string
          member_id: string
          payload?: Json
          read_at?: string | null
          title?: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          kind?: string
          member_id?: string
          payload?: Json
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_slots: {
        Row: {
          club_id: string
          created_by_member_id: string
          description: string | null
          ends_at: string
          id: string
          location: string | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          club_id: string
          created_by_member_id: string
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          starts_at: string
          status: string
          title: string
        }
        Update: {
          club_id?: string
          created_by_member_id?: string
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_slots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_slots_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_slots_creator_membership_fkey"
            columns: ["club_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["club_id", "member_id"]
          },
        ]
      }
      payment_call_items: {
        Row: {
          club_id: string
          declared_at: string | null
          id: string
          is_paid: boolean
          member_id: string
          method: string | null
          paid_at: string | null
          payment_call_id: string
          reference: string | null
          reminded_at: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          validated_by_member_id: string | null
        }
        Insert: {
          club_id: string
          declared_at?: string | null
          id?: string
          is_paid?: boolean
          member_id: string
          method?: string | null
          paid_at?: string | null
          payment_call_id: string
          reference?: string | null
          reminded_at?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          validated_by_member_id?: string | null
        }
        Update: {
          club_id?: string
          declared_at?: string | null
          id?: string
          is_paid?: boolean
          member_id?: string
          method?: string | null
          paid_at?: string | null
          payment_call_id?: string
          reference?: string | null
          reminded_at?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          validated_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_call_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_call_items_payment_call_id_fkey"
            columns: ["payment_call_id"]
            isOneToOne: false
            referencedRelation: "payment_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_calls: {
        Row: {
          amount_cents: number
          category: string
          club_id: string
          created_at: string
          created_by_member_id: string | null
          currency: string
          detail: string
          due_date: string
          id: string
          title: string
        }
        Insert: {
          amount_cents: number
          category?: string
          club_id: string
          created_at?: string
          created_by_member_id?: string | null
          currency?: string
          detail?: string
          due_date: string
          id?: string
          title: string
        }
        Update: {
          amount_cents?: number
          category?: string
          club_id?: string
          created_at?: string
          created_by_member_id?: string | null
          currency?: string
          detail?: string
          due_date?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_calls_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          id: string
          member_id: string
          poll_id: string
          poll_option_id: string
          voted_at: string
        }
        Insert: {
          id?: string
          member_id: string
          poll_id: string
          poll_option_id: string
          voted_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          poll_id?: string
          poll_option_id?: string
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_belongs_to_poll_fkey"
            columns: ["poll_id", "poll_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["poll_id", "id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_option_id_fkey"
            columns: ["poll_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allows_multiple_choices: boolean
          closes_at: string | null
          club_id: string
          created_at: string
          created_by_member_id: string
          id: string
          question: string
        }
        Insert: {
          allows_multiple_choices?: boolean
          closes_at?: string | null
          club_id: string
          created_at?: string
          created_by_member_id: string
          id?: string
          question: string
        }
        Update: {
          allows_multiple_choices?: boolean
          closes_at?: string | null
          club_id?: string
          created_at?: string
          created_by_member_id?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_creator_membership_fkey"
            columns: ["club_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["club_id", "member_id"]
          },
        ]
      }
      roles: {
        Row: {
          club_id: string
          code: string
          id: string
          is_system_default: boolean
          label: string
          permissions: Json
        }
        Insert: {
          club_id: string
          code: string
          id?: string
          is_system_default?: boolean
          label: string
          permissions?: Json
        }
        Update: {
          club_id?: string
          code?: string
          id?: string
          is_system_default?: boolean
          label?: string
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "roles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          club_id: string | null
          external_match_id: string
          id: string
          last_updated_at: string
          player_a_external_id: string
          player_b_external_id: string
          provider: string
          scheduled_at: string | null
          score_snapshot_json: Json | null
          status: string
        }
        Insert: {
          club_id?: string | null
          external_match_id: string
          id?: string
          last_updated_at?: string
          player_a_external_id: string
          player_b_external_id: string
          provider: string
          scheduled_at?: string | null
          score_snapshot_json?: Json | null
          status: string
        }
        Update: {
          club_id?: string | null
          external_match_id?: string
          id?: string
          last_updated_at?: string
          player_a_external_id?: string
          player_b_external_id?: string
          provider?: string
          scheduled_at?: string | null
          score_snapshot_json?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_tasks: {
        Row: {
          assigned_member_id: string | null
          club_id: string
          description: string | null
          due_at: string | null
          id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          assigned_member_id?: string | null
          club_id: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority: string
          status: string
          title: string
        }
        Update: {
          assigned_member_id?: string | null
          club_id?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tasks_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_tasks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_payment_declaration: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      declare_payment: {
        Args: { p_item_id: string; p_method: string; p_reference?: string }
        Returns: undefined
      }
      is_club_board: { Args: { p_club_id: string }; Returns: boolean }
      validate_payment: { Args: { p_item_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
