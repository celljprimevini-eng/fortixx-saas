/**
 * Tipos gerados manualmente a partir de supabase/migrations/0001_initial_schema.sql.
 *
 * Depois que o projeto Supabase real estiver linkado, rode:
 *   npm run db:types
 * para substituir este arquivo pela versão gerada automaticamente
 * (fica sempre 100% sincronizada com o schema real do banco).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          plan: 'basico' | 'pro' | 'enterprise';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'paused' | 'incomplete_expired' | 'unpaid';
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tenants']['Row']> & { name: string; slug: string };
        Update: Partial<Database['public']['Tables']['tenants']['Row']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          role: 'admin' | 'rh' | 'gestor' | 'colaborador';
          department_id: string | null;
          job_title: string | null;
          manager_id: string | null;
          phone: string | null;
          status: 'active' | 'inactive' | 'on_leave';
          two_factor_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; tenant_id: string; full_name: string; email: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'profiles_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          }
        ];
      };
      departments: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          parent_id: string | null;
          head_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['departments']['Row']> & { tenant_id: string; name: string };
        Update: Partial<Database['public']['Tables']['departments']['Row']>;
        Relationships: [];
      };
      job_openings: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          department_id: string | null;
          description: string | null;
          requirements: string | null;
          location: string | null;
          employment_type: 'clt' | 'pj' | 'estagio' | 'temporario';
          status: 'open' | 'paused' | 'closed';
          is_public: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['job_openings']['Row']> & { tenant_id: string; title: string };
        Update: Partial<Database['public']['Tables']['job_openings']['Row']>;
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          tenant_id: string;
          job_opening_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          resume_url: string | null;
          resume_raw_text: string | null;
          extracted_skills: string[] | null;
          stage: 'recebido' | 'triagem' | 'analise' | 'entrevista' | 'aprovado' | 'reprovado';
          source: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['candidates']['Row']> & { tenant_id: string; full_name: string; email: string };
        Update: Partial<Database['public']['Tables']['candidates']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'candidates_job_opening_id_fkey';
            columns: ['job_opening_id'];
            isOneToOne: false;
            referencedRelation: 'job_openings';
            referencedColumns: ['id'];
          }
        ];
      };
      onboardings: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          candidate_id: string | null;
          status: 'em_andamento' | 'concluido' | 'atrasado';
          start_date: string;
          target_completion_date: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['onboardings']['Row']> & { tenant_id: string; profile_id: string };
        Update: Partial<Database['public']['Tables']['onboardings']['Row']>;
        Relationships: [];
      };
      onboarding_tasks: {
        Row: {
          id: string;
          onboarding_id: string;
          title: string;
          description: string | null;
          done: boolean;
          done_at: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['onboarding_tasks']['Row']> & { onboarding_id: string; title: string };
        Update: Partial<Database['public']['Tables']['onboarding_tasks']['Row']>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string | null;
          candidate_id: string | null;
          file_name: string;
          file_url: string;
          file_size_bytes: number | null;
          category: 'identidade' | 'comprovante' | 'contrato' | 'curriculo' | 'outro' | null;
          ocr_status: 'pendente' | 'processando' | 'concluido' | 'falhou' | 'baixa_confianca';
          ocr_confidence: number | null;
          ocr_extracted: Json | null;
          approval_status: 'pending' | 'approved' | 'rejected';
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['documents']['Row']> & { tenant_id: string; file_name: string; file_url: string };
        Update: Partial<Database['public']['Tables']['documents']['Row']>;
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          shift_date: string;
          shift_type: 'manha' | 'tarde' | 'noite' | 'folga';
          start_time: string | null;
          end_time: string | null;
          status: 'scheduled' | 'confirmed' | 'completed' | 'absent';
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['schedules']['Row']> & { tenant_id: string; profile_id: string; shift_date: string; shift_type: string };
        Update: Partial<Database['public']['Tables']['schedules']['Row']>;
        Relationships: [];
      };
      schedule_read_confirmations: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          schedule_period: string;
          confirmed_at: string | null;
          notified_at: string | null;
          notified_via: string[];
        };
        Insert: Partial<Database['public']['Tables']['schedule_read_confirmations']['Row']> & { tenant_id: string; profile_id: string; schedule_period: string };
        Update: Partial<Database['public']['Tables']['schedule_read_confirmations']['Row']>;
        Relationships: [];
      };
      schedule_change_log: {
        Row: {
          id: string;
          tenant_id: string;
          schedule_id: string | null;
          changed_by: string | null;
          change_description: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['schedule_change_log']['Row']> & { tenant_id: string; change_description: string };
        Update: Partial<Database['public']['Tables']['schedule_change_log']['Row']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          category: 'documentos' | 'escalas' | 'onboarding' | 'sistema';
          title: string;
          message: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & { tenant_id: string; profile_id: string; category: string; title: string };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          ip_address: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']> & { tenant_id: string; action: string };
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
        Relationships: [];
      };
      interviews: {
        Row: {
          id: string;
          tenant_id: string;
          candidate_id: string;
          job_opening_id: string | null;
          interviewer_id: string | null;
          scheduled_at: string;
          status: 'agendada' | 'realizada' | 'cancelada' | 'reagendada';
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['interviews']['Row']> & { tenant_id: string; candidate_id: string; scheduled_at: string };
        Update: Partial<Database['public']['Tables']['interviews']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'interviews_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'interviews_job_opening_id_fkey';
            columns: ['job_opening_id'];
            isOneToOne: false;
            referencedRelation: 'job_openings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'interviews_interviewer_id_fkey';
            columns: ['interviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      trainings: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['trainings']['Row']> & { tenant_id: string; title: string };
        Update: Partial<Database['public']['Tables']['trainings']['Row']>;
        Relationships: [];
      };
      training_progress: {
        Row: {
          id: string;
          tenant_id: string;
          training_id: string;
          profile_id: string;
          progress_pct: number;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['training_progress']['Row']> & { tenant_id: string; training_id: string; profile_id: string };
        Update: Partial<Database['public']['Tables']['training_progress']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'training_progress_training_id_fkey';
            columns: ['training_id'];
            isOneToOne: false;
            referencedRelation: 'trainings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'training_progress_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
