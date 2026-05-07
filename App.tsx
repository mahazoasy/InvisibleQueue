import React from 'react';
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
import { View, Text } from 'react-native';

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
          title: 'Files à proximité',
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
              <Ionicons name="time" size={20} color={BRAND} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 17, fontWeight: '800', color: DARK }}>Invisible Queue</Text>
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
          return <Ionicons name={(focused ? cfg.active : cfg.inactive) as any} size={size} color={color} />;
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
      <Tab.Screen name="Profil" component={ProfileScreen} options={{ tabBarLabel: 'Profil', headerShown: true, headerTitle: 'Mon profil', ...headerOptions }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();
  if (loading) return null;
  if (!user && !isGuest) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }
  return <AppTabs />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}