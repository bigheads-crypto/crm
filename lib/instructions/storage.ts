// Helpery Storage dla modułu Instrukcje.
// Bucket prywatny `instructions`; klucze kluczowane po id wpisu-pliku (stabilne
// przy zmianie nazwy folderu). Każdy wpis = jeden plik, wersjonowany numerem —
// poprzednie wersje zostają pod swoją ścieżką (Archiwum), nie są przenoszone:
//   {id}/v{n}.{ext}              — plik wpisu w wersji n
//   {id}/materials/{filename}    — dodatkowe materiały (dowolne formaty)

import { createClient } from '@/lib/supabase/client'

type Supa = ReturnType<typeof createClient>

export const INSTRUCTIONS_BUCKET = 'instructions'

/** Rozszerzenie pliku z nazwy (małymi literami); 'bin' gdy brak. */
export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : 'bin'
}

export function versionPath(instructionId: number, version: number, ext: string): string {
  return `${instructionId}/v${version}.${ext}`
}

export function materialsPrefix(instructionId: number): string {
  return `${instructionId}/materials`
}

/** Wgranie/nadpisanie obiektu (upsert). */
export function uploadObject(supabase: Supa, path: string, file: File) {
  return supabase.storage.from(INSTRUCTIONS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
}

/** Lista starszych wersji pliku (obiekty {id}/v{n}.{ext}) — do panelu Archiwum. */
export async function listVersionFiles(supabase: Supa, instructionId: number) {
  const res = await supabase.storage.from(INSTRUCTIONS_BUCKET).list(String(instructionId), {
    limit: 200,
    sortBy: { column: 'name', order: 'desc' },
  })
  if (res.error) return { data: null, error: res.error }
  const files = (res.data ?? []).filter((o) => o.id != null && /^v\d+\./i.test(o.name))
  return { data: files, error: null }
}

/** Lista plików w folderze materiałów danego wpisu. */
export function listMaterials(supabase: Supa, instructionId: number) {
  return supabase.storage.from(INSTRUCTIONS_BUCKET).list(materialsPrefix(instructionId), {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  })
}

/** Usunięcie obiektów (pełne klucze). */
export function removeObjects(supabase: Supa, paths: string[]) {
  return supabase.storage.from(INSTRUCTIONS_BUCKET).remove(paths)
}

/** Podpisany URL do prywatnego obiektu; `downloadName` wymusza pobranie pod tą nazwą. */
export function signedUrl(supabase: Supa, path: string, downloadName?: string, expiresIn = 60) {
  return supabase.storage
    .from(INSTRUCTIONS_BUCKET)
    .createSignedUrl(path, expiresIn, downloadName ? { download: downloadName } : undefined)
}

/** Pobranie pliku przez podpisany URL — wymusza zapis pod `filename`. Zwraca błąd lub null. */
export async function downloadObject(supabase: Supa, path: string, filename: string): Promise<Error | null> {
  const { data, error } = await signedUrl(supabase, path, filename)
  if (error) return error
  if (!data?.signedUrl) return new Error('Brak podpisanego URL')
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.rel = 'noopener'
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  return null
}
