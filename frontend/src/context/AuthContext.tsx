import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Inventory, Profile, InventoryInvitation } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  inventories: Inventory[];
  currentInventory: Inventory | null;
  needsInventorySelection: boolean;
  pendingInvitations: InventoryInvitation[];
  selectInventory: (inventory: Inventory) => void;
  refreshInventories: () => Promise<void>;
  setNeedsInventorySelection: (show: boolean) => void;
  acceptInvitation: (invitationId: string, inventoryId: string, role: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
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
  const [pendingInvitations, setPendingInvitations] = useState<InventoryInvitation[]>([]);

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
          owner_id: currentUser.id,
          inventory_type: 'BUSINESS'
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

  // RF-05.1: Cargar invitaciones pendientes de colaboradores
  const fetchPendingInvitations = useCallback(async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory_invitations')
        .select(`
          *,
          inventories (id, name, description, currency, owner_id)
        `)
        .eq('email', email.trim().toLowerCase())
        .eq('status', 'pending');

      if (!error && data) {
        setPendingInvitations(data as InventoryInvitation[]);
      }
    } catch (err) {
      console.warn('Error cargando invitaciones pendientes:', err);
    }
  }, []);

  // Cargar inventarios asociados al usuario (dueño o colaborador)
  const fetchInventories = useCallback(async (currentUser: User) => {
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
            inventory_type,
            yape_phone,
            yape_qr_url,
            plin_phone,
            plin_qr_url,
            payment_instructions,
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

      // RNF-02: Persistencia del inventario seleccionado
      // Al cambiar de pestaña o bloquear el teléfono, NO volver a preguntar si ya había uno seleccionado
      const savedInvId = localStorage.getItem(`active_inventory_${currentUser.id}`);
      const savedInv = invList.find((i) => i.id === savedInvId);

      if (invList.length === 1) {
        // Solo un inventario disponible
        setCurrentInventory(invList[0]);
        setNeedsInventorySelection(false);
        localStorage.setItem(`active_inventory_${currentUser.id}`, invList[0].id);
      } else if (invList.length > 1) {
        if (savedInv) {
          // Ya tenía un inventario seleccionado previamente: persistir sin modal
          setCurrentInventory(savedInv);
          setNeedsInventorySelection(false);
        } else {
          // Primera vez con múltiples inventarios: preguntar
          setCurrentInventory(invList[0]);
          setNeedsInventorySelection(true);
        }
      } else {
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
      }
    } catch (err) {
      console.error('Error cargando inventarios:', err);
    }
  }, []);

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
      if (user.email) {
        await fetchPendingInvitations(user.email);
      }
    }
  };

  // RF-05.1: Aceptar explícitamente una invitación a colaborar
  const acceptInvitation = async (invitationId: string, inventoryId: string, role: string) => {
    if (!user) return;
    try {
      const { error: memberError } = await supabase.from('inventory_users').insert({
        inventory_id: inventoryId,
        user_id: user.id,
        role: role || 'collaborator'
      });

      if (memberError && memberError.code !== '23505') {
        throw memberError;
      }

      await supabase
        .from('inventory_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (user.email) {
        await fetchPendingInvitations(user.email);
      }
      await fetchInventories(user);
    } catch (err: any) {
      console.error('Error aceptando invitación:', err);
      alert('Error al aceptar invitación: ' + (err.message || 'Error desconocido'));
    }
  };

  // RF-05.1: Rechazar explícitamente una invitación
  const rejectInvitation = async (invitationId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('inventory_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);

      if (user.email) {
        await fetchPendingInvitations(user.email);
      }
    } catch (err: any) {
      console.error('Error rechazando invitación:', err);
    }
  };

  // RNF-03: Control de Sesión en PWA - Expiración por inactividad tras 15 minutos
  useEffect(() => {
    if (!user) return;

    let lastActivity = Date.now();
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutos

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        alert('Tu sesión ha expirado por inactividad (15 minutos). Por seguridad, vuelve a iniciar sesión.');
        signOut();
      }
    }, 30000); // Revisión periódica cada 30 segundos

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    // 1. Obtener sesión activa inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchInventories(session.user);
        if (session.user.email) {
          fetchPendingInvitations(session.user.email);
        }
      }
      setLoading(false);
    });

    // 2. Suscribirse a cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchInventories(session.user);
        if (session.user.email) {
          fetchPendingInvitations(session.user.email);
        }
      } else {
        setInventories([]);
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
        setPendingInvitations([]);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchInventories, fetchPendingInvitations]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      await fetchInventories(data.user);
      if (data.user.email) {
        await fetchPendingInvitations(data.user.email);
      }
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
    if (user) {
      localStorage.removeItem(`active_inventory_${user.id}`);
    }
    await supabase.auth.signOut();
    setCurrentInventory(null);
    setInventories([]);
    setPendingInvitations([]);
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
        pendingInvitations,
        selectInventory,
        refreshInventories,
        setNeedsInventorySelection,
        acceptInvitation,
        rejectInvitation,
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
