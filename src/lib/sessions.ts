import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
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
    name: string;
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
            // Compute default name based on existing sessions if not provided
            let finalName = data.name;
            if (!finalName) {
                const existing = await this.getUserSessions(userId);
                finalName = `Sesja ${existing.length + 1} (${new Date().toLocaleDateString('pl-PL')})`;
            }

            const docRef = await addDoc(collection(db, "sessions"), {
                ...data,
                userId,
                name: finalName,
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

    async appendResults(sessionId: string, newResults: string[]) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            const { arrayUnion } = await import("firebase/firestore");
            await updateDoc(docRef, {
                results: arrayUnion(...newResults),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error appending results to session:", error);
            throw error;
        }
    },

    async getUserSessions(userId: string) {
        try {
            const q = query(
                collection(db, "sessions"),
                where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            const sessions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Photosession[];

            return sessions.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
        } catch (error) {
            console.error("Error getting user sessions:", error);
            throw error;
        }
    },

    async getSessionById(sessionId: string): Promise<Photosession | null> {
        try {
            const docRef = doc(db, "sessions", sessionId);
            const { getDoc } = await import("firebase/firestore");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...docSnap.data()
                } as Photosession;
            }
            return null;
        } catch (error) {
            console.error("Error getting session by ID:", error);
            throw error;
        }
    },

    async deleteSession(sessionId: string) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting session:", error);
            throw error;
        }
    }
};
