export type SkuCommissionHistoryVm = {
  amount: number;
  amountLabel: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  open: boolean;
};

export type SkuCommissionRowVm = {
  skuId: string;
  productName: string;
  skuName: string;
  skuCode: string;
  sellingUnit: string;
  currentAmount: number | null;
  currentAmountLabel: string;
  effectiveFrom: string | null;
  open: boolean;
  history: SkuCommissionHistoryVm[];
};
