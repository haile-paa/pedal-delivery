import { Stack } from "expo-router";
import { View } from "react-native";
import { useTheme, ForceLightTheme } from "../../src/context/ThemeContext";

// No GlobalThemeToggle here on purpose: the welcome/auth flow always renders
// in the light theme and in the device's default language. Dark mode and
// language switching are only offered once the person is signed in
// (Settings screen, plus the floating toggle in the customer/driver tabs).
//
// ForceLightTheme wraps the stack so every screen's own useTheme() call
// gets the light palette too, regardless of the signed-in user's saved
// dark-mode preference — these screens were never designed against dark
// colors (low-contrast text, washed-out gradients), so previously a
// returning user with dark mode on would land here to a half-broken login
// screen.
function AuthLayoutContent() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
    </View>
  );
}

export default function AuthLayout() {
  return (
    <ForceLightTheme>
      <AuthLayoutContent />
    </ForceLightTheme>
  );
}
