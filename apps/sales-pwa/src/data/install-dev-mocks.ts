import { createAuthProvider } from '@groaurum/auth';
import { registerDevAuthFactory } from '@/auth/createSalesAuthProvider';
import { createMockSalesmanService } from './salesman-api-mock';
import { installDevMockSalesmanApi, isSalesDataMockMode } from './salesmanApi';

/** Development-only. The production build does not import this module. */
export function installDevMocks(): void {
  if (isSalesDataMockMode()) {
    installDevMockSalesmanApi(createMockSalesmanService());
  }
  registerDevAuthFactory(createAuthProvider);
}
