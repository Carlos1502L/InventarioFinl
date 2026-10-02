import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Inventory, Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  inventories: Inventory[];
  currentInventory: Inventory | null;
  needsInventorySelection: boolean;
  selectInventory: (inventory: Inventory) => void;
  refreshInventories: () => Promise<void>;
  setNeedsInventorySelection: (show: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Multi-Tenancy State
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);
  const [needsInventorySelection, setNeedsInventorySelection] = useState<boolean>(false);

  // Cargar inventarios asociados al usuario (dueño o colaborador)
  const fetchInventories = async (currentUser: User) => {
    try {
      // 1. Inventarios donde es colaborador o dueño vía inventory_users
      const { data: memberInvs, error: errMember } = await supabase
        .from('inventory_users')
        .select(`
          role,
          inventories (
            id,
            name,
            description,
            currency,
            owner_id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', currentUser.id);

      // 2. Inventarios donde es dueño directo (por si aún no está en inventory_users)
      const { data: ownedInvs, error: errOwned } = await supabase
        .from('inventories')
        .select('*')
        .eq('owner_id', currentUser.id);

      const invList: Inventory[] = [];
      const seenIds = new Set<string>();

      if (ownedInvs) {
        ownedInvs.forEach((inv) => {
          seenIds.add(inv.id);
          invList.push({
            ...inv,
            role: 'owner',
            is_owner: true
          });
        });
      }

      if (memberInvs) {
        memberInvs.forEach((item: any) => {
          if (item.inventories && !seenIds.has(item.inventories.id)) {
            seenIds.add(item.inventories.id);
            invList.push({
              ...item.inventories,
              role: item.role || 'collaborator',
              is_owner: item.inventories.owner_id === currentUser.id
            });
          }
        });
      }

      setInventories(invList);

      // Manejar la selección del inventario activo
      const savedInvId = localStorage.getItem(`active_inventory_${currentUser.id}`);
      const savedInv = invList.find((i) => i.id === savedInvId);

      if (invList.length > 1) {
        if (savedInv) {
          setCurrentInventory(savedInv);
        } else {
          // Mostrar pantalla/modal de selección al login
          setNeedsInventorySelection(true);
          setCurrentInventory(invList[0]);
        }
      } else if (invList.length === 1) {
        setCurrentInventory(invList[0]);
        setNeedsInventorySelection(false);
      } else {
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
      }
    } catch (err) {
      console.error('Error cargando inventarios:', err);
    }
  };

  const selectInventory = (inventory: Inventory) => {
    setCurrentInventory(inventory);
    setNeedsInventorySelection(false);
    if (user) {
      localStorage.setItem(`active_inventory_${user.id}`, inventory.id);
    }
  };

  const refreshInventories = async () => {
    if (user) {
      await fetchInventories(user);
    }
  };

  useEffect(() => {
    // 1. Obtener sesión activa inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchInventories(session.user);
      }
      setLoading(false);
    });

    // 2. Suscribirse a cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchInventories(session.user);
      } else {
        setInventories([]);
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      await fetchInventories(data.user);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('active_inventory');
    setCurrentInventory(null);
    setInventories([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        inventories,
        currentInventory,
        needsInventorySelection,
        selectInventory,
        refreshInventories,
        setNeedsInventorySelection,
        signIn,
        signUp,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
