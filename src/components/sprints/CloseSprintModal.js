"use client";

import { useEffect, useState } from "react";
import { Button, Modal, Select, useToast } from "@/components/ui";
import { sprintService } from "@/services/api";

/** Closes the active sprint and decides where its unfinished tasks go. */
export default function CloseSprintModal({ isOpen, onClose, sprint, plannedSprints, onClosed }) {
  const { addToast } = useToast();
  const [target, setTarget] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) setTarget(plannedSprints[0]?.id || "");
  }, [isOpen, plannedSprints]);

  if (!sprint) return null;
  const unfinished = sprint.task_count - sprint.done_count;

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await sprintService.complete(sprint.id, unfinished > 0 ? target || null : null);
      addToast({ message: `${sprint.name} closed`, type: "success" });
      onClosed?.();
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Close ${sprint.name}`}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isClosing}>Cancel</Button>
          <Button onClick={handleClose} isLoading={isClosing}>Close sprint</Button>
        </>
      )}
    >
      <p className="text-sm text-body">
        {sprint.done_count} of {sprint.task_count} {sprint.task_count === 1 ? "task" : "tasks"} done.
        {unfinished === 0 && sprint.task_count > 0 && " Nothing left over."}
      </p>
      {unfinished > 0 && (
        <div className="mt-4">
          <Select
            id="sprintCarryOver"
            label={`Move ${unfinished} unfinished ${unfinished === 1 ? "task" : "tasks"} to`}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            options={[
              ...plannedSprints.map((planned) => ({ value: planned.id, label: planned.name })),
              { value: "", label: "Backlog" },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
