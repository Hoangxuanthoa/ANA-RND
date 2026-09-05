"use client";

import { useState } from "react";
import type { Product } from "@/lib/mock-data";
import { ExclusiveWarningModal } from "@/components/ExclusiveWarningModal";

// Shared by every "pick this product" flow (project picker, add-to-
// collection): wraps the actual action so it pauses on an Exclusive
// product someone else marked, showing who to ask first — see
// ExclusiveWarningModal for why this is a soft warning, not a block.
export function useExclusiveGuard(userName: string) {
  const [pending, setPending] = useState<{ product: Product; onProceed: () => void } | null>(null);

  function guardPick(product: Product, onProceed: () => void) {
    if (product.reuse === "EXCLUSIVE" && product.exclusiveBy && product.exclusiveBy !== userName) {
      setPending({ product, onProceed });
    } else {
      onProceed();
    }
  }

  const guardModal = pending ? (
    <ExclusiveWarningModal
      open
      productName={pending.product.name}
      exclusiveBy={pending.product.exclusiveBy!}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        pending.onProceed();
        setPending(null);
      }}
    />
  ) : null;

  return { guardPick, guardModal };
}
