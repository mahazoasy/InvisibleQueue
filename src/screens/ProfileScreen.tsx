import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import md5 from 'md5';

export default function ProfileScreen() {
  const { user, isGuest, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isGuest && user?.email) {
      // 1. Vérifier si une photo existe déjà dans Supabase (ex: connexion Google)
      const supabaseAvatar = user.user_metadata?.avatar_url;
      if (supabaseAvatar) {
        setAvatarUrl(supabaseAvatar);
      } else {
        // 2. Sinon, utiliser Gravatar
        const emailHash = md5(user.email.trim().toLowerCase());
        setAvatarUrl(`https://www.gravatar.com/avatar/${emailHash}?d=identicon&s=200`);
      }
    }
  }, [user, isGuest]);

  const handleSignOut = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Erreur', 'Impossible de se déconnecter.');
          }
        },
      },
    ]);
  };

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1C3F" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            {isGuest ? (
              <Ionicons name="person-outline" size={36} color="#FFFFFF" />
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {displayName
                  .split(' ')
                  .map(w => w[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.heroName}>
            {isGuest ? 'Mode Invité' : displayName}
          </Text>
          <View style={styles.heroBadge}>
            <Ionicons
              name={isGuest ? 'walk-outline' : 'checkmark-circle'}
              size={13}
              color={isGuest ? '#F39C12' : '#2ECC71'}
            />
            <Text style={[styles.heroBadgeText, { color: isGuest ? '#F39C12' : '#2ECC71' }]}>
              {isGuest ? 'Invité' : 'Compte vérifié'}
            </Text>
          </View>
        </View>

        {/* Info Card (inchangée) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.card}>
            {isGuest ? (
              <View style={styles.guestInfo}>
                <Ionicons name="information-circle-outline" size={40} color="#F39C12" />
                <Text style={styles.guestTitle}>Navigation en mode invité</Text>
                <Text style={styles.guestText}>
                  Créez un compte pour accéder à toutes les fonctionnalités : création de files,
                  historique de vos passages et bien plus.
                </Text>
              </View>
            ) : (
              <>
                <InfoRow icon="person-outline" label="Nom" value={displayName} />
                <View style={styles.cardDivider} />
                <InfoRow icon="mail-outline" label="Email" value={user?.email || '—'} />
                <View style={styles.cardDivider} />
                <InfoRow
                  icon="shield-checkmark-outline"
                  label="Compte"
                  value="Vérifié"
                  valueColor="#2ECC71"
                />
              </>
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <View style={styles.card}>
            <InfoRow icon="layers-outline" label="Version" value="1.0.0" />
            <View style={styles.cardDivider} />
            <InfoRow icon="globe-outline" label="Application" value="Invisible Queue" />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
          <Text style={styles.logoutBtnText}>Déconnexion</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>Invisible Queue © 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={18} color="#1A73E8" />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1C3F' },
  container: { flexGrow: 1, backgroundColor: '#F7F9FC', paddingBottom: 40 },
  hero: {
    backgroundColor: '#0F1C3F',
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  heroBadgeText: { fontSize: 13, fontWeight: '700' },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A94A6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cardDivider: { height: 1, backgroundColor: '#F0F2F8', marginLeft: 56 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: { fontSize: 15, color: '#4A5568', fontWeight: '500', width: 64 },
  infoValue: { flex: 1, fontSize: 15, color: '#0F1C3F', fontWeight: '600', textAlign: 'right' },
  guestInfo: { alignItems: 'center', padding: 24, gap: 12 },
  guestTitle: { fontSize: 17, fontWeight: '700', color: '#0F1C3F', textAlign: 'center' },
  guestText: { fontSize: 14, color: '#8A94A6', textAlign: 'center', lineHeight: 21 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoutBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerNote: { textAlign: 'center', color: '#C5CDE0', fontSize: 12, marginTop: 28 },
});