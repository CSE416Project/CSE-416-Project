import BackArrow from '../../components/common/BackArrow';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bankingApi, type ApiBankTransaction, type BankBudgetCategory, type BankReviewCategory, type TransactionReview } from '../../api/banking.api';
import { ApiError } from '../../api/client';
import { formatCents } from '../expenses/split';

const CATEGORIES: { key: BankBudgetCategory; label: string }[] = [
  { key: 'dining', label: 'Dining' }, { key: 'groceries', label: 'Groceries' },
  { key: 'transit', label: 'Transit' }, { key: 'shopping', label: 'Shopping' }, { key: 'other', label: 'Other' },
];
type Filter = 'unreviewed' | 'excluded' | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'unreviewed', label: 'Needs category' }, { key: 'excluded', label: 'Excluded' },
];
const labelFor = (key: BankReviewCategory | null) => key === 'income' ? 'Income' : CATEGORIES.find(item => item.key === key)?.label ?? 'Not categorized';
const message = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unable to load transactions.';
function ReviewEditor({ transaction, onCancel, onSaved }: { transaction: ApiBankTransaction; onCancel: () => void; onSaved: (transaction: ApiBankTransaction) => void }) {
  const [category, setCategory] = useState<BankBudgetCategory>(CATEGORIES.some(item => item.key === transaction.category) ? transaction.category as BankBudgetCategory : 'other');
  const incoming = transaction.amountCents <= 0;
  const [excluded, setExcluded] = useState(incoming || transaction.excluded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (saving) return;
    setSaving(true); setError('');
    const review: TransactionReview = { category: incoming ? null : category, excluded, note: transaction.note, reviewed: true, splits: [] };
    try { onSaved((await bankingApi.reviewTransaction(transaction.id, review)).transaction); }
    catch (failure) { setError(message(failure)); setSaving(false); }
  };
  return <div className="bank-dialog-backdrop" onKeyDown={event => { if (event.key === 'Escape' && !saving) onCancel(); }}>
    <div className="bank-dialog transaction-review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-transaction-title">
      <header><div><h2 id="review-transaction-title">Review transaction</h2><p>{transaction.merchant} · {formatCents(transaction.amountCents)}</p></div>
        <button type="button" aria-label="Close" disabled={saving} onClick={onCancel}>×</button></header>
      {transaction.linkedExpense && <p className="bank-linked-notice">Linked to “{transaction.linkedExpense.title}” in {transaction.linkedExpense.groupName}. Your personal budget counts <strong>{formatCents(transaction.linkedExpense.personalBudgetCents ?? 0)}</strong> instead of the original {formatCents(transaction.amountCents)} bank charge.</p>}
      <label className="review-check"><input type="checkbox" checked={excluded} disabled={saving || incoming || !!transaction.linkedExpense} onChange={event => setExcluded(event.target.checked)} />
        <span><strong>Exclude from budget</strong></span></label>
      {!incoming && <label>CATEGORY<select value={category} disabled={saving || excluded} onChange={event => setCategory(event.target.value as BankBudgetCategory)}>
        {CATEGORIES.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}
      </select></label>}
      {error && <p className="form-notice" role="alert">{error}</p>}
      <div className="review-dialog-actions">
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  </div>;
}

