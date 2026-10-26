"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Avatar, Badge, Button, ErrorState } from "@/components/ui";
import { adminService } from "@/services/api";
import AddMemberSheet from "./AddMemberSheet";
import MemberSheet from "./MemberSheet";
import { cn } from "@/lib/utils";
import { formatDay, formatUsd } from "./format";

// One grid for the header and every row, so the columns line up.
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_1rem] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_7.5rem_1rem] md:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_1rem]";

function MemberRow({ member, isYou, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(member.id)}
      className={cn(COLUMNS, "group w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-surface-secondary")}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Avatar src={member.avatar_url} name={member.full_name} size="sm" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cn("truncate text-sm font-medium", member.is_active ? "text-heading" : "text-muted")}>
              {member.full_name}
            </span>
            {isYou && <span className="text-xs text-muted">(you)</span>}
            {member.role === "admin" && <Badge size="sm">Admin</Badge>}
            {!member.is_active && <Badge size="sm" variant="danger">Suspended</Badge>}
            {member.ai_assistant_enabled_at && <Badge size="sm" variant="neutral">Workspace AI</Badge>}
          </span>
          <span className="block truncate text-xs text-muted">{member.email}</span>
        </span>
      </span>
      <span className={cn("hidden text-right font-mono text-[0.75rem] tabular-nums sm:block", member.ai_cost_this_month > 0 ? "text-heading" : "text-placeholder")}>
        <span className="sr-only">Workspace AI this month: </span>
        {formatUsd(member.ai_cost_this_month)}
      </span>
      <span className={cn("hidden text-right font-mono text-[0.75rem] tabular-nums md:block", member.last_sign_in_at ? "text-heading" : "text-placeholder")}>
        <span className="sr-only">Latest sign-in: </span>
        {member.last_sign_in_at ? formatDay(member.last_sign_in_at) : <><span aria-hidden="true">—</span><span className="sr-only">never</span></>}
      </span>
      <ChevronRight className="h-4 w-4 text-placeholder transition-colors group-hover:text-muted" aria-hidden="true" />
    </button>
  );
}

function memberCount(members) {
  const total = members.length;
  const active = members.filter((member) => member.is_active).length;
  const people = `${total} member${total === 1 ? "" : "s"}`;
  if (active === total) return total > 1 ? `${people}, all active` : people;
  return `${people}, ${total - active} suspended`;
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

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{members ? memberCount(members) : "Loading members…"}</p>
        <Button leftIcon={<Plus />} onClick={() => setAdding(true)}>Add member</Button>
      </div>

      {!members ? (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => <div key={row} className="skeleton h-14" />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className={cn(COLUMNS, "border-b border-border bg-surface-secondary px-4 py-2 text-[0.6875rem] font-medium text-muted")} aria-hidden="true">
            <span>Member</span>
            <span className="hidden text-right sm:block">AI this month</span>
            <span className="hidden text-right md:block">Latest sign-in</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {members.map((member) => (
              <MemberRow key={member.id} member={member} isYou={member.id === currentUserId} onOpen={setOpenId} />
            ))}
          </div>
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
