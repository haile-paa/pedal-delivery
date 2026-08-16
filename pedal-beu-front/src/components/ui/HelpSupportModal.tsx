import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

// Single source of truth for the support contact details — update here and
// every screen that shows them (this modal, and the tel:/mailto: links)
// stays in sync.
export const SUPPORT_PHONE = "+251909585090";
export const SUPPORT_PHONE_DISPLAY = "+251 909 585 090";
export const SUPPORT_EMAIL = "wubealuke888@gmail.com";

interface HelpSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

  const handleCall = () => Linking.openURL(`tel:${SUPPORT_PHONE}`);
  const handleEmail = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.headerIconWrap}>
                  <Ionicons
                    name='help-buoy'
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.closeButton}
                >
                  <Ionicons
                    name='close'
                    size={20}
                    color={colors.gray500}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>{t("helpAndSupport")}</Text>
              <Text style={styles.subtitle}>{t("supportSubtitle")}</Text>

              <TouchableOpacity
                style={styles.row}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name='call' size={18} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t("supportPhoneLabel")}</Text>
                  <Text style={styles.rowValue}>{SUPPORT_PHONE_DISPLAY}</Text>
                </View>
                <Ionicons
                  name='chevron-forward'
                  size={18}
                  color={colors.gray400}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.row}
                onPress={handleEmail}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name='mail' size={18} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t("supportEmailLabel")}</Text>
                  <Text style={styles.rowValue}>{SUPPORT_EMAIL}</Text>
                </View>
                <Ionicons
                  name='chevron-forward'
                  size={18}
                  color={colors.gray400}
                />
              </TouchableOpacity>

              <View style={styles.row}>
                <View style={[styles.rowIconWrap, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons
                    name='chatbubble-ellipses'
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>
                    {t("supportLiveChatLabel")}
                  </Text>
                  <Text style={styles.rowValue}>
                    {t("supportLiveChatValue")}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCall}
                activeOpacity={0.85}
              >
                <Ionicons name='call' size={16} color='#FFFFFF' />
                <Text style={styles.primaryButtonText}>
                  {t("callSupport")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleEmail}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryButtonText}>
                  {t("emailSupport")}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: isDark ? colors.primaryGlow : "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.35 : 0.18,
      shadowRadius: 24,
      elevation: 12,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    headerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primary + "18",
      justifyContent: "center",
      alignItems: "center",
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.gray100,
    },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      color: colors.gray900,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.gray600,
      marginBottom: 20,
      lineHeight: 20,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    rowIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    rowText: {
      flex: 1,
    },
    rowLabel: {
      fontSize: 12,
      color: colors.gray500,
      marginBottom: 2,
    },
    rowValue: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.gray900,
    },
    primaryButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      marginTop: 20,
      gap: 8,
      shadowColor: isDark ? colors.primaryGlow : "transparent",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.45 : 0,
      shadowRadius: 12,
      elevation: isDark ? 4 : 0,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryButton: {
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 14,
      marginTop: 8,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default HelpSupportModal;
