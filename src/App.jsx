import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import DashboardView from './components/dashboard/DashboardView';
import StockView from './components/stock/StockView';
import InvoicesView from './components/invoices/InvoicesView';
import CustomersView from './components/customers/CustomersView';
import SuppliersView from './components/suppliers/SuppliersView';
import ChargesView from './components/charges/ChargesView';
import MovementsView from './components/movements/MovementsView';
import ReturnsView from './components/returns/ReturnsView';
import TreasuryView from './components/treasury/TreasuryView';
import LossesView from './components/losses/LossesView';
import PosView from './components/pos/PosView';
import ReparationsView from './components/reparations/ReparationsView';
import UsersManagementView from './components/users/UsersManagementView';
import LoginView from './components/auth/LoginView';

import CreateInvoiceModal from './components/invoices/CreateInvoiceModal';
import CreatePurchaseModal from './components/purchases/CreatePurchaseModal';
import CreateTransactionModal from './components/treasury/CreateTransactionModal';
import CreateLossModal from './components/losses/CreateLossModal';
import ProductModal from './components/stock/ProductModal';
import InvoiceDetailModal from './components/invoices/InvoiceDetailModal';
import SaleReturnModal from './components/invoices/SaleReturnModal';
import ActivationModal from './components/license/ActivationModal';
import PrinterSettingsModal from './components/settings/PrinterSettingsModal';
import UpdateModal from './components/update/UpdateModal';
import ErrorBoundary from './components/common/ErrorBoundary';

