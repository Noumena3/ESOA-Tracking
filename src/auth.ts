import { supabaseClient } from './api';

export async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

export async function signIn(email: string, password: string) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut(): Promise<boolean> {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return true;
}
