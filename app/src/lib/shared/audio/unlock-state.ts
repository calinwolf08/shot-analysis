/**
 * Page-lifetime "audio has been unlocked by a tap" flag. Mobile browsers need
 * one gesture to start audio; after that the Practice tab can reopen (e.g.
 * switching back from Shots) without asking again. Resets on a full reload —
 * which is exactly when the browser forgets the unlock too.
 */
let unlocked = false;

export const audioUnlockState = {
  get unlocked(): boolean {
    return unlocked;
  },
  markUnlocked(): void {
    unlocked = true;
  },
  /** Tests only. */
  reset(): void {
    unlocked = false;
  },
};
