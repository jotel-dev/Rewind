import { getQorexEip1193Provider, qorexWallet } from "@qorechain/qorex-rainbowkit";
import { createConnector } from "wagmi";

type Provider = NonNullable<ReturnType<typeof getQorexEip1193Provider>>;

async function requestWithTimeout(provider: Provider, args: Parameters<Provider["request"]>[0], ms: number) {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      provider.request(args),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(
          "QoreX did not respond. Open and unlock the extension, check for a pending connection prompt, then retry.",
        )), ms);
      }),
    ]);
    if (args.method === "eth_requestAccounts" && (!Array.isArray(result) || result.length === 0)) {
      throw new Error("QoreX returned no accounts. Unlock it and approve the connection.");
    }
    return result;
  } catch (error) {
    // RainbowKit switches to the selected wallet panel on a short timer.
    // An immediate rejection can otherwise be cleared by that transition.
    const remaining = 200 - (performance.now() - started);
    if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function reconnectableProvider(provider: Provider): Provider {
  return {
    isQoreX: true,
    on: provider.on.bind(provider),
    removeListener: provider.removeListener.bind(provider),
    async request(args) {
      // The documented QoreX bridge supports account requests directly.
      // Let wagmi skip its optional permissions probe and open that prompt.
      if (args.method === "wallet_requestPermissions") {
        throw Object.assign(new Error("QoreX does not support wallet_requestPermissions."), { code: 4200 });
      }
      if (args.method === "eth_requestAccounts") {
        return requestWithTimeout(provider, args, 30_000);
      }
      if (args.method === "eth_accounts" || args.method === "eth_chainId") {
        return requestWithTimeout(provider, args, 5_000);
      }
      return provider.request(args);
    },
  };
}

export function rewindQorexWallet(): ReturnType<typeof qorexWallet> {
  const wallet = qorexWallet({ pollAccountsOnFocus: true });
  return {
    ...wallet,
    createConnector: (details) => {
      const createQorex = wallet.createConnector(details);
      return createConnector((config) => {
        const connector = createQorex(config);
        return {
          ...connector,
          async getProvider(parameters) {
            const provider = await connector.getProvider(parameters) as Provider | undefined;
            return provider && reconnectableProvider(provider);
          },
        };
      });
    },
  };
}
