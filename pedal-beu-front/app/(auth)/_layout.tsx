import { Stack } from "expo-router";
import { colors } from "../../src/theme/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name='welcome' />
      <Stack.Screen name='phone-verification' />
      <Stack.Screen name='profile-setup' />
    </Stack>
  );
}
