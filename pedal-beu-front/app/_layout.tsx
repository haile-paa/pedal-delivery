import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStateProvider } from "../src/context/AppStateContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { LanguageProvider } from "../src/context/LanguageContext";
import { StatusBar } from "expo-status-bar";

function RootStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name='index' />
        {/* These three routes are where the app hands off between entirely
            different navigator groups — auth stack to customer tabs on
            login, tabs back to auth stack on logout, driver tabs to auth
            stack, etc. That handoff is exactly where the recurring
            "addViewAt: failed to insert view ... already has a parent"
            native crash has been happening (right after login, right after
            logout, and worst when login/logout fire in quick succession).
            It's a known react-native-screens bug on Android's Fabric
            renderer where its view-recycling optimization can race with an
            in-flight transition animation. Turning the animation off for
            just these three top-level group boundaries removes that race
            without affecting in-group screen transitions (which still use
            the default slide). */}
        <Stack.Screen name='(auth)' options={{ animation: "none" }} />
        <Stack.Screen name='(customer)' options={{ animation: "none" }} />
        <Stack.Screen name='(driver)' options={{ animation: "none" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppStateProvider>
              <RootStack />
            </AppStateProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
