import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { ApiError } from '@/lib/apiClient'
import { useAuthStore } from '@/store/useAuthStore'
import type { TeamMember, TeamRole } from '@/api/teamApi'
import { ReassignLeadsDialog } from './ReassignLeadsDialog'
import { AccessChoice, PasswordInput, SaveBar, Section, TeamHeader, ToggleRow } from './teamParts'
import { useRoles, useSetStaffAvailability, useTeam, useUpdateStaff } from './teamQueries'
import { EMAIL_PATTERN, MIN_PASSWORD, SELECT_CLASSES, errorText, staffName } from './teamUtils'

export function StaffEditPage() {
  const { staffId = '' } = useParams<{ staffId: string }>()
  const team = useTeam()
  const roles = useRoles()
  const member = team.data?.find((m) => m.user_id === staffId)

  return (
    <div className="flex h-full flex-col">
      <TeamHeader title={member ? `Edit ${staffName(member)}` : 'Edit staff'} subtitle="Details, role and access." backTo="/admin/staff" />
      {team.isLoading || roles.isLoading ? (
        <PageLoader label="Loading staff…" />
      ) : member && roles.data ? (
        // Keyed so the form starts from this person's saved values.
        <EditForm key={member.user_id} member={member} roles={roles.data} colleagues={(team.data ?? []).filter((m) => m.status === '1' && m.user_id !== member.user_id)} />
      ) : (
        <p className="px-4 py-10 text-center text-[13px] text-[var(--text-muted)]">
          {team.isError || roles.isError ? errorText(team.error ?? roles.error) : 'Staff member not found.'}
        </p>
      )}
    </div>
  )
}

