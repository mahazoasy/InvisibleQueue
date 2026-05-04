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

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Files à proximité' }} />
      <Stack.Screen name="CreateQueue" component={CreateQueueScreen} options={{ title: 'Créer une file' }} />
      <Stack.Screen name="ActiveQueue" component={ActiveQueueScreen} options={{ title: 'Ma position' }} />
      <Stack.Screen name="ManageQueue" component={ManageQueueScreen} options={{ title: 'Gérer la file' }} />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Files') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'Profil') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        headerShown: false, 
      })}
    >
      <Tab.Screen name="Files" component={HomeStack} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();

  if (loading) return null;

  const showLogin = !user && !isGuest;

  if (showLogin) {
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