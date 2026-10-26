export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type LightingMode = "without_lights" | "with_lights";
export type AppRole = "owner" | "admin" | "staff";
export type PlatformRole = "customer" | "owner" | "admin";
export type PaymentMethod = "yape" | "plin" | "cash" | "bank_transfer";
export type PaymentStatus = "reported" | "verified" | "rejected" | "refunded";
export type ReviewModerationStatus = "pending" | "published" | "rejected" | "hidden";
export type ReservationSource = "public_web" | "admin" | "phone" | "whatsapp" | "other";
export type BlockReason = "maintenance" | "academy" | "tournament" | "event" | "closure" | "other";
export type BlockStatus = "active" | "cancelled";
export type AppNotificationEvent =
  | "reservation_requested"
  | "reservation_confirmed"
  | "reservation_rejected"
  | "reservation_cancelled"
  | "reservation_withdrawn"
  | "reservation_expired"
  | "cancellation_requested"
  | "cancellation_approved"
  | "cancellation_rejected"
  | "cancellation_expired"
  | "cancellation_withdrawn"
  | "reschedule_requested"
  | "reschedule_approved"
  | "reschedule_rejected"
  | "reschedule_expired"
  | "reschedule_withdrawn"
  | "reschedule_proposed"
  | "reschedule_proposal_accepted"
  | "reschedule_proposal_rejected"
  | "reschedule_proposal_withdrawn"
  | "reschedule_proposal_expired";

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_public_sports: {
        Args: Record<string, never>;
        Returns: Array<{
          sport_id: string;
          slug: string;
          name: string;
          icon: string | null;
          sort_order: number;
        }>;
      };
      get_platform_admin_sports: {
        Args: Record<string, never>;
        Returns: Array<{
          sport_id: string;
          slug: string;
          name: string;
          icon: string | null;
          is_active: boolean;
          sort_order: number;
          active_court_count: number | string;
          court_count: number | string;
        }>;
      };
      platform_admin_upsert_sport: {
        Args: { p_sport_id: string | null; p_slug: string; p_name: string; p_icon: string | null; p_sort_order: number };
        Returns: string;
      };
      platform_admin_set_sport_active: {
        Args: { p_sport_id: string; p_active: boolean };
        Returns: boolean;
      };
      get_public_platform_catalog: {
        Args: { p_sport_slug?: string | null; p_city?: string | null };
        Returns: Array<{
          business_id: string;
          business_slug: string;
          business_name: string;
          business_city: string | null;
          business_country: string | null;
          business_timezone: string;
          cover_image_url: string | null;
          cover_alt_text: string | null;
          rating_average: number | string | null;
          review_count: number | string;
          venue_id: string;
          venue_slug: string;
          venue_name: string;
          venue_city: string | null;
          venue_address: string | null;
          latitude: number | string | null;
          longitude: number | string | null;
          court_id: string;
          court_slug: string;
          court_name: string;
          court_surface: string | null;
          sport_id: string;
          sport_slug: string;
          sport_name: string;
          price_from: number | string | null;
          currency: string;
        }>;
      };
      get_public_pricing_for_date: {
        Args: { p_business_slug: string; p_date: string };
        Returns: Array<{
          business_id: string;
          business_name: string;
          currency: string;
          timezone: string;
          court_id: string;
          court_name: string;
          lighting: LightingMode;
          label: string;
          hourly_rate: number | string;
          effective_from: string;
          effective_until: string | null;
          configuration_status: "provisional" | "confirmed";
        }>;
      };
      get_admin_customers: {
        Args: { p_limit?: number };
        Returns: Array<{
          customer_id: string;
          full_name: string;
          phone_e164: string | null;
          marketing_opt_in: boolean;
          customer_created_at: string;
          last_activity_at: string;
          last_reservation_at: string | null;
          reservation_count: number | string;
          active_reservation_count: number | string;
          completed_reservation_count: number | string;
          cancelled_reservation_count: number | string;
          confirmed_value: number | string;
          completed_value: number | string;
          currency: string;
        }>;
      };
      get_admin_customers_page: {
        Args: {
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          customer_id: string;
          full_name: string;
          phone_e164: string | null;
          marketing_opt_in: boolean;
          customer_created_at: string;
          last_activity_at: string;
          last_reservation_at: string | null;
          reservation_count: number | string;
          active_reservation_count: number | string;
          completed_reservation_count: number | string;
          cancelled_reservation_count: number | string;
          confirmed_value: number | string;
          completed_value: number | string;
          currency: string;
        }>;
      };
      get_admin_customer_summary: {
        Args: { p_customer_id: string };
        Returns: Array<{
          customer_id: string;
          full_name: string;
          phone_e164: string | null;
          marketing_opt_in: boolean;
          customer_created_at: string;
          last_activity_at: string;
          last_reservation_at: string | null;
          reservation_count: number | string;
          active_reservation_count: number | string;
          completed_reservation_count: number | string;
          cancelled_reservation_count: number | string;
          confirmed_value: number | string;
          completed_value: number | string;
          currency: string;
        }>;
      };
      get_admin_customer_history: {
        Args: { p_customer_id: string; p_limit?: number };
        Returns: Array<{
          reservation_id: string;
          court_id: string;
          court_name: string;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          source: ReservationSource;
          created_at: string;
          updated_at: string;
          currency: string;
        }>;
      };
      get_admin_customer_history_page: {
        Args: {
          p_customer_id: string;
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          reservation_id: string;
          court_id: string;
          court_name: string;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          source: ReservationSource;
          created_at: string;
          updated_at: string;
          currency: string;
        }>;
      };
      get_admin_pricing_rules: {
        Args: Record<string, never>;
        Returns: Array<{
          pricing_rule_id: string;
          court_id: string;
          court_name: string;
          lighting: LightingMode;
          label: string;
          hourly_rate: number | string;
          effective_from: string;
          effective_until: string | null;
          is_active: boolean;
          configuration_status: "provisional" | "confirmed";
          created_by: string | null;
          created_at: string;
          updated_at: string;
          is_current: boolean;
          currency: string;
          business_today: string;
        }>;
      };
      admin_schedule_pricing_rule: {
        Args: {
          p_court_id: string;
          p_lighting: LightingMode;
          p_hourly_rate: number;
          p_effective_from: string;
        };
        Returns: Array<{
          pricing_rule_id: string;
          court_id: string;
          lighting: LightingMode;
          hourly_rate: number | string;
          effective_from: string;
          effective_until: string | null;
          currency: string;
        }>;
      };
      get_admin_operational_metrics: {
        Args: { p_from: string; p_to: string };
        Returns: Array<{
          period_from: string;
          period_to: string;
          reservation_count: number | string;
          pending_count: number | string;
          confirmed_count: number | string;
          completed_count: number | string;
          cancelled_count: number | string;
          pending_hours: number | string;
          reserved_hours: number | string;
          confirmed_value: number | string;
          completed_value: number | string;
          open_capacity_hours: number | string;
          agenda_occupied_hours: number | string;
          occupancy_percent: number | string;
          currency: string;
          timezone: string;
        }>;
      };
      get_public_site_content: {
        Args: { p_business_slug: string };
        Returns: Array<{
          business_id: string;
          services: Json;
          gallery: Json;
          theme: Json;
          updated_at: string | null;
        }>;
      };
      get_admin_site_content: {
        Args: Record<string, never>;
        Returns: Array<{
          business_id: string;
          services: Json;
          gallery: Json;
          theme: Json;
          updated_at: string | null;
        }>;
      };
      admin_update_site_content: {
        Args: { p_services: Json; p_gallery: Json; p_theme: Json };
        Returns: Array<{
          business_id: string;
          services: Json;
          gallery: Json;
          theme: Json;
          updated_at: string;
        }>;
      };
      get_public_availability: {
        Args: {
          p_business_slug: string;
          p_from: string;
          p_to: string;
        };
        Returns: Array<{
          business_id: string;
          business_name: string;
          business_timezone: string;
          court_id: string;
          court_name: string;
          calendar_date: string;
          is_open: boolean;
          opens_at: string | null;
          closes_at: string | null;
          schedule_status: "provisional" | "confirmed";
          busy_intervals: Json;
        }>;
      };
      get_public_business_config: {
        Args: { p_business_slug: string };
        Returns: Array<{
          business_id: string;
          business_name: string;
          short_name: string | null;
          category: string | null;
          city: string | null;
          country: string | null;
          address: string | null;
          phone: string | null;
          currency: string;
          timezone: string;
          configuration_status: "provisional" | "confirmed";
          pricing: Json;
        }>;
      };
      get_public_booking_context: {
        Args: { p_business_slug: string };
        Returns: Array<{
          business_id: string;
          business_name: string;
          currency: string;
          timezone: string;
          booking_increment_minutes: number;
          courts: Json;
        }>;
      };
      create_public_reservation_request: {
        Args: {
          p_business_slug: string;
          p_court_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_net_height_cm: number | null;
          p_customer_name: string;
          p_phone_e164: string;
          p_marketing_opt_in: boolean;
          p_request_token: string;
        };
        Returns: Array<{
          request_id: string;
          request_status: ReservationStatus;
          court_id: string;
          start_at: string;
          end_at: string;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
        }>;
      };
      link_public_reservation_user: {
        Args: { p_reservation_id: string; p_user_id: string };
        Returns: boolean;
      };
      claim_public_reservation: {
        Args: { p_request_token: string };
        Returns: string;
      };
      get_my_customer_profile: {
        Args: Record<string, never>;
        Returns: Array<{
          display_name: string | null;
          phone_e164: string | null;
        }>;
      };
      update_my_customer_profile: {
        Args: { p_display_name: string; p_phone_e164: string | null };
        Returns: Array<{
          display_name: string | null;
          phone_e164: string | null;
        }>;
      };
      request_my_reservation_cancellation: {
        Args: { p_reservation_id: string; p_reason?: string | null };
        Returns: Array<{ request_id: string; request_status: string; created_at: string }>;
      };
      request_my_reservation_reschedule: {
        Args: {
          p_reservation_id: string;
          p_court_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_reason?: string | null;
        };
        Returns: Array<{
          request_id: string;
          request_status: string;
          requested_start_at: string;
          requested_end_at: string;
          estimated_total_amount: number | string;
        }>;
      };
      get_my_reservation_change_requests: {
        Args: Record<string, never>;
        Returns: Array<{
          request_id: string;
          reservation_id: string;
          request_type: string;
          request_status: string;
          customer_reason: string | null;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
          requested_court_id: string | null;
          requested_start_at: string | null;
          requested_end_at: string | null;
          requested_total_amount: number | string | null;
          requested_court_name: string | null;
          initiator_kind: "customer" | "business";
          proposal_note: string | null;
          resolution_kind: string | null;
          can_withdraw_request: boolean;
        }>;
      };
      get_admin_reservation_change_requests: {
        Args: Record<string, never>;
        Returns: Array<{
          request_id: string;
          reservation_id: string;
          request_type: string;
          request_status: string;
          customer_reason: string | null;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
          court_name: string;
          customer_name: string | null;
          customer_phone_e164: string | null;
          start_at: string;
          end_at: string;
          current_total_amount: number | string;
          currency: string;
          requested_court_id: string | null;
          requested_court_name: string | null;
          requested_start_at: string | null;
          requested_end_at: string | null;
          requested_total_amount: number | string | null;
          initiator_kind: "customer" | "business";
          proposal_note: string | null;
          resolution_kind: string | null;
        }>;
      };
      get_admin_pending_reservation_change_requests_page: {
        Args: {
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          request_id: string;
          reservation_id: string;
          request_type: string;
          request_status: string;
          customer_reason: string | null;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
          court_name: string;
          customer_name: string | null;
          customer_phone_e164: string | null;
          start_at: string;
          end_at: string;
          current_total_amount: number | string;
          currency: string;
          requested_court_id: string | null;
          requested_court_name: string | null;
          requested_start_at: string | null;
          requested_end_at: string | null;
          requested_total_amount: number | string | null;
          initiator_kind: "customer" | "business";
          proposal_note: string | null;
          resolution_kind: string | null;
        }>;
      };
      get_admin_pending_change_reservation_ids: {
        Args: { p_reservation_ids: string[] };
        Returns: Array<{ reservation_id: string }>;
      };
      admin_resolve_reservation_change_request: {
        Args: { p_request_id: string; p_approve: boolean; p_resolution_note?: string | null };
        Returns: Array<{
          request_id: string;
          request_status: string;
          reservation_id: string;
          reservation_status: ReservationStatus;
        }>;
      };
      get_admin_reschedule_courts: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          court_id: string;
          court_name: string;
          booking_increment_minutes: number;
        }>;
      };
      admin_propose_reservation_reschedule: {
        Args: {
          p_reservation_id: string;
          p_court_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_note?: string | null;
        };
        Returns: Array<{
          request_id: string;
          request_status: string;
          requested_start_at: string;
          requested_end_at: string;
          estimated_total_amount: number | string;
        }>;
      };
      respond_to_business_reschedule_proposal: {
        Args: { p_request_id: string; p_accept: boolean };
        Returns: Array<{
          request_id: string;
          request_status: string;
          reservation_id: string;
          reservation_status: ReservationStatus;
        }>;
      };
      admin_withdraw_business_reschedule_proposal: {
        Args: { p_request_id: string; p_note?: string | null };
        Returns: Array<{
          request_id: string;
          request_status: string;
          reservation_id: string;
          reservation_status: ReservationStatus;
        }>;
      };
      admin_expire_business_reschedule_proposal: {
        Args: { p_request_id: string };
        Returns: Array<{
          request_id: string;
          request_status: string;
          reservation_id: string;
          reservation_status: ReservationStatus;
        }>;
      };
      admin_expire_customer_change_request: {
        Args: { p_request_id: string };
        Returns: Array<{
          request_id: string;
          request_status: string;
          reservation_id: string;
          reservation_status: ReservationStatus;
        }>;
      };
      withdraw_my_reservation_change_request: {
        Args: { p_request_id: string };
        Returns: Array<{
          request_id: string;
          request_status: string;
          reservation_id: string;
          reservation_status: ReservationStatus;
        }>;
      };
      get_my_reservations: {
        Args: Record<string, never>;
        Returns: Array<{
          reservation_id: string;
          business_id: string;
          business_slug: string;
          business_name: string;
          business_phone: string | null;
          business_timezone: string;
          court_id: string;
          court_name: string;
          sport_slug: string;
          sport_name: string;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          total_amount: number | string;
          currency: string;
          created_at: string;
          can_withdraw: boolean;
          can_request_cancellation: boolean;
          can_request_reschedule: boolean;
          closure_kind: "customer_withdrawal" | "business_rejection" | "confirmed_cancellation" | "request_expiration" | null;
          is_expired_pending: boolean;
        }>;
      };
      get_my_reservations_page: {
        Args: {
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          reservation_id: string;
          business_id: string;
          business_slug: string;
          business_name: string;
          business_phone: string | null;
          business_timezone: string;
          court_id: string;
          court_name: string;
          sport_slug: string;
          sport_name: string;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          total_amount: number | string;
          currency: string;
          created_at: string;
          can_withdraw: boolean;
          can_request_cancellation: boolean;
          can_request_reschedule: boolean;
          closure_kind: "customer_withdrawal" | "business_rejection" | "confirmed_cancellation" | "request_expiration" | null;
          is_expired_pending: boolean;
        }>;
      };
      get_my_latest_reservation_change_requests: {
        Args: { p_reservation_ids: string[] };
        Returns: Array<{
          request_id: string;
          reservation_id: string;
          request_type: string;
          request_status: string;
          customer_reason: string | null;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
          requested_court_id: string | null;
          requested_start_at: string | null;
          requested_end_at: string | null;
          requested_total_amount: number | string | null;
          requested_court_name: string | null;
          initiator_kind: "customer" | "business";
          proposal_note: string | null;
          resolution_kind: string | null;
          can_withdraw_request: boolean;
        }>;
      };
      get_my_notifications: {
        Args: { p_limit?: number };
        Returns: Array<{
          notification_id: string;
          event_type: AppNotificationEvent;
          reservation_id: string | null;
          change_request_id: string | null;
          business_name: string;
          business_timezone: string;
          court_name: string | null;
          start_at: string | null;
          requested_court_name: string | null;
          requested_start_at: string | null;
          created_at: string;
          read_at: string | null;
        }>;
      };
      get_my_notifications_page: {
        Args: {
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          notification_id: string;
          event_type: AppNotificationEvent;
          reservation_id: string | null;
          change_request_id: string | null;
          business_name: string;
          business_timezone: string;
          court_name: string | null;
          start_at: string | null;
          requested_court_name: string | null;
          requested_start_at: string | null;
          created_at: string;
          read_at: string | null;
        }>;
      };
      get_my_notification_unread_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_my_notification_read: {
        Args: { p_notification_id: string };
        Returns: string;
      };
      mark_all_my_notifications_read: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_admin_notifications: {
        Args: { p_limit?: number };
        Returns: Array<{
          notification_id: string;
          event_type: AppNotificationEvent;
          reservation_id: string | null;
          change_request_id: string | null;
          court_name: string | null;
          start_at: string | null;
          requested_court_name: string | null;
          requested_start_at: string | null;
          created_at: string;
          read_at: string | null;
        }>;
      };
      get_admin_notifications_page: {
        Args: {
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          notification_id: string;
          event_type: AppNotificationEvent;
          reservation_id: string | null;
          change_request_id: string | null;
          court_name: string | null;
          start_at: string | null;
          requested_court_name: string | null;
          requested_start_at: string | null;
          created_at: string;
          read_at: string | null;
        }>;
      };
      get_admin_notification_unread_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_admin_notification_read: {
        Args: { p_notification_id: string };
        Returns: string;
      };
      mark_all_admin_notifications_read: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_admin_reservation_audit: {
        Args: { p_reservation_id: string; p_limit?: number };
        Returns: Array<{
          event_id: string;
          event_type: string;
          actor_kind: "customer" | "owner" | "admin" | "staff" | "platform_admin" | "system";
          actor_label: string;
          old_status: ReservationStatus | null;
          new_status: ReservationStatus | null;
          old_court_name: string | null;
          new_court_name: string | null;
          old_start_at: string | null;
          new_start_at: string | null;
          old_end_at: string | null;
          new_end_at: string | null;
          old_lighting: LightingMode | null;
          new_lighting: LightingMode | null;
          old_net_height_cm: number | null;
          new_net_height_cm: number | null;
          old_hourly_rate: number | string | null;
          new_hourly_rate: number | string | null;
          old_total_amount: number | string | null;
          new_total_amount: number | string | null;
          request_type: "cancellation" | "reschedule" | null;
          old_request_status: "pending" | "approved" | "rejected" | null;
          new_request_status: "pending" | "approved" | "rejected" | null;
          change_request_id: string | null;
          resolution_note: string | null;
          operation_id: string;
          currency: string;
          created_at: string;
        }>;
      };
      get_admin_reservation_audit_page: {
        Args: {
          p_reservation_id: string;
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_event_sequence?: number | null;
        };
        Returns: Array<{
          event_id: string;
          event_sequence: number;
          event_type: string;
          actor_kind: "customer" | "owner" | "admin" | "staff" | "platform_admin" | "system";
          actor_label: string;
          old_status: ReservationStatus | null;
          new_status: ReservationStatus | null;
          old_court_name: string | null;
          new_court_name: string | null;
          old_start_at: string | null;
          new_start_at: string | null;
          old_end_at: string | null;
          new_end_at: string | null;
          old_lighting: LightingMode | null;
          new_lighting: LightingMode | null;
          old_net_height_cm: number | null;
          new_net_height_cm: number | null;
          old_hourly_rate: number | string | null;
          new_hourly_rate: number | string | null;
          old_total_amount: number | string | null;
          new_total_amount: number | string | null;
          request_type: "cancellation" | "reschedule" | null;
          old_request_status: "pending" | "approved" | "rejected" | null;
          new_request_status: "pending" | "approved" | "rejected" | null;
          change_request_id: string | null;
          resolution_note: string | null;
          operation_id: string;
          currency: string;
          created_at: string;
        }>;
      };
      withdraw_my_pending_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          updated_at: string;
        }>;
      };
      get_my_favorite_business_ids: {
        Args: Record<string, never>;
        Returns: Array<{ business_id: string }>;
      };
      set_business_favorite: {
        Args: { p_business_id: string; p_favorite: boolean };
        Returns: boolean;
      };
      get_my_reviewable_reservations: {
        Args: Record<string, never>;
        Returns: Array<{
          reservation_id: string;
          business_id: string;
          business_slug: string;
          business_name: string;
          court_name: string;
          sport_name: string;
          start_at: string;
          review_id: string | null;
          rating: number | null;
          comment: string | null;
          review_status: ReviewModerationStatus | null;
        }>;
      };
      submit_verified_business_review: {
        Args: { p_reservation_id: string; p_rating: number; p_comment?: string | null };
        Returns: string;
      };
      get_public_business_reviews: {
        Args: { p_business_slug: string; p_limit?: number };
        Returns: Array<{
          review_id: string;
          rating: number;
          created_at: string;
          court_name: string;
          sport_name: string;
        }>;
      };
      get_platform_admin_reviews_page: {
        Args: { p_status?: ReviewModerationStatus; p_limit?: number; p_offset?: number };
        Returns: Array<{
          review_id: string;
          business_name: string;
          business_slug: string;
          rating: number;
          comment: string | null;
          review_status: ReviewModerationStatus;
          created_at: string;
          updated_at: string;
          court_name: string;
          sport_name: string;
        }>;
      };
      platform_admin_moderate_review: {
        Args: { p_review_id: string; p_status: ReviewModerationStatus };
        Returns: ReviewModerationStatus;
      };
      get_public_payment_methods: {
        Args: { p_business_slug: string };
        Returns: Array<{
          method: PaymentMethod;
          label: string;
          destination: string | null;
          instructions: string | null;
        }>;
      };
      report_my_payment: {
        Args: { p_reservation_id: string; p_method: PaymentMethod; p_reference?: string | null };
        Returns: Array<{
          payment_id: string;
          payment_status: PaymentStatus;
          amount: number | string;
          currency: string;
        }>;
      };
      get_my_payments: {
        Args: Record<string, never>;
        Returns: Array<{
          payment_id: string;
          reservation_id: string;
          business_name: string;
          method: PaymentMethod;
          status: PaymentStatus;
          amount: number | string;
          currency: string;
          customer_reference: string | null;
          created_at: string;
        }>;
      };
      get_admin_payment_methods: {
        Args: Record<string, never>;
        Returns: Array<{
          method: PaymentMethod;
          label: string;
          destination: string | null;
          instructions: string | null;
          is_active: boolean;
          sort_order: number;
        }>;
      };
      admin_set_payment_method: {
        Args: { p_method: PaymentMethod; p_enabled: boolean; p_destination?: string | null; p_instructions?: string | null };
        Returns: boolean;
      };
      get_admin_payments: {
        Args: { p_limit?: number };
        Returns: Array<{
          payment_id: string;
          reservation_id: string;
          customer_name: string | null;
          court_name: string;
          method: PaymentMethod;
          status: PaymentStatus;
          amount: number | string;
          currency: string;
          customer_reference: string | null;
          internal_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        }>;
      };
      admin_review_payment: {
        Args: { p_payment_id: string; p_status: PaymentStatus; p_internal_note?: string | null };
        Returns: boolean;
      };
      get_platform_admin_context: {
        Args: Record<string, never>;
        Returns: Array<{
          user_id: string;
          display_name: string | null;
          role: PlatformRole;
        }>;
      };
      get_platform_admin_summary: {
        Args: Record<string, never>;
        Returns: Array<{
          businesses_total: number | string;
          businesses_active: number | string;
          venues_active: number | string;
          courts_active: number | string;
          users_total: number | string;
          reservations_total: number | string;
        }>;
      };
      get_platform_admin_businesses: {
        Args: { p_limit?: number };
        Returns: Array<{
          business_id: string;
          slug: string;
          name: string;
          city: string | null;
          country: string | null;
          is_active: boolean;
          owner_user_id: string | null;
          venue_count: number | string;
          court_count: number | string;
          reservation_count: number | string;
        }>;
      };
      get_platform_admin_businesses_page: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Array<{
          business_id: string;
          slug: string;
          name: string;
          city: string | null;
          country: string | null;
          is_active: boolean;
          configuration_status: "provisional" | "confirmed";
          currency: string;
          timezone: string;
          venue_count: number | string;
          court_count: number | string;
          reservation_count: number | string;
        }>;
      };
      platform_admin_update_business_core: {
        Args: { p_business_id: string; p_slug: string; p_currency: string; p_timezone: string };
        Returns: boolean;
      };
      platform_admin_set_business_active: {
        Args: { p_business_id: string; p_active: boolean };
        Returns: boolean;
      };
      platform_admin_create_business: {
        Args: {
          p_slug: string;
          p_name: string;
          p_owner_email: string;
          p_city?: string | null;
          p_country?: string | null;
          p_address?: string | null;
          p_phone?: string | null;
          p_currency?: string;
          p_timezone?: string;
        };
        Returns: Array<{
          business_id: string;
          business_slug: string;
          business_name: string;
          owner_user_id: string;
        }>;
      };
      platform_admin_recover_primary_owner: {
        Args: { p_business_id: string; p_owner_email: string };
        Returns: Array<{
          business_id: string;
          previous_owner_user_id: string | null;
          owner_user_id: string;
        }>;
      };
      get_admin_business_structure: {
        Args: Record<string, never>;
        Returns: Array<{
          business_id: string;
          business_slug: string;
          business_name: string;
          city: string | null;
          country: string | null;
          address: string | null;
          phone: string | null;
          currency: string;
          timezone: string;
          configuration_status: "provisional" | "confirmed";
          sports: Json;
          venues: Json;
        }>;
      };
      get_admin_booking_settings: {
        Args: Record<string, never>;
        Returns: Array<{ booking_increment_minutes: number }>;
      };
      get_admin_publication_readiness: {
        Args: Record<string, never>;
        Returns: Array<{
          configuration_status: "provisional" | "confirmed";
          has_active_venue: boolean;
          has_active_court: boolean;
          active_courts_ready: boolean;
          active_court_count: number | string;
        }>;
      };
      admin_set_business_configuration_status: {
        Args: { p_status: "provisional" | "confirmed" };
        Returns: "provisional" | "confirmed";
      };
      admin_update_booking_increment: {
        Args: { p_booking_increment_minutes: number };
        Returns: number;
      };
      admin_update_business_profile: {
        Args: { p_name: string; p_city: string | null; p_country: string | null; p_address: string | null; p_phone: string | null };
        Returns: boolean;
      };
      admin_create_venue: {
        Args: { p_slug: string; p_name: string; p_city?: string | null; p_address?: string | null; p_latitude?: number | null; p_longitude?: number | null };
        Returns: string;
      };
      admin_update_venue: {
        Args: { p_venue_id: string; p_name: string; p_city: string | null; p_address: string | null; p_latitude: number | null; p_longitude: number | null; p_active: boolean };
        Returns: boolean;
      };
      admin_update_venue_slug: {
        Args: { p_venue_id: string; p_slug: string };
        Returns: boolean;
      };
      admin_create_court: {
        Args: {
          p_venue_id: string;
          p_sport_id: string;
          p_slug: string;
          p_name: string;
          p_surface: string | null;
          p_hours: Json;
          p_rate_without_lights: number;
          p_rate_with_lights: number;
        };
        Returns: string;
      };
      admin_update_court_identity: {
        Args: { p_court_id: string; p_name: string; p_surface: string | null };
        Returns: boolean;
      };
      admin_update_court_structure: {
        Args: { p_court_id: string; p_venue_id: string; p_sport_id: string; p_slug: string };
        Returns: boolean;
      };
      admin_set_court_active: {
        Args: { p_court_id: string; p_active: boolean };
        Returns: boolean;
      };
      admin_schedule_court_operating_hours: {
        Args: { p_court_id: string; p_hours: Json; p_effective_from: string };
        Returns: boolean;
      };
      admin_access_transfer_primary_owner: {
        Args: { p_actor_user_id: string; p_target_user_id: string };
        Returns: Array<{
          business_id: string;
          previous_owner_user_id: string;
          owner_user_id: string;
        }>;
      };
      admin_access_link_existing_profile: {
        Args: {
          p_actor_user_id: string;
          p_existing_email: string;
          p_role: AppRole;
          p_display_name?: string | null;
        };
        Returns: Array<{
          user_id: string;
          business_id: string;
          role: AppRole;
          display_name: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
      };
      get_current_admin_context: {
        Args: Record<string, never>;
        Returns: Array<{
          user_id: string;
          business_id: string;
          business_name: string;
          role: AppRole;
          display_name: string | null;
          timezone: string;
        }>;
      };
      get_admin_reservation_requests: {
        Args: { p_limit?: number; p_include_archived?: boolean };
        Returns: Array<{
          reservation_id: string;
          business_id: string;
          court_id: string;
          court_name: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone_e164: string | null;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
          source: ReservationSource;
          created_at: string;
          archived_at: string | null;
        }>;
      };
      get_admin_reservations_page: {
        Args: {
          p_view?: "active" | "completed" | "cancelled" | "archived";
          p_limit?: number;
          p_cursor_start_at?: string | null;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Array<{
          reservation_id: string;
          business_id: string;
          court_id: string;
          court_name: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone_e164: string | null;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
          source: ReservationSource;
          created_at: string;
          archived_at: string | null;
        }>;
      };
      get_admin_schedule: {
        Args: { p_from: string; p_to: string };
        Returns: Array<{
          business_id: string;
          booking_increment_minutes: number;
          court_id: string;
          court_name: string;
          calendar_date: string;
          is_open: boolean;
          opens_at: string | null;
          closes_at: string | null;
          schedule_status: "provisional" | "confirmed";
          entries: Json;
        }>;
      };
      admin_confirm_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          updated_at: string;
        }>;
      };
      admin_reject_pending_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          closure_kind: "customer_withdrawal" | "business_rejection" | "confirmed_cancellation" | "request_expiration" | null;
          updated_at: string;
        }>;
      };
      admin_expire_pending_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          closure_kind: "customer_withdrawal" | "business_rejection" | "confirmed_cancellation" | "request_expiration" | null;
          updated_at: string;
        }>;
      };
      admin_complete_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          updated_at: string;
        }>;
      };
      admin_cancel_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          closure_kind: "customer_withdrawal" | "business_rejection" | "confirmed_cancellation" | "request_expiration" | null;
          updated_at: string;
        }>;
      };
      admin_archive_cancelled_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          archived_at: string | null;
          updated_at: string;
        }>;
      };
      admin_restore_archived_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          archived_at: string | null;
          updated_at: string;
        }>;
      };
      admin_create_manual_reservation: {
        Args: {
          p_court_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_net_height_cm: number;
          p_customer_name: string;
          p_phone_e164: string;
          p_source: Exclude<ReservationSource, "public_web">;
        };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          court_id: string;
          start_at: string;
          end_at: string;
          lighting: LightingMode;
          net_height_cm: number;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
        }>;
      };
      admin_edit_reservation: {
        Args: {
          p_reservation_id: string;
          p_court_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_net_height_cm: number;
          p_customer_name: string;
          p_phone_e164: string;
        };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
          court_id: string;
          start_at: string;
          end_at: string;
          lighting: LightingMode;
          net_height_cm: number;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
        }>;
      };
      admin_create_schedule_block: {
        Args: {
          p_court_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_reason: BlockReason;
          p_internal_note: string | null;
        };
        Returns: Array<{
          block_id: string;
          block_status: BlockStatus;
          court_id: string;
          start_at: string;
          end_at: string;
          reason: BlockReason;
        }>;
      };
      admin_cancel_schedule_block: {
        Args: { p_block_id: string };
        Returns: Array<{
          block_id: string;
          block_status: BlockStatus;
          updated_at: string;
        }>;
      };
      get_admin_export_reservations: {
        Args: { p_from: string; p_to: string };
        Returns: Array<{
          reservation_id: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone_e164: string | null;
          marketing_opt_in: boolean;
          court_id: string;
          court_name: string;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
          source: ReservationSource;
          created_at: string;
          updated_at: string;
        }>;
      };
      get_admin_export_reservations_page: {
        Args: {
          p_from: string;
          p_to: string;
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
          p_snapshot_created_at?: string | null;
          p_snapshot_id?: string | null;
        };
        Returns: Array<{
          reservation_id: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone_e164: string | null;
          marketing_opt_in: boolean;
          court_id: string;
          court_name: string;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          lighting: LightingMode;
          net_height_cm: number | null;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
          source: ReservationSource;
          created_at: string;
          updated_at: string;
          export_snapshot_created_at: string | null;
          export_snapshot_id: string | null;
        }>;
      };
    };
    Enums: {
      configuration_status: "provisional" | "confirmed";
      reservation_status: ReservationStatus;
      lighting_mode: LightingMode;
      app_role: AppRole;
      reservation_source: ReservationSource;
      block_reason: BlockReason;
      block_status: BlockStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
