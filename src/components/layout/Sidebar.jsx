import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ReceiptText, 
  Users, 
  ArrowLeftRight, 
  Database, 
  Settings, 
  ShoppingBag, 
  AlertTriangle, 
  RotateCcw,
  Wallet,
  AlertOctagon,
  Printer,
  Building,
  TrendingDown,
  Wrench,
  ShieldCheck,
  LogOut,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  CloudDownload
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  dbStatus, 
  lowStockCount = 0, 
  licenseInfo, 
  onOpenLicenseModal, 
  onOpenPrinterSettings,
  onOpenUpdateModal,
  hasUpdate = false
}) {
  const { t } = useLanguage();
  const { currentUser, logout, isAdmin, isReparateur, isVendeur } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('commercepost_sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.innerWidth <= 1366;
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('commercepost_sidebar_collapsed', String(next));
      return next;
    });
  };

  const allMenuItems = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, roles: ['ADMIN'] },
    { id: 'pos', label: t('nav_pos'), icon: ShoppingBag, highlight: true, roles: ['ADMIN', 'VENDEUR', 'REPARATEUR'] },
    { id: 'reparations', label: t('nav_reparations'), icon: Wrench, highlight: true, roles: ['ADMIN', 'REPARATEUR', 'VENDEUR'] },
    { id: 'invoices', label: t('nav_invoices') || 'Bons de Commande', icon: ReceiptText, roles: ['ADMIN', 'VENDEUR', 'REPARATEUR'] },
    { id: 'customers', label: t('nav_customers'), icon: Users, roles: ['ADMIN', 'VENDEUR', 'REPARATEUR'] },
    { id: 'stock', label: t('nav_stock'), icon: Package, badge: lowStockCount > 0 ? lowStockCount : null, badgeColor: 'bg-amber-500 text-white', roles: ['ADMIN', 'REPARATEUR', 'VENDEUR'] },
    { id: 'returns', label: t('nav_returns'), icon: RotateCcw, roles: ['ADMIN', 'VENDEUR'] },
    { id: 'suppliers', label: t('nav_suppliers') || 'Fournisseurs & Achats', icon: Building, roles: ['ADMIN'] },
    { id: 'charges', label: t('nav_charges') || 'Charges & Dépenses', icon: TrendingDown, roles: ['ADMIN'] },
    { id: 'treasury', label: t('nav_treasury'), icon: Wallet, roles: ['ADMIN'] },
    { id: 'losses', label: t('nav_losses'), icon: AlertOctagon, roles: ['ADMIN'] },
    { id: 'movements', label: t('nav_movements'), icon: ArrowLeftRight, roles: ['ADMIN'] },
    { id: 'users', label: t('nav_users'), icon: ShieldCheck, roles: ['ADMIN'] }
  ];

  // Filtrer les éléments de menu selon le rôle de l'utilisateur
  const menuItems = allMenuItems.filter(item => {
    if (!currentUser?.role) return true;
    return item.roles.includes(currentUser.role);
  });

  return (
    <aside 
      className={`${isCollapsed ? 'w-44' : 'w-56'} sidebar-container bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 border-r border-slate-800 select-none transition-all duration-200`}
      style={{
        backgroundColor: 'var(--sidebar-bg, #0f172a)',
        borderColor: 'var(--sidebar-border, #1e293b)'
      }}
    >
      {/* Brand Header */}
      {isCollapsed ? (
        <div 
          className="h-14 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-950/40"
          style={{
            backgroundColor: 'var(--sidebar-header-bg, rgba(2, 6, 23, 0.4))',
            borderColor: 'var(--sidebar-border, #1e293b)'
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-black text-xs shrink-0">
              CP
            </div>
            <span className="font-black text-xs tracking-tight text-white truncate">
              Commerce<span className="text-blue-400">Pro</span>
            </span>
          </div>
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Agrandir le menu"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div 
          className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800 bg-slate-950/40"
          style={{
            backgroundColor: 'var(--sidebar-header-bg, rgba(2, 6, 23, 0.4))',
            borderColor: 'var(--sidebar-border, #1e293b)'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-black text-sm shrink-0">
              CP
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm tracking-tight text-white truncate">
                Commerce<span className="text-blue-400">Pro</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate">{t('appSubtitle')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Mode compact (Gagner de la place pour écran 13 pouces)"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2 py-2 space-y-1' : 'px-2.5 py-2.5 space-y-1'} overflow-y-auto`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'pos' && activeTab.startsWith('pos'));

          if (isCollapsed) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10.5px] font-bold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : item.highlight
                    ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate leading-tight">{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-1.5 py-0.2 text-[8.5px] font-bold rounded-full shrink-0 ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : item.highlight
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="truncate leading-tight">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Session Profile & Logout */}
      {currentUser && (
        <div 
          className={`${isCollapsed ? 'p-2' : 'p-2.5'} border-t border-slate-800/80 bg-slate-950/60`}
          style={{
            backgroundColor: 'var(--sidebar-header-bg, rgba(2, 6, 23, 0.6))',
            borderColor: 'var(--sidebar-border, #1e293b)'
          }}
        >
          <div 
            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50"
            style={{
              backgroundColor: 'var(--sidebar-hover, rgba(30, 41, 59, 0.6))',
              borderColor: 'var(--sidebar-border, #334155)'
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white font-black text-xs shrink-0 ${
                isAdmin ? 'bg-blue-600' : isReparateur ? 'bg-amber-600' : 'bg-emerald-600'
              }`}>
                {currentUser.nom ? currentUser.nom.slice(0, 2).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-black text-white truncate leading-tight">{currentUser.nom || currentUser.username}</span>
                <span className="text-[9px] text-slate-400 truncate flex items-center gap-1 leading-tight">
                  <span className="font-bold text-blue-400">{currentUser.role}</span>
                  • {currentUser.caisse || 'Caisse 1'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer shrink-0"
              title="Déconnexion"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* License & Database Status */}
      <div 
        className={`${isCollapsed ? 'p-2' : 'p-2.5'} border-t border-slate-800 bg-slate-950/30 space-y-1`}
        style={{
          backgroundColor: 'var(--sidebar-header-bg, rgba(2, 6, 23, 0.3))',
          borderColor: 'var(--sidebar-border, #1e293b)'
        }}
      >
        {/* License status button */}
        <button
          type="button"
          onClick={onOpenLicenseModal}
          className="w-full flex items-center justify-between px-2 py-1 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-left transition cursor-pointer"
          title="Gestionnaire de licence logicielle"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${licenseInfo?.isActivated ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-[10px] font-bold text-slate-200 truncate">
              {licenseInfo?.type === 'LIFETIME' ? 'Licence Illimitée' : licenseInfo?.daysRemaining != null ? `${licenseInfo.daysRemaining}j restants` : 'Licence Active'}
            </span>
          </div>
          <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded shrink-0 ${
            licenseInfo?.isActivated
              ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-400'
              : 'bg-amber-950/60 border border-amber-800/60 text-amber-400'
          }`}>
            {licenseInfo?.isActivated ? 'Active' : 'Alerte'}
          </span>
        </button>

        {/* Settings Button (Printers & Theme Colors) */}
        {onOpenPrinterSettings && (
          <button
            type="button"
            onClick={onOpenPrinterSettings}
            className="w-full flex items-center justify-between px-2 py-1 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-left transition cursor-pointer"
            title="Paramètres de l'application : Couleurs, Thème, Imprimantes"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Settings className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-200 truncate">Paramètres</span>
            </div>
            <span className="text-[8.5px] font-bold text-slate-400 bg-slate-700/60 px-1 py-0.2 rounded shrink-0">
              Thème
            </span>
          </button>
        )}

        {/* Update Button (GitHub Releases) */}
        {onOpenUpdateModal && (
          <button
            type="button"
            onClick={onOpenUpdateModal}
            className={`w-full flex items-center justify-between px-2 py-1 rounded-md border text-left transition cursor-pointer ${
              hasUpdate
                ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 animate-pulse'
                : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/40 text-slate-200'
            }`}
            title="Mises à jour en ligne (GitHub)"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <CloudDownload className={`w-3.5 h-3.5 shrink-0 ${hasUpdate ? 'text-blue-400' : 'text-slate-400'}`} />
              <span className="text-[10px] font-bold truncate">Mise à jour</span>
            </div>
            <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded shrink-0 ${
              hasUpdate ? 'bg-blue-600 text-white font-black' : 'bg-slate-700/60 text-slate-400'
            }`}>
              {hasUpdate ? 'Dispo !' : 'v1.0.0'}
            </span>
          </button>
        )}

        {/* Database status */}
        <div className="flex items-center justify-between px-2 py-1 rounded-md bg-slate-800/40 border border-slate-700/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${dbStatus?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-[10px] font-bold text-slate-200 truncate">
              {dbStatus?.connected ? t('db_connected') : t('db_disconnected')}
            </span>
          </div>
          <Database className={`w-3 h-3 shrink-0 ${dbStatus?.connected ? 'text-emerald-400' : 'text-rose-400'}`} />
        </div>
      </div>
    </aside>
  );
}
