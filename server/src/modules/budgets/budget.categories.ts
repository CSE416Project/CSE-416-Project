export const CATEGORY_KEYS = ['dining', 'groceries', 'transit', 'shopping', 'other'] as const;
export type CategoryKey = typeof CATEGORY_KEYS[number];

export const MAX_LIMIT_CENTS = 100_000_000;

// What-if simulator: the most scenarios a user can keep, and the longest scenario name.
export const MAX_SAVED_SCENARIOS = 8;
export const MAX_SCENARIO_NAME_LENGTH = 40;

// Plaid primary categories that are money moving between the user's own accounts, income,
// or loan/credit-card payments. Counting them would double count the spending they pay for.
export const NOT_SPENDING = new Set(['INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS']);
const OTHER_SPENDING = new Set([
  'BANK_FEES', 'ENTERTAINMENT', 'GENERAL_SERVICES', 'GOVERNMENT_AND_NON_PROFIT',
  'HOME_IMPROVEMENT', 'MEDICAL', 'PERSONAL_CARE', 'RENT_AND_UTILITIES', 'TRAVEL',
]);
// Ordered merchant rules fill gaps in provider data. Specific food services precede ride services.
const MERCHANT_RULES: { category: CategoryKey; pattern: RegExp }[] = [
  { category: 'groceries', pattern: /grocer|supermarket|trader joe|whole foods|safeway|kroger|aldi|publix|wegmans|sprouts|farmers? market|\bweee\b|h mart|99 ranch|stop ?& ?shop|food lion|shoprite|fresh direct/i },
  { category: 'dining', pattern: /uber\s*eats|doordash|grubhub|postmates|restaurant|\bcaf[eé]\b|coffee|starbucks|dunkin|mcdonald|chipotle|shake shack|panera|taichi|tai chi|boba|pizza|sushi|bakery|taco bell|burger king|chick.?fil.?a/i },
  { category: 'transit', pattern: /\buber\b|\blyft\b|\bmta\b|\blirr\b|metro.?north|amtrak|transit|subway fare|parking|\bexxon\b|\bshell\b|\bsunoco\b|\bchevron\b/i },
  { category: 'shopping', pattern: /amazon|\bamzn\b|\btarget\b|walmart|\bcostco\b|best buy|\bikea\b|\betsy\b|\bebay\b|tj.?maxx|marshalls|uniqlo|\bnike\b|\bsephora\b|\b7.?eleven\b/i },
];
export type CategorizableTransaction = { category: string | null; name: string; merchant: string | null };
function matchedCategory(transaction: CategorizableTransaction): CategoryKey | null {
  const text = `${transaction.merchant ?? ''} ${transaction.name}`;
  const merchant = MERCHANT_RULES.find(rule => rule.pattern.test(text));
  if (merchant) return merchant.category;
  switch (transaction.category) {
    case 'FOOD_AND_DRINK': return 'dining';
    case 'TRANSPORTATION': return 'transit';
    case 'GENERAL_MERCHANDISE': return 'shopping';
    default: return transaction.category && OTHER_SPENDING.has(transaction.category) ? 'other' : null;
  }
}
/** Unknown purchases count under Other immediately, while retaining an attention flag. */
export function categorize(transaction: CategorizableTransaction): CategoryKey | null {
  return NOT_SPENDING.has(transaction.category ?? '') ? null : matchedCategory(transaction) ?? 'other';
}
export function requiresCategoryReview(transaction: CategorizableTransaction & { amountCents: number }) {
  return transaction.amountCents > 0 && !automaticExclusionReason(transaction) && !NOT_SPENDING.has(transaction.category ?? '') && matchedCategory(transaction) === null;
}
const CARD_PAYMENT = /\b(?:credit card payment|card payment|payment thank you|autopay payment|capital one (?:mobile|online) (?:pymt|payment))\b/i;
export function automaticExclusionReason(transaction: CategorizableTransaction & { amountCents?: number }) {
  if (transaction.amountCents !== undefined && transaction.amountCents <= 0) return 'DEPOSIT_OR_REFUND';
  if (CARD_PAYMENT.test(`${transaction.merchant ?? ''} ${transaction.name}`)) return 'CREDIT_CARD_PAYMENT';
  return null;
}

export type MonthWindow = { month: string; start: Date; end: Date; daysInMonth: number; daysLeft: number };

/** The UTC calendar month containing `now`, with `end` exclusive. Bank and expense dates are stored as UTC dates. */
export function monthWindow(now: Date): MonthWindow {
  const year = now.getUTCFullYear(), index = now.getUTCMonth();
  return {
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    start: new Date(Date.UTC(year, index, 1)),
    end: new Date(Date.UTC(year, index + 1, 1)),
    daysInMonth: new Date(Date.UTC(year, index + 1, 0)).getUTCDate(),
    daysLeft: new Date(Date.UTC(year, index + 1, 0)).getUTCDate() - now.getUTCDate(),
  };
}

/** The `count` UTC calendar months ending with the one containing `now`, oldest first, as `YYYY-MM` keys. */
export function recentMonths(now: Date, count: number): { keys: string[]; start: Date } {
  const keys = Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  return { keys, start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1)) };
}
