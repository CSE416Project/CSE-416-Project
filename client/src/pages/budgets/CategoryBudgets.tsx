import { checkCsvExportSupport, saveCsv } from '../../native/exportCsv';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../../components/common/Avatar';
import { bankingApi, type ApiBankTransaction } from '../../api/banking.api';
import { budgetsApi, type ApiGroupBudget, type ApiPersonalBudget } from '../../api/budgets.api';
import { ApiError } from '../../api/client';
import { relativeTime } from '../../utils/dates';
import { formatCents } from '../expenses/split';
import { type CategoryKey, budgetPeriod, categorySpending, daysLeftLabel, isOverLimit, toCategoryBudgets, toCategoryTransactions, totalPlannedCents, totalSpentCents } from './categoryPlan';
import { groupBudgetPct, settleUpBody, toGroupBudget, totalOwedCents } from './groupBudgetPlan';
import { CategoryTransactions, EditGroupPlan, EditLimits, WhoOwesWhat } from './CategoryBudgetDetails';
import { useLiveData } from '../dashboard/useLiveData';
import './categoryBudgets.css';

type BudgetScope = 'personal' | 'group';
type Detail = { kind: 'category'; key: CategoryKey } | { kind: 'owes' } | { kind: 'limits' } | { kind: 'groupPlan' } | null;

const REFRESH_MS = 60_000;
const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : 'Unable to reach the server. Try again.';
const loadUnreviewedTransactions = () => bankingApi.transactions('unreviewed');
const labelForTransaction = (transaction: ApiBankTransaction) => transaction.category === 'income'
  ? 'Income'
  : transaction.category ? transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1) : 'Uncategorized';

