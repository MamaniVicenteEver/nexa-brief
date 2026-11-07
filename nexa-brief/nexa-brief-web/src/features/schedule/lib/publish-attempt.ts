// Keep an uncertain request's identity across dialog unmounts and reloads.
export function publishAttempt(scope: string): string {
  const storageKey = `nexa:publish-attempt:${scope}`;
  const previous = sessionStorage.getItem(storageKey);
  if (previous) return previous;
  const key = crypto.randomUUID();
  sessionStorage.setItem(storageKey, key);
  return key;
}

export function finishPublishAttempt(scope: string): void {
  sessionStorage.removeItem(`nexa:publish-attempt:${scope}`);
}
