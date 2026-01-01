import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import { colors } from "../../theme/colors";
import DocumentUpload from "../../components/driver/DocumentUpload";
import { useRouter } from "expo-router";

const DocumentsScreen: React.FC = () => {
  const router = useRouter();
  const [documents, setDocuments] = useState([
    {
      id: "1",
      title: "Driver License",
      description: "Front and back of valid driver license",
      status: "approved" as const,
      uploadedAt: new Date("2024-01-15"),
    },
    {
      id: "2",
      title: "Vehicle Registration",
      description: "Current vehicle registration document",
      status: "approved" as const,
      uploadedAt: new Date("2024-01-15"),
    },
    {
      id: "3",
      title: "Insurance Certificate",
      description: "Valid insurance certificate",
      status: "pending" as const,
      uploadedAt: new Date("2024-01-20"),
    },
    {
      id: "4",
      title: "Background Check",
      description: "Completed background check report",
      status: "rejected" as const,
      uploadedAt: new Date("2024-01-18"),
      rejectionReason: "Document expired. Please upload current document.",
    },
  ]);

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDocumentUpload = async (file: any) => {
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 1) {
          clearInterval(interval);
          return 1;
        }
        return prev + 0.1;
      });
    }, 200);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    clearInterval(interval);
    setUploadProgress(0);

    // Add new document
    const newDocument = {
      id: Math.random().toString(36).substr(2, 9),
      title: file.name.split(".")[0],
      description: "Newly uploaded document",
      status: "pending" as const,
      uploadedAt: new Date(),
    };

    setDocuments((prev) => [newDocument, ...prev]);
    Alert.alert(
      "Success",
      "Document uploaded successfully! It will be reviewed within 24 hours."
    );
  };

  const handleResubmit = (documentId: string) => {
    Alert.alert("Resubmit Document", "Please upload the updated document", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Upload",
        onPress: () => {
          // In a real app, this would open the document picker
          Alert.alert("Upload", "Document picker would open here");
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return colors.success;
      case "pending":
        return colors.warning;
      case "rejected":
        return colors.error;
      default:
        return colors.gray500;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending":
        return "Under Review";
      case "rejected":
        return "Rejected";
      default:
        return "Unknown";
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.subtitle}>
            Upload and manage your driver documents
          </Text>
        </View>

        {/* Required Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Documents</Text>
          <Text style={styles.sectionDescription}>
            Upload these documents to start delivering
          </Text>

          <DocumentUpload
            title='Driver License'
            description='Front and back of valid driver license'
            acceptedTypes={["public.image", "public.pdf"]}
            onUpload={handleDocumentUpload}
            progress={uploadProgress}
            status='uploaded'
          />

          <DocumentUpload
            title='Vehicle Registration'
            description='Current vehicle registration document'
            acceptedTypes={["public.image", "public.pdf"]}
            onUpload={handleDocumentUpload}
            progress={uploadProgress}
            status='uploaded'
          />

          <DocumentUpload
            title='Insurance Certificate'
            description='Valid insurance certificate'
            acceptedTypes={["public.image", "public.pdf"]}
            onUpload={handleDocumentUpload}
            progress={uploadProgress}
            status='uploading'
          />

          <DocumentUpload
            title='Background Check'
            description='Completed background check report'
            acceptedTypes={["public.image", "public.pdf"]}
            onUpload={handleDocumentUpload}
            progress={uploadProgress}
            status='error'
          />
        </View>

        {/* Document Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Status</Text>

          <View style={styles.statusContainer}>
            <View style={styles.statusCard}>
              <Text style={styles.statusNumber}>2</Text>
              <Text style={styles.statusLabel}>Approved</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusNumber}>1</Text>
              <Text style={styles.statusLabel}>Pending</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusNumber}>1</Text>
              <Text style={styles.statusLabel}>Rejected</Text>
            </View>
          </View>
        </View>

        {/* Uploaded Documents List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uploaded Documents</Text>

          {documents.map((document) => (
            <View key={document.id} style={styles.documentItem}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>{document.title}</Text>
                <Text style={styles.documentDescription}>
                  {document.description}
                </Text>
                <Text style={styles.documentDate}>
                  Uploaded: {document.uploadedAt.toLocaleDateString()}
                </Text>

                {document.status === "rejected" && (
                  <Text style={styles.rejectionReason}>
                    ❌ {document.rejectionReason}
                  </Text>
                )}
              </View>

              <View style={styles.documentStatus}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(document.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(document.status) },
                    ]}
                  >
                    {getStatusText(document.status)}
                  </Text>
                </View>

                {document.status === "rejected" && (
                  <TouchableOpacity
                    style={styles.resubmitButton}
                    onPress={() => handleResubmit(document.id)}
                  >
                    <Text style={styles.resubmitButtonText}>Resubmit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📋 Important Information</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>
              • All documents must be clear and readable
            </Text>
            <Text style={styles.infoItem}>
              • Expired documents will be rejected
            </Text>
            <Text style={styles.infoItem}>
              • Review process takes 24-48 hours
            </Text>
            <Text style={styles.infoItem}>
              • You'll be notified when documents are approved
            </Text>
            <Text style={styles.infoItem}>
              • Keep documents updated for continuous service
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray600,
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusCard: {
    flex: 1,
    alignItems: "center",
  },
  statusNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  documentItem: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: colors.gray500,
  },
  rejectionReason: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    fontStyle: "italic",
  },
  documentStatus: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  resubmitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resubmitButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },
  infoSection: {
    backgroundColor: colors.info + "10",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.info + "30",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.info,
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
});

export default DocumentsScreen;