import { api } from './services/api';
import { 
  AlertTriangle, 
  RefreshCw, 
  X, 
  Plus,
  ShoppingBag, 
  LayoutDashboard, 
  ReceiptText, 
  Users, 
  Building, 
  TrendingDown, 
  Package, 
  Wallet, 
  RotateCcw, 
  AlertOctagon, 
  ArrowLeftRight,
  Wrench,
  ShieldCheck 
} from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function AppContent() {
  const { t, isRTL, dir } = useLanguage();
  const { currentUser } = useAuth();

  // License & Update State
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  // Multi-Tab Workspaces State (Support multi-POS simultanés + autres onglets)
  const [tabs, setTabs] = useState(() => {
    if (currentUser?.role === 'REPARATEUR') {
      return [
        { id: 'reparations', type: 'reparations', title: 'SAV & Réparations', closable: false },
        { id: 'pos-1', type: 'pos', title: 'POS 1', closable: true }
      ];
    }
    if (currentUser?.role === 'VENDEUR') {
      return [
        { id: 'pos-1', type: 'pos', title: 'POS 1', closable: false }
      ];
    }
    return [
      { id: 'dashboard', type: 'dashboard', title: 'Tableau de Bord', closable: false },
      { id: 'pos-1', type: 'pos', title: 'POS 1', closable: true },
      { id: 'reparations', type: 'reparations', title: 'SAV & Réparations', closable: true }
    ];
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (currentUser?.role === 'REPARATEUR') return 'reparations';
    if (currentUser?.role === 'VENDEUR') return 'pos-1';
    return 'dashboard';
  });

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'REPARATEUR') {
      setTabs(prev => {
        if (!prev.some(t => t.type === 'reparations')) {
          return [{ id: 'reparations', type: 'reparations', title: 'SAV & Réparations', closable: false }, ...prev];
        }
        return prev;
      });
      setActiveTab('reparations');
    } else if (currentUser.role === 'VENDEUR') {
      setTabs([
        { id: 'pos-1', type: 'pos', title: 'POS 1', closable: false }
      ]);
      setActiveTab('pos-1');
    }
  }, [currentUser?.id, currentUser?.role]);

  const [dbStatus, setDbStatus] = useState({ connected: true });
  const [lowStockCount, setLowStockCount] = useState(0);

  // Global Modals
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isGlobalEncaissementOpen, setIsGlobalEncaissementOpen] = useState(false);
  const [isGlobalLossOpen, setIsGlobalLossOpen] = useState(false);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);
  const [isGlobalReturnOpen, setIsGlobalReturnOpen] = useState(false);
  const [invoiceForGlobalReturn, setInvoiceForGlobalReturn] = useState(null);

  // Check License Status
  const checkLicense = async () => {
    try {
      const res = await api.license.getStatus();
      if (res && res.success && res.data) {
        setLicenseInfo(res.data);
      } else {
        setLicenseInfo({ isActivated: false, machineId: res?.data?.machineId || 'CP-INDISPONIBLE', status: 'NOT_ACTIVATED' });
      }
    } catch (e) {
      console.warn('Vérification licence échouée:', e);
      setLicenseInfo({ isActivated: false, machineId: 'CP-ERROR', status: 'NOT_ACTIVATED' });
    } finally {
      setLicenseLoading(false);
    }
  };

  // Check DB status on mount and periodically
  const checkDB = async () => {
    try {
      const status = await api.getDBStatus();
      setDbStatus(status);

      // Check low stock count
      const stockRes = await api.stock.getAll({ lowStockOnly: true });
      if (stockRes.success) {
        setLowStockCount(stockRes.data?.length || 0);
      }
    } catch (e) {
      console.warn('Vérification DB échouée:', e);
    }
  };

  useEffect(() => {
    checkLicense();
    checkDB();
    const interval = setInterval(() => {
      checkDB();
      checkLicense();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Vérification silencieuse de mise à jour au démarrage (10s après le lancement)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.updater.check();
        if (res && res.success && res.hasUpdate) {
          setUpdateInfo(res);
          setHasUpdate(true);
        }
      } catch (e) {}
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleReconnectDB = async () => {
    await api.reconnectDB();
    await checkDB();
  };

  const handleInvoiceCreated = (invoice) => {
    setLastCreatedInvoice(invoice);
    setIsInvoiceDetailOpen(true);
    checkDB();
  };

  const getDefaultTabTitle = (type) => {
    switch (type) {
      case 'pos': return t('nav_pos') || 'Caisse / Vente';
      case 'dashboard': return t('nav_dashboard') || 'Tableau de Bord';
      case 'invoices': return t('nav_invoices') || 'Bons de Commande';
      case 'customers': return t('nav_customers') || 'Clients & Dettes';
      case 'suppliers': return t('nav_suppliers') || 'Fournisseurs & Achats';
      case 'charges': return t('nav_charges') || 'Charges & Dépenses';
      case 'treasury': return t('nav_treasury') || 'Trésorerie & Caisses';
      case 'returns': return t('nav_returns') || 'Retours & Avoirs';
      case 'stock': return t('nav_stock') || 'Stock';
      case 'losses': return t('nav_losses') || 'Pertes & Casse';
      case 'movements': return t('nav_movements') || 'Mouvements';
      case 'reparations': return 'SAV & Réparations';
      case 'users': return 'Comptes, Caisses & Audit';
      default: return type;
    }
  };

  const getTabIcon = (type) => {
    switch (type) {
      case 'pos': return ShoppingBag;
      case 'dashboard': return LayoutDashboard;
      case 'invoices': return ReceiptText;
      case 'customers': return Users;
      case 'suppliers': return Building;
      case 'charges': return TrendingDown;
      case 'treasury': return Wallet;
      case 'returns': return RotateCcw;
      case 'stock': return Package;
      case 'losses': return AlertOctagon;
      case 'movements': return ArrowLeftRight;
      case 'reparations': return Wrench;
      case 'users': return ShieldCheck;
      default: return ShoppingBag;
    }
  };

  const handleAddNewPos = () => {
    const newId = `pos-${Date.now()}`;
    setTabs((prev) => {
      const posTabs = prev.filter(t => t.type === 'pos');
      const nextIndex = posTabs.length + 1;
      const newTitle = `POS ${nextIndex}`;
      return [...prev, { id: newId, type: 'pos', title: newTitle, closable: true }];
    });
    setActiveTab(newId);
  };

  // Raccourci global F5 : Ouvrir un nouveau panier/POS sans recharger la page
  useEffect(() => {
    const triggerF5Action = () => {
      const isModalOpen = document.querySelector('.modal-content') || document.querySelector('.modal-backdrop') || document.querySelector('[role="dialog"]');
      if (!isModalOpen) {
        handleAddNewPos();
      }
    };

    const handleGlobalF5 = (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        triggerF5Action();
      }
    };
    window.addEventListener('keydown', handleGlobalF5, true);

    const unsubscribeIpc = window.api?.onF5Key ? window.api.onF5Key(triggerF5Action) : null;

    return () => {
      window.removeEventListener('keydown', handleGlobalF5, true);
      if (typeof unsubscribeIpc === 'function') unsubscribeIpc();
    };
  }, []);

  // Open or switch to a tab
  const handleOpenTab = (type, customTitle = null) => {
    if (type === 'pos') {
      const existingPos = tabs.find(t => t.type === 'pos');
      if (existingPos) {
        if (!activeTab.startsWith('pos')) {
          setActiveTab(existingPos.id);
        }
        return;
      } else {
        handleAddNewPos();
        return;
      }
    }

    setTabs((prev) => {
      const existing = prev.find(t => t.id === type);
      if (existing) {
        return prev;
      }
      const title = customTitle || getDefaultTabTitle(type);
      return [...prev, { id: type, type, title, closable: true }];
    });
    setActiveTab(type);
  };

  // Close a tab
  const handleCloseTab = (tabId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTabs((prev) => {
      const closingTab = prev.find(t => t.id === tabId);
      if (closingTab?.type === 'pos') {
        const remainingPos = prev.filter(t => t.type === 'pos' && t.id !== tabId);
        if (remainingPos.length === 0) {
          return prev; // Toujours conserver au moins une caisse active
        }
      }
      const updated = prev.filter(t => t.id !== tabId);
      if (activeTab === tabId) {
        const nextActive = updated[updated.length - 1]?.id || 'pos-1';
        setActiveTab(nextActive);
      }
      return updated;
    });
  };

  const getPageMeta = () => {
    if (activeTab.startsWith('pos')) {
      return { title: t('pos_title') || 'Point de Vente (POS)', subtitle: t('pos_subtitle') || 'Ventes au comptoir, caisses multiples & impression SPRT 80' };
    }

    switch (activeTab) {
      case 'dashboard':
        return { title: t('dash_title'), subtitle: t('dash_subtitle') };
      case 'invoices':
        return { title: t('inv_title'), subtitle: t('inv_subtitle') };
      case 'treasury':
        return { title: t('tre_title'), subtitle: t('tre_subtitle') };
      case 'returns':
        return { title: t('ret_title'), subtitle: t('ret_subtitle') };
      case 'stock':
        return { title: t('stock_title'), subtitle: t('stock_subtitle') };
      case 'losses':
        return { title: t('loss_title'), subtitle: t('loss_subtitle') };
      case 'movements':
        return { title: t('mov_title'), subtitle: t('mov_subtitle') };
      case 'customers':
        return { title: t('cust_title'), subtitle: t('cust_subtitle') };
      case 'suppliers':
        return { title: 'Fournisseurs & Achats', subtitle: 'Gestion des fournisseurs, dettes et règlements' };
      case 'charges':
        return { title: 'Charges & Dépenses', subtitle: 'Suivi des dépenses d\'exploitation' };
      case 'reparations':
        return { title: 'Service Après-Vente (SAV) & Atelier de Réparation', subtitle: 'Réception, diagnostic, pièces détachées et bons de livraison / retours' };
      case 'users':
        return { title: 'Administration des Comptes, Caisses & Audit', subtitle: 'Comptes utilisateurs, affectation des caisses et journal de modifications' };
      default:
        return { title: t('appTitle'), subtitle: '' };
    }
  };

  const meta = getPageMeta();

  const renderTabContent = (type) => {
    switch (type) {
      case 'pos':
        return <PosView />;
      case 'reparations':
        return <ReparationsView />;
      case 'users':
        return <UsersManagementView />;
      case 'dashboard':
        return (
          <DashboardView
            onNavigateToStock={() => handleOpenTab('stock')}
            onNavigateToInvoices={() => handleOpenTab('invoices')}
            onNavigateToCustomers={() => handleOpenTab('customers')}
            onViewInvoice={(inv) => {
              setLastCreatedInvoice(inv);
              setIsInvoiceDetailOpen(true);
            }}
          />
        );
      case 'stock':
        return <StockView onNewProductTrigger={() => setIsProductModalOpen(true)} />;
      case 'invoices':
        return <InvoicesView onNewSale={() => handleOpenTab('pos')} />;
      case 'customers':
        return <CustomersView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'charges':
        return <ChargesView />;
      case 'treasury':
        return <TreasuryView />;
      case 'returns':
        return <ReturnsView />;
      case 'losses':
        return <LossesView />;
      case 'movements':
        return <MovementsView />;
      default:
        return <PosView />;
    }
  };

  // 1. Écran de chargement initial pour la vérification de la licence
  if (licenseLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-blue-500/25 font-black text-2xl mb-4 animate-pulse">
          CP
        </div>
        <h2 className="text-xl font-black tracking-tight text-white mb-2">Commerce<span className="text-blue-400">Pro</span></h2>
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
          <span>Vérification de la licence système...</span>
        </div>
      </div>
    );
  }

  // 2. Si le logiciel n'est pas activé, afficher le modal d'activation bloquant l'accès
  if (!licenseInfo?.isActivated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative select-none">
        <ActivationModal
          isOpen={true}
          licenseInfo={licenseInfo}
          onClose={null}
          onActivated={async () => {
            await checkLicense();
          }}
          isManageMode={false}
        />
      </div>
    );
  }

  // 3. Si non connecté, afficher l'écran de Login ("comme il était")
  if (!currentUser) {
    return <LoginView licenseInfo={licenseInfo} />;
  }

  return (
    <div dir={dir} className="flex h-screen bg-slate-100 font-sans antialiased text-slate-800 overflow-hidden select-none">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleOpenTab}
        dbStatus={dbStatus}
        lowStockCount={lowStockCount}
        licenseInfo={licenseInfo}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
        onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        hasUpdate={hasUpdate}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onNewSale={handleAddNewPos}
          onNewPurchase={() => setIsPurchaseModalOpen(true)}
          onNewProduct={() => setIsProductModalOpen(true)}
          onNewEncaissement={() => setIsGlobalEncaissementOpen(true)}
          onNewLoss={() => setIsGlobalLossOpen(true)}
          onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          hasUpdate={hasUpdate}
          onSelectInvoiceForReturn={(inv) => {
            setInvoiceForGlobalReturn(inv);
            setIsGlobalReturnOpen(true);
          }}
          onSelectInvoiceForDetail={(inv) => {
            setLastCreatedInvoice(inv);
            setIsInvoiceDetailOpen(true);
          }}
        />

        {/* SQLite Warning Banner if disconnected */}
        {!dbStatus.connected && (
          <div className="bg-rose-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold shrink-0 shadow-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                {isRTL 
                  ? 'قاعدة البيانات المحلية SQLite غير متصلة.' 
                  : 'Base de données locale SQLite non connectée.'}
              </span>
            </div>
            <button
              onClick={handleReconnectDB}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-rose-700 font-bold rounded-lg hover:bg-rose-50 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isRTL ? 'إعادة محاولة الاتصال' : 'Réessayer la connexion'}</span>
            </button>
          </div>
        )}

        {/* Multi-Window Tabs Bar (Permet de travailler sur plusieurs fenêtres en parallèle) */}
        <div 
          className="app-tab-bar bg-slate-900 border-b border-slate-800 px-3 pt-2 flex items-center gap-1.5 overflow-x-auto select-none shrink-0 scrollbar-none"
          style={{
            backgroundColor: 'var(--sidebar-bg, #0f172a)',
            borderColor: 'var(--sidebar-border, #1e293b)'
          }}
        >
          {tabs.map((tab) => {
            const Icon = getTabIcon(tab.type);
            const isActive = activeTab === tab.id;
            const isPos = tab.type === 'pos';
            const posCount = tabs.filter(t => t.type === 'pos').length;
            const canClose = tab.closable && (!isPos || posCount > 1);

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={!isActive ? {
                  backgroundColor: 'var(--sidebar-hover, rgba(30, 41, 59, 0.8))',
                  borderColor: 'var(--sidebar-border, #334155)'
                } : undefined}
                className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-t-xl text-xs font-black transition cursor-pointer shrink-0 border-t border-x ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-xs'
                    : 'app-tab-inactive bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? (isPos ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400 group-hover:text-white'}`} />
                <span className="whitespace-nowrap">{tab.title}</span>
                {canClose && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition ml-1"
                    title="Fermer cette fenêtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Bouton pour ajouter un nouvel onglet POS instantanément (Raccourci F5) */}
          <button
            type="button"
            onClick={handleAddNewPos}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shrink-0 shadow-xs ml-1"
            title="Ouvrir un nouveau POS / Panier de vente (Raccourci: Touche F5)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ POS (F5)</span>
          </button>
        </div>

        {/* Multi-View Container (All tabs stay mounted in DOM to never lose cart or form states) */}
        <main className="flex-1 overflow-hidden min-h-0 flex flex-col relative bg-slate-100">
          <ErrorBoundary>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="w-full h-full flex-1 flex flex-col min-h-0 overflow-y-auto"
                style={{ display: activeTab === tab.id ? 'flex' : 'none' }}
              >
                {tab.type === 'pos' ? (
                  <PosView
                    key={tab.id}
                    posId={tab.id}
                    posTitle={tab.title}
                    isActive={activeTab === tab.id}
                    onOpenNewPos={handleAddNewPos}
                  />
                ) : (
                  renderTabContent(tab.type)
                )}
              </div>
            ))}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Quick POS / Sale Modal */}
      <CreateInvoiceModal
        isOpen={isPosOpen}
        onClose={() => setIsPosOpen(false)}
        onInvoiceCreated={handleInvoiceCreated}
      />

      {/* Global Purchase Invoice Modal (Achat Fournisseur) */}
      <CreatePurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseCreated={() => {
          checkDB();
          handleOpenTab('movements');
        }}
      />

      {/* Global Quick Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={null}
        onSaved={() => {
          checkDB();
          handleOpenTab('stock');
        }}
        onProductCreated={() => {
          checkDB();
          handleOpenTab('stock');
        }}
      />

      {/* Global Quick Encaissement Modal */}
      <CreateTransactionModal
        isOpen={isGlobalEncaissementOpen}
        onClose={() => setIsGlobalEncaissementOpen(false)}
        initialType="ENCAISSEMENT"
        onSuccess={() => {
          checkDB();
          handleOpenTab('treasury');
        }}
      />

      {/* Global Quick Loss Modal */}
      <CreateLossModal
        isOpen={isGlobalLossOpen}
        onClose={() => setIsGlobalLossOpen(false)}
        onLossCreated={() => {
          checkDB();
          handleOpenTab('losses');
        }}
      />

      {/* Invoice Detail Modal for viewing/printing */}
      <InvoiceDetailModal
        isOpen={isInvoiceDetailOpen}
        onClose={() => {
          setIsInvoiceDetailOpen(false);
          setLastCreatedInvoice(null);
        }}
        invoice={lastCreatedInvoice}
      />

      {/* Global Sale Return Modal (depuis la barre de recherche ou toute autre vue) */}
      <SaleReturnModal
        isOpen={isGlobalReturnOpen}
        onClose={() => {
          setIsGlobalReturnOpen(false);
          setInvoiceForGlobalReturn(null);
        }}
        invoice={invoiceForGlobalReturn}
        onReturnProcessed={() => {
          checkDB();
          handleOpenTab('returns');
        }}
      />

      {/* Activation License Modal (Mode Consultation & Gestion) */}
      <ActivationModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        licenseInfo={licenseInfo}
        onActivated={async () => {
          await checkLicense();
        }}
        isManageMode={true}
      />

      {/* Printer & Hardware Settings Modal */}
      <PrinterSettingsModal
        isOpen={isPrinterSettingsOpen}
        onClose={() => setIsPrinterSettingsOpen(false)}
      />

      {/* Online Auto-Update Modal (GitHub Releases) */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        initialUpdateInfo={updateInfo}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
