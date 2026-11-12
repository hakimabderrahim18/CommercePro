import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('commercepost_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  // Nettoyer l'ancien stockage localStorage persistant pour toujours afficher l'écran de login au démarrage
  useEffect(() => {
    try {
      localStorage.removeItem('commercepost_current_user');
    } catch (e) {}
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.auth.login({ username, password });
      if (res.success && res.user) {
        setCurrentUser(res.user);
        sessionStorage.setItem('commercepost_current_user', JSON.stringify(res.user));
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
    localStorage.removeItem('commercepost_current_user');
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isReparateur = currentUser?.role === 'REPARATEUR';
  const isVendeur = currentUser?.role === 'VENDEUR';

  return (
    <AuthContext.Provider value={{
      currentUser,
      setCurrentUser,
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
