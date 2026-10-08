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

  // Auto-recuperación si el usuario no tiene ningún inventario
  const autoInitializeInventory = async (currentUser: User): Promise<Inventory | null> => {
    try {
      // 1. Intentar vía función RPC segura en PostgreSQL
      const { data: invId, error: rpcErr } = await supabase.rpc('initialize_user_inventory');
      if (!rpcErr && invId) {
        const { data: fetchedInv } = await supabase
          .from('inventories')
          .select('*')
          .eq('id', invId)
          .single();
        if (fetchedInv) {
          return { ...fetchedInv, role: 'owner', is_owner: true };
        }
      }

      // 2. Fallback: Inserción directa en cliente
      const { data: directInv, error: insertErr } = await supabase
        .from('inventories')
        .insert({
          name: 'Mi Inventario Principal',
          description: 'Inventario inicial de trabajo',
          currency: 'USD',
          owner_id: currentUser.id
        })
        .select()
        .single();

      if (!insertErr && directInv) {
        await supabase.from('inventory_users').insert({
          inventory_id: directInv.id,
          user_id: currentUser.id,
          role: 'owner'
        });

        // Crear una ubicación física básica
        await supabase.from('locations').insert({
          inventory_id: directInv.id,
          name: 'Almacén Central',
          code: 'LOC-ALM-001',
          description: 'Almacén físico principal'
        });

        // Crear una categoría básica
        await supabase.from('categories').insert({
          inventory_id: directInv.id,
          name: 'General',
          color: '#3B82F6',
          description: 'Categoría predeterminada'
        });

        return { ...directInv, role: 'owner', is_owner: true };
      }
    } catch (e) {
      console.warn('Auto-inicialización no completada:', e);
    }
    return null;
  };

  // Cargar inventarios asociados al usuario (dueño o colaborador)
  const fetchInventories = async (currentUser: User) => {
    try {
      // 1. Inventarios donde es colaborador o dueño vía inventory_users
      const { data: memberInvs } = await supabase
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

      // 2. Inventarios donde es dueño directo
      const { data: ownedInvs } = await supabase
        .from('inventories')
        .select('*')
        .eq('owner_id', currentUser.id);

      let invList: Inventory[] = [];
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

      // Si aún no tiene ningún inventario, ejecutar auto-inicialización inmediata
      if (invList.length === 0) {
        const autoInv = await autoInitializeInventory(currentUser);
        if (autoInv) {
          invList = [autoInv];
        }
      }

      setInventories(invList);

      // Manejar la selección del inventario activo
      if (invList.length === 1) {
        // EXACTAMENTE 1 inventario: ENTRAR DIRECTO SIN MOSTRAR MODAL
        setCurrentInventory(invList[0]);
        setNeedsInventorySelection(false);
        localStorage.setItem(`active_inventory_${currentUser.id}`, invList[0].id);
      } else if (invList.length > 1) {
        // TIENE MÁS DE 1 INVENTARIO (Colaborativo o múltiples personales)
        // Desplegar la pantalla de selección "¿A qué inventario deseas ingresar hoy?"
        const savedInvId = localStorage.getItem(`active_inventory_${currentUser.id}`);
        const savedInv = invList.find((i) => i.id === savedInvId);
        setCurrentInventory(savedInv || invList[0]);
        setNeedsInventorySelection(true);
      } else {
        // Sin inventarios disponibles
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
