// ─── Tivra Database Types v2 ─────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole     = 'student' | 'teacher' | 'admin' | 'parent'
export type AccessStatus = 'pending_payment' | 'active' | 'restricted'
export type AccessType   = 'college' | 'individual' | 'teacher_invite' | 'parent'
export type ModuleStatus = 'not_started' | 'in_progress' | 'completed'
export type AttendanceStatus = 'present' | 'partial' | 'absent' | 'late'
export type PaymentStatus = 'pending' | 'approved' | 'rejected'

export interface Database {
  public: {
    Tables: {
      approved_colleges: {
        Row: { id:string; college_name:string; email_domain:string; created_at:string }
        Insert: Omit<Database['public']['Tables']['approved_colleges']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['approved_colleges']['Insert']>
      }
      programs: {
        Row: { id:string; name:string; slug:string; description:string|null; is_active:boolean; created_at:string }
        Insert: Omit<Database['public']['Tables']['programs']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['programs']['Insert']>
      }
      phases: {
        Row: { id:string; program_id:string; title:string; phase_number:number; description:string|null }
        Insert: Omit<Database['public']['Tables']['phases']['Row'],'id'>
        Update: Partial<Database['public']['Tables']['phases']['Insert']>
      }
      modules: {
        Row: { id:string; phase_id:string; title:string; module_number:number; notes_url:string|null; is_unlocked:boolean; created_at:string; updated_by:string|null; updated_at:string|null }
        Insert: Omit<Database['public']['Tables']['modules']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['modules']['Insert']>
      }
      profiles: {
        Row: {
          id:string; full_name:string|null; email:string|null
          role: UserRole; access_type:AccessType|null; access_status:AccessStatus
          payment_verified_at:string|null; payment_verified_by:string|null; payment_notes:string|null
          college_id:string|null; enrolled_program_id:string|null
          linked_student_id:string|null
          leaderboard_opt_in:boolean; streak_count:number; last_login_date:string|null
          phone:string|null; created_at:string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id:string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      payment_requests: {
        Row: {
          id:string; student_id:string; program_id:string|null
          amount:number|null; payment_method:string|null; transaction_ref:string|null
          razorpay_order_id:string|null; plan:string|null
          screenshot_url:string|null; status:PaymentStatus
          reviewed_by:string|null; reviewed_at:string|null; rejection_note:string|null
          created_at:string
        }
        Insert: Omit<Database['public']['Tables']['payment_requests']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['payment_requests']['Insert']>
      }
      module_progress: {
        Row: { id:string; student_id:string; module_id:string; status:ModuleStatus; completed_at:string|null }
        Insert: Omit<Database['public']['Tables']['module_progress']['Row'],'id'>
        Update: Partial<Database['public']['Tables']['module_progress']['Insert']>
      }
      weekly_tests: {
        Row: { id:string; program_id:string; phase_id:string|null; week_number:number; title:string; topic:string|null; unlock_datetime:string|null; duration_minutes:number; is_manually_unlocked:boolean; created_at:string }
        Insert: Omit<Database['public']['Tables']['weekly_tests']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['weekly_tests']['Insert']>
      }
      test_attempts: {
        Row: { id:string; student_id:string; test_id:string; score_percent:number|null; answers:Json|null; submitted_at:string }
        Insert: Omit<Database['public']['Tables']['test_attempts']['Row'],'id'|'submitted_at'>
        Update: Partial<Database['public']['Tables']['test_attempts']['Insert']>
      }
      assessments: {
        Row: { id:string; phase_id:string; title:string; total_questions:number; duration_minutes:number; passing_percent:number; unlock_datetime:string|null; is_manually_unlocked:boolean; created_at:string }
        Insert: Omit<Database['public']['Tables']['assessments']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['assessments']['Insert']>
      }
      assessment_attempts: {
        Row: { id:string; student_id:string; assessment_id:string; score_percent:number|null; answers:Json|null; passed:boolean; submitted_at:string }
        Insert: Omit<Database['public']['Tables']['assessment_attempts']['Row'],'id'|'submitted_at'>
        Update: Partial<Database['public']['Tables']['assessment_attempts']['Insert']>
      }
      certificates: {
        Row: { id:string; student_id:string; assessment_id:string|null; phase_id:string|null; score_percent:number|null; issued_at:string; issued_by:'auto'|'admin'; is_revoked:boolean; verification_code:string }
        Insert: Omit<Database['public']['Tables']['certificates']['Row'],'id'|'issued_at'|'verification_code'>
        Update: Partial<Database['public']['Tables']['certificates']['Insert']>
      }
      doubts: {
        Row: { id:string; student_id:string; module_id:string|null; question_text:string; upvotes:number; is_resolved:boolean; created_at:string }
        Insert: Omit<Database['public']['Tables']['doubts']['Row'],'id'|'created_at'|'upvotes'|'is_resolved'>
        Update: Partial<Database['public']['Tables']['doubts']['Insert']>
      }
      doubt_answers: {
        Row: { id:string; doubt_id:string; answered_by:string; answer_text:string; is_accepted:boolean; created_at:string }
        Insert: Omit<Database['public']['Tables']['doubt_answers']['Row'],'id'|'created_at'|'is_accepted'>
        Update: Partial<Database['public']['Tables']['doubt_answers']['Insert']>
      }
      live_sessions: {
        Row: { id:string; program_id:string|null; phase_id:string|null; module_id:string|null; title:string; description:string|null; scheduled_at:string; duration_minutes:number; join_url:string|null; recording_url:string|null; platform:'zoom'|'meet'|'daily'|'livekit'; is_live:boolean; is_completed:boolean; host_id:string|null; created_by:string|null; created_at:string }
        Insert: Omit<Database['public']['Tables']['live_sessions']['Row'],'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['live_sessions']['Insert']>
      }
      attendance_records: {
        Row: { id:string; session_id:string; student_id:string; joined_at:string|null; left_at:string|null; duration_minutes:number|null; status:AttendanceStatus; is_override:boolean; override_by:string|null; override_reason:string|null; session_code:string|null; created_at:string }
        Insert: Omit<Database['public']['Tables']['attendance_records']['Row'],'id'|'created_at'|'duration_minutes'>
        Update: Partial<Database['public']['Tables']['attendance_records']['Insert']>
      }
      session_controls: {
        Row: { id:string; session_code:string|null; attendance_window_open:boolean; window_opened_at:string|null; window_closes_at:string|null; auto_close_minutes:number }
        Insert: Partial<Database['public']['Tables']['session_controls']['Row']> & { id:string }
        Update: Partial<Database['public']['Tables']['session_controls']['Row']>
      }
    }
    Views: {
      v_admin_students: {
        Row: {
          id:string; full_name:string|null; email:string|null; role:UserRole
          access_type:AccessType|null; access_status:AccessStatus
          phone:string|null; streak_count:number; created_at:string
          payment_verified_at:string|null; payment_notes:string|null
          college_name:string|null; verified_by_name:string|null
          modules_done:number; progress_percent:number
          payment_request_status:PaymentStatus|null
          transaction_ref:string|null; payment_submitted_at:string|null
        }
      }
      v_attendance_export: {
        Row: {
          session_title:string; session_date:string; session_duration_mins:number
          student_name:string|null; student_email:string|null
          joined_at:string|null; left_at:string|null; attended_minutes:number|null
          status:AttendanceStatus; is_override:boolean; override_reason:string|null
        }
      }
    }
  }
}

export type Profile         = Database['public']['Tables']['profiles']['Row']
export type Program         = Database['public']['Tables']['programs']['Row']
export type Phase           = Database['public']['Tables']['phases']['Row']
export type Module          = Database['public']['Tables']['modules']['Row']
export type WeeklyTest      = Database['public']['Tables']['weekly_tests']['Row']
export type Assessment      = Database['public']['Tables']['assessments']['Row']
export type Certificate     = Database['public']['Tables']['certificates']['Row']
export type Doubt           = Database['public']['Tables']['doubts']['Row']
export type LiveSession     = Database['public']['Tables']['live_sessions']['Row']
export type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row']
export type PaymentRequest  = Database['public']['Tables']['payment_requests']['Row']
