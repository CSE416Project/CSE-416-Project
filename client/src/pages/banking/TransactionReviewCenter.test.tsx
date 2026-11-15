import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import TransactionReviewCenter from './TransactionReviewCenter';

const transaction = {
  id: 'tx-1', accountId: 'account-1', accountName: 'Checking', institution: 'Test Bank', merchant: 'Corner Cafe', name: 'CORNER CAFE',
  date: '2026-10-29', amountCents: 1250, pending: false, providerCategory: 'FOOD_AND_DRINK', category: 'dining',
  excluded: false, note: null, reviewed: false, needsReview: true, reviewedAt: null, linkedExpense: null, splits: [],
};

beforeEach(() => vi.restoreAllMocks());

it('shows all transactions, then categorizes only the item that needs review', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/banking/transactions?')) return new Response(JSON.stringify({ transactions: [transaction] }), { status: 200 });
    if (url.endsWith('/banking/transactions/tx-1/review')) return new Response(JSON.stringify({ transaction: { ...transaction, category: 'shopping', note: 'Office supplies', reviewed: true, reviewedAt: Date.now() } }), { status: 200 });
    return new Response(JSON.stringify({ error: 'Unexpected request' }), { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<TransactionReviewCenter onBack={() => {}} />);

  fireEvent.click(await screen.findByRole('tab', { name: /Needs category/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Corner Cafe/ }));
  fireEvent.change(screen.getByLabelText('CATEGORY'), { target: { value: 'shopping' } });
  fireEvent.change(screen.getByLabelText('NOTE'), { target: { value: 'Office supplies' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/banking/transactions/tx-1/review'), expect.objectContaining({
    method: 'PUT',
    body: JSON.stringify({ category: 'shopping', excluded: false, note: 'Office supplies', reviewed: true, splits: [] }),
  })));
  expect(await screen.findByText('Everything is categorized')).toBeInTheDocument();
  expect(screen.queryByLabelText('1 transaction needs categorization')).not.toBeInTheDocument();
});

it('opens with the requested budget month and filters from the popup', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ transactions: [transaction] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<TransactionReviewCenter initialMonth="2026-10" onBack={() => {}} />);

  expect(await screen.findByText('October 2026')).toBeInTheDocument();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('month=2026-10'), expect.anything()));
  fireEvent.click(screen.getByRole('button', { name: 'Filter transactions' }));
  fireEvent.change(screen.getByLabelText('Transaction month'), { target: { value: '2026-09' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('month=2026-09'), expect.anything()));
});

it('highlights a linked group expense and distinguishes its budget share from the original charge', async () => {
  const linked = { ...transaction, amountCents: 25000, linkedExpense: {
    id: 'expense-1', title: 'Cheesecake dinner', groupName: 'Boston trip', personalBudgetCents: 12000,
  } };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ transactions: [linked] }), { status: 200 })));
  render(<TransactionReviewCenter initialMonth="2026-10" onBack={() => {}} />);

  const card = await screen.findByRole('button', { name: /Corner Cafe/ });
  expect(card).toHaveClass('linked-group-expense');
  expect(card).toHaveTextContent('Linked to Cheesecake dinner · Boston trip');
  expect(card).toHaveTextContent('$120.00Personal budget');
  expect(card).toHaveTextContent('$250.00Original charge');
  fireEvent.click(card);
  expect(screen.getByText(/Your personal budget counts/)).toHaveTextContent('$120.00 instead of the original $250.00 bank charge');
});

it('requires split amounts to equal the charge before saving', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ transactions: [transaction] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<TransactionReviewCenter onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: /Corner Cafe/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Split across categories/ }));
  fireEvent.change(screen.getByLabelText('Split 1 amount'), { target: { value: '5.00' } });
  fireEvent.change(screen.getByLabelText('Split 2 amount'), { target: { value: '5.00' } });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(screen.getByText('$10.00 of $12.50 allocated')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Split 2 amount'), { target: { value: '7.50' } });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});

it('lets a user correct a deposit so it counts as income', async () => {
  const deposit = { ...transaction, id: 'deposit-1', merchant: 'Stony Brook Payroll', amountCents: -125000, providerCategory: 'TRANSFER_IN', category: null, needsReview: false, reviewed: true };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/banking/transactions?')) return new Response(JSON.stringify({ transactions: [deposit] }), { status: 200 });
    if (url.endsWith('/banking/transactions/deposit-1/review')) return new Response(JSON.stringify({ transaction: { ...deposit, category: 'income' } }), { status: 200 });
    return new Response('{}', { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<TransactionReviewCenter onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: /Stony Brook Payroll/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Count as income/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/banking/transactions/deposit-1/review'), expect.objectContaining({
    body: JSON.stringify({ category: 'income', excluded: false, note: null, reviewed: true, splits: [] }),
  })));
});


it('shows the global attention count and finds older uncategorized transactions without a month restriction', async () => {
  const categorized = { ...transaction, id: 'categorized', merchant: 'Reviewed Cafe', reviewed: true, needsReview: false };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const needsCategory = url.searchParams.get('status') === 'unreviewed';
    return new Response(JSON.stringify({ transactions: needsCategory ? [transaction] : [categorized] }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<TransactionReviewCenter initialMonth="2026-11" onBack={() => {}} />);
  await screen.findByRole('button', { name: /Reviewed Cafe/ });
  const tab = screen.getByRole('tab', { name: /Needs category/ });
  expect(await screen.findByLabelText('1 transaction needs categorization')).toBeVisible();
  fireEvent.click(tab);
  expect(await screen.findByRole('button', { name: /Corner Cafe/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Reviewed Cafe/ })).not.toBeInTheDocument();
  expect(tab).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Needs category · All months')).toBeVisible();
  const categoryRequests = fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost')).filter(url => url.searchParams.get('status') === 'unreviewed');
  expect(categoryRequests.every(url => !url.searchParams.has('month'))).toBe(true);
  fireEvent.click(screen.getByRole('tab', { name: 'All' }));
  await screen.findByRole('button', { name: /Reviewed Cafe/ });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('status=all&month=2026-11'), expect.anything()));
});

it('keeps the needs-category tab without an attention badge when there is nothing to categorize', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ transactions: [] }), { status: 200 })));
  render(<TransactionReviewCenter onBack={() => {}} />);
  await screen.findByText('No matching transactions');
  const tab = screen.getByRole('tab', { name: 'Needs category' });
  fireEvent.keyDown(screen.getByRole('tab', { name: 'All' }), { key: 'ArrowRight' });
  expect(tab).toHaveFocus();
  expect(tab).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByText('Everything is categorized')).toBeVisible();
});


it('keeps the attention count while a search has no matches', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    return new Response(JSON.stringify({ transactions: url.searchParams.has('query') ? [] : [transaction] }), { status: 200 });
  }));
  render(<TransactionReviewCenter onBack={() => {}} />);
  await screen.findByLabelText('1 transaction needs categorization');
  fireEvent.click(screen.getByRole('tab', { name: /Needs category/ }));
  await screen.findByRole('button', { name: /Corner Cafe/ });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } });
  expect(await screen.findByText('No matching transactions')).toBeVisible();
  expect(screen.queryByText('Everything is categorized')).not.toBeInTheDocument();
  expect(screen.getByLabelText('1 transaction needs categorization')).toBeVisible();
});
