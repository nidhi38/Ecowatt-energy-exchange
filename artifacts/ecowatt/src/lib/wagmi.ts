import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'b93jXjPJg0pj7ra-INml1';

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  },
});
