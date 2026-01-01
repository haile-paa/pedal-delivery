import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import DocumentPicker from "react-native-document-picker";
import * as Progress from "react-native-progress";

interface DocumentUploadProps {
  title: string;
  description: string;
  acceptedTypes?: string[];
  onUpload: (file: any) => Promise<void>;
  progress?: number;
  status?: "pending" | "uploading" | "uploaded" | "error";
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  title,
  description,
  acceptedTypes = ["public.item"],
  onUpload,
  progress = 0,
  status = "pending",
}) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const scaleAnim = useSharedValue(1);
  const shakeAnim = useSharedValue(0);

  const selectFile = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: acceptedTypes,
      });

      if (res[0]) {
        setFileName(res[0].name);
        setFileSize(res[0].size);

        // Start upload
        setIsUploading(true);
        await onUpload(res[0]);
        setIsUploading(false);
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
      } else {
        Alert.alert("Error", "Failed to select file");
        shakeAnim.value = withSequence(
          withSpring(-10),
          withSpring(10),
          withSpring(-5),
          withSpring(5),
          withSpring(0)
        );
      }
    }
  };

  const handlePress = () => {
    if (status === "uploaded") return;

    scaleAnim.value = withSequence(
      withSpring(0.95),
      withSpring(1, {}, () => {
        selectFile();
      })
    );
  };

  const getStatusColor = () => {
    switch (status) {
      case "uploaded":
        return colors.success;
      case "error":
        return colors.error;
      case "uploading":
        return colors.primary;
      default:
        return colors.gray300;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "uploaded":
        return "checkmark-circle";
      case "error":
        return "alert-circle";
      case "uploading":
        return "time";
      default:
        return "document-attach";
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }, { translateX: shakeAnim.value }],
  }));

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={status === "uploaded" || isUploading}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
          status === "uploaded" && styles.containerUploaded,
          status === "error" && styles.containerError,
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={getStatusIcon() as any}
            size={32}
            color={getStatusColor()}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {fileName && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
              {fileSize && (
                <Text style={styles.fileSize}>
                  {(fileSize / 1024 / 1024).toFixed(2)} MB
                </Text>
              )}
            </View>
          )}

          {isUploading && (
            <View style={styles.progressContainer}>
              <Progress.Bar
                progress={progress}
                width={null}
                height={8}
                color={colors.primary}
                borderRadius={4}
                borderWidth={0}
              />
              <Text style={styles.progressText}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          )}

          {status === "error" && (
            <Text style={styles.errorText}>Upload failed. Tap to retry.</Text>
          )}
        </View>

        <View style={styles.actionContainer}>
          {status === "pending" && !isUploading && (
            <Ionicons name='cloud-upload' size={20} color={colors.gray400} />
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.gray200,
    marginVertical: 8,
  },
  containerUploaded: {
    borderColor: colors.success,
    backgroundColor: colors.success + "10",
  },
  containerError: {
    borderColor: colors.error,
    backgroundColor: colors.error + "10",
  },
  iconContainer: {
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 8,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  fileName: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
    marginRight: 8,
  },
  fileSize: {
    fontSize: 12,
    color: colors.gray500,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressText: {
    fontSize: 12,
    color: colors.gray600,
    textAlign: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
  },
  actionContainer: {
    marginLeft: 8,
  },
});

export default DocumentUpload;
