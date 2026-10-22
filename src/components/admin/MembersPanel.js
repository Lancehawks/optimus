"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Avatar, Badge, Button, ErrorState } from "@/components/ui";
import { adminService } from "@/services/api";
import AddMemberSheet from "./AddMemberSheet";
import MemberSheet from "./MemberSheet";
import { formatDay, formatUsd } from "./format";

function MemberRow({ member, isYou, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(member.id)}
      className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-secondary"
    >
      <Avatar src={member.avatar_url} name={member.full_name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-heading">{member.full_name}</span>
          {isYou && <span className="text-xs text-muted">(you)</span>}
          {member.role === "admin" && <Badge size="sm">Admin</Badge>}
          {!member.is_active && <Badge size="sm" variant="danger">Suspended</Badge>}
          {member.ai_assistant_enabled_at && <Badge size="sm" variant="neutral">Assistant on</Badge>}
        </span>
        <span className="block truncate text-xs text-muted">{member.email}</span>
      </span>
      <span className="hidden w-28 shrink-0 text-right sm:block">
        <span className="block font-mono text-[0.75rem] tabular-nums text-heading">{formatUsd(member.ai_cost_this_month)}</span>
        <span className="block text-[0.6875rem] text-muted">assistant this month</span>
      </span>
      <span className="hidden w-28 shrink-0 text-right md:block">
        <span className="block font-mono text-[0.75rem] tabular-nums text-heading">{formatDay(member.last_sign_in_at)}</span>
        <span className="block text-[0.6875rem] text-muted">latest sign-in</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-placeholder transition-colors group-hover:text-muted" />
    </button>
  );
}

export default function MembersPanel({ currentUserId }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.listMembers();
      setMembers(data.members);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceMember = (updated) => {
    setMembers((current) => {
      if (!current) return current;
      const exists = current.some((member) => member.id === updated.id);
      return exists ? current.map((member) => (member.id === updated.id ? { ...member, ...updated } : member)) : [...current, updated];
    });
  };

  if (error && !members) {
    return <ErrorState title="Couldn't load members" description={error} onRetry={load} />;
  }

  const activeCount = members?.filter((member) => member.is_active).length ?? 0;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {members ? `${activeCount} active of ${members.length} members` : "Loading members…"}
        </p>
        <Button leftIcon={<Plus />} onClick={() => setAdding(true)}>Add member</Button>
      </div>

      {!members ? (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => <div key={row} className="skeleton h-14" />)}
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} isYou={member.id === currentUserId} onOpen={setOpenId} />
          ))}
        </div>
      )}

      <MemberSheet
        memberId={openId}
        isYou={openId === currentUserId}
        onClose={() => setOpenId(null)}
        onSaved={replaceMember}
      />
      <AddMemberSheet
        isOpen={adding}
        onClose={() => setAdding(false)}
        onCreated={(member) => {
          replaceMember(member);
          setAdding(false);
          setOpenId(member.id);
        }}
      />
    </section>
  );
}
