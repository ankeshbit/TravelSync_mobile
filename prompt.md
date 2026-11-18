# TravelSync Mobile: fix prompts

Paste one prompt at a time into Claude Code, run from the repo root. Each prompt ends with the same check: `npx tsc --noEmit && npm run lint && npm test`.

Baseline: tsc, lint and all 127 tests pass today, so these are logic and runtime bugs the tooling does not catch.

Confirmed = I re-read the code myself. Reported = found by a reviewer reading the code, not re-checked.

---

## P1 (fix first)

### 1. Dashboard search wipes the screen and closes the keyboard (confirmed)
```
In src/hooks/useTrips.ts, the useTrips infinite query changes its queryKey whenever the search text changes, but has no placeholderData. Each new key puts tripsLoading=true, so src/app/(tabs)/index.tsx (the `if (tripsLoading && !isRefetching)` early return around line 274) replaces the whole screen with a fullscreen LoadingState. The search TextInput unmounts and the keyboard dismisses while the user is typing.
Fix: add `placeholderData: keepPreviousData` to useTrips (it is already imported in that file), and in index.tsx show the fullscreen loader only when there is no data at all (e.g. `isLoading && !data`). Show a small inline spinner while a search is refetching. Keep the search input mounted at all times.
Do not change the query key shape. Then run: npx tsc --noEmit && npm run lint && npm test
```

### 2. Google sign-up on Register never navigates (confirmed)
```
In src/app/(auth)/register.tsx, handleGoogleSignup (around line 61) calls loginWithGoogle() and then does nothing. Unlike login.tsx, register.tsx has no navigation after success, and src/app/(auth)/_layout.tsx has no auth redirect, so the user stays on the Create Account form after signing up.
Fix: mirror what login.tsx does after Google sign-in. If the returned user's email is unverified, go to /(auth)/verify-email, otherwise /(tabs). A null return (user cancelled) must do nothing. Reuse the same logic rather than duplicating it if practical.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 3. Email verification polling stops after one network error (confirmed)
```
In src/app/(auth)/verify-email.tsx, checkVerificationStatus (around lines 69-88) sets `isPolling = false` before awaiting getIdToken(true) and syncBackendUser(). If either throws, the catch only logs, and every later 5s tick returns early because isPolling is false. The user is stuck until they tap the manual check button.
Fix: only set isPolling = false after getIdToken, syncBackendUser and router.replace have succeeded, or reset it to true in the catch. Keep the isCheckingRef guard so two checks never overlap, and keep the cleanup on unmount.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 4. Expense modal keeps the last currency, so the new expense "disappears" (confirmed)
```
In src/app/trip/expenses.tsx, handleOpenAddModal (around line 167) resets title, amount, category, payer and splits but never modalCurrency. After adding a EUR expense, the next Add still defaults to EUR while the visible list is filtered by activeCurrency, so the saved expense vanishes from the list and users re-add it.
Fix: reset modalCurrency to '' in handleOpenAddModal. After a successful add, if the expense currency differs from activeCurrency, switch activeCurrency to it so the new expense is visible.
Also validate in handleAddExpense (around line 198): block saving if selectedSplits is empty (members may not have loaded), and require the currency to be exactly 3 letters (the custom input at line 527 allows 1-2). Show a clear error for each case.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 5. Offline note can be saved to the bundle but never queued (reported)
```
In src/services/offlineStorage.ts, updatePlaceNoteLocal (around lines 280-309) writes the note into the trip bundle first and then calls queuePendingSync. If the queue write throws, it returns false ("failed") but the note is already stored locally and will never sync.
Fix: make it atomic. Queue first, then write the bundle, and if the second write fails, roll the queue entry back. Alternatively write both under one lock and restore the previous bundle on failure. Add a jest test in src/__tests__/offlineStorage.test.ts that mocks AsyncStorage.setItem to fail on the queue key and asserts the bundle is unchanged.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 6. Offline Refresh and Sync can overwrite each other (reported)
```
In src/services/offlineStorage.ts, saveOfflineTripPack reads the pending queue with readQueueUnlocked (no lock on the sync key), and in src/app/trip/offline.tsx the Refresh and Sync buttons are not disabled while the other runs. If refresh fetches the pack, sync clears the queue, and then the save runs, the just-synced note is overwritten locally with the stale server value.
Fix: (a) disable both buttons while either operation is in flight, using a ref-based in-flight guard (not only React state) so a fast double tap cannot start two runs; (b) in saveOfflineTripPack take the sync-key lock before reading the queue. Keep lock ordering consistent (bundle key then sync key everywhere) to avoid deadlock, and also take the sync lock in deleteOfflineTrip. Add a test for the interleaving.
Then run: npx tsc --noEmit && npm run lint && npm test
```

