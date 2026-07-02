import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { LogOut, ArrowLeft, User as UserIcon } from 'lucide-react-native';
import { Colors } from '../constants/theme';

const palette = Colors.light;

export default function ProfileScreen() {
    const { user, appMode, logout } = useContext(AuthContext);
    const router = useRouter();

    if (!user) return null;

    const roleLabel = user.role === 'hospital' ? 'Requester' : user.role;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color={palette.dark} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <UserIcon color={palette.tint} size={50} />
                    </View>
                </View>
                
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Name</Text>
                        <Text style={styles.value}>{user.name}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Role</Text>
                        <Text style={[styles.value, styles.roleValue]}>{roleLabel}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Blood Group</Text>
                        <Text style={styles.value}>{user.bloodGroup ? user.bloodGroup : 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Phone</Text>
                        <Text style={styles.value}>{user.phone || 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>App Mode</Text>
                        <Text style={[styles.value, styles.roleValue]}>{appMode === 'need' ? 'Need Blood' : appMode === 'donate' ? 'Donate Blood' : 'Not Selected'}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                    <LogOut color="#fff" size={20} />
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: palette.border },
    headerTitle: { fontSize: 18, fontWeight: '900', color: palette.dark },
    backBtn: { padding: 8, backgroundColor: palette.softSlate, borderRadius: 14 },
    container: { flexGrow: 1, padding: 24, alignItems: 'center' },
    avatarContainer: { marginBottom: 30, alignItems: 'center' },
    avatar: { width: 108, height: 108, borderRadius: 36, backgroundColor: palette.softRose, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: palette.border },
    infoCard: { width: '100%', backgroundColor: '#fff', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: palette.border, marginBottom: 30 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    label: { fontSize: 14, color: palette.muted, fontWeight: '700' },
    value: { fontSize: 16, fontWeight: '900', color: palette.dark },
    roleValue: { textTransform: 'capitalize' },
    divider: { height: 1, backgroundColor: palette.softSlate, marginVertical: 5 },
    logoutButton: { flexDirection: 'row', backgroundColor: palette.tint, padding: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', width: '100%' },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: '900', marginLeft: 10 }
});
