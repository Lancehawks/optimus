"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, Toggle, useToast } from "@/components/ui";
import { TIMEZONE_OPTIONS } from "@/constants";
import { adminService } from "@/services/api";
import { formatDay, formatUsd } from "./format";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

function formFrom(member) {
  return {
    fullName: member.full_name,
    email: member.email,
    timezone: member.timezone,
    role: member.role,
    isActive: member.is_active,
    assistantEnabled: Boolean(member.ai_assistant_enabled_at),
    password: "",
  };
}

// Only fields that changed are sent, so saving never rewrites what an admin
// didn't touch.
function changesBetween(member, form) {
  const original = formFrom(member);
  const changes = {};
  for (const key of ["fullName", "email", "timezone", "role", "isActive", "assistantEnabled"]) {
    if (form[key] !== original[key]) changes[key] = form[key];
  }
  if (form.password) changes.password = form.password;
  return changes;
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-heading">{value}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-overline">{title}</h3>
      {children}
    </section>
  );
}

export default function MemberSheet({ memberId, isYou, onClose, onSaved }) {
  const { addToast } = useToast();
  const [member, setMember] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!memberId) return undefined;
    let cancelled = false;
    setMember(null);
    setForm(null);
    setLoadError(null);
    setSaveError(null);
    adminService.getMember(memberId)
      .then((data) => {
        if (cancelled) return;
        setMember(data.member);
        setForm(formFrom(data.member));
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [memberId]);

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const changes = member && form ? changesBetween(member, form) : {};
  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async (event) => {
    event.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data = await adminService.updateMember(member.id, changes);
      setMember(data.member);
      setForm(formFrom(data.member));
      onSaved(data.member);
      addToast({ message: changes.password ? "Saved. They'll need the new password to sign in." : "Member updated", type: "success" });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(memberId)}
      onClose={onClose}
      title={member?.full_name || "Member"}
      description={member?.email}
      placement="right"
      size="md"
      footer={form ? (
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button type="submit" form="member-sheet-form" isLoading={saving} disabled={!hasChanges}>Save changes</Button>
        </>
      ) : null}
    >
      {loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
      {!form && !loadError && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((row) => <div key={row} className="skeleton h-10" />)}
        </div>
      )}
      {form && (
        <form id="member-sheet-form" onSubmit={handleSave} className="space-y-6">
          <Section title="Access">
            {isYou && (
              <p className="mb-3 text-xs text-muted">This is you. Another admin has to change your role or suspend you.</p>
            )}
            <div className="space-y-4">
              <Select
                label="Role"
                id="member-role"
                value={form.role}
                onChange={(event) => update("role")(event.target.value)}
                options={ROLE_OPTIONS}
                disabled={isYou}
                hint="Admins can add and manage members and see assistant usage."
              />
              <div>
                <Toggle checked={form.isActive} onChange={update("isActive")} disabled={isYou} label="Can sign in" />
                {!form.isActive && (
                  <p className="mt-1.5 pl-[2.875rem] text-xs text-muted">Suspended. Saving signs them out of every device.</p>
                )}
              </div>
              <div>
                <Toggle checked={form.assistantEnabled} onChange={update("assistantEnabled")} label="Can use the workspace AI key" />
                <p className="mt-1.5 pl-[2.875rem] text-xs text-muted">
                  {member.ai_assistant_enabled_at && form.assistantEnabled
                    ? `Turned on ${member.ai_assistant_enabled_by ? `by ${member.ai_assistant_enabled_by} ` : ""}on ${formatDay(member.ai_assistant_enabled_at)}. The workspace pays for their assistant use.`
                    : "The workspace pays for their assistant use. Members with their own key can use the assistant either way."}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Profile">
            <div className="space-y-4">
              <Input label="Full name" id="member-name" value={form.fullName} onChange={(event) => update("fullName")(event.target.value)} required maxLength={150} />
              <Input label="Email" id="member-email" type="email" value={form.email} onChange={(event) => update("email")(event.target.value)} required />
              <Select label="Timezone" id="member-timezone" value={form.timezone} onChange={(event) => update("timezone")(event.target.value)} options={
                TIMEZONE_OPTIONS.some((option) => option.value === form.timezone)
                  ? TIMEZONE_OPTIONS
                  : [{ value: form.timezone, label: form.timezone }, ...TIMEZONE_OPTIONS]
              } />
            </div>
          </Section>

          <Section title="Password">
            <Input
              label="Set a new password"
              id="member-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => update("password")(event.target.value)}
              minLength={8}
              maxLength={128}
              hint="Leave empty to keep their password. A new one signs them out everywhere; share it with them privately."
            />
          </Section>

          <Section title="Activity">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Fact label="Tasks" value={member.activity.tasks} />
              <Fact label="Notes" value={member.activity.notes} />
              <Fact label="Projects" value={member.activity.projects} />
              <Fact label="Events" value={member.activity.events} />
              <Fact label="Signed-in devices" value={member.activity.active_sessions} />
              <Fact label="Conversations" value={member.activity.conversations} />
              <Fact label="Workspace AI this month" value={formatUsd(member.ai_cost_this_month)} />
              <Fact label="Workspace AI all time" value={formatUsd(member.ai_cost_all_time)} />
              <Fact label="Member since" value={formatDay(member.created_at)} />
            </dl>
            <p className="mt-3 text-xs text-muted">Counts only. Admins can&apos;t open a member&apos;s tasks, notes or conversations.</p>
          </Section>

          {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
        </form>
      )}
    </Modal>
  );
}
