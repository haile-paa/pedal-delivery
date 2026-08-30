import { Stack } from "expo-router";
import { enableScreens } from "react-native-screens";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStateProvider } from "../src/context/AppStateContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { LanguageProvider } from "../src/context/LanguageContext";
import { StatusBar } from "expo-status-bar";

// The adb logcat you sent nails this down exactly:
//   java.lang.IllegalStateException: addViewAt: failed to insert view
//   [850] into parent [858] at index 0
//   Caused by: The specified child already has a parent. You must call
//   removeView() on the child's parent first.
// That's not a bug in this app's code — it's a currently-open, unfixed bug
// in react-native-screens' "View Recycling" feature on Android's Fabric
// renderer (software-mansion/react-native-screens#3249, and the related
// #2803). In short: when Fabric mounts a screen, react-native-screens
// tries to reuse ("recycle") a native view that's still attached to its
// previous parent, and Fabric's mounting layer refuses the double-parent —
// crashing the whole app. It's a timing/ordering bug between two native
// systems, not something reachable by rearranging our own JS event
// handlers or navigation calls (which is why the double-submit guard and
// the animation-cancel/InteractionManager changes didn't stop it — they
// were reasonable things to rule out, but this crash was never in our
// code to begin with).
//
// react-native-screens' own README documents the official workaround for
// exactly this class of problem: enableScreens(false) makes every
// navigator in the app fall back to plain React Native Views instead of
// native Screen components, which sidesteps the recycling bug entirely.
// This does cost a little of the native performance/memory optimization
// react-native-screens normally provides — screen transitions are a
// little less GPU-optimized — but it trades that for the app no longer
// hard-crashing on login/logout. Worth revisiting (i.e. removing this)
// once react-native-screens ships a fixed release including the fix for
// #3249.
//
// This MUST run before any navigator/screen renders, so it's called here
// at module scope — outside and before the RootLayout component below —
// rather than inside a useEffect.
enableScreens(false);

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
