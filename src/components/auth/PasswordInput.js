"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";

export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      size="lg"
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="pointer-events-auto flex cursor-pointer text-placeholder transition-colors hover:text-heading"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      }
    />
  );
}
