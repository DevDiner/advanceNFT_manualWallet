import React from 'react';
import Button from './shared/Button';

type Page = 'minter' | 'wallet';

interface HeaderProps {
    account: string | null;
    connectWallet: () => void;
    disconnectWallet: () => void;
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = ({ account, connectWallet, disconnectWallet, currentPage, setCurrentPage }) => {
    const displayAddress = account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : '';

    const navLinkClasses = (page: Page) => 
        `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            currentPage === page 
            ? 'bg-purple-600 text-white' 
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`;

    return (
        <header className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-white">
                <span className="text-purple-400">Advanced</span>NFT
            </h1>
            
            <nav className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('minter')} className={navLinkClasses('minter')}>
                    Minter
                </button>
                <button onClick={() => setCurrentPage('wallet')} className={navLinkClasses('wallet')}>
                    My Wallet
                </button>
            </nav>

            {account ? (
                <div className="flex items-center gap-4">
                     <span className="hidden sm:block bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-mono text-sm">{displayAddress}</span>
                    <Button onClick={disconnectWallet} variant="secondary">Disconnect</Button>
                </div>
            ) : (
                <Button onClick={connectWallet}>Connect Wallet</Button>
            )}
        </header>
    );
};

export default Header;