export default function TransactionReviewCenter({ onBack, onUnreviewedDelta, initialMonth }: { onBack: () => void; onUnreviewedDelta?: (delta: number) => void; initialMonth?: string }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthOptions = Array.from({ length: 25 }, (_, index) => {
    const date = new Date(`${currentMonth}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - index);
    return { value: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(initialMonth || currentMonth);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [transactions, setTransactions] = useState<ApiBankTransaction[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewCountError, setReviewCountError] = useState('');
  const countRequest = useRef(0);
  const loadReviewCount = useCallback(async () => {
    const id = ++countRequest.current;
    try {
      const result = await bankingApi.transactions('unreviewed');
      if (id === countRequest.current) { setReviewCount(result.transactions.length); setReviewCountError(''); }
    } catch { if (id === countRequest.current) setReviewCountError('Unable to check transactions needing categorization. Pull down to retry.'); }
  }, []);
  useEffect(() => { void loadReviewCount(); return () => { countRequest.current++; }; }, [loadReviewCount]);
  const [selected, setSelected] = useState<ApiBankTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const requestKey = useMemo(() => `${filter}:${filter === 'unreviewed' ? '' : month}:${query.trim()}`, [filter, month, query]);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!filterMenuRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFiltersOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [filtersOpen]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true); setError('');
      bankingApi.transactions(filter, query, filter === 'unreviewed' ? '' : month).then(result => { if (active) setTransactions(result.transactions); })
        .catch(failure => { if (active) setError(message(failure)); })
        .finally(() => { if (active) setLoading(false); });
    }, query.trim() ? 250 : 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [requestKey]);

  usePullRefresh(async () => {
    const [result] = await Promise.all([bankingApi.transactions(filter, query, filter === 'unreviewed' ? '' : month), loadReviewCount()]);
    setTransactions(result.transactions);
  });
  const saved = (transaction: ApiBankTransaction) => {
    const wasUnreviewed = !!selected && !selected.reviewed && !selected.excluded;
    const isUnreviewed = !transaction.reviewed && !transaction.excluded;
    if (wasUnreviewed !== isUnreviewed) {
      const delta = isUnreviewed ? 1 : -1;
      countRequest.current++;
      setReviewCount(count => Math.max(0, count + delta));
      onUnreviewedDelta?.(delta);
    }
    setSelected(null);
    window.dispatchEvent(new Event('cse416:settlements'));
    const belongs = filter === 'all' || filter === 'excluded' && transaction.excluded
      || filter === 'unreviewed' && !transaction.reviewed && !transaction.excluded;
    setTransactions(previous => belongs ? previous.map(item => item.id === transaction.id ? transaction : item) : previous.filter(item => item.id !== transaction.id));
  };

  return <main className="banking-workspace review-workspace">
    <header className="bank-header"><button type="button" aria-label="Back" onClick={onBack}><BackArrow /></button>
      <div><h1>Transactions</h1><p>{filter === 'unreviewed' ? 'Needs category · All months' : monthOptions.find(item => item.value === month)?.label ?? month}</p></div></header>
    <div className="review-toolbar">
      <input className="review-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search merchant or account" aria-label="Search transactions" />
      <div className="review-filter-menu" ref={filterMenuRef}>
        <button type="button" className={filtersOpen || filter !== 'all' ? 'review-filter-toggle active' : 'review-filter-toggle'} aria-label="Filter transactions" aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => setFiltersOpen(open => !open)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        </button>
        {filtersOpen && <div className="review-filter-popover" role="dialog" aria-label="Transaction filters">
          <label>Month<select disabled={filter === 'unreviewed'} aria-label="Transaction month" value={month} onChange={event => setMonth(event.target.value)}>
            {monthOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          {filter === 'unreviewed' && <p className="bank-caption">Needs category includes all months.</p>}
          <button type="button" className="review-filter-done" onClick={() => setFiltersOpen(false)}>Done</button>
        </div>}
      </div>
    </div>
    <div className="review-tabs" role="tablist" aria-label="Transaction status">
      {FILTERS.map((item, index) => <button type="button" role="tab" id={`transaction-tab-${item.key}`} aria-controls="transaction-results" aria-selected={filter === item.key} tabIndex={filter === item.key ? 0 : -1}
        key={item.key} className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % FILTERS.length : event.key === 'ArrowLeft' ? (index + FILTERS.length - 1) % FILTERS.length : event.key === 'Home' ? 0 : event.key === 'End' ? FILTERS.length - 1 : null;
          if (next === null) return;
          event.preventDefault(); setFilter(FILTERS[next]!.key);
          (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
        }}>{item.label}{item.key === 'unreviewed' && reviewCount > 0 && <span className="review-tab-attention" aria-label={`${reviewCount} ${reviewCount === 1 ? 'transaction needs' : 'transactions need'} categorization`}><b aria-hidden="true">!</b>{reviewCount}</span>}</button>)}
    </div>
    {reviewCountError && <p className="form-notice" role="alert">{reviewCountError}</p>}
    <div id="transaction-results" role="tabpanel" aria-labelledby={`transaction-tab-${filter}`} aria-busy={loading} tabIndex={0}>
    {loading && <p className="bank-caption" role="status">Loading transactions…</p>}
    {!loading && !error && transactions.length === 0 && <section className="review-empty"><strong>{filter === 'unreviewed' && !query.trim() ? 'Everything is categorized' : 'No matching transactions'}</strong><p>{filter === 'unreviewed' && !query.trim() ? 'Only transactions the app could not categorize automatically appear here.' : 'Try another filter or search.'}</p></section>}
    {error && <p className="form-notice" role="alert">{error}</p>}
    <div className="review-list">
      {transactions.map(transaction => <button type="button" className={transaction.linkedExpense ? 'review-card linked-group-expense' : 'review-card'} key={transaction.id} aria-disabled={transaction.source === 'group_payment'} onClick={() => { if (transaction.source !== 'group_payment') setSelected(transaction); }}>
        <span className="review-card-main"><strong>{transaction.merchant}</strong><small>{transaction.institution} · {transaction.accountName} · {new Date(`${transaction.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</small>
          {transaction.linkedExpense && <small className="review-linked-context">Linked to {transaction.linkedExpense.title} · {transaction.linkedExpense.groupName}</small>}
          <span className="review-badges">{transaction.pending && <em>Pending</em>}{transaction.linkedExpense && <em className="linked">Group expense</em>}{transaction.groupPayment && <em>{transaction.groupPayment.method} · {transaction.groupPayment.groupName}</em>}{transaction.excluded ? <em>Excluded</em> : transaction.splits.length ? <em>{transaction.splits.length} category split</em> : <em>{labelFor(transaction.category)}</em>}{transaction.needsReview && <em className="needs-category">Needs category</em>}</span>
          </span>
        {transaction.linkedExpense ? <span className="review-linked-amounts">
          <span className="review-budget-amount"><strong>{formatCents(transaction.linkedExpense.personalBudgetCents ?? 0)}</strong><small>Personal budget</small></span>
          <span className="review-original-amount"><strong>{formatCents(transaction.amountCents)}</strong><small>Original charge</small></span>
        </span> : <span className={transaction.amountCents < 0 ? 'review-amount income' : 'review-amount'}>{formatCents(transaction.amountCents)}</span>}
      </button>)}
    </div>
    </div>
    {selected && <ReviewEditor transaction={selected} onCancel={() => setSelected(null)} onSaved={saved} />}
  </main>;
}
