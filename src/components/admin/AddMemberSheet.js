"use client";

import { useState } from "react";
import { Button, Input, Modal, Select, Toggle, useToast } from "@/components/ui";
import { TIMEZONE_OPTIONS } from "@/constants";
import { adminService } from "@/services/api";

const EMPTY = { fullName: "", email: "", password: "", role: "member", timezone: "UTC", assistantEnabled: false };

export default function AddMemberSheet({ isOpen, onClose, onCreated }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const close = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await adminService.createMember(form);
      addToast({ message: `${data.member.full_name} can now sign in with the password you set`, type: "success" });
      setForm(EMPTY);
      onCreated(data.member);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add member"
      description="They sign in with this email and password. To let someone choose their own password, send an invitation from Settings."
      placement="right"
      size="md"
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" form="add-member-form" isLoading={saving}>Add member</Button>
        </>
      )}
    >
      <form id="add-member-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full name" id="new-member-name" value={form.fullName} onChange={(event) => update("fullName")(event.target.value)} required maxLength={150} />
        <Input label="Email" id="new-member-email" type="email" value={form.email} onChange={(event) => update("email")(event.target.value)} required />
        <Input
          label="Password"
          id="new-member-password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => update("password")(event.target.value)}
          required
          minLength={8}
          maxLength={128}
          hint="At least 8 characters. Share it with them privately; they can change it in Settings."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Role" id="new-member-role" value={form.role} onChange={(event) => update("role")(event.target.value)} options={[
            { value: "member", label: "Member" },
            { value: "admin", label: "Admin" },
          ]} />
          <Select label="Timezone" id="new-member-timezone" value={form.timezone} onChange={(event) => update("timezone")(event.target.value)} options={TIMEZONE_OPTIONS} />
        </div>
        <Toggle checked={form.assistantEnabled} onChange={update("assistantEnabled")} label="Can use the assistant" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
