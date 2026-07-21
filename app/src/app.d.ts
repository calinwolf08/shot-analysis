// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth } from "$lib/server/auth";

type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** The authenticated user for this request, or null. */
      user: { id: string; email: string; name: string } | null;
      /** The raw better-auth session (user + session), or null. */
      session: Session;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
