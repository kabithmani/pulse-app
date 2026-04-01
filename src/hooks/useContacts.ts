'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Contact } from '@/lib/types';

export function useContacts(userId?: string) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (!error) setContacts(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const createContact = useCallback(async (contact: Partial<Contact>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...contact, user_id: userId })
      .select()
      .single();
    if (error) { console.error(error); return null; }
    await fetchContacts();
    return data;
  }, [userId, fetchContacts]);

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error(error); return null; }
    await fetchContacts();
    return data;
  }, [fetchContacts]);

  const deleteContact = useCallback(async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id);
    await fetchContacts();
  }, [fetchContacts]);

  // Find or create a contact by name
  const findOrCreateByName = useCallback(async (name: string) => {
    const existing = contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return createContact({ name });
  }, [contacts, createContact]);

  return { contacts, loading, createContact, updateContact, deleteContact, findOrCreateByName, refetch: fetchContacts };
}
