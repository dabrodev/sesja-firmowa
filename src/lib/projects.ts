import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface Project {
    id?: string;
    userId: string;
    name: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export const projectService = {
    async createProject(userId: string, name: string) {
        try {
            const docRef = await addDoc(collection(db, "projects"), {
                userId,
                name,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating project:", error);
            throw error;
        }
    },

    async updateProject(projectId: string, data: Partial<Project>) {
        try {
            const docRef = doc(db, "projects", projectId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating project:", error);
            throw error;
        }
    },

    async getUserProjects(userId: string) {
        try {
            const q = query(
                collection(db, "projects"),
                where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            const projects = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[];

            return projects.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
        } catch (error) {
            console.error("Error getting user projects:", error);
            throw error;
        }
    },

    async getProjectById(projectId: string): Promise<Project | null> {
        try {
            const docRef = doc(db, "projects", projectId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...docSnap.data()
                } as Project;
            }
            return null;
        } catch (error) {
            console.error("Error getting project by ID:", error);
            throw error;
        }
    },

    async deleteProject(projectId: string) {
        try {
            const docRef = doc(db, "projects", projectId);
            await deleteDoc(docRef);
            // Note: Cloud Functions or rules should ideally handle deleting
            // all sub-sessions, or we do it carefully in the frontend.
        } catch (error) {
            console.error("Error deleting project:", error);
            throw error;
        }
    }
};
