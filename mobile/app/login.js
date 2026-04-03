import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Droplet, ShieldCheck } from 'lucide-react-native';
import { Colors } from '../constants/theme';

const palette = Colors.light;

export default function LoginScreen() {
    const { login } = useContext(AuthContext);
    const router = useRouter();
    
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loadingAction, setLoadingAction] = useState(false);

    const handleLogin = async () => {
        if (!phone || !password) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }
        setLoadingAction(true);
        try {
            await login(phone, password);
            router.replace('/');
        } catch (err) {
            Alert.alert("Login Failed", err.response?.data?.msg || err.message || "Invalid credentials");
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoWrap}>
                        <Droplet color="#fff" size={36} />
                    </View>
                    <Text style={styles.title}>LifeDrop</Text>
                    <Text style={styles.subtitle}>Sign in to coordinate lifesaving donations</Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Phone Number"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity 
                        style={styles.button} 
                        onPress={handleLogin}
                        disabled={loadingAction}
                    >
                        <ShieldCheck color="#fff" size={18} />
                        <Text style={styles.buttonText}>{loadingAction ? 'Signing in...' : 'Sign In'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/register')}>
                        <Text style={styles.linkText}>Do not have an account? <Text style={styles.linkHighlight}>Register</Text></Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoWrap: {
        width: 74,
        height: 74,
        borderRadius: 28,
        backgroundColor: palette.tint,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: palette.dark,
        marginTop: 16,
    },
    subtitle: {
        fontSize: 14,
        color: palette.muted,
        marginTop: 8,
        fontWeight: '600',
        textAlign: 'center',
    },
    form: {
        backgroundColor: palette.card,
        padding: 24,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: palette.border,
    },
    input: {
        backgroundColor: palette.softSlate,
        padding: 16,
        borderRadius: 18,
        marginBottom: 16,
        fontSize: 16,
        fontWeight: '700',
        color: palette.dark,
        borderWidth: 1,
        borderColor: palette.border,
    },
    button: {
        backgroundColor: palette.tint,
        padding: 16,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkText: {
        color: palette.muted,
        fontSize: 14,
        fontWeight: '600',
    },
    linkHighlight: {
        color: palette.tint,
        fontWeight: '900',
    }
});
