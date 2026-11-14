import { getContext, setContext } from "svelte";
import type { AuthStore } from "./auth-store.svelte";

const KEY = Symbol("auth-store");

/** Call during root +layout.svelte component init. */
export function provideAuth(store: AuthStore): void {
  setContext(KEY, store);
}

/** Call during any child component's init. */
export function useAuth(): AuthStore {
  const store = getContext<AuthStore | undefined>(KEY);
  if (!store) {
    throw new Error(
      "AuthStore not provided — is this component rendered under the app layout (or a test providing auth)?",
    );
  }
  return store;
}
