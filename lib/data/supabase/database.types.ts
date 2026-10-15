export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type LightingMode = "without_lights" | "with_lights";
export type AppRole = "owner" | "admin" | "staff";
export type ReservationSource = "public_web" | "admin" | "phone" | "whatsapp" | "other";
export type BlockReason = "maintenance" | "academy" | "tournament" | "event" | "closure" | "other";
export type BlockStatus = "active" | "cancelled";

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
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
          p_net_height_cm: number;
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
          net_height_cm: number;
          hourly_rate: number | string;
          total_amount: number | string;
          currency: string;
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
        Args: { p_limit?: number };
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
      admin_cancel_reservation: {
        Args: { p_reservation_id: string };
        Returns: Array<{
          reservation_id: string;
          reservation_status: ReservationStatus;
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
