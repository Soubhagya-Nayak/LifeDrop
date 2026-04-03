import React, { useState, createContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import api, { setUnauthorizedHandler } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [appMode, setAppModeState] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        setUnauthorizedHandler(() => {
            setAppModeState(null);
            setUser(null);
            delete api.defaults.headers.common['Authorization'];
            router.replace('/login');
        });

        const loadUser = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                const storedUser = await AsyncStorage.getItem('user');
                const storedAppMode = await AsyncStorage.getItem('appMode');
                
                if (token && storedUser) {
                    setUser(JSON.parse(storedUser));
                    if (storedAppMode) {
                        setAppModeState(storedAppMode);
                    }
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                }
            } catch (err) {
                console.log('Failed to load user', err);
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, [router]);

    useEffect(() => {
        if (loading) return;

        const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';

        if (!user && !inAuthScreen) {
            router.replace('/login');
        } else if (user && inAuthScreen) {
            router.replace('/');
        }
    }, [user, loading, segments, router]);

    const login = async (phone, password) => {
        const res = await api.post('/auth/login', { phone, password });
        await AsyncStorage.setItem('token', res.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        if (res.data.user.role === 'donor' || res.data.user.role === 'hospital') {
            await AsyncStorage.removeItem('appMode');
            setAppModeState(null);
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    };

    const register = async (userData) => {
        await api.post('/auth/register', userData);
    };

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('appMode');
        setAppModeState(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
        router.replace('/login');
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
        <AuthContext.Provider value={{ user, appMode, setAppMode, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
