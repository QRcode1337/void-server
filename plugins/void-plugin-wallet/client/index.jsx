/**
 * Wallet Plugin Client Entry Point
 *
 * Exports all client components for dynamic loading by void-server.
 */

// Route definitions
export const routes = [
  {
    path: '',
    component: 'WalletPage',
    title: 'Wallets'
  }
];

// Default navigation config
export const defaultNav = {
  section: null,
  title: 'Wallets',
  icon: 'wallet'
};

// Component map for dynamic loading
export const componentMap = {
  WalletPage: () => import('./pages/WalletPage')
};
