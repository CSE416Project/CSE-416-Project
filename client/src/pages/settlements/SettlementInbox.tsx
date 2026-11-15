import { useEffect, useRef, useState } from 'react';
import { settlementsApi, paymentMethods } from '../../api/settlements.api';
import Avatar from '../../components/common/Avatar';
import MobileDialog from '../../components/common/MobileDialog';
import { createRequestId } from '../../utils/requestId';
import { formatCents } from '../expenses/split';
import { useLiveData } from '../dashboard/useLiveData';
import { confirmAllocations, groupPayments, reportAllocations, type GroupPaymentPair, type GroupPayments } from './group-payments';
import './settlements.css';

export default function SettlementInbox({ active = true, onChanged, groupId }: { active?: boolean; onChanged?: () => void; groupId?: string }) {
  const { data, error: loadError, refresh } = useLiveData(settlementsApi.inbox, active);
  const [selection, setSelection] = useState<{ kind: 'send' | 'collect'; groupId: string; batchIds: string[] } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const changed = useRef(onChanged); changed.current = onChanged;
  useEffect(() => {
    if (!active) return;
    const listener = () => { void refresh(); };
    window.addEventListener('cse416:settlements', listener);
    return () => window.removeEventListener('cse416:settlements', listener);
  }, [active, refresh]);
  const run = async (work: () => Promise<unknown>, success: string) => {
    if (busy) return false;
    setBusy(true); setError('');
    try { await work(); await refresh(); window.dispatchEvent(new Event('cse416:settlements')); changed.current?.(); setMessage(success); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save. Please try again.'); return false; }
    finally { setBusy(false); }
  };
  const open = (kind: 'send' | 'collect', groupId: string) => { setMemberId(null); setError(''); setMessage(''); setSelection({ kind, groupId, batchIds: data?.batches.filter(b => b.groupId === groupId && !b.completed).map(b => b.id) ?? [] }); };
  if (!active) return null;
  if (!data) return loadError ? <p className="settlement-status">Could not load group payments. <button type="button" onClick={() => void refresh()}>Reload payments</button></p> : null;
  const groups = groupPayments(data.batches).filter(group => !groupId || group.id === groupId);
  const selected = selection ? groupPayments(data.batches, selection.batchIds).find(g => g.id === selection.groupId) : undefined;
  const outgoing = selected?.pairs.filter(p => p.senderId === data.userId && p.confirmedCents < p.amountCents) ?? [];
  const collection = selected?.pairs.filter(p => p.recipientId === data.userId) ?? [];
  const sending = selection?.kind === 'send';
  const memberKey = (p: GroupPaymentPair) => sending ? p.recipientId : p.senderId;
  const memberName = (p: GroupPaymentPair) => sending ? p.recipientName : p.senderName;
  const sections = sending ? [
    { label: 'To send', members: outgoing.filter(p => p.unreportedCents > 0) },
    { label: 'Awaiting confirmation', members: outgoing.filter(p => !p.unreportedCents) },
  ] : [
    { label: 'Needs confirmation', members: collection.filter(p => p.pendingCents > 0) },
    { label: 'Awaiting payment', members: collection.filter(p => !p.pendingCents && p.unreportedCents > 0) },
    { label: 'Confirmed', members: collection.filter(p => p.confirmedCents === p.amountCents) },
  ];
  const pair = (sending ? outgoing : collection).find(member => memberKey(member) === memberId) ?? sections.find(section => section.members.length)?.members[0];
  function selectMember(id: string) {
    setMemberId(id);
    setMessage('');
    setError('');
  }
  const visible = groups.filter(g => g.pairs.some(p => (p.senderId === data.userId || p.recipientId === data.userId) && p.confirmedCents < p.amountCents));
  return <section className="settlement-inbox" aria-label={groupId ? 'Your payments' : 'Group payment notifications'}>
    {!!visible.length && <h2>{groupId ? 'Your payments' : 'Group payments'}</h2>}
    {visible.map(group => {
      const owes = group.pairs.filter(p => p.senderId === data.userId && p.confirmedCents < p.amountCents);
      const incoming = group.pairs.filter(p => p.recipientId === data.userId);
      const due = owes.filter(p => p.unreportedCents > 0);
      const unsent = owes.reduce((sum, p) => sum + p.unreportedCents, 0), pending = owes.reduce((sum, p) => sum + p.pendingCents, 0);
      const recipient = due.length === 1 ? due[0]!.recipientName : `${due.length} people`;
      const waitingLabel = owes.length === 1 ? `Waiting for ${owes[0]!.recipientName} to confirm` : 'Waiting for payment confirmations';
      const sendLabel = due.length === 1 ? `Send ${recipient} ${formatCents(unsent)}` : `Send ${formatCents(unsent)} to ${recipient}`;
      return <div key={group.id}>
        {!!owes.length && <button className="settlement-card" type="button" onClick={() => open('send', group.id)}
          aria-label={`${group.groupName} · ${unsent ? sendLabel : waitingLabel}`}>
          <span className="payment-card-heading">{group.groupName}<span aria-hidden="true">›</span></span>
          {unsent ? <span className="payment-card-balance"><strong>{formatCents(unsent)}</strong> to send to {recipient}</span> : <strong>{waitingLabel}</strong>}
          <small>{group.expenses.length} {group.expenses.length === 1 ? 'transaction' : 'transactions'}{pending ? ` · ${formatCents(pending)} reported sent` : ''}</small>
        </button>}
        {incoming.some(p => p.confirmedCents < p.amountCents) && <CollectionCard group={group} pairs={incoming} onClick={() => open('collect', group.id)} />}
      </div>;
    })}
    {!selection && error && <p role="alert">{error}</p>}
    {!selection && message && <p className="settlement-status" role="status">{message}</p>}
    {selection && <MobileDialog title={selection.kind === 'send' ? 'Confirm money sent' : 'Collection progress'} busy={busy} onClose={() => setSelection(null)}>
      {!selected && <p>All payments in this group are resolved.</p>}
      {selected && <>
          <div className="collection-summary">
            <strong>{selected.groupName}</strong>
            <div className="payment-card-balance"><strong>{formatCents(sending ? outgoing.reduce((sum, p) => sum + p.unreportedCents, 0) : collection.reduce((sum, p) => sum + p.amountCents - p.confirmedCents, 0))}</strong> {sending ? 'left to send' : 'left to collect'}</div>
            <details className="collection-expenses">
              <summary>Included expenses <span>{selected.expenses.length}</span></summary>
              <ul aria-label="Included expenses" tabIndex={0}>
                {selected.expenses.map(expense => <li key={expense.id}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3l2 1.5L9.5 3 12 4.5 14.5 3 17 4.5 19 3v18l-2-1.5-2.5 1.5-2.5-1.5L9.5 21 7 19.5 5 21zM9 9h6M9 13h4" />
                  </svg>
                  <span>{expense.title}</span>
                </li>)}
              </ul>
            </details>
          </div>
          <div className="collection-picker">
            {sections.map(section => <section key={section.label} aria-label={section.label}>
              <h3>{section.label} <span>({section.members.length})</span></h3>
              {section.members.length > 0 && <div className="collection-choices">
                {section.members.map(member => <button type="button" key={memberKey(member)} disabled={busy}
                  aria-label={`${memberName(member)}, ${section.label}`} aria-pressed={memberKey(member) === (pair && memberKey(pair))}
                  onClick={() => selectMember(memberKey(member))}>
                  <span className="collection-avatar" aria-hidden="true"><MemberAvatar id={memberKey(member)} name={memberName(member)} /></span>
                  <span className="collection-choice-name">{memberName(member)}</span>
                </button>)}
              </div>}
            </section>)}
          </div>
          {sending && pair && <SendPayment key={pair.recipientId} groupId={selected.id} pair={pair} busy={busy} run={run}
            onDone={() => { if (outgoing.length === 1) setSelection(null); else setMemberId(null); }} />}
          {!sending && pair && <div className={`settlement-person collection-member ${pair.confirmedCents === pair.amountCents ? 'settlement-person-confirmed' : ''}`} key={pair.senderId}>
            {pair.unreportedCents > 0 && <button className="collection-reminder" aria-label={`Remind ${pair.senderName}`} title={`Remind ${pair.senderName}`} type="button" disabled={busy} onClick={() => void run(() => settlementsApi.remindGroup(selected.id, pair.senderId), `In-app reminder sent to ${pair.senderName}.`)}>
              Remind
            </button>}
            <div className="payment-card-heading"><strong>{pair.senderName}</strong>{pair.amountCents > pair.confirmedCents && <b>{formatCents(pair.amountCents - pair.confirmedCents)} due</b>}</div>
            <span className="settlement-person-status">{pair.confirmedCents === pair.amountCents ? 'Received and confirmed' : pair.pendingCents ? `${formatCents(pair.pendingCents)} reported sent` : 'Awaiting payment'}</span>
            {!!pair.confirmedCents && pair.confirmedCents < pair.amountCents && <small>{formatCents(pair.confirmedCents)} already confirmed</small>}
            <PaymentMethodTotals payments={pair.pendingPayments} />
            {!!pair.pendingPayments.length && <div className="settlement-person-actions"><button className="settlement-confirm-action" type="button" disabled={busy} onClick={() => void run(() => settlementsApi.confirmGroup(selected.id, { senderId: pair.senderId, allocations: confirmAllocations(pair), status: 'CONFIRMED' }), `Receipt from ${pair.senderName} confirmed.`)} aria-label={`Confirm received from ${pair.senderName}`}>Confirm received</button>
              <button type="button" disabled={busy} onClick={() => void run(() => settlementsApi.confirmGroup(selected.id, { senderId: pair.senderId, allocations: confirmAllocations(pair), status: 'ISSUE' }), 'Payment flagged for review.')}>Not received</button></div>}

          </div>}
      </>}
      {error && <p role="alert">{error}</p>}{message && <p className="settlement-status" role="status">{message}</p>}

    </MobileDialog>}
  </section>;
}
function PaymentMethodTotals({ payments }: { payments: GroupPaymentPair['pendingPayments'] }) {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    const method = payment.method ?? 'Method not recorded';
    totals.set(method, (totals.get(method) ?? 0) + payment.cents);
  }
  return <>{Array.from(totals, ([method, cents]) => <small key={method}>{formatCents(cents)} · {method}</small>)}</>;
}
function MemberAvatar({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  return <span onError={() => setFailed(true)}>
    <Avatar name={name} photo={failed ? null : `${base}/users/${encodeURIComponent(id)}/photo`} />
  </span>;
}
function SendPayment({ groupId, pair, busy, run, onDone }: { groupId: string; pair: GroupPaymentPair; busy: boolean; run: (work: () => Promise<unknown>, success: string) => Promise<boolean>; onDone: () => void }) {
  const [method, setMethod] = useState<string>(paymentMethods[0]);
  const snapshot = useRef({ requestId: createRequestId(), allocations: reportAllocations(pair) });
  const current = reportAllocations(pair), stale = JSON.stringify(current) !== JSON.stringify(snapshot.current.allocations);
  return <div className="settlement-person collection-member send-member">
    <div className="payment-card-heading"><strong>{pair.recipientName}</strong>
      {pair.unreportedCents > 0 && <b>{formatCents(pair.unreportedCents)} to send</b>}
    </div>
    {pair.pendingCents > 0 && <span className="settlement-person-status">Awaiting confirmation from {pair.recipientName}</span>}
    <PaymentMethodTotals payments={pair.pendingPayments} />
    {pair.unreportedCents > 0 && <form onSubmit={event => { event.preventDefault(); if (stale) return;
      void run(() => settlementsApi.reportGroup(groupId, { recipientId: pair.recipientId, method, clientRequestId: snapshot.current.requestId, allocations: snapshot.current.allocations }), 'Payment reported. The recipient will confirm when it arrives.').then(ok => { if (ok) onDone(); });
    }}><label>How did you send it?<select value={method} disabled={busy} onChange={event => setMethod(event.target.value)}>{paymentMethods.map(m => <option key={m}>{m}</option>)}</select></label>
      <p className="settlement-caption">Only confirm after sending the money using your chosen method.</p>
      {stale && <p role="alert">The amount changed. Close and reopen this card to review the updated total.</p>}
      <button className="settlement-primary" type="submit" disabled={busy || stale}>{busy ? 'Saving…' : `I sent ${formatCents(pair.unreportedCents)}`}</button></form>}
  </div>;
}
function CollectionCard({ group, pairs, onClick }: { group: GroupPayments; pairs: GroupPaymentPair[]; onClick: () => void }) {
  const total = pairs.reduce((sum, p) => sum + p.amountCents, 0), sent = pairs.reduce((sum, p) => sum + p.confirmedCents + p.pendingCents, 0), received = pairs.reduce((sum, p) => sum + p.confirmedCents, 0);
  const confirmed = pairs.filter(p => p.confirmedCents === p.amountCents).length, reported = pairs.filter(p => p.confirmedCents + p.pendingCents === p.amountCents).length;
  return <button type="button" className="settlement-card collection" onClick={onClick}
    aria-label={`${group.groupName} · Collect ${formatCents(total - received)}. Review payments`}>
    <span className="payment-card-heading">{group.groupName}<span aria-hidden="true">›</span></span>
    <span className="payment-card-balance"><strong>{formatCents(total - received)}</strong> left to collect</span>
    <span className="collection-progress-label">Reported sent <b>{formatCents(sent)} of {formatCents(total)}</b></span>
    <span role="progressbar" aria-label={`Collection progress for ${group.groupName}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={sent} aria-valuetext={`${formatCents(sent)} of ${formatCents(total)} reported sent`}><i style={{ width: `${total ? sent / total * 100 : 0}%` }} /></span>
    <small>{reported} of {pairs.length} reported sending · {confirmed} confirmed received</small>
  </button>;
}
