import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { AccessChoice, PasswordInput, SaveBar, Section, TeamHeader } from './teamParts'
import { useCreateStaff, useRoles } from './teamQueries'
import { EMAIL_PATTERN, MIN_PASSWORD, SELECT_CLASSES, errorText, generatePassword } from './teamUtils'

interface Created {
  id: string
  name: string
  email: string
  password: string
}

export function StaffAddPage() {
  const [created, setCreated] = useState<Created | null>(null)
  return (
    <div className="flex h-full flex-col">
      <TeamHeader title="Add staff" subtitle="Create a login for a teammate." backTo="/admin/staff" />
      {created ? <CreatedPanel created={created} onAddAnother={() => setCreated(null)} /> : <AddForm onCreated={setCreated} />}
    </div>
  )
}

function AddForm({ onCreated }: { onCreated: (created: Created) => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: roles = [], isLoading: loadingRoles } = useRoles()
  const create = useCreateStaff()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pickedRoleId, setPickedRoleId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // True only once the admin types, pastes or generates one: a browser may autofill the admin's own password here.
  const [passwordTyped, setPasswordTyped] = useState(false)
  const [triedSave, setTriedSave] = useState(false)

  const roleId = pickedRoleId || roles[0]?.id || ''
  const entered = passwordTyped ? password.trim() : ''
  const errors = {
    name: fullName.trim() ? undefined : 'Enter their name.',
    email: !email.trim() ? 'Enter the email they will sign in with.' : EMAIL_PATTERN.test(email.trim()) ? undefined : 'This doesn’t look like an email address.',
    role: roleId || loadingRoles ? undefined : 'Create a role first (Admin → Roles & Permissions).',
    password:
      password && !passwordTyped
        ? 'Your browser filled this in. Type or generate a password for them instead.'
        : !entered
          ? 'Set a password, or generate one.'
          : entered.length < MIN_PASSWORD
            ? `Use at least ${MIN_PASSWORD} characters.`
            : undefined,
  }
  const shown = (key: keyof typeof errors) => (triedSave ? errors[key] : undefined)
  const valid = !!roleId && !Object.values(errors).some(Boolean)

  function submit(e: FormEvent) {
    e.preventDefault()
    setTriedSave(true)
    if (!valid || create.isPending) return
    const name = fullName.trim()
    create.mutate(
      { full_name: name, email: email.trim(), phone: phone.trim(), password: entered, role_id: roleId, is_admin: isAdmin },
      {
        onSuccess: (member) => {
          toast.show({ title: `${name} added`, tone: 'success' })
          onCreated({ id: member.user_id, name, email: email.trim(), password: entered })
        },
        onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:px-6">
          <Section title="Profile" hint="Their details and sign-in.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name *" error={shown('name')}>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Riya Sharma" className="h-11" />
              </Field>
              <Field label="Phone">
                <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="h-11" />
              </Field>
            </div>
            <Field label="Email *" hint="They sign in with this." error={shown('email')}>
              <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-11" />
            </Field>
            <Field label="Password *" hint={`At least ${MIN_PASSWORD} characters. You can copy it after adding them.`} error={shown('password')}>
              <div className="flex gap-2">
                <PasswordInput
                  show={showPassword}
                  onShowChange={setShowPassword}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={() => setPasswordTyped(true)}
                  onPaste={() => setPasswordTyped(true)}
                  onDrop={() => setPasswordTyped(true)}
                  // Phone keyboards don't always send key events; typing into the focused box counts too.
                  onBeforeInput={() => setPasswordTyped(true)}
                  placeholder="Password"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 shrink-0"
                  onClick={() => {
                    setPassword(generatePassword())
                    setPasswordTyped(true)
                    // A generated password is shown, so it can be checked.
                    setShowPassword(true)
                  }}
                >
                  <RefreshCw size={14} /> Generate
                </Button>
              </div>
            </Field>
          </Section>

          <Section title="Access" hint="What this person can see and do.">
            <AccessChoice isAdmin={isAdmin} onChange={setIsAdmin} />
            <Field label="Role *" hint={isAdmin ? 'Kept for reports and filters; admins are not limited by it.' : undefined} error={shown('role')}>
              <select value={roleId} onChange={(e) => setPickedRoleId(e.target.value)} className={SELECT_CLASSES}>
                {roles.length === 0 && <option value="">{loadingRoles ? 'Loading roles…' : 'No roles available'}</option>}
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.role}
                  </option>
                ))}
              </select>
            </Field>
          </Section>
        </div>
      </div>

      <SaveBar note={triedSave && !valid ? <span className="font-medium text-[var(--error)]">Fix the highlighted fields.</span> : 'They can sign in as soon as they are added.'}>
        <Button type="button" variant="secondary" onClick={() => navigate('/admin/staff')} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add staff'}
        </Button>
      </SaveBar>
    </form>
  )
}

/** The sign-in details to hand over, shown once. */
function CreatedPanel({ created, onAddAnother }: { created: Created; onAddAnother: () => void }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const link = window.location.origin
  const details = `Your CRM login\nLink: ${link}\nEmail: ${created.email}\nPassword: ${created.password}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
    } catch {
      toast.show({ title: 'Couldn’t copy. Select the details and copy them by hand.', tone: 'error' })
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <div className="rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
          <div className="border-b border-[var(--border)] p-4">
            <h2 className="text-[16px] font-semibold text-[var(--text-h)]">{created.name} is added</h2>
            <p className="text-[12.5px] text-[var(--text-muted)]">Send them these sign-in details. The password isn’t shown again.</p>
          </div>
          <dl className="space-y-3 p-4 text-[13.5px]">
            {[
              { label: 'Link', value: link },
              { label: 'Email', value: created.email },
              { label: 'Password', value: created.password },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[12px] text-[var(--text-muted)]">{row.label}</dt>
                <dd className="select-all break-all font-mono-num text-[var(--text-h)]">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2 border-t border-[var(--border)] p-4">
            <Button className="justify-center" onClick={() => void copy()}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy sign-in details'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="justify-center" onClick={onAddAnother}>
                Add another
              </Button>
              <Link
                to="/admin/staff"
                className="flex h-10 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
              >
                Back to staff
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
