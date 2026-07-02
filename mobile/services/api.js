import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

let unauthorizedHandler = null;

const resolveApiBaseUrl = () => {
    const rawHost =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.debuggerHost ||
        Constants.manifest?.debuggerHost ||
        Constants.manifest2?.extra?.expoClient?.hostUri ||
        '';

    const host = rawHost
        .replace(/^https?:\/\//, '')
        .split(':')[0]
        .trim();

    if (host) {
        return `http://${host}:5000/api`;
    }

    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:5000/api';
    }

    return 'http://localhost:5000/api';
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || resolveApiBaseUrl();

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await AsyncStorage.multiRemove(['token', 'user', 'appMode']);
            if (unauthorizedHandler) {
                unauthorizedHandler();
            }
        }

        if (!error.response) {
            error.message = `Unable to reach LifeDrop backend at ${API_URL}. Check server and network.`;
        }
        return Promise.reject(error);
    }
);

export default api;

export const setUnauthorizedHandler = (handler) => {
    unauthorizedHandler = handler;
};

export { API_URL };
