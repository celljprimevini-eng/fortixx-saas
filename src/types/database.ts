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
          cakto_customer_id: string | null;
          cakto_subscription_id: string | null;
          billing_provider: 'stripe' | 'cakto';
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
          birth_date: string | null;
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
      hr_faqs: {
        Row: {
          id: string;
          tenant_id: string;
          question: string;
          answer: string;
          views: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['hr_faqs']['Row']> & { tenant_id: string; question: string; answer: string };
        Update: Partial<Database['public']['Tables']['hr_faqs']['Row']>;
        Relationships: [];
      };
      hr_conversations: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          subject: string;
          status: 'open' | 'resolved' | 'escalated';
          last_message_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['hr_conversations']['Row']> & { tenant_id: string; profile_id: string; subject: string };
        Update: Partial<Database['public']['Tables']['hr_conversations']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'hr_conversations_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      hr_messages: {
        Row: {
          id: string;
          tenant_id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          body: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['hr_messages']['Row']> & { tenant_id: string; conversation_id: string; role: 'user' | 'assistant'; body: string };
        Update: Partial<Database['public']['Tables']['hr_messages']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'hr_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'hr_conversations';
            referencedColumns: ['id'];
          }
        ];
      };
      posts: {
        Row: {
          id: string;
          tenant_id: string;
          author_id: string;
          kind: 'post' | 'comunicado' | 'aniversario';
          body: string;
          subject_profile_id: string | null;
          pinned: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['posts']['Row']> & { tenant_id: Database['public']['Tables']['posts']['Row']['tenant_id']; author_id: Database['public']['Tables']['posts']['Row']['author_id']; body: Database['public']['Tables']['posts']['Row']['body'] };
        Update: Partial<Database['public']['Tables']['posts']['Row']>;
        Relationships: [];
      };
      post_reactions: {
        Row: {
          post_id: string;
          profile_id: string;
          tenant_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['post_reactions']['Row']> & { post_id: Database['public']['Tables']['post_reactions']['Row']['post_id']; profile_id: Database['public']['Tables']['post_reactions']['Row']['profile_id']; tenant_id: Database['public']['Tables']['post_reactions']['Row']['tenant_id'] };
        Update: Partial<Database['public']['Tables']['post_reactions']['Row']>;
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          tenant_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['post_comments']['Row']> & { post_id: Database['public']['Tables']['post_comments']['Row']['post_id']; tenant_id: Database['public']['Tables']['post_comments']['Row']['tenant_id']; author_id: Database['public']['Tables']['post_comments']['Row']['author_id']; body: Database['public']['Tables']['post_comments']['Row']['body'] };
        Update: Partial<Database['public']['Tables']['post_comments']['Row']>;
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          tenant_id: string;
          author_id: string;
          question: string;
          anonymous: boolean;
          closes_at: string | null;
          closed: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['polls']['Row']> & { tenant_id: Database['public']['Tables']['polls']['Row']['tenant_id']; author_id: Database['public']['Tables']['polls']['Row']['author_id']; question: Database['public']['Tables']['polls']['Row']['question'] };
        Update: Partial<Database['public']['Tables']['polls']['Row']>;
        Relationships: [];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          tenant_id: string;
          label: string;
          position: number;
        };
        Insert: Partial<Database['public']['Tables']['poll_options']['Row']> & { poll_id: Database['public']['Tables']['poll_options']['Row']['poll_id']; tenant_id: Database['public']['Tables']['poll_options']['Row']['tenant_id']; label: Database['public']['Tables']['poll_options']['Row']['label'] };
        Update: Partial<Database['public']['Tables']['poll_options']['Row']>;
        Relationships: [];
      };
      poll_votes: {
        Row: {
          poll_id: string;
          option_id: string;
          profile_id: string;
          tenant_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['poll_votes']['Row']> & { poll_id: Database['public']['Tables']['poll_votes']['Row']['poll_id']; option_id: Database['public']['Tables']['poll_votes']['Row']['option_id']; profile_id: Database['public']['Tables']['poll_votes']['Row']['profile_id']; tenant_id: Database['public']['Tables']['poll_votes']['Row']['tenant_id'] };
        Update: Partial<Database['public']['Tables']['poll_votes']['Row']>;
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          kind: 'ferias' | 'folga' | 'licenca';
          start_date: string;
          end_date: string;
          days: number;
          note: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'canceled';
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['leave_requests']['Row']> & { tenant_id: Database['public']['Tables']['leave_requests']['Row']['tenant_id']; profile_id: Database['public']['Tables']['leave_requests']['Row']['profile_id']; start_date: Database['public']['Tables']['leave_requests']['Row']['start_date']; end_date: Database['public']['Tables']['leave_requests']['Row']['end_date']; days: Database['public']['Tables']['leave_requests']['Row']['days'] };
        Update: Partial<Database['public']['Tables']['leave_requests']['Row']>;
        Relationships: [];
      };
      service_requests: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          category: 'documento' | 'beneficio' | 'dados_cadastrais' | 'holerite' | 'ponto' | 'outro';
          subject: string;
          body: string;
          status: 'open' | 'in_progress' | 'done' | 'rejected';
          response: string | null;
          handled_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['service_requests']['Row']> & { tenant_id: Database['public']['Tables']['service_requests']['Row']['tenant_id']; profile_id: Database['public']['Tables']['service_requests']['Row']['profile_id']; category: Database['public']['Tables']['service_requests']['Row']['category']; subject: Database['public']['Tables']['service_requests']['Row']['subject']; body: Database['public']['Tables']['service_requests']['Row']['body'] };
        Update: Partial<Database['public']['Tables']['service_requests']['Row']>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          location: string | null;
          starts_at: string;
          ends_at: string | null;
          capacity: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['events']['Row']> & { tenant_id: Database['public']['Tables']['events']['Row']['tenant_id']; title: Database['public']['Tables']['events']['Row']['title']; starts_at: Database['public']['Tables']['events']['Row']['starts_at'] };
        Update: Partial<Database['public']['Tables']['events']['Row']>;
        Relationships: [];
      };
      event_registrations: {
        Row: {
          event_id: string;
          profile_id: string;
          tenant_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['event_registrations']['Row']> & { event_id: Database['public']['Tables']['event_registrations']['Row']['event_id']; profile_id: Database['public']['Tables']['event_registrations']['Row']['profile_id']; tenant_id: Database['public']['Tables']['event_registrations']['Row']['tenant_id'] };
        Update: Partial<Database['public']['Tables']['event_registrations']['Row']>;
        Relationships: [];
      };
      signature_requests: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          title: string;
          content: string;
          content_hash: string;
          status: 'pending' | 'signed' | 'declined';
          requested_by: string | null;
          signed_name: string | null;
          signed_at: string | null;
          signer_ip: string | null;
          signer_user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['signature_requests']['Row']> & { tenant_id: Database['public']['Tables']['signature_requests']['Row']['tenant_id']; profile_id: Database['public']['Tables']['signature_requests']['Row']['profile_id']; title: Database['public']['Tables']['signature_requests']['Row']['title']; content: Database['public']['Tables']['signature_requests']['Row']['content']; content_hash: Database['public']['Tables']['signature_requests']['Row']['content_hash'] };
        Update: Partial<Database['public']['Tables']['signature_requests']['Row']>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['push_subscriptions']['Row']> & { tenant_id: Database['public']['Tables']['push_subscriptions']['Row']['tenant_id']; profile_id: Database['public']['Tables']['push_subscriptions']['Row']['profile_id']; endpoint: Database['public']['Tables']['push_subscriptions']['Row']['endpoint']; p256dh: Database['public']['Tables']['push_subscriptions']['Row']['p256dh']; auth: Database['public']['Tables']['push_subscriptions']['Row']['auth'] };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
