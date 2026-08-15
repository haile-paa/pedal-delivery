import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage, Language } from "../../context/LanguageContext";

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const styles = getStyles(colors);

  const handleSelectLanguage = (lang: Language) => setLanguage(lang);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.white}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name='arrow-back' size={24} color={colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>{t("appearance")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons
                name={isDark ? "moon" : "moon-outline"}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t("darkMode")}</Text>
              <Text style={styles.rowSubtitle}>{t("darkModeDesc")}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.gray300, true: colors.primaryLight }}
              thumbColor={isDark ? colors.primary : colors.white}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t("language")}</Text>
        <View style={styles.card}>
          <Text style={styles.languageDesc}>{t("languageDesc")}</Text>

          <TouchableOpacity
            style={styles.languageOption}
            onPress={() => handleSelectLanguage("en")}
          >
            <View style={styles.rowIcon}>
              <Text style={styles.flagText}>🇬🇧</Text>
            </View>
            <Text style={[styles.rowTitle, styles.languageName]}>
              {t("english")}
            </Text>
            {language === "en" && (
              <Ionicons
                name='checkmark-circle'
                size={22}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.languageOption}
            onPress={() => handleSelectLanguage("am")}
          >
            <View style={styles.rowIcon}>
              <Text style={styles.flagText}>🇪🇹</Text>
            </View>
            <Text style={[styles.rowTitle, styles.languageName]}>
              {t("amharic")}
            </Text>
            {language === "am" && (
              <Ionicons
                name='checkmark-circle'
                size={22}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
      backgroundColor: colors.white,
    },
    backBtn: {
      width: 40,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.gray900,
    },
    headerRight: {
      width: 40,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.gray500,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 16,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.gray100,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.gray900,
    },
    rowSubtitle: {
      fontSize: 12,
      color: colors.gray500,
      marginTop: 2,
    },
    languageDesc: {
      fontSize: 12,
      color: colors.gray500,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
    },
    languageOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    languageName: {
      flex: 1,
    },
    flagText: {
      fontSize: 18,
    },
    divider: {
      height: 1,
      backgroundColor: colors.gray100,
      marginLeft: 60,
    },
  });

export default SettingsScreen;
