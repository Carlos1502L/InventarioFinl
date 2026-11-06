import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Inventory, Profile, InventoryInvitation } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isInitialLoading: boolean;
  isInitialAuthCheck: boolean;
  inventories: Inventory[] | null;
  currentInventory: Inventory | null;
  needsInventorySelection: boolean;
  pendingInvitations: InventoryInvitation[];
  selectInventory: (inventory: Inventory | null) => void;
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
  const [isInitialAuthCheck, setIsInitialAuthCheck] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  
  // Multi-Tenancy State
  const [inventories, setInventories] = useState<Inventory[] | null>(null);
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

      // RF-INV-043: Actualizar el estado global con la lista real (vacía si el usuario eliminó todos los inventarios)
      setInventories(invList);

      if (invList.length === 0) {
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
        localStorage.removeItem(`active_inventory_${currentUser.id}`);
        return;
      }

      // RNF-02: Persistencia del inventario seleccionado
      // Al cambiar de pestaña o bloquear el teléfono, NO volver a preguntar si ya había uno seleccionado
      const savedInvId = localStorage.getItem(`active_inventory_${currentUser.id}`);
      const savedInv = invList.find((i) => i.id === savedInvId);

      if (invList.length === 1) {
        // Solo un inventario disponible: preservar identidad si no ha cambiado
        setCurrentInventory((prev) => {
          const next = invList[0];
          if (prev && prev.id === next.id) {
            return JSON.stringify(prev) !== JSON.stringify(next) ? next : prev;
          }
          return next;
        });
        setNeedsInventorySelection(false);
        localStorage.setItem(`active_inventory_${currentUser.id}`, invList[0].id);
      } else if (invList.length > 1) {
        if (savedInv) {
          // Ya tenía un inventario seleccionado previamente: persistir sin modal ni re-render innecesario
          setCurrentInventory((prev) => {
            if (prev && prev.id === savedInv.id) {
              return JSON.stringify(prev) !== JSON.stringify(savedInv) ? savedInv : prev;
            }
            return savedInv;
          });
          setNeedsInventorySelection(false);
        } else {
          // Primera vez con múltiples inventarios: preguntar solo si no había selección previa
          setCurrentInventory((prev) => {
            if (prev && invList.some((i) => i.id === prev.id)) {
              return prev;
            }
            setNeedsInventorySelection(true);
            return invList[0];
          });
        }
      } else {
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
      }
    } catch (err) {
      console.error('Error cargando inventarios:', err);
    }
  }, []);

  const selectInventory = (inventory: Inventory | null) => {
    setCurrentInventory(inventory);
    setNeedsInventorySelection(false);
    if (user) {
      if (inventory) {
        localStorage.setItem(`active_inventory_${user.id}`, inventory.id);
      } else {
        localStorage.removeItem(`active_inventory_${user.id}`);
      }
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
    let isMounted = true;

    // 1. Lectura de sesión inicial en almacenamiento (Arranque en frío)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      const initialUser = session?.user ?? null;
      setUser(initialUser);

      if (initialUser) {
        await fetchInventories(initialUser);
        if (initialUser.email) {
          await fetchPendingInvitations(initialUser.email);
        }
      } else {
        setInventories([]);
      }

      // Solo se apaga aquí una única vez en el ciclo de vida del arranque
      setIsInitialAuthCheck(false);
      setIsInitialLoading(false);
      setLoading(false);
    }).catch((err) => {
      console.error('Error verificando sesión inicial:', err);
      if (isMounted) {
        setInventories([]);
        setIsInitialAuthCheck(false);
        setIsInitialLoading(false);
        setLoading(false);
      }
    });

    // 2. Suscripción a cambios de auth (Segundo plano silencioso)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      // CRÍTICO: NUNCA activar loaders ni setIsInitialAuthCheck(true) aquí
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);

      if (event === 'SIGNED_OUT' || !newSession) {
        setInventories([]);
        setCurrentInventory(null);
        setNeedsInventorySelection(false);
        setPendingInvitations([]);
        return;
      }

      // TOKEN_REFRESHED, USER_UPDATED o reconexiones de red: silencioso en segundo plano
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        return;
      }

      // Si es un inicio de sesión genuino y no se tenían inventarios en memoria:
      if (event === 'SIGNED_IN' && newUser) {
        setInventories((prevInvs) => {
          if (!prevInvs || prevInvs.length === 0) {
            fetchInventories(newUser);
            if (newUser.email) {
              fetchPendingInvitations(newUser.email);
            }
          }
          return prevInvs;
        });
      }
    });

    return () => {
      isMounted = false;
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
        isInitialLoading,
        isInitialAuthCheck,
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
