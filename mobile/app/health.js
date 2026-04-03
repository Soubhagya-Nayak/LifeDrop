import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Switch, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import api from '../services/api';
import { Colors } from '../constants/theme';

const palette = Colors.light;

export default function HealthScreen() {
    const router = useRouter();
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [hasFever, setHasFever] = useState(false);
    const [hasHiv, setHasHiv] = useState(false);
    const [hasHepatitis, setHasHepatitis] = useState(false);
    const [recentSurgery, setRecentSurgery] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!age || !weight) {
            Alert.alert('Error', 'Please enter your age and weight');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/health/submit', {
                age: parseInt(age),
                weight: parseFloat(weight),
                has_fever: hasFever,
                has_hiv: hasHiv,
                has_hepatitis: hasHepatitis,
                recent_surgery: recentSurgery
            });
            Alert.alert(
                'Assessment Complete', 
                `Status: ${res.data.eligibility_status}\n\n${res.data.eligibility_status === 'Eligible' ? 'You are eligible to donate!' : 'Unfortunately, you do not meet the health requirements at this time.'}`,
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (_err) {
            Alert.alert('Error', 'Failed to submit health info.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color={palette.dark} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health Eligibility</Text>
                <View style={{ width: 24 }} />
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.instructions}>Please answer truthfully. This ensures the safety of everyone.</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Age (years)</Text>
                        <TextInput style={styles.input} placeholder="e.g. 25" keyboardType="numeric" value={age} onChangeText={setAge} />
                    </View>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Weight (kg)</Text>
                        <TextInput style={styles.input} placeholder="e.g. 68" keyboardType="numeric" value={weight} onChangeText={setWeight} />
                    </View>

                    <View style={styles.switchesCard}>
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Do you currently have a fever?</Text>
                            <Switch value={hasFever} onValueChange={setHasFever} trackColor={{ false: "#d1d5db", true: "#fca5a5" }} thumbColor={hasFever ? "#e60000" : "#f3f4f6"} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Have you ever been diagnosed with HIV?</Text>
                            <Switch value={hasHiv} onValueChange={setHasHiv} trackColor={{ false: "#d1d5db", true: "#fca5a5" }} thumbColor={hasHiv ? "#e60000" : "#f3f4f6"} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Do you have Hepatitis B or C?</Text>
                            <Switch value={hasHepatitis} onValueChange={setHasHepatitis} trackColor={{ false: "#d1d5db", true: "#fca5a5" }} thumbColor={hasHepatitis ? "#e60000" : "#f3f4f6"} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Surgery in the last 6 months?</Text>
                            <Switch value={recentSurgery} onValueChange={setRecentSurgery} trackColor={{ false: "#d1d5db", true: "#fca5a5" }} thumbColor={recentSurgery ? "#e60000" : "#f3f4f6"} />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
                        <ShieldCheck color="#fff" size={18} />
                        <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit & Check Status'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: palette.border },
    headerTitle: { fontSize: 18, fontWeight: '900', color: palette.dark },
    backBtn: { padding: 8, backgroundColor: palette.softSlate, borderRadius: 14 },
    container: { flexGrow: 1, padding: 24 },
    instructions: { fontSize: 15, color: palette.muted, marginBottom: 20, lineHeight: 22, fontWeight: '600' },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 12, fontWeight: '900', color: palette.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border, padding: 16, borderRadius: 18, fontSize: 16, fontWeight: '700', color: palette.dark },
    switchesCard: { backgroundColor: '#fff', borderRadius: 28, padding: 18, borderWidth: 1, borderColor: palette.border, marginBottom: 30 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    switchLabel: { flex: 1, fontSize: 14, color: palette.dark, paddingRight: 10, fontWeight: '700' },
    divider: { height: 1, backgroundColor: palette.softSlate },
    submitButton: { backgroundColor: palette.dark, padding: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
