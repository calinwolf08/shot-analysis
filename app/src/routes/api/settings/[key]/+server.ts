import { json, parseBody, withUser } from "$lib/server/http";
import { setSettingBody } from "$lib/shared/api/contracts";
import { SETTINGS, type SettingKey } from "$lib/shared/db/repos";

export const GET = withUser(async ({ repos }, event) => {
  const key = event.params.key;
  if (!key || !(key in SETTINGS))
    return json({ error: "unknown setting" }, 400);
  return json(await repos.settings.get(key as SettingKey));
});

export const PUT = withUser(async ({ repos }, event) => {
  const key = event.params.key;
  if (!key || !(key in SETTINGS))
    return json({ error: "unknown setting" }, 400);
  const { value } = await parseBody(event, setSettingBody);
  // The repo re-validates against the setting's schema (400 on mismatch).
  const parsed = SETTINGS[key as SettingKey].schema.parse(value);
  await repos.settings.set(key as SettingKey, parsed as never);
  return json({ ok: true });
});