function EditForm({ member, roles, colleagues }: { member: TeamMember; roles: TeamRole[]; colleagues: TeamMember[] }) {
  const navigate = useNavigate()
  const toast = useToast()
  const userId = useAuthStore((s) => s.user?.id)
  const update = useUpdateStaff()
  const availability = useSetStaffAvailability()
  const isSelf = member.user_id === userId
  const isOwner = member.is_owner === true
  // The server only lets an admin set their own password, or a non-admin's.
  const canSetPassword = isSelf || !member.is_admin

  // What the form started from. Kept as it was, so a background refresh of the list doesn't mark fields as changed.
  const [saved] = useState(() => ({
    name: [member.first_name, member.last_name].filter(Boolean).join(' '),
    email: member.user_email ?? '',
    phone: member.user_phone ?? '',
    roleId: roles.find((r) => r.role === member.user_role_type_name)?.id ?? '',
    isAdmin: member.is_admin === true,
    active: member.status === '1',
    leads: member.receives_leads !== false,
  }))
  const [fullName, setFullName] = useState(saved.name)
  const [email, setEmail] = useState(saved.email)
  const [phone, setPhone] = useState(saved.phone)
  const [roleId, setRoleId] = useState(saved.roleId)
  const [isAdmin, setIsAdmin] = useState(saved.isAdmin)
  const [active, setActive] = useState(saved.active)
  const [receivesLeads, setReceivesLeads] = useState(saved.leads)
  const [changingPassword, setChangingPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // True only once the admin types or pastes: an autofilled password is never sent.
  const [passwordTyped, setPasswordTyped] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leadsMessage, setLeadsMessage] = useState<string | null>(null)

  const newPassword = changingPassword && passwordTyped ? password.trim() : ''
  const passwordError = newPassword && newPassword.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : undefined
  const nameError = fullName.trim() ? undefined : 'Enter their name.'
  const emailError = EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address.'

  const changed = {
    name: fullName.trim() !== saved.name,
    email: email.trim() !== saved.email,
    phone: phone.trim() !== saved.phone,
    role: roleId !== saved.roleId,
    admin: isAdmin !== saved.isAdmin,
    active: active !== saved.active,
    leads: receivesLeads !== saved.leads,
    password: newPassword.length > 0,
  }
  const changeCount = Object.values(changed).filter(Boolean).length
  const valid = !passwordError && !(changed.name && nameError) && !(changed.email && emailError)
  const done = () => navigate('/admin/staff')

  // Saved in order: profile, then "Gets new leads" (its own endpoint), then the account status last:
  // deactivating someone with open leads is refused until the leads are moved, and that mustn't lose the rest.
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || saving || changeCount === 0) return
    setSaving(true)
    try {
      // Only what changed is sent.
      const patch = {
        ...(changed.name ? { full_name: fullName.trim() } : {}),
        ...(changed.email ? { email: email.trim() } : {}),
        ...(changed.phone ? { phone: phone.trim() } : {}),
        ...(changed.role && roleId ? { role_id: roleId } : {}),
        ...(changed.admin ? { is_admin: isAdmin } : {}),
        ...(changed.password ? { password: newPassword } : {}),
      }
      if (Object.keys(patch).length > 0) await update.mutateAsync({ userId: member.user_id, patch })
      if (changed.leads) await availability.mutateAsync({ userId: member.user_id, patch: { receives_leads: receivesLeads } })
      if (changed.active) {
        try {
          await update.mutateAsync({ userId: member.user_id, patch: { status: active } })
        } catch (err) {
          // Open leads: ask where they should go. Everything else is already saved.
          if (!active && err instanceof ApiError && err.status === 400) {
            setLeadsMessage(err.message)
            return
          }
          throw err
        }
      }
      toast.show({ title: 'Changes saved', tone: 'success' })
      done()
    } catch (err) {
      toast.show({ title: errorText(err), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={(e) => void save(e)} noValidate autoComplete="off" className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:px-6">
            <Section title="Profile" hint="Their details and sign-in.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *" error={changed.name ? nameError : undefined}>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
                </Field>
                <Field label="Phone">
                  <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
                </Field>
              </div>
              <Field label="Email *" hint="Also their sign-in email." error={changed.email ? emailError : undefined}>
                <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </Field>
              {!canSetPassword ? (
                <p className="rounded-lg bg-[var(--surface-hover)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">Another admin’s password can’t be changed here.</p>
              ) : changingPassword ? (
                <Field label="New password" hint={`At least ${MIN_PASSWORD} characters. Share it with them yourself.`} error={passwordError}>
                  <div className="flex gap-2">
                    <PasswordInput
                      show={showPassword}
                      onShowChange={setShowPassword}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={() => setPasswordTyped(true)}
                      onPaste={() => setPasswordTyped(true)}
                      onDrop={() => setPasswordTyped(true)}
                      onBeforeInput={() => setPasswordTyped(true)}
                      placeholder="Type a new password"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 shrink-0"
                      onClick={() => {
                        setChangingPassword(false)
                        setPassword('')
                        setPasswordTyped(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </Field>
              ) : (
                <Button type="button" variant="outline" onClick={() => setChangingPassword(true)}>
                  <KeyRound size={14} /> Set new password
                </Button>
              )}
            </Section>

            <Section title="Access" hint="What this person can see and do.">
              {isOwner ? (
                <p className="rounded-lg bg-[var(--surface-hover)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">Business owner: always has full access.</p>
              ) : (
                <>
                  <AccessChoice isAdmin={isAdmin} onChange={setIsAdmin} disabled={isSelf && saved.isAdmin} />
                  {isSelf && saved.isAdmin && <p className="text-[12px] text-[var(--text-muted)]">You can’t remove your own admin access.</p>}
                </>
              )}
              <Field label="Role" hint={isAdmin ? 'Kept for reports and filters; admins are not limited by it.' : undefined}>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={SELECT_CLASSES}>
                  {!saved.roleId && <option value="">No role</option>}
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.role}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            <Section title="Account" hint="Sign-in and new leads.">
              <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                <ToggleRow
                  title="Active account"
                  text={
                    isOwner || isSelf
                      ? isOwner
                        ? 'The owner’s account stays active.'
                        : 'You can’t deactivate your own account.'
                      : active
                        ? 'Can sign in and get leads.'
                        : 'Can’t sign in or get leads. Open leads must be moved first.'
                  }
                  checked={active}
                  onChange={setActive}
                  // Switching an account back on stays possible; only switching off is locked.
                  disabled={(isOwner || isSelf) && saved.active}
                />
                <ToggleRow title="Gets new leads" text="Off = no new leads in any pipeline. The person isn’t told." checked={receivesLeads} onChange={setReceivesLeads} />
              </div>
            </Section>
          </div>
        </div>

        <SaveBar note={changeCount === 0 ? 'No changes yet' : `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`}>
          <Button type="button" variant="secondary" onClick={done} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || saving || changeCount === 0}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </SaveBar>
      </form>

      {leadsMessage !== null && (
        // Either way the other changes are saved, so both lead back to the list.
        <ReassignLeadsDialog member={member} colleagues={colleagues} message={leadsMessage} onCancel={done} onDone={done} />
      )}
    </>
  )
}