---

## P2

### 7. Failed offline items are retried forever (reported)
```
In src/api/trips.ts, normalizeSyncResult marks every unacknowledged submitted item as failed, and src/app/trip/offline.tsx keeps failed items in the queue with no limit. A note for a place deleted on the server fails on every sync and the "Sync (n)" badge never clears.
Fix: add an attempts counter to PendingSyncItem (src/services/offlineStorage.ts). After 3 failed attempts, move the item to a "needs attention" state and show a per-item Discard option in the UI. Do not resend discarded items. Only attempts for items the server explicitly reported as failed should count, not items that were simply missing from the response. Add tests.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 8. Legacy storage migration can drop pending edits (reported)
```
In src/services/offlineStorage.ts, migrateLegacyUserStorage (lines 114-163) skips copying the legacy bundle or queue when the new key already exists, then deletes the legacy key, losing un-synced notes. It also only migrates trips listed in the legacy trips index.
Fix: when both queues exist, merge them (concatenate and dedupe by item id) before deleting the legacy one. Also discover legacy bundle and queue keys that are not in the index. Add tests for the merge case.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 9. Failed background refetch replaces the whole trip screen (reported, unsure)
```
In src/app/trip/[id].tsx (around lines 309-318) and src/app/trip/map.tsx (around lines 264-284), `tripError || !trip` (and placesError) is checked before rendering. In TanStack Query v5 a failed refetch sets isError even when data is still present, so a socket-triggered invalidation during a network blip can unmount the screen and any open modal with typed text.
First check the QueryClient retry config in src/app/_layout.tsx. Then change the checks to show the error screen only when there is no data (`isError && !data`) and otherwise keep rendering the stale data with a small non-blocking "couldn't refresh" banner.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 10. Rapid double taps create duplicates or overwrite reorders (reported)
```
Three related race conditions, fix them together:
1. src/app/trip/map.tsx handleMovePlace (lines ~197-216, buttons ~439-453): the up/down arrows only disable at the list ends, not while reorderPlacesMutation.isPending, so a second tap works from a stale order. Disable arrows while pending, and apply an optimistic reorder to the query cache with rollback on error.
2. src/app/trip/[id].tsx (~280-303) and src/app/trip/map.tsx (~236-258): AI-suggestion "Add" only records addedSuggestions after awaiting geocodePlace and the mutation, so double taps add the stop twice. Also the key `sug.title || sug.name || ''` collides on empty strings. Add the suggestion to an in-flight ref set synchronously at tap time, use a stable unique key, and remove it on failure.
3. The manual "Save" flows in [id].tsx (~152-178) and map.tsx (~136-163) geocode before mutateAsync, so isPending is not yet true. Add a local `saving` state set before geocoding and use it to disable the button.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 11. Null totals and NaN in the expenses screen (reported)
```
In src/app/trip/expenses.tsx: (a) around lines 116-121 the guard `totalExpenses !== undefined` lets null through, and computedTotalExpenses.toLocaleString() then throws. Use `typeof === 'number' && Number.isFinite`, and coerce numeric strings with Number(). (b) around lines 244-250 and 378, Number(e.amount) can be NaN and the category chip renders "NaN"; skip non-finite amounts. (c) around line 239, the "Trip Not Found" retry calls onRefresh, which refetches expenses and balances but not the trip, so it does nothing when the trip query failed; include the trip refetch, and do not show "Not Found" while the trip query is disabled or still loading. (d) payer and split list: filterTripMembers uses `m.userId || m.user?.id || m.id` but allMembers uses `m.userId || m.id`; make them use one shared id helper, and make sure the owner is included even if trip.owner is not populated (fall back to trip.ownerId).
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 12. Geocoding is gated on location permission it does not need (confirmed)
```
In src/utils/geocoding.ts (lines 21-24), geocodePlace calls Location.requestForegroundPermissionsAsync() and returns {} if denied. First check the Expo SDK 58 docs for expo-location (https://docs.expo.dev/versions/v58.0.0/sdk/location/) to confirm whether geocodeAsync needs permission on Android and iOS. If it does not, remove the permission request so denied users still get map pins and are not prompted on every add.
Also: when `address` is empty the query becomes just the destination, so the place gets the destination's centre as if it were its own location. Return {} when the address is empty.
Add jest tests in src/__tests__/geocoding.test.ts for both cases.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 13. AI chatbot crashes if a follow-up has no options (confirmed)
```
In src/components/common/AiTravelChatbot.tsx, `q.options.map(...)` (line 267, also near line 106) throws if the backend omits `options`, which takes down the whole dashboard. Normalise the response where structuredFollowUps is set: drop follow-ups without an array `options`, or default options to []. Render defensively with `(q.options ?? []).map`.
Then run: npx tsc --noEmit && npm run lint && npm test
```

---

## P3 (lower priority)

### 14. Preferences hook races and stale cross-user state (reported)
```
In src/hooks/useUserPreferences.ts: (a) the load effect replaces the whole state with stored prefs, overwriting a toggle the user made before the load finished; merge instead, or ignore the load result if the user has already changed something. (b) When uid changes, preferences and loading are not reset, so the previous user's settings show briefly; reset to defaults and loading=true on uid change. (c) A failed write is swallowed with no rollback; revert the optimistic update on failure.
Also clear the stored `user_prefs_<uid>` entry and the memory cache on logout and on account deletion (src/context/AuthContext.tsx logout, and the delete-account flow in src/app/(tabs)/profile.tsx).
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 15. Auth and navigation edge cases (reported)
```
(a) src/app/(auth)/login.tsx lines ~31-39 and 54-56: after loginWithEmail the effect redirects an unverified user to verify-email, and then the handler unconditionally does router.replace('/(tabs)'), causing a flash and competing replaces. Only navigate to /(tabs) when emailVerified is true.
(b) src/app/(tabs)/profile.tsx lines ~265-269: the guard uses isLoading instead of isInitializing, so a cold start or web reload on /profile redirects to login before Firebase restores the session. Use isInitializing.
(c) src/config/firebase.ts lines ~22-29: if initializeAuth fails for a reason other than already-initialized, it silently falls back to non-persistent getAuth, losing the session on restart. Surface this with a clear console.error and, if possible, a user-visible warning.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 16. Date handling at extreme time zones (reported, low impact for UTC+05:30)
```
src/utils/tripValidation.ts dateStringToISO (lines 54-59) builds local noon and converts with toISOString(). Local noon is the previous or next UTC day in UTC+13/+14 and UTC-12, so the date shifts and every edit-and-save moves it again. Build the string directly: `new Date(Date.UTC(y, m, d, 12)).toISOString()`.
Also: src/app/trip/create.tsx line ~126 and edit.tsx line ~218 pass `new Date('YYYY-MM-DD')` as minimumDate, which parses as UTC; use parseCalendarDate from src/utils/dateUtils.ts instead. Add tests in src/__tests__/tripValidation.test.ts and dateUtils.test.ts that run under TZ=Pacific/Auckland and TZ=Pacific/Pago_Pago.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 17. Socket hook cleanup and duplicate alerts (reported)
```
In src/hooks/useTripSocket.ts: (a) getUserPreferences(...).then(...) (lines ~67-76) has no .catch and writes after the effect is torn down; add a cancelled flag and a catch. (b) hasExited is local to each hook instance, so when both [id] and map screens are mounted, trip:deleted/trip:removed shows two alerts and calls router.replace twice; move the "already exited" flag to module level, keyed by tripId. (c) src/app/trip/edit.tsx lines ~162-170: markTripDeletedLocally runs before deleteTripMutation and is not undone when the delete fails, so a later real trip:deleted event is ignored; unmark in the catch.
Also useLeaveTrip (src/hooks/useTripDetails.ts ~72-82) only invalidates lists and summary; remove the trip's detail, places, expenses and members caches after leaving.
Then run: npx tsc --noEmit && npm run lint && npm test
```

### 18. Small input and form issues (reported)
```
(a) src/app/trip/[id].tsx lines ~165-167: `parseInt(placeDay, 10) || 1` accepts negative or huge days and negative durations; clamp day to 1..trip length (or a sane max) and duration to a positive range, with an inline error.
(b) src/app/trip/create.tsx lines ~42-52: the AsyncStorage preferred-currency load has no .catch and can overwrite a currency the user already typed; add cancellation and only apply it if the field is untouched.
(c) src/app/trip/edit.tsx lines ~67-80: the form copies trip into state once, so a trip:updated from another device is silently overwritten on save; warn or refresh when the server version changes while editing.
(d) src/utils/money.ts: add an upper bound to parseAmount, and avoid float half-cent errors (1.005 -> 1.00) by rounding via a decimal-safe method.
Then run: npx tsc --noEmit && npm run lint && npm test
```

---

## Not verifiable from the client
Whether the server lets any member delete any expense, and whether the API returns places ordered by orderIndex, depend on the backend. Check those against the Express server code.