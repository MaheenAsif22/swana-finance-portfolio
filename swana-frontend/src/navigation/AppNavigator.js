import React, { useEffect } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store/auth.store';
import { C, F } from '../utils/theme';

import LoginScreen          from '../screens/LoginScreen';
import DashboardScreen      from '../screens/DashboardScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import PostBalanceScreen    from '../screens/PostBalanceScreen';
import ApprovalsScreen      from '../screens/ApprovalsScreen';
import HistoryScreen        from '../screens/HistoryScreen';
import ReportsScreen        from '../screens/ReportsScreen';
import TxDetailScreen       from '../screens/TxDetailScreen';
import ImportScreen         from '../screens/ImportScreen';
import ImportReviewScreen   from '../screens/ImportReviewScreen';
import KnowledgeScreen      from '../screens/KnowledgeScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const HEADER = { headerStyle: { backgroundColor: C.bg }, headerTintColor: C.primary, headerShadowVisible: false };

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

function MainTabs() {
  const role = useAuthStore((s) => s.user?.role);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: C.border, backgroundColor: C.white },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: F.xs, fontWeight: '500' },
      }}
    >
      <Tab.Screen name="Home"      component={DashboardScreen} options={{ tabBarLabel: 'Home',     tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="History"   component={HistoryScreen}   options={{ tabBarLabel: 'Ledger',   tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
      {role === 'owner' && (
        <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ tabBarLabel: 'Approvals', tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} /> }} />
      )}
      <Tab.Screen name="Reports"   component={ReportsScreen}   options={{ tabBarLabel: 'Reports',  tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, ready, hydrate } = useAuthStore();

  useEffect(() => { hydrate(); }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={HEADER}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main"          component={MainTabs}             options={{ headerShown: false }} />
            <Stack.Screen name="AddTx"         component={AddTransactionScreen} options={{ title: 'Add Transaction', presentation: 'modal' }} />
            <Stack.Screen name="PostBalance"   component={PostBalanceScreen}    options={{ title: 'Post Opening Balance', presentation: 'modal' }} />
            <Stack.Screen name="TxDetail"      component={TxDetailScreen}       options={{ title: 'Transaction Details' }} />
            <Stack.Screen name="Approvals"     component={ApprovalsScreen}      options={{ title: 'Pending Approvals' }} />
            <Stack.Screen name="Import"        component={ImportScreen}         options={{ title: 'Import from WhatsApp' }} />
            <Stack.Screen name="ImportReview"  component={ImportReviewScreen}   options={{ title: 'Review Import', headerBackVisible: false }} />
            <Stack.Screen name="Knowledge"     component={KnowledgeScreen}      options={{ title: 'Payee Dictionary' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
