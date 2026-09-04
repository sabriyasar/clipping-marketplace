export function calculatePayout(
  views: number,
  payoutPer1kViews: number,
): number {
  return Math.floor(views / 1000) * payoutPer1kViews;
}
