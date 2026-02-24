import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface Photosession {
    id?: string;
    userId: string;
    status: "draft" | "processing" | "completed" | "failed";
    faceReferences: string[];
    officeReferences: string[];
    results: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export const sessionService = {
    async saveSession(userId: string, data: Partial<Photosession>) {
        try {
            const docRef = await addDoc(collection(db, "sessions"), {
                ...data,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: data.status || "draft",
            });
            return docRef.id;
        } catch (error) {
            console.error("Error saving session:", error);
            throw error;
        }
    },

    async updateSession(sessionId: string, data: Partial<Photosession>) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating session:", error);
            throw error;
        }
    },

    async getUserSessions(userId: string) {
        try {
            // Simplified query without orderBy to avoid "tank-like" performance 
            // caused by missing composite indexes on Firestore.
            const q = query(
                collection(db, "sessions"),
                where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            const sessions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Photosession[];

            // Sort locally (instant)
            return sessions.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
        } catch (error) {
            console.error("Error getting user sessions:", error);
            throw error;
        }
    }
};
