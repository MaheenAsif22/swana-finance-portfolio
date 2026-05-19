import { create } from 'zustand';

export const useTxStore = create((set) => ({
  pending: [],
  setPending:    (pending)  => set({ pending }),
  addTx:         (tx)       => set((s) => ({ pending: tx.status === 'pending' ? [tx, ...s.pending] : s.pending })),
  updateTx:      (updated)  => set((s) => ({
    pending: s.pending.filter((t) => t.id !== updated.id),
  })),
  removePending: (id)       => set((s) => ({ pending: s.pending.filter((t) => t.id !== id) })),
}));
