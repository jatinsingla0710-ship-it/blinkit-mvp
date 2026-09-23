export {
  APP_ROLES,
  ADMIN_ROLES,
  APP_AUDIENCES,
  audienceForRole,
  isAdminRole,
  isAppRole,
  type AppRole,
  type AppAudience,
} from './roles';

export {
  PERMISSIONS,
  ADMIN_MODULES,
  MODULE_ALLOWED_ROLES,
  ROLE_PERMISSIONS,
  type Permission,
  type AdminModule,
} from './permissions';

export {
  LIVE_STAFF_ROLES,
  LIVE_MAPPED_APP_ROLES,
  FRONTEND_ONLY_APP_ROLES,
  STAFF_ROLE_TO_APP_ROLE,
  isLiveMappedAppRole,
  isFrontendOnlyAppRole,
  staffRolesForAppRole,
  type LiveStaffRole,
  type LiveMappedAppRole,
  type FrontendOnlyAppRole,
} from './staff-role-map';

export {
  buildRolePermissionMatrix,
  roleHasModuleAccess,
  assertRoleMatrixCoversAppRoles,
  type RoleSourceKind,
  type RoleMatrixRow,
  type RolePermissionMatrix,
} from './role-permission-matrix';

export type {
  AuthProviderKind,
  SessionStatus,
  AuthErrorCode,
  AuthError,
  AuthUser,
  AuthSession,
  AuthState,
  AuthStateListener,
  SignInCredentials,
  AuthProvider,
  PermissionCheckInput,
} from './types';

export {
  parsePublicAuthConfig,
  assertPublicAuthConfig,
  APP_ENVS,
  type AppEnv,
  type PublicAuthConfig,
  type EnvSource,
} from './env';

export { createAuthError } from './errors';
export {
  canAccessModule,
  hasPermission,
  isSessionExpired,
  resolveAppDestination,
  resolveNavigationAudience,
  roleHasPermission,
  userHasAnyRole,
  userHasPermission,
  userHasRole,
} from './helpers';

export { createMockAuthProvider } from './providers/mock-auth-provider';
export { createSupabaseAuthProviderStub } from './providers/supabase-auth-provider.stub';
export {
  createSupabaseAuthProvider,
  type SupabaseAuthClientLike,
  type SupabaseAuthProviderOptions,
} from './providers/supabase-auth-provider';
export { createAuthProvider } from './create-auth-provider';
export {
  APP_DESTINATION_PATHS,
  destinationPathForAudience,
} from './navigation';
