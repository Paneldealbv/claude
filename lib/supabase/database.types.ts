// Gegenereerd uit de database — niet handmatig wijzigen.
// Opnieuw maken na een migratie: npm run supabase -- types

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: number
          project_id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: never
          project_id: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: never
          project_id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          project_id: string
          updated_at: string
          vat_cents: number
          vat_rate_bp: number
          vat_reverse_charge: boolean
        }
        Insert: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id: string
          updated_at?: string
          vat_cents: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Update: {
          amount_excl_cents?: number
          amount_incl_cents?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id?: string
          updated_at?: string
          vat_cents?: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_project_id_category_id_fkey"
            columns: ["project_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "budget_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          is_closed: boolean
          name: string
          parent_id: string | null
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          name: string
          parent_id?: string | null
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          name?: string
          parent_id?: string | null
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_project_id_parent_id_fkey"
            columns: ["project_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      contract_changes: {
        Row: {
          amount_excl_cents: number
          amount_incl_cents: number
          contract_line_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          description: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["change_status"]
          updated_at: string
          vat_cents: number
          vat_rate_bp: number
          vat_reverse_charge: boolean
        }
        Insert: {
          amount_excl_cents: number
          amount_incl_cents: number
          contract_line_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          description: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["change_status"]
          updated_at?: string
          vat_cents: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Update: {
          amount_excl_cents?: number
          amount_incl_cents?: number
          contract_line_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          description?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["change_status"]
          updated_at?: string
          vat_cents?: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contract_changes_project_id_contract_line_id_fkey"
            columns: ["project_id", "contract_line_id"]
            isOneToOne: false
            referencedRelation: "contract_lines"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "contract_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_installments: {
        Row: {
          amount_incl_cents: number | null
          contract_id: string
          created_at: string
          created_by: string | null
          description: string
          expected_date: string | null
          id: string
          percentage_bp: number | null
          project_id: string
          sequence: number
          updated_at: string
        }
        Insert: {
          amount_incl_cents?: number | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expected_date?: string | null
          id?: string
          percentage_bp?: number | null
          project_id: string
          sequence: number
          updated_at?: string
        }
        Update: {
          amount_incl_cents?: number | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expected_date?: string | null
          id?: string
          percentage_bp?: number | null
          project_id?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_project_id_contract_id_fkey"
            columns: ["project_id", "contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "contract_installments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_lines: {
        Row: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id: string
          contract_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          project_id: string
          sort_order: number
          updated_at: string
          vat_cents: number
          vat_rate_bp: number
          vat_reverse_charge: boolean
        }
        Insert: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id: string
          sort_order?: number
          updated_at?: string
          vat_cents: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Update: {
          amount_excl_cents?: number
          amount_incl_cents?: number
          category_id?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
          vat_cents?: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contract_lines_project_id_category_id_fkey"
            columns: ["project_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "contract_lines_project_id_contract_id_fkey"
            columns: ["project_id", "contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "contract_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          quote_id: string | null
          signed_on: string | null
          status: Database["public"]["Enums"]["contract_status"]
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          quote_id?: string | null
          signed_on?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          quote_id?: string | null
          signed_on?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_quote_id_fkey"
            columns: ["project_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "contracts_project_id_supplier_id_fkey"
            columns: ["project_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      cost_documents: {
        Row: {
          booked_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          document_date: string
          document_number: string | null
          due_date: string | null
          file_id: string | null
          id: string
          installment_id: string | null
          notes: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["document_source"]
          stated_total_incl_cents: number | null
          status: Database["public"]["Enums"]["cost_document_status"]
          supplier_id: string | null
          type: Database["public"]["Enums"]["cost_document_type"]
          updated_at: string
        }
        Insert: {
          booked_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          document_date: string
          document_number?: string | null
          due_date?: string | null
          file_id?: string | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["document_source"]
          stated_total_incl_cents?: number | null
          status?: Database["public"]["Enums"]["cost_document_status"]
          supplier_id?: string | null
          type: Database["public"]["Enums"]["cost_document_type"]
          updated_at?: string
        }
        Update: {
          booked_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_number?: string | null
          due_date?: string | null
          file_id?: string | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["document_source"]
          stated_total_incl_cents?: number | null
          status?: Database["public"]["Enums"]["cost_document_status"]
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["cost_document_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_documents_project_id_contract_id_fkey"
            columns: ["project_id", "contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_documents_project_id_file_id_fkey"
            columns: ["project_id", "file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_documents_project_id_installment_id_fkey"
            columns: ["project_id", "installment_id"]
            isOneToOne: false
            referencedRelation: "contract_installments"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_documents_project_id_supplier_id_fkey"
            columns: ["project_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      cost_lines: {
        Row: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id: string | null
          contract_id: string | null
          contract_line_id: string | null
          cost_document_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          project_id: string
          sort_order: number
          updated_at: string
          vat_cents: number
          vat_rate_bp: number
          vat_reverse_charge: boolean
        }
        Insert: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id?: string | null
          contract_id?: string | null
          contract_line_id?: string | null
          cost_document_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id: string
          sort_order?: number
          updated_at?: string
          vat_cents: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Update: {
          amount_excl_cents?: number
          amount_incl_cents?: number
          category_id?: string | null
          contract_id?: string | null
          contract_line_id?: string | null
          cost_document_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
          vat_cents?: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cost_lines_project_id_category_id_fkey"
            columns: ["project_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_lines_project_id_contract_id_fkey"
            columns: ["project_id", "contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_lines_project_id_contract_line_id_fkey"
            columns: ["project_id", "contract_line_id"]
            isOneToOne: false
            referencedRelation: "contract_lines"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_lines_project_id_cost_document_id_fkey"
            columns: ["project_id", "cost_document_id"]
            isOneToOne: false
            referencedRelation: "cost_documents"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "cost_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      depot_claim_lines: {
        Row: {
          amount_cents: number
          cost_document_id: string
          created_at: string
          created_by: string | null
          depot_claim_id: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cost_document_id: string
          created_at?: string
          created_by?: string | null
          depot_claim_id: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cost_document_id?: string
          created_at?: string
          created_by?: string | null
          depot_claim_id?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "depot_claim_lines_project_id_cost_document_id_fkey"
            columns: ["project_id", "cost_document_id"]
            isOneToOne: false
            referencedRelation: "cost_documents"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "depot_claim_lines_project_id_depot_claim_id_fkey"
            columns: ["project_id", "depot_claim_id"]
            isOneToOne: false
            referencedRelation: "depot_claims"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "depot_claim_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      depot_claims: {
        Row: {
          amount_cents: number
          claim_number: string | null
          created_at: string
          created_by: string | null
          funding_source_id: string
          id: string
          notes: string | null
          paid_out_on: string | null
          project_id: string
          status: Database["public"]["Enums"]["depot_claim_status"]
          submitted_on: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          claim_number?: string | null
          created_at?: string
          created_by?: string | null
          funding_source_id: string
          id?: string
          notes?: string | null
          paid_out_on?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["depot_claim_status"]
          submitted_on?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          claim_number?: string | null
          created_at?: string
          created_by?: string | null
          funding_source_id?: string
          id?: string
          notes?: string | null
          paid_out_on?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["depot_claim_status"]
          submitted_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "depot_claims_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depot_claims_project_id_funding_source_id_fkey"
            columns: ["project_id", "funding_source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      document_extractions: {
        Row: {
          cost_document_id: string | null
          created_at: string
          created_by: string | null
          duplicate_candidates: Json
          error: string | null
          file_id: string
          id: string
          issues: Json
          model: string | null
          project_id: string
          result: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["extraction_status"]
          suggested_contract_id: string | null
          suggested_supplier_id: string | null
          updated_at: string
        }
        Insert: {
          cost_document_id?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_candidates?: Json
          error?: string | null
          file_id: string
          id?: string
          issues?: Json
          model?: string | null
          project_id: string
          result?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
          suggested_contract_id?: string | null
          suggested_supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          cost_document_id?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_candidates?: Json
          error?: string | null
          file_id?: string
          id?: string
          issues?: Json
          model?: string | null
          project_id?: string
          result?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
          suggested_contract_id?: string | null
          suggested_supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_project_id_cost_document_id_fkey"
            columns: ["project_id", "cost_document_id"]
            isOneToOne: false
            referencedRelation: "cost_documents"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "document_extractions_project_id_file_id_fkey"
            columns: ["project_id", "file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "document_extractions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extractions_project_id_suggested_contract_id_fkey"
            columns: ["project_id", "suggested_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "document_extractions_project_id_suggested_supplier_id_fkey"
            columns: ["project_id", "suggested_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mime_type: string
          original_name: string
          project_id: string
          sha256: string
          size_bytes: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type: string
          original_name: string
          project_id: string
          sha256: string
          size_bytes: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string
          original_name?: string
          project_id?: string
          sha256?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_sources: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          interest_rate_bp: number | null
          lender: string | null
          name: string
          notes: string | null
          parent_source_id: string | null
          project_id: string
          start_date: string | null
          type: Database["public"]["Enums"]["funding_type"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          interest_rate_bp?: number | null
          lender?: string | null
          name: string
          notes?: string | null
          parent_source_id?: string | null
          project_id: string
          start_date?: string | null
          type: Database["public"]["Enums"]["funding_type"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          interest_rate_bp?: number | null
          lender?: string | null
          name?: string
          notes?: string | null
          parent_source_id?: string | null
          project_id?: string
          start_date?: string | null
          type?: Database["public"]["Enums"]["funding_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_sources_project_id_parent_source_id_fkey"
            columns: ["project_id", "parent_source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          cost_document_id: string
          created_at: string
          created_by: string | null
          depot_claim_id: string | null
          description: string | null
          funding_source_id: string | null
          id: string
          paid_on: string
          project_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cost_document_id: string
          created_at?: string
          created_by?: string | null
          depot_claim_id?: string | null
          description?: string | null
          funding_source_id?: string | null
          id?: string
          paid_on: string
          project_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cost_document_id?: string
          created_at?: string
          created_by?: string | null
          depot_claim_id?: string | null
          description?: string | null
          funding_source_id?: string | null
          id?: string
          paid_on?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_project_id_cost_document_id_fkey"
            columns: ["project_id", "cost_document_id"]
            isOneToOne: false
            referencedRelation: "cost_documents"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "payments_project_id_depot_claim_id_fkey"
            columns: ["project_id", "depot_claim_id"]
            isOneToOne: false
            referencedRelation: "depot_claims"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_funding_source_id_fkey"
            columns: ["project_id", "funding_source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          project_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          project_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          project_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          expected_completion: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          expected_completion?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          expected_completion?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          project_id: string
          quote_id: string
          sort_order: number
          updated_at: string
          vat_cents: number
          vat_rate_bp: number
          vat_reverse_charge: boolean
        }
        Insert: {
          amount_excl_cents: number
          amount_incl_cents: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id: string
          quote_id: string
          sort_order?: number
          updated_at?: string
          vat_cents: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Update: {
          amount_excl_cents?: number
          amount_incl_cents?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id?: string
          quote_id?: string
          sort_order?: number
          updated_at?: string
          vat_cents?: number
          vat_rate_bp?: number
          vat_reverse_charge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_project_id_category_id_fkey"
            columns: ["project_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "quote_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_project_id_quote_id_fkey"
            columns: ["project_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          file_id: string | null
          id: string
          notes: string | null
          project_id: string
          quote_date: string | null
          quote_number: string | null
          stated_total_incl_cents: number | null
          status: Database["public"]["Enums"]["quote_status"]
          supplier_id: string | null
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_id?: string | null
          id?: string
          notes?: string | null
          project_id: string
          quote_date?: string | null
          quote_number?: string | null
          stated_total_incl_cents?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          supplier_id?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          quote_date?: string | null
          quote_number?: string | null
          stated_total_incl_cents?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          supplier_id?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_file_id_fkey"
            columns: ["project_id", "file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_supplier_id_fkey"
            columns: ["project_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      room_allocations: {
        Row: {
          contract_line_id: string | null
          cost_line_id: string | null
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          room_id: string
          share_bp: number
          updated_at: string
        }
        Insert: {
          contract_line_id?: string | null
          cost_line_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          room_id: string
          share_bp: number
          updated_at?: string
        }
        Update: {
          contract_line_id?: string | null
          cost_line_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          room_id?: string
          share_bp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_allocations_project_id_contract_line_id_fkey"
            columns: ["project_id", "contract_line_id"]
            isOneToOne: false
            referencedRelation: "contract_lines"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "room_allocations_project_id_cost_line_id_fkey"
            columns: ["project_id", "cost_line_id"]
            isOneToOne: false
            referencedRelation: "cost_lines"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "room_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_allocations_project_id_room_id_fkey"
            columns: ["project_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string | null
          floor: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          iban: string | null
          id: string
          kvk_number: string | null
          name: string
          notes: string | null
          phone: string | null
          project_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          kvk_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          project_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          kvk_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      create_invite: {
        Args: {
          p_email: string
          p_project: string
          p_role?: Database["public"]["Enums"]["member_role"]
        }
        Returns: {
          expires_at: string
          invite_id: string
          token: string
        }[]
      }
      create_project: {
        Args: {
          p_address?: string
          p_expected_completion?: string
          p_name: string
        }
        Returns: string
      }
      delete_cost_document: { Args: { p_document: string }; Returns: string }
      get_invite: {
        Args: { p_token: string }
        Returns: {
          invited_by: string
          invited_email: string
          project_name: string
          role: Database["public"]["Enums"]["member_role"]
          status: string
        }[]
      }
      pay_out_depot_claim: {
        Args: { p_claim: string; p_date: string }
        Returns: undefined
      }
      revoke_invite: { Args: { p_invite: string }; Returns: undefined }
      save_cost_document: {
        Args: { p_document: Json; p_lines: Json }
        Returns: string
      }
      save_depot_claim: {
        Args: { p_claim: Json; p_lines: Json }
        Returns: string
      }
      save_funding_source: {
        Args: { p_parts: Json; p_source: Json }
        Returns: string
      }
      set_depot_claim_status: {
        Args: {
          p_claim: string
          p_date: string
          p_status: Database["public"]["Enums"]["depot_claim_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      change_status: "voorgesteld" | "akkoord" | "afgewezen"
      contract_status: "actief" | "afgerond" | "geannuleerd"
      cost_document_status:
        | "concept"
        | "te_controleren"
        | "geboekt"
        | "vervallen"
      cost_document_type:
        | "factuur"
        | "termijnfactuur"
        | "eindfactuur"
        | "creditnota"
        | "bon"
      depot_claim_status: "concept" | "ingediend" | "uitbetaald" | "afgewezen"
      document_source: "handmatig" | "ai"
      extraction_status:
        | "wachtrij"
        | "bezig"
        | "te_controleren"
        | "verwerkt"
        | "mislukt"
        | "afgewezen"
      funding_type:
        | "eigen_geld"
        | "hypotheek"
        | "schenking"
        | "lening"
        | "overig"
        | "bouwdepot"
        | "overige_hypotheekruimte"
      member_role: "eigenaar" | "bewerker" | "lezer"
      quote_status: "ontvangen" | "geaccepteerd" | "afgewezen" | "verlopen"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      change_status: ["voorgesteld", "akkoord", "afgewezen"],
      contract_status: ["actief", "afgerond", "geannuleerd"],
      cost_document_status: [
        "concept",
        "te_controleren",
        "geboekt",
        "vervallen",
      ],
      cost_document_type: [
        "factuur",
        "termijnfactuur",
        "eindfactuur",
        "creditnota",
        "bon",
      ],
      depot_claim_status: ["concept", "ingediend", "uitbetaald", "afgewezen"],
      document_source: ["handmatig", "ai"],
      extraction_status: [
        "wachtrij",
        "bezig",
        "te_controleren",
        "verwerkt",
        "mislukt",
        "afgewezen",
      ],
      funding_type: [
        "eigen_geld",
        "hypotheek",
        "schenking",
        "lening",
        "overig",
        "bouwdepot",
        "overige_hypotheekruimte",
      ],
      member_role: ["eigenaar", "bewerker", "lezer"],
      quote_status: ["ontvangen", "geaccepteerd", "afgewezen", "verlopen"],
    },
  },
} as const
