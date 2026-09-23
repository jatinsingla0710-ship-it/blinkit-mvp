import type { ShopAuthLink, StaffProfile } from '@groaurum/shared-types';

export interface AuthSession {
  authUserId: string;
  mobile: string;
  profile: StaffProfile | null;
  linkedShopId: string | null;
}

export interface AuthenticationShopLinkingService {
  getCurrentSession(): Promise<AuthSession | null>;
  requestPhoneOtp(mobile: string): Promise<void>;
  verifyPhoneOtp(mobile: string, otp: string): Promise<AuthSession>;
  ensureCustomerProfile(): Promise<void>;
  linkVerifiedMobile(shopId?: string): Promise<{
    linked: boolean;
    shopId?: string;
    alreadyLinked?: boolean;
    reason?: string;
    choices?: { shopId: string; shopName: string }[];
  }>;
  linkAuthToShopOnLogin(mobile: string, authUserId: string): Promise<ShopAuthLink>;
}
