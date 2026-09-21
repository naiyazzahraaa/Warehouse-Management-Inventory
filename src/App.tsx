import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useOutletContext, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Dashboard } from './components/Dashboard';
import { ItemManagement } from './components/ItemManagement';
import { BinCardPage } from './components/BinCardPage';
import { TransactionHistoryView } from './components/TransactionHistoryView';
import { QrScannerModal } from './components/QrScannerModal';
import { TransactionModal } from './components/TransactionModal';
import { BatchQrPrintModal } from './components/BatchQrPrintModal';
import { CsvImportModal } from './components/CsvImportModal';
import { ItemFormModal } from './components/ItemFormModal';
import { LoginModal } from './components/LoginModal';
import { LoginScreen } from './components/LoginScreen';
import { MultiDeviceSyncGuideModal } from './components/MultiDeviceSyncGuideModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InventoryItem, TransactionType } from './types';
import { db } from './services/db';
import { cloudSync } from './services/cloudSync';

interface ShellContextType {
  activeItem: InventoryItem | null;
  setActiveItem: React.Dispatch<React.SetStateAction<InventoryItem | null>>;
  refreshTrigger: number;
  handleOpenBinCard: (item: InventoryItem) => void;
  handleStartTransaction: (item: InventoryItem, type: TransactionType) => void;
  setItemToEdit: React.Dispatch<React.SetStateAction<InventoryItem | null>>;
  setIsAddItemOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsImportCsvOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsScannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSyncGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchPrintItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  handleOpenItemByCode: (code: string) => Promise<void>;
}

export function useShellContext() {
  return useOutletContext<ShellContextType>();
}

// 1. Root Path / : Auto redirect to /login if not authenticated, or /dashboard if authenticated
const RootRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// 2. Login Page Guard: If already authenticated, redirect smoothly to /dashboard without page reload
const LoginRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginScreen />;
};

// 3. Catch-all: If user tries to access any random or undefined route
const CatchAllRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// Helper to normalize any lingering '#/' hash paths from previous sessions into clean SPA paths
function HashUrlNormalizer() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.startsWith('#/')) {
      const cleanPath = window.location.hash.slice(1);
      window.history.replaceState(null, '', cleanPath);
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);
  return null;
}

// Sub-route page views consuming the shell context
function DashboardView() {
  const navigate = useNavigate();
  const ctx = useShellContext();
  return (
    <Dashboard
      onSelectItem={ctx.handleOpenBinCard}
      onOpenScanner={() => ctx.setIsScannerOpen(true)}
      onOpenAddItem={() => ctx.setIsAddItemOpen(true)}
      onOpenImportCsv={() => ctx.setIsImportCsvOpen(true)}
      onGoToItemsTab={() => navigate('/items')}
      onOpenSyncGuide={() => ctx.setIsSyncGuideOpen(true)}
    />
  );
}

function ItemsView() {
  const ctx = useShellContext();
  return (
    <ItemManagement
      onOpenBinCard={ctx.handleOpenBinCard}
      onOpenAddItem={() => ctx.setIsAddItemOpen(true)}
      onOpenEditItem={(item) => ctx.setItemToEdit(item)}
      onOpenImportCsv={() => ctx.setIsImportCsvOpen(true)}
      onOpenBatchPrint={(items) => ctx.setBatchPrintItems(items)}
      onRecordTransaction={(item, type) => ctx.handleStartTransaction(item, type)}
      refreshTrigger={ctx.refreshTrigger}
    />
  );
}

function TransactionsView() {
  const ctx = useShellContext();

  return (
    <TransactionHistoryView
      onSelectItemByCode={ctx.handleOpenItemByCode}
      refreshTrigger={ctx.refreshTrigger}
    />
  );
}

function BinCardView() {
  const ctx = useShellContext();
  return (
    <BinCardPage
      activeItem={ctx.activeItem}
      setActiveItem={ctx.setActiveItem}
      onRecordTransaction={ctx.handleStartTransaction}
      onEditItem={(item) => ctx.setItemToEdit(item)}
    />
  );
}

