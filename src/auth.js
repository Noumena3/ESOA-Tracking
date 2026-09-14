import { supabaseClient } from './api.js';

export async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

export async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return true;
}
