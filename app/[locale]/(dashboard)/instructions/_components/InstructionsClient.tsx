'use client'

import { useState, useCallback, useMemo, type CSSProperties } from 'react'
import { useFetchOnParamChange } from '@/lib/hooks/table-data'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Search, Folder, FolderPlus, ChevronRight, Home, Trash2, Upload, Download, Archive, Paperclip } from 'lucide-react'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Instruction, InstructionFolder } from '@/lib/supabase/types'
import { PAGE_SIZE } from '@/lib/constants'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { versionPath, fileExt, uploadObject, downloadObject, listVersionFiles, listMaterials, removeObjects, materialsPrefix } from '@/lib/instructions/storage'

const schema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(['active', 'archived']),
})
type FormData = z.infer<typeof schema>
type Lang = 'pl' | 'en' | 'es'

// Zgodny ze stylem wbudowanych akcji DataTable (Pencil/Trash): 28×28, bez ramki.
const iconBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, border: 'none',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
}

function StatusBadge({ value, label }: { value: string; label: string }) {
  const active = value === 'active'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: active ? '#22c55e' : '#6b7280' }}>
      {label}
    </span>
  )
}

interface Props {
  initialData: Instruction[]
  initialCount: number
  initialFolders: InstructionFolder[]
  canWrite: boolean
  canEdit: boolean
}

