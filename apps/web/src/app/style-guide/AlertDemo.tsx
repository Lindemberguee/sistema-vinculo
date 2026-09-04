"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";

export function AlertDemo() {
  const [show, setShow] = useState(true);
  if (!show) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setShow(true)}>
        Restaurar alerta dispensável
      </Button>
    );
  }
  return (
    <Alert
      tone="success"
      icon={<CheckCircle2 className="size-4" />}
      title="Alerta dispensável"
      onDismiss={() => setShow(false)}
    >
      Clique no × para fechar.
    </Alert>
  );
}
