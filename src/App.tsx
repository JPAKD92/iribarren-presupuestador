import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type { Presupuesto } from './types'

const USERS: Record<string, string> = { marcos: 'marcos' }

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (USERS[user.toLowerCase()] === pass) {
      localStorage.setItem('irb_auth', '1')
      onLogin()
    } else {
      setErr('Usuario o contraseña incorrectos')
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-text" style={{ fontSize: '2.2rem', marginBottom: 4 }}>iribarren</div>
        <div className="logo-sub" style={{ color: '#9B50DE', marginBottom: 28 }}>Tornería · Presupuestador</div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Usuario</label>
            <input type="text" value={user} onChange={e => { setUser(e.target.value); setErr('') }} autoComplete="username" autoCapitalize="none" />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={pass} onChange={e => { setPass(e.target.value); setErr('') }} autoComplete="current-password" />
          </div>
          {err && <div className="error-msg">{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  )
}

type View = 'list' | 'form' | 'print'

function generarNumero(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  return `101-${dd}${mm}${hh}`
}

function fechaHoy(): string {
  return new Date().toISOString().split('T')[0]
}

function formatFecha(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatTotal(val: string): string {
  if (!val) return ''
  const n = parseFloat(val)
  if (isNaN(n)) return val
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const emptyForm = (): Presupuesto => ({
  numero: generarNumero(),
  fecha: fechaHoy(),
  cliente: '',
  trabajo: '',
  total: '',
  observaciones: '',
})

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('irb_auth') === '1')
  const [view, setView] = useState<View>('list')
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [form, setForm] = useState<Presupuesto>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [printData, setPrintData] = useState<Presupuesto | null>(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const loadPresupuestos = useCallback(async () => {
    setListLoading(true)
    const { data, error } = await supabase
      .from('presupuestos_iribarren')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setPresupuestos(data as Presupuesto[])
    setListLoading(false)
  }, [])

  useEffect(() => { loadPresupuestos() }, [loadPresupuestos])

  function newPresupuesto() {
    setForm(emptyForm())
    setEditingId(null)
    setError('')
    setSaved(false)
    setView('form')
  }

  function editPresupuesto(p: Presupuesto) {
    setForm({ ...p })
    setEditingId(p.id ?? null)
    setError('')
    setSaved(false)
    setView('form')
  }

  async function savePresupuesto(): Promise<Presupuesto | null> {
    setLoading(true)
    setError('')
    const payload = {
      numero: form.numero,
      fecha: form.fecha || fechaHoy(),
      cliente: form.cliente,
      trabajo: form.trabajo,
      total: form.total,
      observaciones: form.observaciones,
      updated_at: new Date().toISOString(),
    }
    let result: Presupuesto | null = null
    if (editingId) {
      const { data, error } = await supabase
        .from('presupuestos_iribarren')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()
      if (error) { setError(error.message); setLoading(false); return null }
      result = data as Presupuesto
    } else {
      const { data, error } = await supabase
        .from('presupuestos_iribarren')
        .insert(payload)
        .select()
        .single()
      if (error) { setError(error.message); setLoading(false); return null }
      result = data as Presupuesto
      setEditingId(result.id ?? null)
    }
    setSaved(true)
    await loadPresupuestos()
    setLoading(false)
    return result
  }

  async function handleSave() {
    await savePresupuesto()
  }

  async function handlePrintFromForm() {
    const saved = await savePresupuesto()
    if (!saved) return
    setPrintData(saved)
    setView('print')
    setTimeout(() => window.print(), 400)
  }

  function handlePrintFromList(p: Presupuesto) {
    setPrintData(p)
    setView('print')
    setTimeout(() => window.print(), 400)
  }

  async function deletePresupuesto(id: string) {
    if (!confirm('¿Eliminar este presupuesto?')) return
    await supabase.from('presupuestos_iribarren').delete().eq('id', id)
    await loadPresupuestos()
  }

  function backToList() {
    setView('list')
    setPrintData(null)
  }

  const [search, setSearch] = useState('')

  const filtered = presupuestos.filter(p => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      p.cliente?.toLowerCase().includes(q) ||
      p.trabajo?.toLowerCase().includes(q) ||
      p.numero?.toLowerCase().includes(q) ||
      formatFecha(p.fecha).includes(q)
    )
  })

  const current = printData ?? form

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  return (
    <>
      {/* PRINT DOC — visible only when @media print */}
      <div className="print-watermark" aria-hidden="true" />
      <div className="print-doc">
        <PrintDocument p={current} />
      </div>

      {/* SCREEN UI */}
      <header className="app-header no-print">
        <img src="/logo.png" alt="Iribarren" className="header-logo" />
        <div className="logo-sub">Tornería</div>
        <div className="header-contact">📞 11 6589-3817</div>
      </header>

      <main className="page no-print">
        {view === 'list' && (
          <>
            <div className="list-toolbar">
              <h2>Presupuestos</h2>
              <button className="btn btn-primary" onClick={newPresupuesto}>
                + Nuevo
              </button>
            </div>

            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar por cliente, trabajo o fecha..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>

            {listLoading ? (
              <div className="loading-overlay">
                <div className="spinner" style={{ borderTopColor: 'var(--purple)', borderColor: 'var(--purple-border)' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <p>{search ? 'Sin resultados para esa búsqueda' : 'No hay presupuestos guardados'}</p>
              </div>
            ) : (
              filtered.map(p => (
                <div key={p.id} className="presupuesto-card">
                  <div className="card-top">
                    <span className="card-numero">{p.numero}</span>
                    <span className="card-fecha">{formatFecha(p.fecha)}</span>
                  </div>
                  {p.cliente && <div className="card-cliente">{p.cliente}</div>}
                  {p.trabajo && <div className="card-trabajo">{p.trabajo}</div>}
                  {p.total && <div className="card-total">$ {formatTotal(p.total)}</div>}
                  <div className="card-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => editPresupuesto(p)}>✏️ Editar</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handlePrintFromList(p)}>🖨️ Imprimir</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deletePresupuesto(p.id!)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {view === 'form' && (
          <>
            <div className="form-header">
              <button className="btn btn-ghost btn-sm" onClick={backToList}>← Volver</button>
              <h2>{editingId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h2>
            </div>

            <div className="presupuesto-meta">
              <span className="meta-numero">{form.numero}</span>
              <span className="meta-fecha">{formatFecha(form.fecha)}</span>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">✓ Guardado correctamente</div>}

            <div className="form-card">
              <div className="form-group">
                <label>Cliente</label>
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={form.cliente}
                  onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Trabajo a realizar</label>
                <textarea
                  placeholder="Descripción del trabajo..."
                  value={form.trabajo}
                  onChange={e => setForm(f => ({ ...f, trabajo: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Total</label>
                <div className="input-money">
                  <span>$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={form.total}
                    onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  placeholder="Notas adicionales, condiciones, validez del presupuesto..."
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={handleSave} disabled={loading}>
                {loading ? <span className="spinner" /> : '💾 Guardar'}
              </button>
              <button className="btn btn-primary" onClick={handlePrintFromForm} disabled={loading}>
                {loading ? <span className="spinner" /> : '🖨️ Guardar e Imprimir'}
              </button>
            </div>
          </>
        )}

        {view === 'print' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 16 }}>Preparando impresión...</p>
            <button className="btn btn-outline" onClick={backToList}>← Volver a la lista</button>
          </div>
        )}
      </main>
    </>
  )
}

function PrintDocument({ p }: { p: Presupuesto }) {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#1a1a2e', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #7B2FBE', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', 'Arial Black', sans-serif", fontStyle: 'italic', fontWeight: 900, fontSize: '2.6rem', color: '#6B00CC', lineHeight: 1 }}>
            iribarren
          </div>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: '#9B50DE', textTransform: 'uppercase', marginTop: 2 }}>
            Tornería
          </div>
          <div style={{ fontSize: '0.82rem', color: '#555', marginTop: 4 }}>📞 11 6589-3817</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7B2FBE', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em' }}>
            PRESUPUESTO
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: '#3d0080' }}>
            {p.numero}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 2 }}>
            Fecha: {formatFecha(p.fecha)}
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ background: '#f5eeff', borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B50DE', fontWeight: 600, marginBottom: 4 }}>Cliente</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 600 }}>{p.cliente || '—'}</div>
      </div>

      {/* Trabajo */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B50DE', fontWeight: 600, marginBottom: 8 }}>Trabajo a realizar</div>
        <div style={{ fontSize: '0.97rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', borderLeft: '3px solid #d4b0f0', paddingLeft: 14, color: '#2a2a3e' }}>
          {p.trabajo || '—'}
        </div>
      </div>

      {/* Total */}
      <div style={{ background: '#3d0080', color: '#fff', borderRadius: 8, padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', letterSpacing: '0.05em', opacity: 0.85 }}>TOTAL</span>
        <span style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {p.total ? `$ ${formatTotal(p.total)}` : '—'}
        </span>
      </div>

      {/* Observaciones */}
      {p.observaciones && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9B50DE', fontWeight: 600, marginBottom: 8 }}>Observaciones</div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', color: '#444' }}>
            {p.observaciones}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e0d0f5', paddingTop: 14, marginTop: 32, fontSize: '0.75rem', color: '#aaa', textAlign: 'center' }}>
        Iribarren Tornería · 11 6589-3817
      </div>
    </div>
  )
}
