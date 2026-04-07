# better-auth-siws

Sign In With Solana (SIWS) plugin for [Better Auth](https://www.better-auth.com/) — wallet authentication, linking, and ready-made React components.

## Features

- **Server plugin** — SIWS nonce generation + signature verification, session creation
- **Client plugin** — `signIn.solana()`, wallet management methods
- **Wallet linking** — Link/unlink Solana wallets to existing accounts
- **React components** — Drop-in `<SolanaSignInButton>` and `<SolanaLinkWallet>`
- **Anonymous mode** — Optionally allow sign-up with wallet only (no email required)
- Uses `@solana/wallet-standard-util` for cryptographic verification

## Installation

```bash
npm install @pinklemon8/better-auth-siws @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-standard-features @solana/wallet-standard-util @solana/web3.js
```

## Quick Start

### 1. Server Setup

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { siws } from "@pinklemon8/better-auth-siws";
import { siwsLink } from "@pinklemon8/better-auth-siws/link";

export const auth = betterAuth({
  // ...your config
  plugins: [
    siws({
      // All options are optional
      statement: "Sign in to MyApp with your Solana wallet",
      chainId: "mainnet",
      nonceExpiryMs: 5 * 60 * 1000, // 5 minutes (default)
      anonymous: false, // true = allow sign-up with wallet only
    }),
    siwsLink(), // adds /siws/link, /siws/unlink, /siws/wallets endpoints
  ],
});
```

### 2. Client Setup

```ts
// auth-client.ts
import { createAuthClient } from "better-auth/react";
import { siwsClient } from "@pinklemon8/better-auth-siws/client";

export const authClient = createAuthClient({
  plugins: [siwsClient()],
});
```

### 3. React Components (Optional)

Drop-in sign-in button:

```tsx
import { SolanaSignInButton } from "@pinklemon8/better-auth-siws/react";

function LoginPage() {
  return (
    <SolanaSignInButton
      onSuccess={(user) => {
        console.log("Signed in:", user);
        window.location.href = "/dashboard";
      }}
      onError={(err) => console.error(err)}
      className="btn btn-primary"
    />
  );
}
```

Wallet linking for settings pages:

```tsx
import { SolanaLinkWallet } from "@pinklemon8/better-auth-siws/react";

function WalletSettings() {
  return (
    <SolanaLinkWallet
      onLink={(addr) => console.log("Linked:", addr)}
      onUnlink={() => console.log("Unlinked")}
      onError={(err) => console.error(err)}
      className="btn"
      unlinkClassName="btn btn-danger"
    />
  );
}
```

Custom rendering for linked state:

```tsx
<SolanaLinkWallet
  renderLinked={({ address, onUnlink }) => (
    <div>
      <code>{address}</code>
      <button onClick={onUnlink}>Remove</button>
    </div>
  )}
/>
```

## API Reference

### Server Plugin: `siws(options?)`

Registers these Better Auth endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/siws/nonce` | POST | Generate a nonce for SIWS. Body: `{ walletAddress }` |
| `/siws/verify` | POST | Verify signature and create session. Body: `{ input, output }` |

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `statement` | `string` | Generic statement | Message shown in wallet |
| `chainId` | `string` | `"mainnet"` | Solana chain ID |
| `nonceExpiryMs` | `number` | `300000` (5 min) | Nonce TTL |
| `anonymous` | `boolean` | `false` | Allow sign-up without pre-existing account |

### Server Plugin: `siwsLink(options?)`

Registers wallet linking endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/siws/link` | POST | Link wallet to authenticated user |
| `/siws/unlink` | POST | Unlink wallet. Body: `{ walletAddress }` |
| `/siws/wallets` | GET | List linked wallets for current user |

### Client Plugin: `siwsClient()`

Adds these methods to your auth client:

```ts
// Sign in with Solana
authClient.signIn.solana({ input, output });

// Get nonce
authClient.solana.getNonce({ walletAddress });

// Link/unlink/list wallets
authClient.solana.linkWallet({ input, output });
authClient.solana.unlinkWallet({ walletAddress });
authClient.solana.getLinkedWallets();
```

### React Components

| Component | Props | Description |
|---|---|---|
| `SolanaProvider` | `cluster`, `endpoint`, `autoConnect` | Wraps Solana wallet adapter providers |
| `SolanaSignInButton` | `baseURL`, `basePath`, `onSuccess`, `onError`, `className`, `disabled`, `cluster`, `endpoint` | Complete sign-in button |
| `SolanaLinkWallet` | `baseURL`, `basePath`, `onLink`, `onUnlink`, `onError`, `className`, `disabled`, `cluster`, `endpoint`, `renderLinked` | Wallet link/unlink component |

## How It Works

1. User clicks sign-in button, wallet modal opens (Phantom, Solflare, etc.)
2. Plugin generates a nonce stored in Better Auth's verification table
3. Wallet signs the SIWS message using `adapter.signIn(input)` (Wallet Standard)
4. Plugin verifies the signature using `@solana/wallet-standard-util`
5. Looks up the wallet address in the `account` table (`providerId: "solana"`)
6. Creates a session and sets the cookie

**Wallet linking** uses the same SIWS verification but associates the wallet with the currently authenticated user instead of creating a new session.

## Requirements

- Better Auth >= 1.2.0
- A Solana wallet that supports SIWS (e.g., Phantom v23.11.0+, Solflare)
- Node.js 18+ (uses `crypto.getRandomValues`)

## License

MIT
