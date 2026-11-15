import { prisma } from '../../config/database.js';
import { automaticExclusionReason, requiresCategoryReview } from '../budgets/budget.categories.js';

export const CLASSIFICATION_VERSION = 1;
/** Upgrade existing imports once, without changing provider data or users' explicit categories. */
export async function refreshBankClassification(userId: string) {
  const rows = await prisma.bankTransaction.findMany({
    where: { classificationVersion: { lt: CLASSIFICATION_VERSION }, account: { connection: { userId } } },
    select: { id: true, category: true, name: true, merchant: true, amountCents: true, categoryOverride: true, excluded: true, autoExcludedReason: true, reviewSplits: { select: { id: true } } },
  });
  const batches = new Map<string, { ids: string[]; data: { excluded: boolean; needsReview: boolean; autoExcludedReason: string | null } }>();
  for (const row of rows) {
    const autoExcludedReason = automaticExclusionReason(row);
    const excluded = !!autoExcludedReason || (row.excluded && !row.autoExcludedReason);
    const needsReview = !excluded && !row.categoryOverride && !row.reviewSplits.length && requiresCategoryReview(row);
    const data = { excluded, needsReview, autoExcludedReason };
    const key = JSON.stringify(data);
    if (!batches.has(key)) batches.set(key, { ids: [], data });
    batches.get(key)!.ids.push(row.id);
  }
  for (const { ids, data } of batches.values()) await prisma.bankTransaction.updateMany({
    where: { id: { in: ids }, classificationVersion: { lt: CLASSIFICATION_VERSION } }, data: { ...data, classificationVersion: CLASSIFICATION_VERSION },
  });
}
