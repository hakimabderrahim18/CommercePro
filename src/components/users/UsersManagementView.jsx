import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  ShieldCheck, 
  Wrench, 
  ShoppingBag, 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Wallet, 
  ArrowLeftRight, 
  CheckCircle, 
  XCircle, 
  Search, 
  RefreshCw,
  Lock,
  Building,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import Modal from '../common/Modal';
import TechniciansAccountsModal from '../reparations/TechniciansAccountsModal';

export default function UsersManagementView() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'caisses' | 'audit'
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Users State
  const [users, setUsers] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalError, setModalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userFormData, setUserFormData] = useState({
    nom: '',
    username: '',
    password: '',
    role: 'VENDEUR',
    caisse: 'Caisse 1 (Magasin)',
    actif: 1
  });

  // Caisses State
  const [caisses, setCaisses] = useState([]);
  const [isCaisseModalOpen, setIsCaisseModalOpen] = useState(false);
  const [caisseModalError, setCaisseModalError] = useState('');
  const [caisseFormData, setCaisseFormData] = useState({ nom: '', code: '', soldeInitial: 0 });
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalError, setTransferModalError] = useState('');
  const [transferFormData, setTransferFormData] = useState({
    sourceCaisse: '',
    destinationCaisse: '',
    montant: '',
    motif: ''
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({
    module: 'TOUS',
    username: 'TOUS',
    caisse: 'TOUS',
    search: '',
    limit: 150
  });

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadUsers = async () => {
    try {
      const res = await api.auth.getUsers();
      if (res.success) setUsers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCaisses = async () => {
    try {
      const res = await api.caisse.getAll();
      if (res.success) setCaisses(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await api.audit.getAll(auditFilters);
      if (res.success) setAuditLogs(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCaisses();
    loadAuditLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'caisses') {
      loadCaisses();
    } else {
      loadUsers();
    }
  }, [activeTab, auditFilters]);

  // Handlers Users
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setModalError('');
    setShowPassword(false);
    loadCaisses();
    setUserFormData({
      nom: '',
      username: '',
      password: '',
      role: 'VENDEUR',
      caisse: caisses[0]?.nom || 'Caisse 1 (Magasin)',
      actif: 1
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setModalError('');
    setShowPassword(false);
    loadCaisses();
    setUserFormData({
      nom: u.nom || '',
      username: u.username || '',
      password: '',
      role: u.role || 'VENDEUR',
      caisse: u.caisse || (caisses[0]?.nom || 'Caisse 1 (Magasin)'),
      actif: u.actif !== undefined ? u.actif : 1
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    if (e) e.preventDefault();
    setModalError('');

    const cleanNom = (userFormData.nom || '').trim();
    const cleanUsername = (userFormData.username || '').trim();
    const cleanPassword = (userFormData.password || '').trim();

    if (!cleanNom) {
      setModalError('Le nom complet est obligatoire.');
      return;
    }

    if (!cleanUsername) {
      setModalError('L’identifiant de connexion (login) est obligatoire.');
      return;
    }

    if (!editingUser && !cleanPassword) {
      setModalError('Le mot de passe est obligatoire pour la création du compte.');
      return;
    }

    try {
      setLoading(true);
      let res;
      const safeCurrentUser = currentUser ? {
        id: currentUser.id,
        username: currentUser.username,
        nom: currentUser.nom,
        role: currentUser.role
      } : null;

      if (editingUser) {
        res = await api.auth.updateUser({
          id: editingUser.id,
          updates: {
            ...userFormData,
            nom: cleanNom,
            username: cleanUsername,
            password: cleanPassword
          }
        }, safeCurrentUser);
      } else {
        res = await api.auth.createUser({
          ...userFormData,
          nom: cleanNom,
          username: cleanUsername,
          password: cleanPassword
        }, safeCurrentUser);
      }

      if (res && res.success) {
        showNotification(editingUser ? 'Compte utilisateur mis à jour avec succès.' : 'Nouveau compte utilisateur créé avec succès.');
        setIsUserModalOpen(false);
        setModalError('');
        loadUsers();
      } else {
        const errMsg = res?.error || 'Erreur lors de l’enregistrement de l’utilisateur.';
        setModalError(errMsg);
      }
    } catch (err) {
      const errMsg = err?.message || 'Erreur technique lors de l’enregistrement.';
      setModalError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === currentUser?.id) {
      showNotification('Vous ne pouvez pas supprimer votre propre compte.', 'error');
      return;
    }
    if (!window.confirm(`Confirmez-vous la suppression du compte "${u.username}" ?`)) return;

    try {
      const safeCurrentUser = currentUser ? {
        id: currentUser.id,
        username: currentUser.username
      } : null;
      const res = await api.auth.deleteUser(u.id, safeCurrentUser);
      if (res && res.success) {
        showNotification('Compte supprimé avec succès.');
        loadUsers();
      } else {
        showNotification(res?.error || 'Erreur de suppression.', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Handlers Caisses
  const handleCreateCaisse = async (e) => {
    if (e) e.preventDefault();
    setCaisseModalError('');
    if (!caisseFormData.nom.trim()) {
      setCaisseModalError('Le nom de la caisse est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      const safeCurrentUser = currentUser ? {
        id: currentUser.id,
        username: currentUser.username
      } : null;
      const res = await api.caisse.create(caisseFormData, safeCurrentUser);
      if (res && res.success) {
        showNotification('Nouvelle caisse enregistrée avec succès.');
        setIsCaisseModalOpen(false);
        setCaisseFormData({ nom: '', code: '', soldeInitial: 0 });
        setCaisseModalError('');
        loadCaisses();
      } else {
        const errMsg = res?.error || 'Erreur création caisse.';
        setCaisseModalError(errMsg);
      }
    } catch (err) {
      const errMsg = err?.message || 'Erreur technique création caisse.';
      setCaisseModalError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransferModal = () => {
    if (caisses.length < 2) {
      showNotification('Il vous faut au moins deux caisses pour effectuer un virement.', 'error');
      return;
    }
    setTransferModalError('');
    setTransferFormData({
      sourceCaisse: caisses[0]?.nom || '',
      destinationCaisse: caisses[1]?.nom || '',
      montant: '',
      motif: ''
    });
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e) => {
    if (e) e.preventDefault();
    setTransferModalError('');
    const val = Number(transferFormData.montant);
    if (!val || val <= 0) {
      setTransferModalError('Montant invalide (doit être supérieur à 0).');
      return;
    }
    if (transferFormData.sourceCaisse === transferFormData.destinationCaisse) {
      setTransferModalError('La caisse source et la caisse destination doivent être différentes.');
      return;
    }

    try {
      setLoading(true);
      const safeCurrentUser = currentUser ? {
        id: currentUser.id,
        username: currentUser.username
      } : null;
      const res = await api.caisse.transfert(transferFormData, safeCurrentUser);
      if (res && res.success) {
        showNotification(res.message || 'Transfert inter-caisses réalisé avec succès.');
        setIsTransferModalOpen(false);
        setTransferModalError('');
        loadCaisses();
        loadAuditLogs();
      } else {
        const errMsg = res?.error || 'Erreur lors du transfert.';
        setTransferModalError(errMsg);
      }
    } catch (err) {
      const errMsg = err?.message || 'Erreur technique lors du transfert.';
      setTransferModalError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 select-none overflow-hidden">
      {/* Top Header & Tabs Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <span>Administration des Comptes, Caisses & Audit</span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Gestion multi-utilisateurs (Admin, Réparateur, Vendeur), affectation des caisses et journal de bord
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'users' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Comptes Utilisateurs ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('caisses')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'caisses' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Gestion des Caisses ({caisses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'audit' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historique des Modifications (Audit)</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mx-6 mt-3 p-3 rounded-2xl text-xs font-bold flex items-center justify-between shrink-0 ${
          feedback.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: GESTION DES UTILISATEURS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800">Liste des Comptes d'Accès</h3>
                <span className="text-xs text-slate-500">Chaque utilisateur possède un rôle et sa caisse attitrée</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTechModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Consulter les soldes des techniciens et effectuer des règlements"
                >
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>Comptes Techniciens</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreateUser}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau Compte</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Identifiant</th>
                    <th className="py-3 px-4">Rôle</th>
                    <th className="py-3 px-4">Caisse Attribuée</th>
                    <th className="py-3 px-4 text-right">Solde Technicien</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const roleColor = 
                      u.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      u.role === 'REPARATEUR' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      'bg-emerald-100 text-emerald-800 border-emerald-200';

                    const RoleIcon = 
                      u.role === 'ADMIN' ? ShieldCheck :
                      u.role === 'REPARATEUR' ? Wrench : ShoppingBag;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black">
                            {u.nom ? u.nom.slice(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div>{u.nom}</div>
                            {isSelf && <span className="text-[10px] text-blue-600 font-bold">(Votre compte connecté)</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-600">
                          {u.username}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${roleColor}`}>
                            <RoleIcon className="w-3 h-3" />
                            <span>{u.role}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[11px]">
                            <Wallet className="w-3 h-3 text-slate-500" />
                            {u.caisse || 'Caisse 1 (Magasin)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.role === 'REPARATEUR' || Number(u.soldeTechnicien || 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => setIsTechModalOpen(true)}
                              className="inline-flex items-center gap-1 font-mono font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition cursor-pointer"
                              title="Voir l'historique et régler le technicien"
                            >
                              <Wallet className="w-3 h-3 text-emerald-600" />
                              <span>{Number(u.soldeTechnicien || 0).toLocaleString('fr-DZ')} DA</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.actif ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle className="w-3 h-3" /> Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <XCircle className="w-3 h-3" /> Inactif
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Modifier ce compte"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Supprimer ce compte"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GESTION DES CAISSES */}
        {activeTab === 'caisses' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800">Caisses du Magasin & de l'Atelier</h3>
                <span className="text-xs text-slate-500">Suivi des encaissements, décaissements et transferts de fonds en temps réel</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenTransferModal}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Virement Inter-Caisses</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCaisseModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle Caisse</span>
                </button>
              </div>
            </div>

            {/* Caisses Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {caisses.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-100">
                        {c.code}
                      </span>
                      <Wallet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-base">{c.nom}</h4>
                      <div className="text-2xl font-black text-emerald-600 tracking-tight mt-1">
                        {(c.soldeActuel || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">DA</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Solde initial :</span>
                      <span className="font-bold text-slate-700">{(c.soldeInitial || 0).toLocaleString('fr-DZ')} DA</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Encaissements :</span>
                      <span className="font-bold">+{(c.totalEncaissements || 0).toLocaleString('fr-DZ')} DA</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Décaissements :</span>
                      <span className="font-bold">-{(c.totalDecaissements || 0).toLocaleString('fr-DZ')} DA</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: JOURNAL D'AUDIT (HISTORIQUE DES MODIFICATIONS) */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={auditFilters.search}
                  onChange={(e) => setAuditFilters({ ...auditFilters, search: e.target.value })}
                  placeholder="Rechercher action, référence, utilisateur..."
                  className="w-full text-xs font-semibold bg-transparent focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={auditFilters.module}
                  onChange={(e) => setAuditFilters({ ...auditFilters, module: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-blue-500"
                >
                  <option value="TOUS">Tous les modules</option>
                  <option value="AUTH">Authentification</option>
                  <option value="USERS">Utilisateurs</option>
                  <option value="CAISSE">Caisses</option>
                  <option value="REPARATION">Réparations SAV</option>
                  <option value="POS">Ventes / Caisse</option>
                </select>

                <button
                  type="button"
                  onClick={loadAuditLogs}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Actualiser l'historique"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date / Heure</th>
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Référence</th>
                    <th className="py-3 px-4">Détails</th>
                    <th className="py-3 px-4">Caisse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400 font-medium">
                        Aucun événement d'audit enregistré.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const actionBg = 
                        log.action.includes('CONNEXION') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        log.action.includes('SUPPRESSION') || log.action.includes('ECHEC') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        log.action.includes('CREATION') || log.action.includes('RECEPTION') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-amber-50 text-amber-700 border-amber-200';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('fr-DZ')}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {log.username}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${actionBg}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-600">
                            {log.module}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {log.reference || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.details}>
                            {log.details}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {log.caisse || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* USER MODAL (CREATION / MODIFICATION) */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setModalError('');
        }}
        title={editingUser ? `Modifier le compte : ${editingUser.username}` : 'Nouveau Compte Utilisateur'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom Complet <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              data-allow-enter="true"
              value={userFormData.nom}
              onChange={(e) => {
                setUserFormData({ ...userFormData, nom: e.target.value });
                if (modalError) setModalError('');
              }}
              placeholder="Ex: Yacine Réparateur"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Identifiant (Login) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              data-allow-enter="true"
              value={userFormData.username}
              onChange={(e) => {
                setUserFormData({ ...userFormData, username: e.target.value });
                if (modalError) setModalError('');
              }}
              placeholder="Ex: yacine"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500 transition"
            />
            <p className="text-[10px] text-slate-400 mt-1">Identifiant unique utilisé pour ouvrir une session dans le logiciel.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {editingUser ? 'Nouveau mot de passe (Laisser vide pour ne pas changer)' : 'Mot de passe ou code PIN *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                data-allow-enter="true"
                value={userFormData.password}
                onChange={(e) => {
                  setUserFormData({ ...userFormData, password: e.target.value });
                  if (modalError) setModalError('');
                }}
                placeholder={editingUser ? '•••••••• (Inchangé)' : 'Mot de passe ou code PIN'}
                className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500 transition"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? "Masquer" : "Afficher"}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rôle</label>
              <select
                value={userFormData.role}
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-blue-500"
              >
                <option value="VENDEUR">Vendeur / Caissier</option>
                <option value="REPARATEUR">Réparateur Atelier</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Caisse Assignée</label>
              <select
                value={userFormData.caisse}
                onChange={(e) => setUserFormData({ ...userFormData, caisse: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-blue-500"
              >
                {caisses.length === 0 && (
                  <option value="Caisse 1 (Magasin)">Caisse 1 (Magasin)</option>
                )}
                {caisses.map((c) => (
                  <option key={c.id} value={c.nom}>{c.nom}</option>
                ))}
                {userFormData.caisse && !caisses.some(c => c.nom === userFormData.caisse) && (
                  <option value={userFormData.caisse}>{userFormData.caisse}</option>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="user-actif"
              checked={!!userFormData.actif}
              onChange={(e) => setUserFormData({ ...userFormData, actif: e.target.checked ? 1 : 0 })}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
            />
            <label htmlFor="user-actif" className="text-xs font-bold text-slate-700 cursor-pointer">
              Compte actif (autorisé à se connecter)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsUserModalOpen(false);
                setModalError('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Enregistrement...' : (editingUser ? 'Enregistrer les modifications' : 'Créer le compte')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* CAISSE MODAL */}
      <Modal
        isOpen={isCaisseModalOpen}
        onClose={() => {
          setIsCaisseModalOpen(false);
          setCaisseModalError('');
        }}
        title="Ajouter une nouvelle caisse"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCaisse} className="space-y-4">
          {caisseModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{caisseModalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom de la Caisse <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              data-allow-enter="true"
              value={caisseFormData.nom}
              onChange={(e) => {
                setCaisseFormData({ ...caisseFormData, nom: e.target.value });
                if (caisseModalError) setCaisseModalError('');
              }}
              placeholder="Ex: Caisse Réparation 2"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Code Caisse</label>
            <input
              type="text"
              data-allow-enter="true"
              value={caisseFormData.code}
              onChange={(e) => setCaisseFormData({ ...caisseFormData, code: e.target.value })}
              placeholder="Ex: CAISSE-SAV-2"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Solde Initial (DA)</label>
            <input
              type="number"
              min="0"
              data-allow-enter="true"
              value={caisseFormData.soldeInitial}
              onChange={(e) => setCaisseFormData({ ...caisseFormData, soldeInitial: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-emerald-500 transition"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsCaisseModalOpen(false);
                setCaisseModalError('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Création...' : 'Créer Caisse'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* TRANSFERT MODAL */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferModalError('');
        }}
        title="Virement Inter-Caisses"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          {transferModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{transferModalError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Caisse Source (Débit)</label>
              <select
                value={transferFormData.sourceCaisse}
                onChange={(e) => {
                  setTransferFormData({ ...transferFormData, sourceCaisse: e.target.value });
                  if (transferModalError) setTransferModalError('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-indigo-500"
              >
                {caisses.map((c) => (
                  <option key={c.id} value={c.nom}>{c.nom} ({c.soldeActuel || 0} DA)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Caisse Destination (Crédit)</label>
              <select
                value={transferFormData.destinationCaisse}
                onChange={(e) => {
                  setTransferFormData({ ...transferFormData, destinationCaisse: e.target.value });
                  if (transferModalError) setTransferModalError('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-indigo-500"
              >
                {caisses.map((c) => (
                  <option key={c.id} value={c.nom}>{c.nom}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Montant à transférer (DA) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              data-allow-enter="true"
              value={transferFormData.montant}
              onChange={(e) => {
                setTransferFormData({ ...transferFormData, montant: e.target.value });
                if (transferModalError) setTransferModalError('');
              }}
              placeholder="Ex: 50000"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-indigo-700 focus:bg-white focus:outline-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Justificatif</label>
            <input
              type="text"
              data-allow-enter="true"
              value={transferFormData.motif}
              onChange={(e) => setTransferFormData({ ...transferFormData, motif: e.target.value })}
              placeholder="Ex: Dépôt fin de journée vers Caisse Maison"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferModalError('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Traitement...' : 'Effectuer le Virement'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Comptes & Règlements des Techniciens */}
      <TechniciansAccountsModal
        isOpen={isTechModalOpen}
        onClose={() => setIsTechModalOpen(false)}
        currentUser={currentUser}
        onUpdated={loadUsers}
      />
    </div>
  );
}
