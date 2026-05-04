import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateQueueScreen from './src/screens/CreateQueueScreen';
import ActiveQueueScreen from './src/screens/ActiveQueueScreen';
import ManageQueueScreen from './src/screens/ManageQueueScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  CreateQueue: undefined;
  ActiveQueue: { entryId: string; queueId: string };
  ManageQueue: { queueId: string; queueName: string };
};

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();

  if (loading) return null;

  const showLogin = !user && !isGuest;

  return (
    <Stack.Navigator>
      {showLogin ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Files à proximité' }} />
          <Stack.Screen name="CreateQueue" component={CreateQueueScreen} options={{ title: 'Créer une file' }} />
          <Stack.Screen name="ActiveQueue" component={ActiveQueueScreen} options={{ title: 'Ma position' }} />
          <Stack.Screen name="ManageQueue" component={ManageQueueScreen} options={{ title: 'Gérer la file' }} />
        </>
      )}
    </Stack.Navigator>
  );
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