export function InstructionsClient({ initialData, initialCount, initialFolders, canWrite, canEdit: canEditProp }: Props) {
  const t = useTranslations('modules.instructions')
  const { showError } = useErrorToast()

  const [allFolders, setAllFolders] = useState<InstructionFolder[]>(initialFolders)
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)

  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadErrorDetail, setLoadErrorDetail] = useState<string>()

  // Modal instrukcji (dodaj / edytuj metadane)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Instruction | null>(null)
  const [formFolderId, setFormFolderId] = useState<number | null>(null)
  const [formLang, setFormLang] = useState<Lang>('pl')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteRow, setDeleteRow] = useState<Instruction | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderSubmitting, setFolderSubmitting] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [deleteFolderRow, setDeleteFolderRow] = useState<InstructionFolder | null>(null)
  const [deleteFolderLoading, setDeleteFolderLoading] = useState(false)

  // Nowa wersja pliku (przycisk ⬆)
  const [uploadRow, setUploadRow] = useState<Instruction | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Panel Archiwum (starsze wersje pliku)
  const [archiveRow, setArchiveRow] = useState<Instruction | null>(null)
  const [archiveFiles, setArchiveFiles] = useState<{ name: string }[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)

  // Panel Materiały (pliki towarzyszące: edytowalny SVG, zdjęcia, plik surowy…)
  const [materialsRow, setMaterialsRow] = useState<Instruction | null>(null)
  const [materialsFiles, setMaterialsFiles] = useState<{ name: string }[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [materialUploading, setMaterialUploading] = useState(false)

  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const canEdit = canEditProp
  const canDelete = canEditProp
  const searching = search.trim().length > 0

  const foldersById = useMemo(() => {
    const m = new Map<number, InstructionFolder>()
    for (const f of allFolders) m.set(f.id, f)
    return m
  }, [allFolders])

  const subfolders = useMemo(
    () => allFolders.filter((f) => f.parent_id === currentFolderId).sort((a, b) => a.name.localeCompare(b.name)),
    [allFolders, currentFolderId]
  )

  const breadcrumb = useMemo(() => {
    const chain: InstructionFolder[] = []
    let id: number | null = currentFolderId
    while (id != null) {
      const f = foldersById.get(id)
      if (!f) break
      chain.unshift(f)
      id = f.parent_id
    }
    return chain
  }, [currentFolderId, foldersById])

  const folderPath = useCallback((folderId: number | null) => {
    const names: string[] = []
    let id: number | null = folderId
    while (id != null) {
      const f = foldersById.get(id)
      if (!f) break
      names.unshift(f.name)
      id = f.parent_id
    }
    return names.length ? names.join(' / ') : '—'
  }, [foldersById])

  const folderOptions = useMemo(() => {
    const opts = allFolders.map((f) => ({ id: f.id as number | null, label: folderPath(f.id) }))
    opts.sort((a, b) => a.label.localeCompare(b.label))
    return [{ id: null as number | null, label: t('rootLocation') }, ...opts]
  }, [allFolders, folderPath, t])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active' },
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Instructions').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    const q = search.trim().replace(/[,()]/g, ' ').trim()
    if (q) {
      query = query.ilike('title', `%${q}%`)
    } else {
      query = currentFolderId == null ? query.is('folder_id', null) : query.eq('folder_id', currentFolderId)
    }
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total, error } = await query
    if (error) {
      setLoadError(true)
      setLoadErrorDetail(describeSupabaseError(error, { table: 'Instructions', operation: 'load' }).detail)
      setLoading(false)
      return
    }
    setLoadError(false); setLoadErrorDetail(undefined)
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [currentFolderId, search, page, columnFilters, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  const refreshFolders = useCallback(async () => {
    const supabase = createClient()
    const { data: f, error } = await supabase.from('Instruction Folders').select('*').order('name')
    if (!error) setAllFolders(f ?? [])
  }, [])

  const enterFolder = (id: number | null) => { setCurrentFolderId(id); setPage(1) }
  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const handleDownload = async (path: string | null, name: string | null) => {
    if (!path) return
    const supabase = createClient()
    const err = await downloadObject(supabase, path, name || path.split('/').pop() || 'plik')
    if (err) showError(describeSupabaseError({ message: err.message }, { table: 'storage', operation: 'load' }))
  }

  // ── Instrukcja: dodaj (nazwa + lokalizacja + język + plik) / edytuj (metadane) ──
  const openAdd = () => {
    reset({ title: '', notes: '', status: 'active' })
    setEditRow(null); setFormFolderId(currentFolderId); setFormLang('pl'); setFormFile(null); setFileError(null)
    setModalOpen(true)
  }
  const openEdit = (row: Instruction) => {
    reset({ title: row.title ?? '', notes: row.notes ?? '', status: row.status })
    setEditRow(row); setFormFolderId(row.folder_id); setFormLang((row.language as Lang) ?? 'pl'); setFormFile(null); setFileError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    if (!editRow && !formFile) { setFileError(t('fileRequired')); return }
    setSaving(true)
    const supabase = createClient()
    const meta = {
      title: values.title.trim(),
      notes: values.notes?.trim() || null,
      status: values.status,
      language: formLang,
      folder_id: formFolderId,
      updated_at: new Date().toISOString(),
    }

    if (editRow) {
      const { error } = await supabase.from('Instructions').update(meta).eq('id', editRow.id)
      setSaving(false)
      if (error) { showError(describeSupabaseError(error, { table: 'Instructions', operation: 'update' })); return }
      void logActivity(supabase, 'update', 'instructions', editRow.id, meta.title, computeChanges(editRow, values))
      setModalOpen(false); fetchData()
      return
    }

    const { data: created, error } = await supabase.from('Instructions').insert({ ...meta, version: 1 }).select('id').single()
    if (error || !created) { setSaving(false); showError(describeSupabaseError(error ?? { message: 'insert failed' }, { table: 'Instructions', operation: 'insert' })); return }
    const id = created.id as number
    const file = formFile as File
    const path = versionPath(id, 1, fileExt(file.name))
    const up = await uploadObject(supabase, path, file)
    if (up.error) { setSaving(false); showError(describeSupabaseError(up.error, { table: 'storage', operation: 'insert' })); return }
    const { data: auth } = await supabase.auth.getUser()
    const { error: updErr } = await supabase.from('Instructions').update({ file_path: path, file_name: file.name, uploaded_by: auth.user?.id ?? null }).eq('id', id)
    setSaving(false)
    if (updErr) { showError(describeSupabaseError(updErr, { table: 'Instructions', operation: 'update' })); return }
    void logActivity(supabase, 'create', 'instructions', id, meta.title)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Instructions').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); showError(describeSupabaseError(error, { table: 'Instructions', operation: 'delete' })); return }
    void logActivity(supabase, 'delete', 'instructions', deleteRow.id, deleteRow.title ?? '')
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  // ── Foldery ────────────────────────────────────────────────────────────────
  const openNewFolder = () => { setNewFolderName(''); setFolderError(null); setFolderModalOpen(true) }

  const onCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) { setFolderError(t('required')); return }
    setFolderSubmitting(true); setFolderError(null)
    const supabase = createClient()
    const { error } = await supabase.from('Instruction Folders').insert({ name, parent_id: currentFolderId })
    setFolderSubmitting(false)
    if (error) { showError(describeSupabaseError(error, { table: 'Instruction Folders', operation: 'insert' })); return }
    void logActivity(supabase, 'create', 'instructions', null, `${t('folderNew')}: ${name}`)
    setFolderModalOpen(false); setNewFolderName(''); refreshFolders()
  }

  const onDeleteFolder = async () => {
    if (!deleteFolderRow) return
    setDeleteFolderLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Instruction Folders').delete().eq('id', deleteFolderRow.id)
    setDeleteFolderLoading(false)
    if (error) {
      showError(describeSupabaseError(error, { table: 'Instruction Folders', operation: 'delete' }))
      setDeleteFolderRow(null)
      return
    }
    void logActivity(supabase, 'delete', 'instructions', deleteFolderRow.id, `${t('folderNew')}: ${deleteFolderRow.name}`)
    setDeleteFolderRow(null); refreshFolders()
  }

  // ── Nowa wersja pliku ──────────────────────────────────────────────────────
  const openUpload = (row: Instruction) => { setUploadRow(row); setUploadFile(null); setUploadError(null) }

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadRow) return
    if (!uploadFile) { setUploadError(t('fileRequired')); return }
    setUploading(true); setUploadError(null)
    const supabase = createClient()
    const id = uploadRow.id
    const version = (uploadRow.version ?? 1) + 1
    const path = versionPath(id, version, fileExt(uploadFile.name))
    const up = await uploadObject(supabase, path, uploadFile)
    if (up.error) { setUploading(false); showError(describeSupabaseError(up.error, { table: 'storage', operation: 'insert' })); return }
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('Instructions').update({
      file_path: path, file_name: uploadFile.name, version, uploaded_by: auth.user?.id ?? null, updated_at: new Date().toISOString(),
    }).eq('id', id)
    setUploading(false)
    if (error) { showError(describeSupabaseError(error, { table: 'Instructions', operation: 'update' })); return }
    void logActivity(supabase, 'update', 'instructions', id, `${uploadRow.title ?? ''} · v${version}`)
    setUploadRow(null); fetchData()
  }

  // ── Archiwum (starsze wersje pliku) ────────────────────────────────────────
  const openArchive = async (row: Instruction) => {
    setArchiveRow(row); setArchiveFiles([]); setArchiveLoading(true)
    const supabase = createClient()
    const { data, error } = await listVersionFiles(supabase, row.id)
    setArchiveLoading(false)
    if (error) { showError(describeSupabaseError(error, { table: 'storage', operation: 'load' })); return }
    const currentBase = row.file_path ? row.file_path.split('/').pop() : null
    setArchiveFiles((data ?? []).map((o) => ({ name: o.name })).filter((o) => o.name !== currentBase))
  }

  // ── Materiały (pliki towarzyszące: edytowalny SVG, zdjęcia, plik surowy…) ────
  const loadMaterials = async (id: number) => {
    const supabase = createClient()
    const { data, error } = await listMaterials(supabase, id)
    if (error) { showError(describeSupabaseError(error, { table: 'storage', operation: 'load' })); return }
    setMaterialsFiles((data ?? []).filter((o) => o.id != null && o.name !== '.emptyFolderPlaceholder').map((o) => ({ name: o.name })))
  }
  const openMaterials = async (row: Instruction) => {
    setMaterialsRow(row); setMaterialsFiles([]); setMaterialFile(null); setMaterialsLoading(true)
    await loadMaterials(row.id)
    setMaterialsLoading(false)
  }
  const onUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!materialsRow || !materialFile) return
    setMaterialUploading(true)
    const supabase = createClient()
    const { error } = await uploadObject(supabase, `${materialsPrefix(materialsRow.id)}/${materialFile.name}`, materialFile)
    setMaterialUploading(false)
    if (error) { showError(describeSupabaseError(error, { table: 'storage', operation: 'insert' })); return }
    void logActivity(supabase, 'update', 'instructions', materialsRow.id, `${t('materials')}: ${materialFile.name}`)
    setMaterialFile(null)
    await loadMaterials(materialsRow.id)
  }
  const deleteMaterial = async (name: string) => {
    if (!materialsRow) return
    if (!confirm(t('deleteMaterialConfirm', { name }))) return
    const supabase = createClient()
    const { error } = await removeObjects(supabase, [`${materialsPrefix(materialsRow.id)}/${name}`])
    if (error) { showError(describeSupabaseError(error, { table: 'storage', operation: 'delete' })); return }
    void logActivity(supabase, 'delete', 'instructions', materialsRow.id, `${t('materials')}: ${name}`)
    await loadMaterials(materialsRow.id)
  }

  // ── Kolumny ────────────────────────────────────────────────────────────────
  const typeCol: Column<Instruction> = {
    key: 'file_name', header: t('colType'), sortable: false, filterable: false,
    render: (v) => (v ? fileExt(v as string).toUpperCase() : '—'),
  }
  const langCol: Column<Instruction> = {
    key: 'language', header: t('language'), filterOptions: ['pl', 'en', 'es'],
    render: (v) => (v ? String(v).toUpperCase() : '—'),
  }
  const versionCol: Column<Instruction> = {
    key: 'version', header: t('colVersion'), render: (v) => `v${v ?? 1}`,
  }
  const statusCol: Column<Instruction> = {
    key: 'status', header: t('status'), filterOptions: ['active', 'archived'],
    render: (v) => <StatusBadge value={v as string} label={v === 'archived' ? t('statusArchived') : t('statusActive')} />,
  }
  const columns: Column<Instruction>[] = searching
    ? [
        { key: 'title', header: t('name') },
        { key: 'folder_id', header: t('colFolder'), sortable: false, filterable: false, render: (v) => folderPath(v as number | null) },
        typeCol, langCol, versionCol, statusCol,
      ]
    : [
        { key: 'title', header: t('name') },
        typeCol, langCol, versionCol, statusCol,
      ]

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Pasek: breadcrumb + wyszukiwarka */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'var(--text-muted)', minWidth: 0, flexWrap: 'wrap' }}>
          <button
            onClick={() => enterFolder(null)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
            style={{ color: currentFolderId == null && !searching ? 'var(--accent)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Home size={14} /> {t('title')}
          </button>
          {!searching && breadcrumb.map((f) => (
            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ChevronRight size={13} style={{ color: 'var(--text-dim)' }} />
              <button
                onClick={() => enterFolder(f.id)}
                style={{ color: f.id === currentFolderId ? 'var(--accent)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
              >
                {f.name}
              </button>
            </span>
          ))}
          {searching && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ChevronRight size={13} style={{ color: 'var(--text-dim)' }} />
              <span>{t('searchResults')}</span>
            </span>
          )}
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('search')}
            style={{ ...inputStyle, paddingLeft: 30, width: 260 }}
          />
        </div>
      </div>

      {/* Podfoldery */}
      {!searching && subfolders.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {subfolders.map((f) => (
            <div
              key={f.id}
              className="group"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <button
                onClick={() => enterFolder(f.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, fontWeight: 500 }}
              >
                <Folder size={16} style={{ color: 'var(--accent)' }} />
                {f.name}
              </button>
              {canDelete && (
                <button
                  onClick={() => setDeleteFolderRow(f)}
                  title={t('folderDeleteTitle')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'inline-flex' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canWrite && !searching ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Instruction) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Instruction) : undefined}
        rowActions={(row) => {
          const r = row as unknown as Instruction
          return (
            <>
              {r.file_path && (
                <button title={t('downloadFile')} onClick={() => handleDownload(r.file_path, r.file_name)} style={iconBtnStyle}><Download size={13} /></button>
              )}
              {(r.version ?? 1) > 1 && (
                <button title={t('archive')} onClick={() => openArchive(r)} style={iconBtnStyle}><Archive size={13} /></button>
              )}
              {canWrite && (
                <button title={t('upload')} onClick={() => openUpload(r)} style={iconBtnStyle}><Upload size={13} /></button>
              )}
              <button title={t('materials')} onClick={() => openMaterials(r)} style={iconBtnStyle}><Paperclip size={13} /></button>
            </>
          )
        }}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel={t('add')}
        loadError={loadError} loadErrorDetail={loadErrorDetail} onRetry={fetchData}
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
        extraActions={canWrite && !searching ? (
          <button
            onClick={openNewFolder}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <FolderPlus size={14} /> {t('folderNew')}
          </button>
        ) : undefined}
      />

      {/* Modal instrukcji */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? t('modalEdit') : t('modalAdd')} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label={t('name')} error={errors.title ? t('required') : undefined}><input {...register('title')} style={inputStyle} autoFocus /></FormField>
          <FormField label={t('location')}>
            <select value={formFolderId == null ? '' : String(formFolderId)} onChange={(e) => setFormFolderId(e.target.value === '' ? null : Number(e.target.value))} style={inputStyle}>
              {folderOptions.map((o) => (
                <option key={o.id ?? 'root'} value={o.id == null ? '' : String(o.id)}>{o.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('language')}>
            <select value={formLang} onChange={(e) => setFormLang(e.target.value as Lang)} style={inputStyle}>
              <option value="pl">PL</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </FormField>
          <FormField label={t('status')}>
            <select {...register('status')} style={inputStyle}>
              <option value="active">{t('statusActive')}</option>
              <option value="archived">{t('statusArchived')}</option>
            </select>
          </FormField>
          <FormField label={t('notes')}><input {...register('notes')} style={inputStyle} /></FormField>
          {!editRow && (
            <FormField label={t('file')} error={fileError ?? undefined}>
              <FileDropzone file={formFile} onChange={(f) => { setFormFile(f); setFileError(null) }} hint={t('dropHint')} />
            </FormField>
          )}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={saving} />
        </form>
      </Modal>

      {/* Modal nowego folderu */}
      <Modal open={folderModalOpen} onClose={() => setFolderModalOpen(false)} title={t('folderNew')} size="sm">
        <form onSubmit={onCreateFolder} className="flex flex-col gap-4">
          <FormField label={t('folderName')} error={folderError ?? undefined}>
            <input
              value={newFolderName}
              onChange={(e) => { setNewFolderName(e.target.value); setFolderError(null) }}
              style={inputStyle}
              placeholder="np. Kubota"
              autoFocus
              autoComplete="off"
            />
          </FormField>
          <FormActions onCancel={() => setFolderModalOpen(false)} isSubmitting={folderSubmitting} />
        </form>
      </Modal>

      {/* Modal nowej wersji pliku */}
      <Modal open={!!uploadRow} onClose={() => setUploadRow(null)} title={t('uploadTitle')} size="md">
        <form onSubmit={onUpload} className="flex flex-col gap-3">
          <FormField label={t('file')}>
            <FileDropzone file={uploadFile} onChange={(f) => { setUploadFile(f); setUploadError(null) }} hint={t('dropHint')} />
          </FormField>
          {uploadError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{uploadError}</p>}
          <FormActions onCancel={() => setUploadRow(null)} isSubmitting={uploading} submitLabel={t('uploadSubmit')} submittingLabel={t('uploading')} />
        </form>
      </Modal>

      {/* Panel Archiwum — starsze wersje pliku */}
      <Modal open={!!archiveRow} onClose={() => setArchiveRow(null)} title={t('archiveTitle', { name: archiveRow?.title ?? '' })} size="md">
        {archiveLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('archiveLoading')}</p>
        ) : archiveFiles.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{t('archiveEmpty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archiveFiles.map((f) => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button
                  onClick={() => archiveRow && handleDownload(`${archiveRow.id}/${f.name}`, f.name)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', flexShrink: 0 }}
                >
                  <Download size={13} /> {t('downloadFile')}
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Panel Materiały — pliki towarzyszące (edytowalny SVG, zdjęcia, plik surowy…) */}
      <Modal open={!!materialsRow} onClose={() => setMaterialsRow(null)} title={t('materialsTitle', { name: materialsRow?.title ?? '' })} size="md">
        <div className="flex flex-col gap-3">
          {canWrite && (
            <form onSubmit={onUploadMaterial} className="flex flex-col gap-2">
              <FileDropzone file={materialFile} onChange={setMaterialFile} hint={t('dropHint')} />
              {materialFile && (
                <button
                  type="submit"
                  disabled={materialUploading}
                  className="self-end flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                >
                  <Upload size={13} /> {materialUploading ? t('uploading') : t('materialsAdd')}
                </button>
              )}
            </form>
          )}
          {materialsLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('archiveLoading')}</p>
          ) : materialsFiles.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{t('materialsEmpty')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {materialsFiles.map((f) => (
                <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button title={t('downloadFile')} onClick={() => materialsRow && handleDownload(`${materialsPrefix(materialsRow.id)}/${f.name}`, f.name)} style={iconBtnStyle}><Download size={13} /></button>
                    {canDelete && (
                      <button title={t('remove')} onClick={() => deleteMaterial(f.name)} style={{ ...iconBtnStyle, color: 'var(--danger)' }}><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title={t('deleteTitle')}
        description={t('deleteDesc', { name: deleteRow?.title ?? '' })}
      />
      <ConfirmDialog
        open={!!deleteFolderRow}
        onClose={() => setDeleteFolderRow(null)}
        onConfirm={onDeleteFolder}
        loading={deleteFolderLoading}
        title={t('folderDeleteTitle')}
        description={t('folderDeleteDesc', { name: deleteFolderRow?.name ?? '' })}
      />
    </>
  )
}
