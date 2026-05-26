// =============================================================================
// Entra ID auth bootstrap — M1 / ALE-79 (skeleton) + M2 / ALE-80 (wiring)
// =============================================================================
//
// Per docs/15 §2: "Auth | None (open dev server) | Entra ID through the
// Switchboard shell". The production Code App runs inside Power Platform; the
// shell hands the user's Entra context to the embedded Code App. This module
// is the single point where that context becomes available to the rest of the
// app — services/dataverse.ts and friends read the resolved Power SDK client
// from here.
//
// Status: SKELETON. ensureAuthenticated() resolves immediately with a null
// user; the app boots unauthenticated so dev mode still works. Once the
// AUTH_CONFIG constants below are filled in (tenant / client / scopes) and
// Power Platform credentials are configured for the environment, swap the
// stub body for the real Power SDK auth call.
//
// Open questions for @alexrsmith — answers turn this skeleton into M2:
//
//   Q4. Auth strategy. Inside a Power Code App, the host should provide
//       a current-user context without a separate sign-in. Options:
//         (a) Use the Code App SDK's getCurrentUser() — preferred per spec
//             §2 ("Entra ID through the Switchboard shell"). No MSAL needed.
//         (b) Run MSAL directly with the Switchboard's app registration.
//             Use this only if the Code App host doesn't expose getCurrentUser
//             (e.g., previewing outside the host shell).
//
//   Q5. Tenant + client + scopes. From the Switchboard's app registration in
//       Entra. Fill into AUTH_CONFIG below; never commit secrets.
//
//   Q6. Required Dataverse scope. Typical value is
//       `https://<environment>.crm.dynamics.com/.default` — confirm against
//       the environment URL once provisioned.
// =============================================================================

// -----------------------------------------------------------------------------
// FILL-IN-THE-BLANKS: Entra / Power Platform configuration.
// -----------------------------------------------------------------------------

export const AUTH_CONFIG = {
  // Q4: pick a strategy. Switchboard hosting → "code-app-host". Standalone → "msal".
  strategy: "code-app-host" as "code-app-host" | "msal",

  // Q5: from the Entra app registration. The Switchboard shell already has
  // one; reuse it so the user doesn't sign in twice.
  tenantId: "TBD_ENTRA_TENANT_ID",
  clientId: "TBD_ENTRA_CLIENT_ID",

  // Q6: Dataverse environment URL — drives the scope for the Power SDK
  // token request. Find this in Power Platform admin → Environments → URL.
  dataverseEnvironmentUrl: "https://TBD.crm.dynamics.com",

  /** Scopes requested at login. .default uses the consent already granted. */
  scopes: ["https://TBD.crm.dynamics.com/.default"],

  // Optional: explicitly pin the redirect URI used by MSAL fallback. In
  // strategy=code-app-host this is ignored.
  redirectUri: "TBD_CODE_APP_REDIRECT_URI",
} as const;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface AuthenticatedUser {
  /** Entra OID. Maps to lum_UserProfile.userId. */
  userId: string;
  email: string;
  displayName: string;
  /** Bearer token for the Dataverse environment. Power SDK manages refresh. */
  accessToken: string;
}

/**
 * Currently signed-in user, or null while the skeleton stub is active.
 * Filled by `ensureAuthenticated`. Read by `services/dataverse.ts`.
 */
let currentUser: AuthenticatedUser | null = null;

export function getCurrentUser(): AuthenticatedUser | null {
  return currentUser;
}

/**
 * Boot-time gate. main.tsx awaits this before mounting React so the first
 * render already has an auth context. Returns immediately in skeleton mode
 * so dev startup isn't blocked.
 */
export async function ensureAuthenticated(): Promise<AuthenticatedUser | null> {
  if (AUTH_CONFIG.tenantId === "TBD_ENTRA_TENANT_ID") {
    // Skeleton: no creds yet. Boot unauthenticated; dataverse stubs handle it.
    console.warn(
      "[skeleton] auth.ensureAuthenticated — no Entra creds wired. " +
        "Fill in AUTH_CONFIG in src/services/auth.ts to turn auth on (M2).",
    );
    return null;
  }

  if (AUTH_CONFIG.strategy === "code-app-host") {
    // M2 wiring (option a):
    //   const ctx = await window.PowerPlatform?.codeApp?.getCurrentUser();
    //   currentUser = { userId: ctx.oid, email: ctx.email,
    //                   displayName: ctx.displayName,
    //                   accessToken: ctx.accessToken };
    throw new Error("[NotImplemented] auth: code-app-host wiring lands in M2.");
  }

  // M2 wiring (option b — MSAL standalone fallback):
  //   const msal = new PublicClientApplication({
  //     auth: { clientId: AUTH_CONFIG.clientId,
  //             authority: `https://login.microsoftonline.com/${AUTH_CONFIG.tenantId}`,
  //             redirectUri: AUTH_CONFIG.redirectUri },
  //     cache: { cacheLocation: "sessionStorage" },
  //   });
  //   await msal.initialize();
  //   const accounts = msal.getAllAccounts();
  //   const account = accounts[0] ?? (await msal.loginPopup({ scopes: [...AUTH_CONFIG.scopes] })).account;
  //   const result = await msal.acquireTokenSilent({ account, scopes: [...AUTH_CONFIG.scopes] });
  //   currentUser = { userId: account.localAccountId, email: account.username,
  //                   displayName: account.name ?? account.username,
  //                   accessToken: result.accessToken };
  throw new Error("[NotImplemented] auth: MSAL fallback wiring lands in M2.");
}
