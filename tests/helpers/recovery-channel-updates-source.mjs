import { initialRoom } from '../../server/bootstrap.mjs';
import { telegramContractFixture } from '../../scripts/telegram-contract-fixture.mjs';
export function seedRecoveryChannelUpdatesSource(store, { rows = 70, padding = 0 } = {}) {
  store.initialize(initialRoom());
  store.issueAccessKey('commons', 'owner');
  const account = store.accountForMember('commons', 'owner'), key = store.issueAccountAccessKey(account.id), slot = store.createAccountSessionSlot();
  const auth = store.loginAccountSession(slot.token, key, 0), telegram = telegramContractFixture();
  telegram.connection.accountId = account.id;
  store.connections.apply(slot.token, { action: 'connection.configure', requestId: 'channel-source-configure', connectionId: telegram.connection.id, expectedRevision: 0, profile: telegram.connection }, auth.sessionBinding);
  const updates = Array.from({ length: rows }, (_, n) => ({ update_id: n, text: 'synthetic-' + n + 'x'.repeat(padding) }));
  // Repeated legal100-update deliveries retain imported history indefinitely;
  // the live pending backlog never exceeds the existing500 cap.
  const retained = Math.max(0, rows - 500);
  for (let start = 0; start < retained; start += 100) {
    const batch = updates.slice(start, Math.min(start + 100, retained));
    store.channelUpdates.record(account.id, telegram.connection.id, batch, { backlog: 500 });
    store.channelUpdates.imported(account.id, telegram.connection.id, batch.map(row => row.update_id));
  }
  for (let start = retained; start < rows; start += 100) store.channelUpdates.record(account.id, telegram.connection.id, updates.slice(start, start + 100), { backlog: 500 });
  if (rows > 1) store.channelUpdates.imported(account.id, telegram.connection.id, [0]);
  if (rows > 2) for (let n = 0; n < 5; n++) store.channelUpdates.failed(account.id, telegram.connection.id, [retained ? rows - 1 : 1], Error('synthetic rejected update'));
  return { accountId: account.id, connectionId: telegram.connection.id, rows };
}
