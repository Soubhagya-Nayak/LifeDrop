import React, { useCallback, useContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AuthContext } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Droplet, FileBadge, UploadCloud, UserPlus } from 'lucide-react-native';
import { Colors } from '../constants/theme';

const palette = Colors.light;

export default function RegisterScreen() {
    const { register, login } = useContext(AuthContext);
    const router = useRouter();
    
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [bloodGroup, setBloodGroup] = useState('A+');
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [aadhaarDocument, setAadhaarDocument] = useState(null);
    const [coords, setCoords] = useState(null);
    const [locationStatus, setLocationStatus] = useState('Location permission pending');
    const [loadingAction, setLoadingAction] = useState(false);

    const captureCurrentLocation = useCallback(async () => {
        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                setCoords(null);
                setLocationStatus('GPS is off. Please enable device location services.');
                Alert.alert('Turn On GPS', 'Please enable location services to continue registration.', [
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    { text: 'Cancel', style: 'cancel' },
                ]);
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setCoords(null);
                setLocationStatus('Location permission denied. Required to continue.');
                Alert.alert('Location Required', 'Please allow location access to create a LifeDrop account.', [
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    { text: 'Cancel', style: 'cancel' },
                ]);
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                mayShowUserSettingsDialog: true,
            }).catch(async () => {
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 300000,
                    requiredAccuracy: 1000,
                });
                if (lastKnown) return lastKnown;
                throw new Error('No location available');
            });
            const nextCoords = {
                latitude: Number(currentLocation.coords.latitude.toFixed(6)),
                longitude: Number(currentLocation.coords.longitude.toFixed(6)),
            };
            setCoords(nextCoords);
            setLocationStatus(`Location captured: ${nextCoords.latitude}, ${nextCoords.longitude}`);
        } catch {
            setCoords(null);
            setLocationStatus('Unable to fetch current location. Please retry.');
        }
    }, []);

    useEffect(() => {
        captureCurrentLocation();
    }, [captureCurrentLocation]);

    const pickAadhaarDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: ['image/*', 'application/pdf'],
            copyToCacheDirectory: true,
            multiple: false,
        });

        if (!result.canceled && result.assets?.[0]) {
            setAadhaarDocument(result.assets[0]);
        }
    };

    const handleRegister = async () => {
        if(!name || !phone || !password || !aadhaarNumber || !aadhaarDocument) {
            Alert.alert("Error", "Please fill all fields and upload Aadhaar card");
            return;
        }

        if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
            Alert.alert("Error", "Enter a valid 12-digit Aadhaar number");
            return;
        }

        if (!coords) {
            Alert.alert("Location Required", "Please grant location access before creating account");
            await captureCurrentLocation();
            return;
        }

        setLoadingAction(true);
        try {
            await register({
                name,
                phone,
                password,
                blood_group: bloodGroup,
                aadhaar_number: aadhaarNumber.trim(),
                aadhaar_document_name: aadhaarDocument.name,
                aadhaar_document_uri: aadhaarDocument.uri,
                latitude: coords.latitude,
                longitude: coords.longitude,
                role: 'donor'
            });
            await login(phone, password);
            router.replace('/');
        } catch (err) {
            Alert.alert("Registration Failed", err.response?.data?.msg || 'Error occurred');
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.header}>
                    <View style={styles.logoWrap}>
                        <Droplet color="#fff" size={32} />
                    </View>
                    <Text style={styles.title}>Join LifeDrop</Text>
                    <Text style={styles.subtitle}>Create your account first, then choose Donate or Need Blood inside the app.</Text>
                </View>

                <View style={styles.form}>
                    <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
                    <TextInput style={styles.input} placeholder="Phone Number" value={phone} keyboardType="phone-pad" onChangeText={setPhone} />
                    <TextInput style={styles.input} placeholder="Password" value={password} secureTextEntry onChangeText={setPassword} />

                    <Text style={styles.label}>Blood Group Code (e.g. A+, O-)</Text>
                    <TextInput style={styles.input} placeholder="A+" value={bloodGroup} onChangeText={setBloodGroup} />

                    <Text style={styles.label}>Aadhaar Number</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="12-digit Aadhaar number"
                        keyboardType="number-pad"
                        maxLength={12}
                        value={aadhaarNumber}
                        onChangeText={setAadhaarNumber}
                    />

                    <TouchableOpacity style={styles.uploadBox} onPress={pickAadhaarDocument}>
                        {aadhaarDocument ? <FileBadge color={palette.tint} size={22} /> : <UploadCloud color={palette.tint} size={22} />}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.uploadTitle}>
                                {aadhaarDocument ? aadhaarDocument.name : 'Upload Aadhaar Card'}
                            </Text>
                            <Text style={styles.uploadSubtitle}>PDF/JPG/PNG accepted for identity verification</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.locationBox} onPress={captureCurrentLocation}>
                        <Text style={styles.locationTitle}>Mandatory Phone Location</Text>
                        <Text style={styles.locationText}>{locationStatus}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.button} 
                        onPress={handleRegister}
                        disabled={loadingAction || !coords}
                    >
                        <UserPlus color="#fff" size={18} />
                        <Text style={styles.buttonText}>{loadingAction ? 'Creating...' : 'Create Account'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/login')}>
                        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Login</Text></Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 50 },
    header: { alignItems: 'center', marginBottom: 30 },
    logoWrap: {
        width: 72,
        height: 72,
        borderRadius: 28,
        backgroundColor: palette.tint,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: { fontSize: 32, fontWeight: '900', color: palette.dark, marginTop: 14 },
    subtitle: { marginTop: 8, fontSize: 14, fontWeight: '600', color: palette.muted },
    form: { backgroundColor: palette.card, padding: 24, borderRadius: 28, borderWidth: 1, borderColor: palette.border },
    label: { fontSize: 12, color: palette.muted, marginBottom: 8, marginTop: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
    input: { backgroundColor: palette.softSlate, padding: 15, borderRadius: 18, marginBottom: 16, fontSize: 16, fontWeight: '700', color: palette.dark, borderWidth: 1, borderColor: palette.border },
    uploadBox: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.softRose,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    uploadTitle: { fontSize: 14, fontWeight: '900', color: palette.dark },
    uploadSubtitle: { marginTop: 4, fontSize: 12, fontWeight: '600', color: palette.muted },
    locationBox: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.softSlate,
        padding: 16,
        marginBottom: 16,
    },
    locationTitle: { fontSize: 12, fontWeight: '900', color: palette.tint, textTransform: 'uppercase', letterSpacing: 1.4 },
    locationText: { marginTop: 6, fontSize: 13, fontWeight: '700', color: palette.dark },
    button: { backgroundColor: palette.tint, padding: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 10 },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
    linkButton: { marginTop: 20, alignItems: 'center' },
    linkText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
    linkHighlight: { color: palette.tint, fontWeight: '900' }
});
