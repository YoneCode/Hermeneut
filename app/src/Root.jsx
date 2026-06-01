import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App.jsx";

const APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "";

// GenLayer Bradbury as a viem-style chain for Privy.
const bradbury = {
  id: 4221,
  name: "GenLayer Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-bradbury.genlayer.com"] } },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer-bradbury.genlayer.com" },
  },
  testnet: true,
};

// Default export so it can be lazy-loaded as its own chunk.
export default function Root() {
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: { theme: "dark", accentColor: "#d5e0ff", logo: undefined },
        loginMethods: ["email", "wallet", "google"],
        embeddedWallets: { createOnLogin: "users-without-wallets" },
        defaultChain: bradbury,
        supportedChains: [bradbury],
      }}
    >
      <App />
    </PrivyProvider>
  );
}
