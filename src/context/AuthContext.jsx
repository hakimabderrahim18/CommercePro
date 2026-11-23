import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // État du verrouillage (true = demande de mot de passe requise, false = accès direct sans mot de passe)
  const [isAuthLockEnabled, setIsAuthLockEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('commercepost_auth_lock_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const lockEnabled = localStorage.getItem('commercepost_auth_lock_enabled') !== 'false';
      if (!lockEnabled) {
        const auto = localStorage.getItem('commercepost_auto_user') || sessionStorage.getItem('commercepost_current_user');
        if (auto) return JSON.parse(auto);
      }
      const saved = sessionStorage.getItem('commercepost_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  // Connexion automatique par défaut si le verrouillage est désactivé
  const autoLoginDefaultUser = async () => {
    try {
      const savedUserStr = localStorage.getItem('commercepost_auto_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        setCurrentUser(u);
        sessionStorage.setItem('commercepost_current_user', JSON.stringify(u));
        return u;
      }
      const res = await api.auth.getUsers();
      if (res && res.success && res.data && res.data.length > 0) {
        const adminUser = res.data.find(u => u.role === 'ADMIN') || res.data[0];
        setCurrentUser(adminUser);
        sessionStorage.setItem('commercepost_current_user', JSON.stringify(adminUser));
        localStorage.setItem('commercepost_auto_user', JSON.stringify(adminUser));
        return adminUser;
      } else {
        const defaultAdmin = {
          id: 1,
          username: 'admin',
          nom: 'Administrateur',
          role: 'ADMIN',
          caisse: 'Caisse 1 (Magasin)'
        };
        setCurrentUser(defaultAdmin);
        sessionStorage.setItem('commercepost_current_user', JSON.stringify(defaultAdmin));
        localStorage.setItem('commercepost_auto_user', JSON.stringify(defaultAdmin));
        return defaultAdmin;
      }
    } catch (e) {
      console.warn('Erreur auto-login:', e);
      return null;
    }
  };

  useEffect(() => {
    if (!isAuthLockEnabled && !currentUser) {
      autoLoginDefaultUser();
    }
  }, [isAuthLockEnabled]);

  const setAuthLock = async (enabled) => {
    setIsAuthLockEnabled(enabled);
    localStorage.setItem('commercepost_auth_lock_enabled', String(enabled));
    if (!enabled) {
      if (currentUser) {
        localStorage.setItem('commercepost_auto_user', JSON.stringify(currentUser));
      } else {
        await autoLoginDefaultUser();
      }
    } else {
      localStorage.removeItem('commercepost_auto_user');
    }
  };

  const bypassLogin = async () => {
    await setAuthLock(false);
    return await autoLoginDefaultUser();
  };

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.auth.login({ username, password });
      if (res.success && res.user) {
        setCurrentUser(res.user);
        sessionStorage.setItem('commercepost_current_user', JSON.stringify(res.user));
        localStorage.setItem('commercepost_auto_user', JSON.stringify(res.user));
        return { success: true, user: res.user };
      }
      return { success: false, error: res.error || 'Identifiant ou mot de passe incorrect.' };
    } catch (err) {
      return { success: false, error: err.message || 'Erreur de connexion.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (currentUser) {
      try {
        await api.audit.log({
          userId: currentUser.id,
          username: currentUser.username,
          action: 'DECONNEXION',
          module: 'AUTH',
          details: 'Déconnexion manuelle'
        });
      } catch (e) {}
    }
    setCurrentUser(null);
    sessionStorage.removeItem('commercepost_current_user');
    setIsAuthLockEnabled(true);
    localStorage.setItem('commercepost_auth_lock_enabled', 'true');
    localStorage.removeItem('commercepost_auto_user');
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isReparateur = currentUser?.role === 'REPARATEUR';
  const isVendeur = currentUser?.role === 'VENDEUR';

  return (
    <AuthContext.Provider value={{
      currentUser,
      setCurrentUser,
      isAuthLockEnabled,
      setAuthLock,
      bypassLogin,
      autoLoginDefaultUser,
      login,
      logout,
      loading,
      isAdmin,
      isReparateur,
      isVendeur
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
