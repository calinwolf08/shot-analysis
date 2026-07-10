/** Tiny toast store (rune-based). */
export interface ToastMessage {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

let nextId = 1;

class ToastStore {
  messages = $state<ToastMessage[]>([]);

  show(text: string, kind: ToastMessage["kind"] = "info", ttlMs = 3500): void {
    const id = nextId++;
    this.messages = [...this.messages, { id, text, kind }];
    setTimeout(() => this.dismiss(id), ttlMs);
  }

  dismiss(id: number): void {
    this.messages = this.messages.filter((m) => m.id !== id);
  }
}

export const toasts = new ToastStore();
