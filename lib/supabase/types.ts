// Typy bazy danych Supabase dla CRM 4DPF

export type Role = 'admin' | 'handlowiec' | 'support' | 'hr' | 'logistyka' | 'manager'

// Tabela profiles (rozszerzenie Supabase Auth)
export interface Profile {
  id: string
  role: Role
  full_name: string | null
  created_at: string
}

// Maszyny budowlane
export interface Machine {
  id: number
  created_at: string
  brand: string | null
  model: string | null
  year: number | null
  engine: string | null
  displacement: string | null
  serial_number: string | null
  dpf: boolean | null
  def: boolean | null
  can_speed: number | null
  emulator: string | null
  harness: string | null
  straight_pipe: string | null
  return_status: string | null
}

export type MachineInsert = Omit<Machine, 'id' | 'created_at'>
export type MachineUpdate = Partial<MachineInsert>

// Kandydaci z OLX
export interface OLXCandidate {
  id: number
  created_at: string
  olx_id: number | null
  name: string | null
  position: string | null
  education: number | null
  language: number | null
  experience: number | null
  grade: number | null
  cv_name: string | null
  cv_url: string | null
  description: string | null
}

export type OLXCandidateInsert = Omit<OLXCandidate, 'id' | 'created_at'>
export type OLXCandidateUpdate = Partial<OLXCandidateInsert>

// Transakcje sprzedażowe
export interface SalesDeal {
  id: number
  created_at: string
  status: string | null
  phone: string | null
  salesman: string | null
  category: string | null
  last_contact_at: string | null
  current_summary: string | null
  detected_engine: string | null
  email: string | null
  shipping_details: string | null
  client_name: string | null
}

export type SalesDealInsert = Omit<SalesDeal, 'id' | 'created_at'>
export type SalesDealUpdate = Partial<SalesDealInsert>

// Jakość sprzedaży (oceny rozmów)
export interface SalesQuality {
  id: number
  salesman: string | null
  category: string | null
  rating: number | null
  phone: string | null
  created_at: string
  clients_name: string | null
  feedback: string | null
  detected_engine: string | null
  summary: string | null
  email: string | null
  shipping_details: string | null
  duration: number | null
  update: string | null
  full_transcript: string | null
  deal_id: number | null
}

export type SalesQualityInsert = Omit<SalesQuality, 'id' | 'created_at'>
export type SalesQualityUpdate = Partial<SalesQualityInsert>

// Log rozmów supportu
export interface SupportLog {
  id: number
  support_agent: string | null
  category: string | null
  phone: string | null
  clients_name: string | null
  created_at: string
  detected_engine: string | null
  summary: string | null
  email: string | null
  duration: number | null
  problem_description: string | null
  support_recommendation: string | null
  full_transcript: string | null
  case_id: number | null
}

export type SupportLogInsert = Omit<SupportLog, 'id' | 'created_at'>
export type SupportLogUpdate = Partial<SupportLogInsert>

// Sprawy supportu
export interface SupportCase {
  id: number
  created_at: string
  phone: string | null
  clients_name: string | null
  status: string | null
  last_contact_at: string | null
  last_agent: string | null
  current_category: string | null
  current_problem_summary: string | null
  current_recommendation: string | null
  last_interaction_id: number | null
  detected_engine: string | null
  final_resolution: string | null
}

export type SupportCaseInsert = Omit<SupportCase, 'id' | 'created_at'>
export type SupportCaseUpdate = Partial<SupportCaseInsert>

// Log wiadomości tekstowych supportu
export interface SupportTextLog {
  id: number
  created_at: string
  phone: string | null
  summary: string | null
  media: Record<string, unknown> | null
  full_message: string | null
  direction: string | null
  case_id: number | null
}

export type SupportTextLogInsert = Omit<SupportTextLog, 'id' | 'created_at'>
export type SupportTextLogUpdate = Partial<SupportTextLogInsert>

// Log wiadomości tekstowych sprzedaży
export interface SalesTextLog {
  id: number
  created_at: string
  phone: string | null
  direction: string | null
  full_message: string | null
  summary: string | null
  media: Record<string, unknown> | null
  deal_id: number | null
  category: string | null
}

export type SalesTextLogInsert = Omit<SalesTextLog, 'id' | 'created_at'>
export type SalesTextLogUpdate = Partial<SalesTextLogInsert>

// Katalog produktów / Magazyn
export interface Product {
  id: number
  created_at: string
  name: string
  category: string | null
  stock_qty: number
  price_default: number | null
  notes: string | null
  plytka: string | null
  program: string | null
  obudowa: string | null
}

export type ProductInsert = Omit<Product, 'id' | 'created_at'>
export type ProductUpdate = Partial<ProductInsert>

// Zestawy (konfiguracje emulatorów + wiązek)
export interface Zestaw {
  id: number
  created_at: string
  nr: number
  name: string
  emulator_program: string | null
  wiazka: string | null
  notes: string | null
  instrukcja: string | null
  price: number | null
  price_currency: string | null
}

