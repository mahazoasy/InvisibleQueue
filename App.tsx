import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CreateQueueScreen from './src/screens/CreateQueueScreen';
import ActiveQueueScreen from './src/screens/ActiveQueueScreen';
import ManageQueueScreen from './src/screens/ManageQueueScreen';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// On prévient l'auto-hide pour pouvoir le contrôler manuellement
SplashScreen.preventAutoHideAsync();

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  CreateQueue: undefined;
  ActiveQueue: { entryId: string; queueId: string };
  ManageQueue: { queueId: string; queueName: string };
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const BRAND = '#1A73E8';
const DARK = '#0F1C3F';
const GRAY = '#8A94A6';

const headerOptions = {
  headerStyle: { backgroundColor: '#FFFFFF', elevation: 0, shadowOpacity: 0 },
  headerTintColor: DARK,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17, color: DARK },
  headerBackTitleVisible: false,
  headerBackImage: () => (
    <Ionicons name="chevron-back" size={24} color={DARK} style={{ marginLeft: 8 }} />
  ),
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
              <Image
                source={require('./assets/splash-icons.png')}
                style={{ width: 22, height: 22, marginRight: 6, tintColor: BRAND }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 17, fontWeight: '800', color: DARK }}>
                Invisible Queue
              </Text>
            </View>
          ),
          headerTitle: () => null,
        }}
      />
      <Stack.Screen
        name="CreateQueue"
        component={CreateQueueScreen}
        options={{ title: 'Nouvelle file' }}
      />
      <Stack.Screen
        name="ActiveQueue"
        component={ActiveQueueScreen}
        options={{ title: 'Ma position', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="ManageQueue"
        component={ManageQueueScreen}
        options={({ route }) => ({
          title: route.params?.queueName || 'Gestion',
          headerBackTitle: '',
        })}
      />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { active: string; inactive: string }> = {
            Files: { active: 'list', inactive: 'list-outline' },
            Profil: { active: 'person', inactive: 'person-outline' },
          };
          const cfg = icons[route.name] || { active: 'home', inactive: 'home-outline' };
          return (
            <Ionicons
              name={(focused ? cfg.active : cfg.inactive) as any}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E8EBF2',
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Files" component={HomeStack} options={{ tabBarLabel: 'Files' }} />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          headerShown: true,
          headerTitle: 'Mon profil',
          ...headerOptions,
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();
  if (loading) return null;
  if (!user && !isGuest) {
    return (
      <Stack.Navigator>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }
  return <AppTabs />;
}

// ─── Splash JS animé ──────────────────────────────────────────────────────────
// Durée totale visible : ~2.5 secondes avant de passer à l'app
const SPLASH_VISIBLE_MS = 2500;

function CustomSplash({ onFinish }: { onFinish: () => void }) {
  const logoScale       = useRef(new Animated.Value(0.5)).current;
  const logoOpacity     = useRef(new Animated.Value(0)).current;
  const titleOpacity    = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const bgOpacity       = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Logo pop-in avec rebond
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 55,
          friction: 7,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // 2. Titre glisse vers le haut
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
      // 3. Sous-titre fade-in
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      // 4. Pause lisible
      Animated.delay(SPLASH_VISIBLE_MS - 1400),
      // 5. Fondu de sortie
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: bgOpacity }]}>
      {/* Cercles décoratifs */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Logo */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          marginBottom: 36,
        }}
      >
        <View style={styles.logoCircle}>
          <Image
            source={require('./assets/splash-icons.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Titre */}
      <Animated.Text
        style={[
          styles.splashTitle,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          },
        ]}
      >
        Invisible Queue
      </Animated.Text>

      {/* Sous-titre */}
      <Animated.Text style={[styles.splashSubtitle, { opacity: subtitleOpacity }]}>
        Files d'attente virtuelles
      </Animated.Text>

      {/* Points indicateurs en bas */}
      <Animated.View style={[styles.splashDots, { opacity: subtitleOpacity }]}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // On cache IMMÉDIATEMENT le splash natif Expo (l'écran gris avec les cercles)
    // Notre splash JS prend le relai dès le premier render
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!splashDone) {
    return <CustomSplash onFinish={() => setSplashDone(true)} />;
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0F1C3F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(26, 115, 232, 0.06)',
    bottom: -60,
    left: -60,
  },
  logoCircle: {
    width: 130,
    height: 130,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 20,
  },
  logoImage: {
    width: 84,
    height: 84,
    tintColor: '#FFFFFF',
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  splashSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '400',
    textAlign: 'center',
  },
  splashDots: {
    position: 'absolute',
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 22,
    borderRadius: 3,
    backgroundColor: '#1A73E8',
  },
});