import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";

export type AuthStackParamList = {
  Login: undefined;
  OTP: { phone: string };
  Name: { uid: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

function TempScreen() {
  return null;
}

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={TempScreen} />
      <Stack.Screen name="Name" component={TempScreen} />
    </Stack.Navigator>
  );
}
