// Typy i helper do filtrowania kolumn w stylu Google Sheets

export type FilterCondition =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'one_of'

export interface ColumnFilter {
  condition: FilterCondition
  value: string
  values?: string[]  // używane gdy condition === 'one_of'
}

export type ColumnFilters = Record<string, ColumnFilter>

// Aplikuje filtry kolumn do zapytania Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyColumnFilters(query: any, filters: ColumnFilters): any {
  Object.entries(filters).forEach(([key, filter]) => {
    const v = filter.value.trim()
    switch (filter.condition) {
      case 'contains':
        if (v) query = query.ilike(key, `%${v}%`)
        break
      case 'not_contains':
        if (v) query = query.filter(key, 'not.ilike', `%${v}%`)
        break
      case 'equals':
        if (v) query = query.eq(key, v)
        break
      case 'not_equals':
        if (v) query = query.neq(key, v)
        break
      case 'starts_with':
        if (v) query = query.ilike(key, `${v}%`)
        break
      case 'ends_with':
        if (v) query = query.ilike(key, `%${v}`)
        break
      case 'is_empty':
        query = query.or(`${key}.is.null,${key}.eq.`)
        break
      case 'is_not_empty':
        query = query.not(key, 'is', null)
        break
      case 'one_of':
        if (filter.values && filter.values.length > 0) {
          query = query.in(key, filter.values)
        }
        break
    }
  })
  return query
}