// `active` is false while the tab is hidden: nothing is fetched or polled until the user opens the budget.
export default function CategoryBudgets({ onOpenSimulator, onOpenTransactions = () => {}, onReviewCountChange, active = true, expenseTarget, onClearExpenseTarget }: { onClearExpenseTarget?: () => void; expenseTarget?: { category: string; expenseId: string } | null; onOpenSimulator: () => void; onOpenTransactions?: (month: string) => void; onReviewCountChange?: (count: number) => void; active?: boolean }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState('');
  const activeMonth = selectedMonth || currentMonth;
  const historical = activeMonth !== currentMonth;
  const monthOptions = Array.from({ length: 25 }, (_, index) => {
    const date = new Date(`${currentMonth}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - index);
    return { value: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  });
  const [scope, setScope] = useState<BudgetScope>('personal');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  useEffect(() => {
    if (!expenseTarget) return;
    const key = (['dining', 'groceries', 'transit', 'shopping', 'other'].includes(expenseTarget.category) ? expenseTarget.category : 'other') as CategoryKey;
    setScope('personal'); setSelectedMonth(''); setDetail({ kind: 'category', key });
  }, [expenseTarget]);
  const [personal, setPersonal] = useState<ApiPersonalBudget | null>(null);
  const [groups, setGroups] = useState<ApiGroupBudget[] | null>(null);
  const [personalError, setPersonalError] = useState('');
  const [groupsError, setGroupsError] = useState('');
  const [monthTransactions, setMonthTransactions] = useState<ApiBankTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const reviews = useLiveData(loadUnreviewedTransactions, active);
  const unreviewed = reviews.data?.transactions ?? [];
  useEffect(() => {
    if (reviews.data) onReviewCountChange?.(reviews.data.transactions.length);
  }, [onReviewCountChange, reviews.data]);
  // Only the most recent request may update state, so a slow refresh cannot overwrite a newer save.
  const latest = useRef({ personal: 0, groups: 0, transactions: 0 });

  const loadPersonal = useCallback(async () => {
    const id = ++latest.current.personal;
    try { const data = await budgetsApi.personal(selectedMonth || undefined); if (id === latest.current.personal) { setPersonal(data); setPersonalError(''); } }
    catch (error) { if (id === latest.current.personal) setPersonalError(errorMessage(error)); }
  }, [selectedMonth]);
  const loadGroups = useCallback(async () => {
    const id = ++latest.current.groups;
    try { const data = await budgetsApi.groups(selectedMonth || undefined); if (id === latest.current.groups) { setGroups(data.groups); setGroupsError(''); } }
    catch (error) { if (id === latest.current.groups) setGroupsError(errorMessage(error)); }
  }, [selectedMonth]);
  const loadMonthTransactions = useCallback(async () => {
    const id = ++latest.current.transactions;
    setTransactionsLoading(true);
    try {
      const data = await bankingApi.transactions('all', '', activeMonth);
      if (id === latest.current.transactions) { setMonthTransactions(data.transactions); setTransactionsError(''); }
    } catch (error) {
      if (id === latest.current.transactions) setTransactionsError(errorMessage(error));
    } finally {
      if (id === latest.current.transactions) setTransactionsLoading(false);
    }
  }, [activeMonth]);
  usePullRefresh(() => Promise.all([loadPersonal(), loadGroups(), loadMonthTransactions()]), active);
  const refresh = useCallback(() => { void loadPersonal(); void loadGroups(); void loadMonthTransactions(); }, [loadPersonal, loadGroups, loadMonthTransactions]);

  useEffect(() => {
    if (!active) return;
    if (!document.hidden) refresh();
    const interval = window.setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, refresh]);

  const budgets = useMemo(() => personal ? toCategoryBudgets(personal.categories) : [], [personal]);
  const period = personal ? budgetPeriod(personal) : null;
  const spent = totalSpentCents(budgets);
  const planned = totalPlannedCents(budgets);
  const pct = planned ? Math.min(100, Math.max(0, (spent / planned) * 100)) : 0;
  const overLimit = budgets.filter(isOverLimit);

  const groupBudgets = useMemo(() => (groups ?? []).map(toGroupBudget), [groups]);
  const activeGroup = groupBudgets.find(group => group.id === activeGroupId) ?? groupBudgets[0];
  const groupPct = activeGroup ? groupBudgetPct(activeGroup) : 0;
  const remainingOwed = activeGroup ? totalOwedCents(activeGroup) : 0;

  const exportCsv = async () => {
    setExporting(true); setExportError('');
    try {
      checkCsvExportSupport();
      const { blob, filename } = await budgetsApi.exportCsv(selectedMonth || undefined);
      await saveCsv(blob, filename);
    } catch (error) { setExportError(errorMessage(error)); }
    finally { setExporting(false); }
  };
  const saveLimits = async (limits: Record<CategoryKey, number>) => {
    const data = await budgetsApi.saveLimits(limits);
    latest.current.personal++;
    setPersonal(data); setPersonalError('');
    setDetail(null);
  };
  const saveGroupPlan = async (groupId: string, plannedCents: number) => {
    const data = await budgetsApi.saveGroupPlan(groupId, plannedCents);
    latest.current.groups++;
    setGroups(data.groups); setGroupsError('');
    setDetail(null);
  };

  if (detail) {
    const item = detail.kind === 'category' ? budgets.find(c => c.key === detail.key) : undefined;
    const showGroup = (detail.kind === 'owes' || detail.kind === 'groupPlan') ? activeGroup : undefined;
    return <main className="cb-screen">
      {item && period && personal && detail.kind === 'category' && <CategoryTransactions highlightId={expenseTarget ? `share-${expenseTarget.expenseId}` : undefined} item={item} period={period} transactions={toCategoryTransactions(personal.transactions[item.key])}
        onBack={() => { onClearExpenseTarget?.(); setDetail(null); }} />}
      {detail.kind === 'limits' && personal && <EditLimits budgets={budgets} onCancel={() => setDetail(null)} onSave={saveLimits} />}
      {detail.kind === 'owes' && showGroup && <WhoOwesWhat group={showGroup} onBack={() => setDetail(null)} />}
      {detail.kind === 'groupPlan' && showGroup && <EditGroupPlan group={showGroup} onCancel={() => setDetail(null)} onSave={plannedCents => saveGroupPlan(showGroup.id, plannedCents)} />}
    </main>;
  }

  const retry = (message: string) => <div className="cb-notice cb-warn" role="alert">
    <p>{message}</p><button type="button" className="cb-retry" onClick={refresh}>Retry</button>
  </div>;

  return <main className="cb-screen">
    <header className="cb-header">
      {scope === 'group' ? <>
        <h1>{activeGroup?.name ?? 'Group budget'}</h1>
        <p>{activeGroup?.memberInfo ?? 'Shared spending with your groups'}</p>
      </> : <>
        <div className="cb-heading-row"><h1>Personal budget</h1>
          <span className="cb-heading-actions"><button type="button" className="cb-simulator-link" aria-label="Open what-if simulator" onClick={onOpenSimulator}>What-if ›</button></span></div>
        <p>Budgets, bank sync, and spending insights</p>
      </>}
    </header>

    <div className="cb-toggle" role="tablist" aria-label="Budget scope">
      <button type="button" role="tab" aria-selected={scope === 'personal'} className={scope === 'personal' ? 'active' : ''} onClick={() => setScope('personal')}>Personal</button>
      <button type="button" role="tab" aria-selected={scope === 'group'} className={scope === 'group' ? 'active' : ''} onClick={() => setScope('group')}>Group</button>
    </div>

    <label className="cb-month-picker">Budget month
      <span className="cb-month-control"><select value={selectedMonth || currentMonth} onChange={event => { latest.current.groups++; setGroups(null); setGroupsError(''); latest.current.personal++; setPersonal(null); setPersonalError(''); setExportError(''); setSelectedMonth(event.target.value); }}>
        {monthOptions.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
      </select></span>
    </label>
    {scope === 'group' ? (!groups ? (groupsError ? retry(groupsError) : <p className="cb-notice" role="status">Loading your groups…</p>)
      : !activeGroup ? <p className="cb-notice" role="status">You're not in any active groups yet. Create one from the Groups tab.</p> : <>
      <div className="cb-group-picker" role="tablist" aria-label="Select group">
        {groupBudgets.map(group => <button key={group.id} type="button" role="tab" aria-selected={group.id === activeGroup.id}
          className={group.id === activeGroup.id ? 'active' : ''} onClick={() => setActiveGroupId(group.id)}>
          <Avatar name={group.name} color={group.color} />
          {group.name}
        </button>)}
      </div>

      <section className="cb-hero" aria-label="Group budget summary">
        <strong className="cb-hero-amount">{formatCents(activeGroup.spentCents)} spent</strong>
        <p className="cb-hero-sub">{activeGroup.plannedCents ? `of ${formatCents(activeGroup.plannedCents)} shared plan` : 'No shared plan set'} · {historical ? 'Month ended' : daysLeftLabel(activeGroup.daysLeft)}</p>
        <div className="cb-hero-bar" role="presentation"><div style={{ width: `${groupPct}%` }} /></div>
        {!historical && activeGroup.canEditPlan && <div className="cb-hero-meta">
          <button type="button" onClick={() => setDetail({ kind: 'groupPlan' })}>Edit plan ›</button>
        </div>}
      </section>
      {activeGroup.plannedCents > 0 && activeGroup.spentCents > activeGroup.plannedCents && <p className="cb-notice cb-warn" role="status">
        Over the shared plan by {formatCents(activeGroup.spentCents - activeGroup.plannedCents)} for this month.</p>}

      <h2 className="cb-section-heading">Shared expenses</h2>
      {activeGroup.members.map(member => <div key={member.id} className="cb-category cb-member">
        <div className="cb-category-head">
          <span className="cb-member-name"><Avatar name={member.name} color={member.avatarColor} /><strong>{member.name}</strong></span>
          <span className={!historical && member.oweCents ? 'cb-owe' : ''}>{!historical && member.oweCents ? `Owes ${formatCents(member.oweCents)}` : `${formatCents(member.paidCents)} paid`}</span>
        </div>
        <div className="cb-category-bar" role="presentation"><div style={{ width: `${historical ? (activeGroup.spentCents ? member.paidCents / activeGroup.spentCents * 100 : 0) : member.pct}%`, background: historical ? 'var(--accent)' : member.barColor }} /></div>
      </div>)}

      <h2 className="cb-section-heading">Current balances</h2>
      <div className={`cb-balance-summary${remainingOwed === 0 ? ' is-settled' : ''}`} role="status">
        <span className="cb-balance-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={remainingOwed === 0 ? 'm5 12 4 4 10-10' : 'M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4'} />
          </svg>
        </span>
        {remainingOwed === 0 ? <><strong>All settled up</strong><p>Nobody owes money in {activeGroup.name} right now.</p></> : <>
          <strong>{formatCents(remainingOwed)} left to settle</strong>
          <p>{settleUpBody(activeGroup)}</p></>}
      </div>
      <button type="button" className="cb-review-all" onClick={() => setDetail({ kind: 'owes' })}>View who owes what ›</button>

    </>) : (!personal || !period ? (personalError ? retry(personalError) : <p className="cb-notice" role="status">Loading your budget…</p>) : <>
      <section className="cb-hero" aria-label="Budget summary">
        <strong className="cb-hero-amount">{formatCents(spent)} spent</strong>
        <p className="cb-hero-sub">{planned ? `of ${formatCents(planned)} planned` : 'No category limits set'} · {historical ? 'Month ended' : daysLeftLabel(period.daysLeft)}</p>
        <div className="cb-hero-bar" role="presentation"><div style={{ width: `${pct}%` }} /></div>
        <div className="cb-hero-meta">
          <span>{personal.lastSyncedAt ? `↻ Bank synced ${relativeTime(personal.lastSyncedAt)}` : '↻ No bank synced yet'}</span>
        </div>
      </section>
      <section className="cb-review-card cb-transaction-preview" aria-label="Recent transactions">
        <div className="cb-review-head"><div><h2>Recent transactions</h2><small>{new Date(`${activeMonth}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</small></div>
          {unreviewed.length > 0 && <span className="cb-review-attention" role="status" aria-label={`${unreviewed.length} ${unreviewed.length === 1 ? 'transaction needs' : 'transactions need'} categorization across all months`}><b aria-hidden="true">!</b>{unreviewed.length}</span>}
        </div>
        {unreviewed.length > 0 && <p className="cb-preview-status">Needs category in transaction review · {unreviewed.length} across all months</p>}
        {reviews.error && <p className="cb-preview-status cb-preview-error" role="alert">Unable to check transactions needing categorization. Pull down to retry.</p>}
        {transactionsLoading && <p className="cb-preview-status" role="status">Loading transactions…</p>}
        {!transactionsLoading && transactionsError && <p className="cb-preview-status cb-preview-error" role="alert">{transactionsError}</p>}
        {!transactionsLoading && !transactionsError && monthTransactions.length === 0 && <p className="cb-preview-status">No transactions for this month yet.</p>}
        {!transactionsLoading && !transactionsError && monthTransactions.slice(0, 3).map(transaction => <div className="cb-review-row" key={transaction.id}>
          <span><strong>{transaction.merchant}</strong><small>{labelForTransaction(transaction)} · {new Date(`${transaction.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</small></span>
          <b className={transaction.amountCents < 0 ? 'income' : ''}>{formatCents(transaction.amountCents)}</b>
        </div>)}
        <button type="button" className="cb-review-all" onClick={() => onOpenTransactions(activeMonth)}>View all transactions ›</button>
      </section>

      {!personal.hasBankConnection && <p className="cb-notice" role="status">Connect a bank account in Profile to see your bank transactions here.</p>}
      {overLimit.length > 0 && <p className="cb-notice cb-warn" role="status">Over budget for this month: {overLimit.map(item => item.label).join(', ')}.</p>}

      {historical && personal.hasSavedLimits === false && <p className="cb-notice">No budget limits were saved for this month. Your actual spending is shown below.</p>}
      <div className="cb-section-row"><h2 className="cb-section-heading">Category plan</h2>
        {!historical && <button type="button" className="cb-simulator-link" onClick={() => setDetail({ kind: 'limits' })}>Edit limits</button>}</div>
      {budgets.map(item => {
        const { sharePct, usedPct, barPct } = categorySpending(item, spent);
        const limited = item.plannedCents > 0;
        return <button key={item.key} type="button" className="cb-category cb-row-button cb-category-summary"
          aria-label={`${item.label} transactions`} aria-describedby={`category-summary-${item.key}`} onClick={() => setDetail({ kind: 'category', key: item.key })}>
          <div className="cb-category-head">
            <strong>{item.label}</strong>
            <span>{limited ? `${formatCents(item.spentCents)} / ${formatCents(item.plannedCents)}` : `${formatCents(item.spentCents)} spent`}</span>
          </div>
          <div className="cb-category-bar" role="progressbar" aria-label={`${item.label} ${limited ? 'limit usage' : 'share of monthly spending'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={barPct}
            aria-valuetext={limited ? `${Math.round(usedPct)}% of limit used` : `${Math.round(sharePct)}% of monthly spending`}>
            <div style={{ width: `${barPct}%`, background: isOverLimit(item) ? 'var(--danger)' : item.color }} />
          </div>
          <div className="cb-category-stats" id={`category-summary-${item.key}`}>
            <span>{Math.round(sharePct)}% of monthly spending</span>
            <span>{limited ? `${Math.round(usedPct)}% of limit used` : 'No limit set'}</span>
            {isOverLimit(item) && <span className="cb-category-over">{formatCents(item.spentCents - item.plannedCents)} over limit</span>}
          </div>
        </button>;
      })}

      <button type="button" className="cb-simulator-link cb-export" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? 'Preparing…' : 'Export selected month (CSV)'}</button>
      {exportError && <p className="cb-notice cb-warn" role="alert">{exportError}</p>}
    </>)}
  </main>;
}
