/**
 * AuthContext.js
 *
 * Provides auth state and navigation guard for the LifeDrop app.
 *
 * Expo Router rule: useRouter() / useSegments() are safe to call in any
 * component that is rendered INSIDE a <Stack> / <Tabs> navigator — which
 * includes _layout.js itself, because Expo Router wraps _layout.js
 * inside its own NavigationContainer before it calls your default export.
 *
 * However, calling router.replace() during the very first render (before
 * the navigator finishes mounting) still throws a warning.  We guard
 * against that with a small useEffect that waits one tick.
 */

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import api, { setUnauthorizedHandler } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser]           = useState(null);
    const [appMode, setAppModeState] = useState(null);
    const [loading, setLoading]     = useState(true);

    const router   = useRouter();
    const segments = useSegments();

    // Track whether the initial async load is complete so the navigation
    // guard only fires after we know the real auth state.
    const initialized = useRef(false);

    // ── 401 handler ─────────────────────────────────────────────────────────
    const forceLogout = useCallback(async () => {
        await AsyncStorage.multiRemove(['token', 'user', 'appMode']);
        setAppModeState(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
    }, []);

    // ── Bootstrap: load persisted session ───────────────────────────────────
    useEffect(() => {
        setUnauthorizedHandler(forceLogout);

        const loadUser = async () => {
            try {
                const token       = await AsyncStorage.getItem('token');
                const storedUser  = await AsyncStorage.getItem('user');
                const storedMode  = await AsyncStorage.getItem('appMode');

                if (token && storedUser) {
                    const parsed = JSON.parse(storedUser);
                    setUser(parsed);
                    if (storedMode) setAppModeState(storedMode);
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                }
            } catch (err) {
                console.warn('[AuthContext] Failed to restore session:', err.message);
            } finally {
                setLoading(false);
                initialized.current = true;
            }
        };

        loadUser();
    }, [forceLogout]);

    // ── Navigation guard ─────────────────────────────────────────────────────
    // Runs after every change to user / loading / segments.
    // The `initialized.current` check prevents premature redirects before the
    // async storage read finishes.
    useEffect(() => {
        if (loading || !initialized.current) return;

        const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';

        if (!user && !inAuthScreen) {
            router.replace('/login');
        } else if (user && inAuthScreen) {
            router.replace('/');
        }
    }, [user, loading, segments, router]);

    // ── Auth actions ─────────────────────────────────────────────────────────
    const login = async (phone, password) => {
        const res = await api.post('/auth/login', { phone, password });
        await AsyncStorage.setItem('token', res.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        await AsyncStorage.removeItem('appMode');
        setAppModeState(null);
        setUser(res.data.user);
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    };

    const register = async (userData) => {
        await api.post('/auth/register', userData);
    };

    const logout = async () => {
        await forceLogout();
        // Navigation guard will redirect to /login when user becomes null
    };

    const setAppMode = async (mode) => {
        if (mode) {
            await AsyncStorage.setItem('appMode', mode);
        } else {
            await AsyncStorage.removeItem('appMode');
        }
        setAppModeState(mode);
    };

    return (
        <AuthContext.Provider
            value={{ user, appMode, setAppMode, loading, login, register, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
};
