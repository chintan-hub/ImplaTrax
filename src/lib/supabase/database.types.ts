/**
 * Hand-written to match supabase/migrations/0001-0011 exactly. Once a live
 * project exists, prefer regenerating this file with
 * `supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts`
 * — but keep the shape (Database['public']['Tables'/'Functions'/'Enums'])
 * so nothing importing from this file has to change.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AccountRole = 'owner' | 'super_admin' | 'admin' | 'manager' | 'staff' | 'read_only'
export type BusinessRole = 'admin' | 'clinician' | 'inventory_manager' | 'front_desk'
export type MemberStatus = 'active' | 'disabled' | 'invited'
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export type ProductCategory =
  | 'implant_fixture' | 'healing_abutment' | 'final_abutment' | 'cover_screw'
  | 'impression_coping' | 'analog' | 'surgical_kit' | 'bone_graft_material'
  | 'membrane' | 'prosthetic_screw'
export type ProductStatus = 'active' | 'discontinued'
export type MovementType = 'inbound' | 'outbound' | 'adjustment' | 'loan_out' | 'loan_return' | 'sale' | 'lost'
export type PoStatus = 'draft' | 'submitted' | 'confirmed' | 'partially_received' | 'received' | 'cancelled'
export type PatientSex = 'male' | 'female'
export type CaseStatus = 'planning' | 'surgery_scheduled' | 'in_progress' | 'restoration' | 'completed' | 'cancelled'
export type LoanStatus = 'open' | 'partially_returned' | 'closed'
export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13'
export type ThemePreference = 'light' | 'dark' | 'system'
export type AuditAction =
  | 'onboarding_completed' | 'login' | 'login_failed' | 'account_locked_out' | 'logout' | 'lock'
  | 'auto_locked' | 'session_timeout' | 'pin_changed' | 'pin_reset_by_admin'
  | 'biometrics_enabled' | 'biometrics_disabled' | 'member_added' | 'member_invited'
  | 'member_disabled' | 'member_reactivated' | 'member_role_changed' | 'member_removed'
  | 'workspace_created' | 'workspace_renamed' | 'profile_updated'
  | 'product_created' | 'product_updated' | 'stock_adjusted'
  | 'purchase_order_created' | 'purchase_order_submitted' | 'purchase_order_confirmed'
  | 'purchase_order_received' | 'purchase_order_cancelled'
  | 'case_created' | 'case_status_changed' | 'sale_created' | 'loan_created' | 'loan_returned'
  | 'workspace_data_wiped'
export type NotificationType = 'low_stock' | 'po_status' | 'loan_status' | 'sale_created' | 'case_status' | 'system'

/** Row has every column; Insert makes has-a-default/nullable columns optional; Update makes everything optional. */
type Table<Row, OptionalOnInsert extends keyof Row> = {
  Row: Row
  Insert: Omit<Row, OptionalOnInsert> & Partial<Pick<Row, OptionalOnInsert>>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      workspaces: Table<
        { id: string; name: string; created_at: string; updated_at: string; local_migration_completed_at: string | null },
        'id' | 'created_at' | 'updated_at' | 'local_migration_completed_at'
      >
      workspace_members: Table<
        {
          id: string; workspace_id: string; auth_user_id: string | null; name: string
          contact_email: string | null; contact_phone: string | null; avatar_color: string
          account_role: AccountRole; business_role: BusinessRole; status: MemberStatus
          last_login_at: string | null; last_active_at: string | null; created_at: string; updated_at: string
        },
        'id' | 'auth_user_id' | 'contact_email' | 'contact_phone' | 'avatar_color' | 'account_role'
        | 'business_role' | 'status' | 'last_login_at' | 'last_active_at' | 'created_at' | 'updated_at'
      >
      workspace_invitations: Table<
        {
          id: string; workspace_id: string; email: string; account_role: AccountRole; business_role: BusinessRole
          invited_by: string | null; token: string; status: InvitationStatus; created_at: string
          expires_at: string; accepted_by: string | null; accepted_at: string | null
        },
        'id' | 'account_role' | 'business_role' | 'invited_by' | 'token' | 'status' | 'created_at'
        | 'expires_at' | 'accepted_by' | 'accepted_at'
      >
      manufacturers: Table<{ id: string; name: string; created_at: string }, 'id' | 'created_at'>
      vendors: Table<
        {
          id: string; workspace_id: string; name: string; contact_name: string; email: string; phone: string
          address: string; country: string; on_time_rate: number; total_orders: number
          created_at: string; updated_at: string
        },
        'id' | 'contact_name' | 'email' | 'phone' | 'address' | 'country' | 'on_time_rate' | 'total_orders'
        | 'created_at' | 'updated_at'
      >
      vendor_manufacturers: Table<{ vendor_id: string; manufacturer_id: string }, never>
      products: Table<
        {
          id: string; workspace_id: string; sku: string; name: string; manufacturer_id: string
          category: ProductCategory; system: string; diameter_mm: number | null; length_mm: number | null
          platform: string | null; barcode: string; qr_payload: string; unit_cost: number; unit_price: number
          price_visible: boolean; quantity_on_hand: number; quantity_reserved: number; low_stock_threshold: number
          batch_tracked: boolean; vendor_id: string; image_color: string; description: string
          status: ProductStatus; created_at: string; updated_at: string
        },
        'id' | 'diameter_mm' | 'length_mm' | 'platform' | 'unit_cost' | 'unit_price' | 'price_visible'
        | 'quantity_on_hand' | 'quantity_reserved' | 'low_stock_threshold' | 'batch_tracked' | 'image_color'
        | 'description' | 'status' | 'created_at' | 'updated_at'
      >
      product_batches: Table<
        {
          id: string; workspace_id: string; product_id: string; lot_number: string; expiry_date: string | null
          quantity: number; received_at: string; reference: string | null
        },
        'id' | 'expiry_date' | 'quantity' | 'received_at' | 'reference'
      >
      inventory_movements: Table<
        {
          id: string; workspace_id: string; product_id: string; type: MovementType; quantity: number
          quantity_before: number; quantity_after: number; reason: string; reference: string | null
          performed_by: string | null; note: string | null; batch_lot: string | null; vendor_id: string | null
          lab_id: string | null; patient_id: string | null; doctor: string | null; case_id: string | null
          photo_urls: string[]; created_at: string
        },
        'id' | 'reference' | 'performed_by' | 'note' | 'batch_lot' | 'vendor_id' | 'lab_id' | 'patient_id'
        | 'doctor' | 'case_id' | 'photo_urls' | 'created_at'
      >
      purchase_orders: Table<
        {
          id: string; workspace_id: string; po_number: string; vendor_id: string; status: PoStatus
          eta: string | null; submitted_at: string | null; confirmed_at: string | null; received_at: string | null
          notes: string | null; photo_url: string | null; photo_urls: string[]; created_at: string; updated_at: string
        },
        'id' | 'status' | 'eta' | 'submitted_at' | 'confirmed_at' | 'received_at' | 'notes' | 'photo_url'
        | 'photo_urls' | 'created_at' | 'updated_at'
      >
      purchase_order_lines: Table<
        {
          id: string; workspace_id: string; po_id: string; product_id: string
          quantity_ordered: number; quantity_received: number; unit_cost: number
        },
        'id' | 'quantity_received' | 'unit_cost'
      >
      purchase_order_events: Table<
        { id: string; workspace_id: string; po_id: string; label: string; description: string; actor: string; event_date: string },
        'id' | 'description' | 'event_date'
      >
      doctors: Table<{ id: string; workspace_id: string; name: string; active: boolean; created_at: string }, 'id' | 'active' | 'created_at'>
      patients: Table<
        {
          id: string; workspace_id: string; patient_code: string; first_name: string; last_name: string
          dob: string; sex: PatientSex; phone: string; email: string; primary_doctor: string
          notes: string | null; created_at: string; updated_at: string
        },
        'id' | 'phone' | 'email' | 'primary_doctor' | 'notes' | 'created_at' | 'updated_at'
      >
      cases: Table<
        {
          id: string; workspace_id: string; case_number: string; patient_id: string; doctor: string
          lab_id: string | null; status: CaseStatus; procedure_description: string; scheduled_date: string | null
          completed_date: string | null; notes: string | null; created_at: string; updated_at: string
        },
        'id' | 'lab_id' | 'status' | 'procedure_description' | 'scheduled_date' | 'completed_date' | 'notes'
        | 'created_at' | 'updated_at'
      >
      case_implant_usages: Table<
        { id: string; workspace_id: string; case_id: string; product_id: string; tooth: string; quantity: number; batch_lot: string | null },
        'id' | 'batch_lot'
      >
      case_events: Table<
        { id: string; workspace_id: string; case_id: string; label: string; description: string; actor: string; event_date: string },
        'id' | 'description' | 'event_date'
      >
      labs: Table<
        {
          id: string; workspace_id: string; name: string; contact_name: string; email: string; phone: string
          address: string; specialties: string[]; rating: number; turnaround_days: number; created_at: string
        },
        'id' | 'contact_name' | 'email' | 'phone' | 'address' | 'specialties' | 'rating' | 'turnaround_days' | 'created_at'
      >
      loans: Table<
        {
          id: string; workspace_id: string; loan_number: string; lab_id: string; status: LoanStatus
          due_date: string | null; notes: string | null; photo_urls: string[]; created_at: string; updated_at: string
        },
        'id' | 'status' | 'due_date' | 'notes' | 'photo_urls' | 'created_at' | 'updated_at'
      >
      loan_lines: Table<
        {
          id: string; workspace_id: string; loan_id: string; product_id: string; quantity_loaned: number
          quantity_returned: number; quantity_lost: number; lost_reason: string | null; batch_lot: string | null
        },
        'id' | 'quantity_returned' | 'quantity_lost' | 'lost_reason' | 'batch_lot'
      >
      loan_events: Table<
        { id: string; workspace_id: string; loan_id: string; label: string; description: string; actor: string; event_date: string },
        'id' | 'description' | 'event_date'
      >
      sales: Table<
        {
          // patient_id is mandatory, not optional — a Sale represents
          // permanent placement of a component into a patient and can never
          // exist without one (see the not-null constraint + comment on
          // this column in migration 0008).
          id: string; workspace_id: string; sale_number: string; patient_id: string; case_id: string | null
          total: number; sold_by: string | null; photo_urls: string[]; created_at: string
          voided_at: string | null; void_reason: string | null
        },
        'id' | 'case_id' | 'total' | 'sold_by' | 'photo_urls' | 'created_at' | 'voided_at' | 'void_reason'
      >
      sale_lines: Table<
        { id: string; workspace_id: string; sale_id: string; product_id: string; quantity: number; unit_price: number; batch_lot: string | null },
        'id' | 'unit_price' | 'batch_lot'
      >
      clinic_settings: Table<
        {
          workspace_id: string; clinic_name: string; address: string; phone: string; email: string; country: string
          logo_url: string | null; currency: string; price_visibility_default: boolean; barcode_format: BarcodeFormat
          low_stock_global_default: number; theme: ThemePreference; batch_lot_tracking_enabled: boolean; updated_at: string
        },
        'clinic_name' | 'address' | 'phone' | 'email' | 'country' | 'logo_url' | 'currency'
        | 'price_visibility_default' | 'barcode_format' | 'low_stock_global_default' | 'theme'
        | 'batch_lot_tracking_enabled' | 'updated_at'
      >
      security_prefs: Table<
        {
          workspace_id: string; auto_lock_minutes: number; session_timeout_minutes: number
          max_pin_attempts: number; lockout_minutes: number; desktop_notifications: boolean
        },
        'auto_lock_minutes' | 'session_timeout_minutes' | 'max_pin_attempts' | 'lockout_minutes' | 'desktop_notifications'
      >
      audit_log: Table<
        {
          id: string; workspace_id: string; actor_member_id: string | null; actor_name: string
          action: AuditAction; detail: string | null; created_at: string
        },
        'id' | 'actor_member_id' | 'detail' | 'created_at'
      >
      notifications: Table<
        {
          id: string; workspace_id: string; member_id: string | null; type: NotificationType; title: string
          body: string; link_path: string | null; read_at: string | null; created_at: string
        },
        'id' | 'member_id' | 'body' | 'link_path' | 'read_at' | 'created_at'
      >
    }
    Views: Record<string, never>
    Functions: {
      create_workspace: { Args: { p_workspace_name: string; p_member_name: string; p_contact_email?: string | null }; Returns: string }
      complete_onboarding: {
        Args: { p_workspace_id: string; p_clinic_name: string; p_country: string; p_currency: string; p_logo_url?: string | null }
        Returns: void
      }
      accept_invitation: { Args: { p_token: string; p_member_name: string }; Returns: string }
      adjust_stock: {
        Args: {
          p_product_id: string; p_delta: number; p_type: MovementType; p_reason: string
          p_reference?: string | null; p_note?: string | null; p_batch_lot?: string | null; p_vendor_id?: string | null
        }
        Returns: string
      }
      receive_purchase_order: { Args: { p_po_id: string; p_lines?: Json | null; p_photo_urls?: string[] | null }; Returns: void }
      create_sale: {
        Args: { p_workspace_id: string; p_sale_number: string; p_lines: Json; p_patient_id: string; p_case_id?: string | null }
        Returns: string
      }
      add_implant_to_case: {
        Args: {
          p_case_id: string; p_product_id: string; p_tooth: string; p_quantity: number
          p_unit_price?: number | null; p_batch_lot?: string | null
        }
        Returns: string
      }
      create_loan: {
        Args: { p_workspace_id: string; p_lab_id: string; p_loan_number: string; p_lines: Json; p_due_date?: string | null; p_notes?: string | null }
        Returns: string
      }
      return_loan_lines: { Args: { p_loan_id: string; p_returns: Json }; Returns: void }
      void_sale: { Args: { p_sale_id: string; p_reason: string }; Returns: void }
      create_purchase_order: {
        Args: { p_workspace_id: string; p_po_number: string; p_vendor_id: string; p_eta: string; p_lines: Json; p_notes?: string | null }
        Returns: string
      }
      submit_purchase_order: { Args: { p_po_id: string }; Returns: void }
      cancel_purchase_order: { Args: { p_po_id: string }; Returns: void }
      attach_po_photo: { Args: { p_po_id: string; p_photo_url: string | null }; Returns: void }
      wipe_workspace_data: { Args: { p_workspace_id: string }; Returns: void }
    }
    Enums: {
      account_role: AccountRole
      business_role: BusinessRole
      member_status: MemberStatus
      invitation_status: InvitationStatus
      product_category: ProductCategory
      product_status: ProductStatus
      movement_type: MovementType
      po_status: PoStatus
      patient_sex: PatientSex
      case_status: CaseStatus
      loan_status: LoanStatus
      barcode_format: BarcodeFormat
      theme_preference: ThemePreference
      audit_action: AuditAction
      notification_type: NotificationType
    }
  }
}
