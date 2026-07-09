import { getContext, setContext } from "svelte";
import type { AppServices } from "./services";

const KEY = Symbol("app-services");

/** Call during +layout.svelte component init. */
export function provideAppServices(services: AppServices): void {
  setContext(KEY, services);
}

/** Call during any child component's init. */
export function useAppServices(): AppServices {
  const services = getContext<AppServices | undefined>(KEY);
  if (!services) {
    throw new Error(
      "AppServices not provided — is this component rendered under the app layout (or a test providing services)?",
    );
  }
  return services;
}