function MainAppShell() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSyncGuideOpen, setIsSyncGuideOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [batchPrintItems, setBatchPrintItems] = useState<InventoryItem[]>([]);
  const [transactionModalItem, setTransactionModalItem] = useState<InventoryItem | null>(null);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>('IN');

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Real-time synchronization subscription: whenever another device mutates data, refresh view automatically
  useEffect(() => {
    const unsubscribe = cloudSync.subscribeDataChanges(() => {
      setRefreshTrigger((prev) => prev + 1);
      if (activeItem) {
        db.getItemById(activeItem.id).then((fresh) => {
          if (fresh) setActiveItem(fresh);
        });
      }
    });
    return unsubscribe;
  }, [activeItem]);

  // Open Digital Bin Card for an item with instant SPA navigation
  const handleOpenBinCard = (item: InventoryItem) => {
    setActiveItem(item);
    navigate(`/bin-card/${item.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // When QR code is scanned, immediately jump to the Digital Bin Card
  const handleItemFoundByScanner = (item: InventoryItem) => {
    setActiveItem(item);
    navigate(`/bin-card/${item.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open item from transaction history by material code
  const handleOpenItemByCode = async (code: string) => {
    const item = await db.getItemByMaterialCode(code);
    if (item) {
      handleOpenBinCard(item);
    } else {
      alert(`Barang dengan kode '${code}' tidak ditemukan.`);
    }
  };

  // Record In/Out mutation
  const handleStartTransaction = (item: InventoryItem, type: TransactionType = 'IN') => {
    setTransactionModalItem(item);
    setTransactionModalType(type);
  };

  const handleTransactionSuccess = (updatedItem: InventoryItem) => {
    if (activeItem && activeItem.id === updatedItem.id) {
      setActiveItem(updatedItem);
    }
    triggerRefresh();
  };

  const handleItemSaved = (savedItem: InventoryItem) => {
    if (activeItem && activeItem.id === savedItem.id) {
      setActiveItem(savedItem);
    }
    triggerRefresh();
  };

  const handleCsvImportSuccess = (count: number) => {
    alert(`Sukses! ${count} data barang berhasil diimpor ke sistem.`);
    triggerRefresh();
    navigate('/items');
  };

  const shellContextValue: ShellContextType = {
    activeItem,
    setActiveItem,
    refreshTrigger,
    handleOpenBinCard,
    handleStartTransaction,
    setItemToEdit,
    setIsAddItemOpen,
    setIsImportCsvOpen,
    setIsScannerOpen,
    setIsSyncGuideOpen,
    setBatchPrintItems,
    handleOpenItemByCode,
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col antialiased">
      
      {/* Top Header */}
      <Navbar
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenSyncGuide={() => setIsSyncGuideOpen(true)}
      />

      {/* Main Content Area: Driven by Client-Side Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        <Outlet context={shellContextValue} />
      </main>

      {/* Mobile Floating Bottom Navigation */}
      <MobileBottomNav
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Modals & Dialogs */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onItemFound={handleItemFoundByScanner}
      />

      <TransactionModal
        isOpen={!!transactionModalItem}
        item={transactionModalItem}
        initialType={transactionModalType}
        onClose={() => setTransactionModalItem(null)}
        onSuccess={handleTransactionSuccess}
      />

      <BatchQrPrintModal
        isOpen={batchPrintItems.length > 0}
        items={batchPrintItems}
        onClose={() => setBatchPrintItems([])}
      />

      <CsvImportModal
        isOpen={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
        onImportSuccess={handleCsvImportSuccess}
      />

      <ItemFormModal
        isOpen={isAddItemOpen || !!itemToEdit}
        itemToEdit={itemToEdit}
        onClose={() => {
          setIsAddItemOpen(false);
          setItemToEdit(null);
        }}
        onSuccess={handleItemSaved}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <MultiDeviceSyncGuideModal
        isOpen={isSyncGuideOpen}
        onClose={() => setIsSyncGuideOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HashUrlNormalizer />
        <Routes>
          {/* 1. Default Route / Auto-Redirect: Root path "/" automatically redirects */}
          <Route path="/" element={<RootRoute />} />

          {/* 2. Opening Screen / Login Route */}
          <Route path="/login" element={<LoginRoute />} />

          {/* 3. Protected Routes: All internal app URLs are strictly guarded */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainAppShell />}>
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/items" element={<ItemsView />} />
              <Route path="/transactions" element={<TransactionsView />} />
              <Route path="/bin-card/:id" element={<BinCardView />} />
              <Route path="/bin-card" element={<BinCardView />} />
            </Route>
          </Route>

          {/* 4. Catch-all Route: Random or unknown paths redirect according to auth state */}
          <Route path="*" element={<CatchAllRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
