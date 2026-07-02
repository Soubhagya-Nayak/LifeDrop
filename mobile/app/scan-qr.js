import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, QrCode } from 'lucide-react-native';
import api from '../services/api';
import { Colors } from '../constants/theme';

const palette = Colors.light;

export default function ScanQrScreen() {
    const router = useRouter();
    const { requestId } = useLocalSearchParams();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    const handleScan = async ({ data }) => {
        if (scanned) return;
        setScanned(true);

        try {
            const parsed = JSON.parse(data);
            if (requestId && String(parsed.request_id) !== String(requestId)) {
                Alert.alert('Wrong QR', 'This QR code does not match the selected patient request.');
                setScanned(false);
                return;
            }

            const res = await api.post('/donation/scan-patient-qr', { qrDataString: data });
            Alert.alert('Donation Confirmed', res.data.msg, [
                { text: 'OK', onPress: () => router.replace('/') },
            ]);
        } catch (err) {
            Alert.alert('Scan Failed', err.response?.data?.msg || 'Invalid QR code');
            setScanned(false);
        }
    };

    if (!permission) {
        return <View style={styles.center}><Text style={styles.infoText}>Loading camera permission...</Text></View>;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.center}>
                    <QrCode size={48} color={palette.tint} />
                    <Text style={styles.title}>Camera permission required</Text>
                    <Text style={styles.infoText}>Allow camera access to scan the patient QR code.</Text>
                    <TouchableOpacity style={styles.button} onPress={requestPermission}>
                        <Text style={styles.buttonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color={palette.dark} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Patient QR</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.cameraWrap}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanned ? undefined : handleScan}
                />
            </View>

            <Text style={styles.infoText}>Scan the QR shown by the patient/requester to verify the correct donation recipient.</Text>

            {scanned && (
                <TouchableOpacity style={styles.button} onPress={() => setScanned(false)}>
                    <Text style={styles.buttonText}>Scan Again</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background, padding: 20 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { padding: 8, backgroundColor: palette.softSlate, borderRadius: 14 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: palette.dark },
    cameraWrap: { flex: 1, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: palette.border },
    camera: { flex: 1 },
    title: { marginTop: 16, fontSize: 22, fontWeight: '900', color: palette.dark },
    infoText: { marginTop: 16, fontSize: 14, fontWeight: '600', color: palette.muted, textAlign: 'center', lineHeight: 22 },
    button: { marginTop: 20, backgroundColor: palette.tint, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 24 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
});
