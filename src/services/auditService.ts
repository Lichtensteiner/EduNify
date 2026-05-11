import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  category: 'attendance' | 'grades' | 'homework' | 'discipline' | 'management' | 'security' | 'finance' | 'canteen';
  timestamp: any;
}

export const recordAuditLog = async (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...log,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
  }
};

export const subscribeToRecentLogs = (callback: (logs: AuditLog[]) => void) => {
  // Calculate 24 hours ago
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const q = query(
    collection(db, 'audit_logs'),
    where('timestamp', '>=', Timestamp.fromDate(twentyFourHoursAgo)),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuditLog[];
    callback(logs);
  }, (error) => {
    console.error("Error fetching audit logs:", error);
    // If index is missing, we might need to fallback to client-side filtering initially
  });
};
