// Centralna procedura opisywania błędów Supabase/Postgres.
//
// Zamiast jednego generycznego komunikatu („Wystąpił błąd") każdy błąd dostaje:
//  - messageKey  → klucz w i18n namespace 'errors' (przetłumaczony, zrozumiały opis przyczyny)
//  - detail      → techniczny ślad: tabela · operacja · kod PG · message z bazy
//    (nieprzetłumaczony celowo — służy do diagnozy, nie dla końcowego użytkownika)
// Pełny obiekt błędu trafia dodatkowo do console.error z prefiksem [CRM].
//
// Użycie w module:
//   const { error } = await supabase.from('Clients').update(...)
//   if (error) showError(describeSupabaseError(error, { table: 'Clients', operation: 'update' }))

export type ErrorOperation = 'load' | 'insert' | 'update' | 'delete'

export interface ErrorContext {
  /** Nazwa tabeli Supabase, np. 'Clients', 'Sales Deals' */
  table: string
  operation: ErrorOperation
}

export interface DescribedError {
  operation: ErrorOperation
  /** Klucz w i18n namespace 'errors' */
  messageKey: string
  /** Techniczne szczegóły do diagnozy: tabela · operacja · kod · message */
  detail: string
}

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

// Kody błędów Postgres/PostgREST → klucze i18n (namespace 'errors')
const CODE_TO_KEY: Record<string, string> = {
  '23505': 'duplicate',          // unique_violation
  '23503': 'foreignKey',         // foreign_key_violation
  '23502': 'requiredMissing',    // not_null_violation
  '23514': 'invalidFormat',      // check_violation
  '22P02': 'invalidFormat',      // invalid_text_representation
  '22001': 'valueTooLong',       // string_data_right_truncation
  '42501': 'permissionDenied',   // insufficient_privilege (RLS)
  '42703': 'unknownColumn',      // undefined_column
  '42P01': 'unknownTable',       // undefined_table
  '57014': 'timeout',            // query_canceled (statement_timeout)
  'PGRST301': 'sessionExpired',  // JWT expired
  'PGRST116': 'notFound',        // .single() bez wyniku
}

export function describeSupabaseError(
  error: SupabaseLikeError | null | undefined,
  ctx: ErrorContext,
): DescribedError {
  const code = error?.code ?? ''
  const message = error?.message ?? ''

  let messageKey = CODE_TO_KEY[code]
  if (!messageKey) {
    if (/failed to fetch|fetch failed|network|ERR_INTERNET|ECONNREFUSED/i.test(message)) {
      messageKey = 'network'
    } else if (/jwt|token|refresh_token/i.test(message)) {
      messageKey = 'sessionExpired'
    } else if (/row-level security|policy/i.test(message)) {
      messageKey = 'permissionDenied'
    } else {
      messageKey = ctx.operation === 'load' ? 'loadFailed' : 'operationFailed'
    }
  }

  const detail = [
    `${ctx.table} · ${ctx.operation}`,
    code && `kod ${code}`,
    message,
    error?.details,
    error?.hint,
  ].filter(Boolean).join(' — ')

  // Pełny obiekt do devtools — detail w UI jest skrócony, tu jest wszystko
  console.error(`[CRM] ${ctx.table}/${ctx.operation}`, error)

  return { operation: ctx.operation, messageKey, detail }
}