export type ZestawInsert = Omit<Zestaw, 'id' | 'created_at'>
export type ZestawUpdate = Partial<ZestawInsert>

// Katalog oprogramowania (firmware emulatorów)
export interface Software {
  id: number
  created_at: string
  product_line: string
  name: string
  plytka: string | null
  notes: string | null
}

export type SoftwareInsert = Omit<Software, 'id' | 'created_at'>
export type SoftwareUpdate = Partial<SoftwareInsert>

// Hardware — płytki i obudowy
export interface Hardware {
  id: number
  created_at: string
  component_type: string
  name: string
  stock_qty: number
  notes: string | null
  program: string | null
}

export type HardwareInsert = Omit<Hardware, 'id' | 'created_at'>
export type HardwareUpdate = Partial<HardwareInsert>

// Wiązki (harnessy)
export interface Wiazka {
  id: number
  created_at: string
  product_line: string
  emulator: string | null
  name: string
  stock_qty: number
  notes: string | null
}

export type WiazkaInsert = Omit<Wiazka, 'id' | 'created_at'>
export type WiazkaUpdate = Partial<WiazkaInsert>

// Sprzedaż (zamówienia)
export interface Sale {
  id: number
  created_at: string
  phone: string | null
  client_name: string | null
  company: string | null
  email_address: string | null
  location: string | null
  vat_no: string | null
  salesman: string | null
  first_contact: string | null
  sale_status: string | null
  machine_id: number | null
  pipe_type: string | null
  quantity: number | null
  price: number | null
  shipping_cost: number | null
  total: number | null
  payment_method: string | null
  paypal_invoice_number: string | null
  tracking_number: string | null
  shipping_details: string | null
  invoice_details: string | null
  deal_id: number | null
  zestaw_id: number | null
  notes: string | null
  client_id: number | null
}

export type SaleInsert = Omit<Sale, 'id' | 'created_at'>
export type SaleUpdate = Partial<SaleInsert>

// Pozycje zamówienia
export interface SaleItem {
  id: number
  created_at: string
  sale_id: number
  zestaw_id: number | null
  quantity: number
  price: number | null
}
export type SaleItemInsert = Omit<SaleItem, 'id' | 'created_at'>

// Domeny
export interface Domain {
  id: number
  created_at: string
  domain: string | null
  provider: string | null
  due_date: string | null
}

export type DomainInsert = Omit<Domain, 'id' | 'created_at'>
export type DomainUpdate = Partial<DomainInsert>

// Hostingi
export interface Hosting {
  id: number
  created_at: string
  description: string | null
  provider: string | null
  due_date: string | null
}

export type HostingInsert = Omit<Hosting, 'id' | 'created_at'>
export type HostingUpdate = Partial<HostingInsert>

// Opinie klientów (linki do opinii wysyłane po wsparciu)
export interface Review {
  id: number
  created_at: string
  technik: string | null
  contact: string | null
  channel: string | null
  napisano: boolean | null
  napisac: boolean | null
  wystawil: boolean | null
  google_name: string | null
}

export type ReviewInsert = Omit<Review, 'id' | 'created_at'>
export type ReviewUpdate = Partial<ReviewInsert>

// Problemy maszyn (powtarzające się, bez rozwiązania)
export interface MachineIssue {
  id: number
  created_at: string
  model: string | null
  year: number | null
  problem: string | null
}

export type MachineIssueInsert = Omit<MachineIssue, 'id' | 'created_at'>
export type MachineIssueUpdate = Partial<MachineIssueInsert>

// Support Backlog — główna sprawa klienta
export interface SupportBacklog {
  id: number
  created_at: string
  updated_at: string
  phone: string | null
  invoice_number: string | null
  client_name: string | null
  status: string
  agent: string | null
}

export type SupportBacklogInsert = Omit<SupportBacklog, 'id' | 'created_at' | 'updated_at'>
export type SupportBacklogUpdate = Partial<SupportBacklogInsert>

// Klienci
export interface Client {
  id: number
  created_at: string
  phone: string | null
  phone_alt: string | null
  client_name: string | null
  company: string | null
  email: string | null
  location: string | null
  vat_no: string | null
  assigned_salesman: string | null
  source: string | null
  notes: string | null
}

export type ClientInsert = Omit<Client, 'id' | 'created_at'>
export type ClientUpdate = Partial<ClientInsert>

// Support Backlog Log — pojedyncza interakcja w ramach sprawy
export interface SupportBacklogLog {
  id: number
  created_at: string
  backlog_id: number
  agent: string | null
  problem: string | null
  proposed_solution: string | null
  outcome: string | null
  notes: string | null
}

export type SupportBacklogLogInsert = Omit<SupportBacklogLog, 'id' | 'created_at'>
export type SupportBacklogLogUpdate = Partial<SupportBacklogLogInsert>
